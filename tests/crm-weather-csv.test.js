import test from "node:test";
import assert from "node:assert/strict";
import * as w from "../src/lib/crm/weather.js";
import * as csv from "../src/lib/crm/csv.js";

/* Datos de prueba: valores inventados SOLO para verificar la aritmética; no son pronósticos reales. */
const COMUNAS = [
  { id: 1, region_id: "RM", nombre: "A", tiendas_abiertas: 6 },
  { id: 2, region_id: "RM", nombre: "B", tiendas_abiertas: 2 },
  { id: 3, region_id: "RM", nombre: "C", tiendas_abiertas: 0 }, // sin tiendas: no pesa
  { id: 4, region_id: "V", nombre: "D", tiendas_abiertas: 4 },
];
const row = (comuna_id, fecha, p) => ({ comuna_id, fecha, prob_precip: p, obtenido_el: "2026-10-13", fuente: "PRUEBA" });

test("clima: bandas con cortes por defecto y personalizados", () => {
  assert.equal(w.bandIndex(null), null);
  assert.equal(w.bandIndex(0), 0);
  assert.equal(w.bandIndex(19), 0);
  assert.equal(w.bandIndex(20), 1);
  assert.equal(w.bandIndex(59), 2);
  assert.equal(w.bandIndex(60), 3);
  assert.equal(w.bandIndex(80), 4);
  assert.equal(w.bandIndex(100), 4);
  assert.equal(w.bandIndex(50, [10, 30, 50, 70]), 3);
  assert.deepEqual(w.normalizeCortes([40, 20, 60, 80]), w.CORTES_POR_DEFECTO); // no crecientes → fábrica
  assert.deepEqual(w.normalizeCortes([10, 30, 50, 70]), [10, 30, 50, 70]);
  assert.equal(w.bandRangeLabel(4), "80 % o más");
  assert.equal(w.bandRangeLabel(0), "0 a 19 %");
});

test("clima: promedio regional ponderado por tiendas abiertas", () => {
  const idx = w.indexForecast([row(1, "2026-10-15", 90), row(2, "2026-10-15", 10), row(4, "2026-10-15", 0)]);
  const rm = w.regionDay(COMUNAS, idx, "RM", "2026-10-15");
  // (90*6 + 10*2) / 8 = 70
  assert.equal(rm.prob, 70);
  assert.equal(rm.comunasConDato, 2);
  assert.equal(rm.comunasTotal, 2); // la comuna sin tiendas abiertas no se cuenta
  assert.equal(rm.tiendasConDato, 8);
  assert.equal(rm.parcial, false);
  const todas = w.regionDay(COMUNAS, idx, "todas", "2026-10-15");
  assert.equal(todas.prob, Math.round((90 * 6 + 10 * 2 + 0 * 4) / 12)); // 47
  assert.equal(todas.comunasTotal, 3);
});

test("clima: sin dato no hay valor; con cobertura parcial se avisa", () => {
  const idx = w.indexForecast([row(1, "2026-10-15", 50)]);
  assert.equal(w.regionDay(COMUNAS, idx, "RM", "2026-10-20"), null);
  assert.equal(w.regionDay(COMUNAS, idx, "V", "2026-10-15"), null);
  const parcial = w.regionDay(COMUNAS, idx, "RM", "2026-10-15");
  assert.equal(parcial.prob, 50);
  assert.equal(parcial.parcial, true);
  assert.equal(parcial.comunasConDato, 1);
  assert.equal(parcial.tiendasConDato, 6);
  assert.equal(parcial.tiendasTotal, 8);
});

test("clima: horizonte honesto (pasado / pronóstico / tendencia)", () => {
  assert.equal(w.horizonKind("2026-10-12", "2026-10-13", 7), "pasado");
  assert.equal(w.horizonKind("2026-10-13", "2026-10-13", 7), "pronostico");
  assert.equal(w.horizonKind("2026-10-19", "2026-10-13", 7), "pronostico");
  assert.equal(w.horizonKind("2026-10-20", "2026-10-13", 7), "tendencia");
});

test("clima: sugerencia solo si más de la mitad de las tiendas supera el umbral", () => {
  const idx = w.indexForecast([row(1, "d", 70), row(2, "d", 10)]);
  const day = w.regionDay(COMUNAS, idx, "RM", "d");
  // tiendas con ≥60 %: 6 de 8 = 75 %
  const s = w.rainSuggestion(day, { umbral: 60, proporcion: 50 });
  assert.ok(s);
  assert.equal(s.etiqueta, "Sugerencia, requiere validación humana");
  assert.equal(w.rainSuggestion(day, { umbral: 60, proporcion: 80 }), null);
  assert.equal(w.rainSuggestion(null), null);
  const idx2 = w.indexForecast([row(1, "d", 10), row(2, "d", 90)]);
  assert.equal(w.rainSuggestion(w.regionDay(COMUNAS, idx2, "RM", "d")), null); // solo 25 % de tiendas
});

/* ------------------------------ CSV ------------------------------ */
const CAT = [
  { id: "t1", lista: "titulo", nombre: "Cyber Preunic" },
  { id: "e1", lista: "estado", nombre: "Pendiente", semantica: "pendiente" },
  { id: "e2", lista: "estado", nombre: "Enviado", semantica: "enviado" },
  { id: "x1", lista: "einstein", nombre: "Einstein Open" },
  { id: "c1", lista: "configuracion", nombre: "Medio" },
];
const RESP = [{ id: "r1", nombre: "Cristobal Cuevas", iniciales: "CCu", email: "persona@ejemplo.test" }];
const names = { catalogo: (id) => (CAT.find((c) => c.id === id) || {}).nombre || "", responsable: (id) => (RESP.find((r) => r.id === id) || {}).nombre || "" };

test("csv: exportar con ; y BOM, comillas y protección contra fórmulas", () => {
  const out = csv.mailingsToCSV([
    { fecha: "2026-10-15", hora: "10:00:00", titulo_id: "t1", responsable_id: "r1", einstein_id: "x1", configuracion_id: "c1", estado_id: "e1", segmento: 'Clientes "VIP"; activos', objetivo: "=1+1", observaciones: "línea1\nlínea2", enviado_en: null, id_externo: "" },
  ], names);
  assert.ok(out.startsWith("﻿Fecha;Hora;Título;"));
  assert.ok(out.includes('15/10/2026;10:00;Cyber Preunic;Cristobal Cuevas;Einstein Open;Medio;Pendiente;"Clientes ""VIP""; activos"'));
  assert.ok(out.includes("'=1+1"));
  assert.ok(out.includes('"línea1\nlínea2"'));
});

test("csv: lo exportado se vuelve a importar sin errores (ida y vuelta)", () => {
  const original = { fecha: "2026-10-15", hora: "10:00", titulo_id: "t1", responsable_id: "r1", einstein_id: "x1", configuracion_id: "c1", estado_id: "e2", segmento: 'Clientes "VIP"; activos', objetivo: "=1+1", observaciones: "a\nb", enviado_en: "2026-10-15", id_externo: "X-1" };
  const text = csv.mailingsToCSV([original], names);
  const p = csv.previewImport(text, { catalogo: CAT, responsables: RESP, existentes: [] });
  assert.equal(p.errorGeneral, null);
  assert.equal(p.filas.length, 1);
  assert.deepEqual(p.filas[0].errores, []);
  const d = p.filas[0].data;
  assert.equal(d.fecha, "2026-10-15"); assert.equal(d.hora, "10:00"); assert.equal(d.titulo_id, "t1"); assert.equal(d.responsable_id, "r1");
  assert.equal(d.estado_id, "e2"); assert.equal(d.segmento, original.segmento); assert.equal(d.objetivo, "=1+1"); assert.equal(d.observaciones, "a\nb"); assert.equal(d.id_externo, "X-1");
});

test("csv: validación por fila (fecha, hora, catálogos, responsable) y títulos nuevos", () => {
  const text = [
    "Fecha;Título;Estado;Responsable;Einstein;Hora",
    "15/10/2026;Cyber Preunic;Pendiente;CCu;Einstein Open;09:30",
    "31/04/2026;Cyber Preunic;Pendiente;;;",
    "16/10/2026;Título Nuevo;;;;",
    "17/10/2026;Cyber Preunic;Archivado;Nadie;Otro Einstein;25:00",
    "mañana;;Pendiente;;;",
  ].join("\n");
  const p = csv.previewImport(text, { catalogo: CAT, responsables: RESP, existentes: [] });
  assert.equal(p.delimiter, ";");
  assert.equal(p.filas.length, 5);
  assert.equal(p.filas[0].ok, true);
  assert.equal(p.filas[0].data.responsable_id, "r1");
  assert.ok(p.filas[1].errores[0].startsWith("Fecha inválida"));
  assert.equal(p.filas[2].ok, true);
  assert.equal(p.filas[2].tituloNuevo, "Título Nuevo");
  assert.equal(p.filas[2].data.estado_id, "e1"); // sin estado → Pendiente
  assert.equal(p.filas[3].errores.length, 4); // estado, responsable, einstein y hora
  assert.equal(p.filas[4].errores.length, 2); // fecha y título
  assert.equal(p.filas.filter((f) => f.ok).length, 2);
});

test("csv: duplicados contra lo existente y dentro del archivo", () => {
  const existentes = [{ fecha: "2026-10-15", titulo_id: "t1", segmento: "Activos", hora: "10:00:00" }];
  const text = ["Fecha;Título;Segmento;Hora", "15/10/2026;Cyber Preunic;Activos;10:00", "15/10/2026;Cyber Preunic;Inactivos;10:00", "15/10/2026;Cyber Preunic;Inactivos;10:00"].join("\n");
  const p = csv.previewImport(text, { catalogo: CAT, responsables: RESP, existentes });
  assert.deepEqual(p.filas.map((f) => f.duplicada), [true, false, true]);
});

test("csv: separador coma, comillas y archivos inválidos", () => {
  const p = csv.previewImport('Fecha,Título\n2026-10-15,"Cyber, Preunic"\n', { catalogo: [...CAT, { id: "t2", lista: "titulo", nombre: "Cyber, Preunic" }], responsables: [], existentes: [] });
  assert.equal(p.delimiter, ",");
  assert.equal(p.filas[0].data.titulo_id, "t2");
  assert.ok(csv.previewImport("", {}).errorGeneral);
  assert.ok(csv.previewImport("Fecha;Marca\n01/01/2026;X", { catalogo: [], responsables: [] }).errorGeneral.includes("Título"));
  assert.ok(csv.previewImport('Fecha;Título\n01/01/2026;"abierta', { catalogo: [], responsables: [] }).errorGeneral.includes("comillas"));
  assert.ok(csv.previewImport("Fecha;Título", { catalogo: [], responsables: [] }).errorGeneral.includes("No hay filas"));
  assert.ok(csv.previewImport("x".repeat(csv.MAX_IMPORT_BYTES + 1), {}).errorGeneral.includes("2 MB"));
});

test("clima: el crédito en pantalla corresponde al proveedor de los datos", () => {
  assert.equal(w.creditoClima([]), "");
  assert.equal(w.creditoClima(undefined), "");
  assert.equal(w.creditoClima(["PRUEBA"]), "");
  assert.equal(w.creditoClima(["OpenWeather One Call 3.0", "OpenWeather One Call 3.0"]), w.CREDITO_OPENWEATHER);
  assert.equal(w.creditoClima(["Google Maps Platform Weather API"]), w.CREDITO_GOOGLE);
  // si por un cambio de proveedor conviven ambas fuentes, se muestran los dos créditos
  const ambos = w.creditoClima(["Google Maps Platform Weather API", null, "OpenWeather One Call 3.0"]);
  assert.ok(ambos.includes(w.CREDITO_OPENWEATHER) && ambos.includes(w.CREDITO_GOOGLE));
  assert.deepEqual(w.proveedoresClima(["Google Maps Platform Weather API", undefined]), ["google"]);
  assert.deepEqual(w.proveedoresClima([]), []);
});
