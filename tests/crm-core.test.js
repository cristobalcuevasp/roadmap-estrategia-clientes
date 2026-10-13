/* Pruebas de la lógica pura del módulo CRM (calendario, días de pago, clima, CSV).
   Se ejecutan con:  node tests/run.mjs   (agrupa con esbuild si está disponible) */
import test from "node:test";
import assert from "node:assert/strict";
import * as cal from "../src/lib/crm/calendar.js";
import * as opp from "../src/lib/crm/opportunity.js";

// Feriados nacionales cargados en la migración 0003 (2026-2027), solo los de los meses probados.
const F = (fecha, nombre) => ({ fecha, nombre, ambito: "nacional", activo: true });
const FERIADOS = [
  F("2026-09-18", "Independencia Nacional"), F("2026-09-19", "Glorias del Ejército"),
  F("2026-10-12", "Encuentro de Dos Mundos"), F("2026-10-31", "Iglesias Evangélicas"),
  F("2026-11-01", "Todos los Santos"), F("2026-12-08", "Inmaculada Concepción"), F("2026-12-25", "Navidad"),
  F("2027-01-01", "Año Nuevo"),
];
const REGLAS = [
  { id: "r1", nombre: "Último día hábil del mes", nivel: "alta", tipo: "ultimo_habil", params: { n: 1 }, justificacion: "J1", activo: true, orden: 1 },
  { id: "r2", nombre: "Primeros días hábiles del mes", nivel: "alta", tipo: "primeros_habiles", params: { n: 2 }, justificacion: "J2", activo: true, orden: 2 },
  { id: "r3", nombre: "Días previos al último día hábil", nivel: "media", tipo: "previos_ultimo_habil", params: { n: 2 }, justificacion: "J3", activo: true, orden: 3 },
  { id: "r4", nombre: "Días hábiles 3 a 5", nivel: "media", tipo: "habiles_rango", params: { desde: 3, hasta: 5 }, justificacion: "J4", activo: true, orden: 4 },
  { id: "r5", nombre: "Quincena", nivel: "media", tipo: "dias_del_mes", params: { dias: [15, 16] }, justificacion: "J5", activo: true, orden: 5 },
  { id: "r6", nombre: "Fin de semana tras pago", nivel: "media", tipo: "fin_de_semana_tras_pago", params: {}, justificacion: "J6", activo: false, orden: 6 },
];
const nivelesDe = (y, m, extra = {}) => {
  const map = opp.classifyMonth(y, m, extra.reglas || REGLAS, extra.feriados || FERIADOS, extra.manuales || []);
  const out = { alta: [], media: [] };
  for (const [iso, v] of map) if (v.nivel !== "normal") out[v.nivel].push(iso.slice(8));
  return out;
};

test("calendario: día de la semana, semana ISO y lunes", () => {
  assert.equal(cal.weekdayIdx("2026-10-12"), 0); // lunes
  assert.equal(cal.weekdayIdx("2026-11-01"), 6); // domingo
  assert.equal(cal.mondayOf("2026-11-01"), "2026-10-26");
  assert.equal(cal.isoWeek("2026-10-12"), 42);
  assert.equal(cal.isoWeek("2026-12-31"), 53); // 2026 tiene 53 semanas ISO
  assert.equal(cal.isoWeek("2027-01-01"), 53);
  assert.equal(cal.isoWeek("2027-01-04"), 1);
});

test("calendario: grilla mensual lunes a domingo", () => {
  const g = cal.monthGrid(2026, 10);
  assert.equal(g.length, 5);
  assert.equal(g[0][0], "2026-09-28");
  assert.equal(g[0][3], "2026-10-01");
  assert.equal(g[4][6], "2026-11-01");
  g.forEach((w) => assert.equal(w.length, 7));
  const f = cal.monthGrid(2026, 2); // febrero 2026 empieza en domingo
  assert.equal(f[0][0], "2026-01-26");
  assert.equal(f[f.length - 1][6], "2026-03-01");
});

test("calendario: sumar meses y días respeta el fin de mes y el cambio de hora", () => {
  assert.equal(cal.addMonthsISO("2026-01-31", 1), "2026-02-28");
  assert.equal(cal.addMonthsISO("2027-01-31", 1), "2027-02-28");
  assert.equal(cal.addMonthsISO("2028-01-31", 1), "2028-02-29");
  assert.equal(cal.addMonthsISO("2026-11-15", 2), "2027-01-15");
  assert.equal(cal.addDaysISO("2026-09-05", 1), "2026-09-06"); // cambio de hora en Chile
  assert.equal(cal.addDaysISO("2026-04-04", 1), "2026-04-05");
  assert.equal(cal.addDaysISO("2026-12-31", 1), "2027-01-01");
});

test("calendario: fechas flexibles (DD/MM/AAAA e ISO) y validación", () => {
  assert.equal(cal.parseFlexibleDate("15/10/2026"), "2026-10-15");
  assert.equal(cal.parseFlexibleDate("5-3-2026"), "2026-03-05");
  assert.equal(cal.parseFlexibleDate("2026-10-15"), "2026-10-15");
  assert.equal(cal.parseFlexibleDate("31/04/2026"), null);
  assert.equal(cal.parseFlexibleDate("29/02/2027"), null);
  assert.equal(cal.parseFlexibleDate("29/02/2028"), "2028-02-29");
  assert.equal(cal.parseFlexibleDate("basura"), null);
  assert.equal(cal.fmtDMY("2026-10-05"), "05/10/2026");
});

test("días de pago: octubre 2026 (12/10 y 31/10 son feriados)", () => {
  const r = nivelesDe(2026, 10);
  // días hábiles: 1,2 | 5-9 | 13-16 | 19-23 | 26-30 (12 feriado). Primeros 2 = 1 y 2; hábil 3-5 = 5,6,7; último = 30; previos = 28 y 29; quincena = 15 y 16.
  assert.deepEqual(r.alta, ["01", "02", "30"]);
  assert.deepEqual(r.media, ["05", "06", "07", "15", "16", "28", "29"]);
});

test("días de pago: noviembre 2026 (el 1 es domingo y feriado; el 30 es lunes)", () => {
  const r = nivelesDe(2026, 11);
  // hábiles: 2..6, 9..13, 16..20, 23..27, 30 → primeros 2 = 2 y 3; hábil 3 a 5 = 4, 5 y 6; previos = 26 y 27; el 15 es domingo (no se marca) y el 16 sí
  assert.deepEqual(r.alta, ["02", "03", "30"]);
  assert.deepEqual(r.media, ["04", "05", "06", "16", "26", "27"]);
});

test("días de pago: diciembre 2026 (8 y 25 feriados)", () => {
  const r = nivelesDe(2026, 12);
  // hábiles: 1..4, 7, 9..11, 14..18, 21..24, 28..31 → último = 31; previos = 29 y 30; primeros = 1 y 2; 3 a 5 = 3, 4, 7
  assert.deepEqual(r.alta, ["01", "02", "31"]);
  assert.deepEqual(r.media, ["03", "04", "07", "15", "16", "29", "30"]);
});

test("días de pago: mes que termina en domingo (enero 2027) → último hábil es el viernes 29", () => {
  const m = opp.classifyMonth(2027, 1, REGLAS, FERIADOS, []);
  assert.equal(m.get("2027-01-31").nivel, "normal"); // domingo
  assert.equal(m.get("2027-01-30").nivel, "normal"); // sábado
  assert.equal(m.get("2027-01-29").nivel, "alta");
  assert.equal(m.get("2027-01-29").razones[0].detalle, "Último día hábil del mes");
  assert.equal(m.get("2027-01-01").nivel, "normal"); // feriado, no hábil
  assert.equal(m.get("2027-01-04").nivel, "alta");   // primer hábil
  assert.equal(m.get("2027-01-05").nivel, "alta");
});

test("días de pago: un feriado (de prueba) el 2/10 desplaza el conteo de días hábiles", () => {
  const conFeriado = opp.classifyMonth(2026, 10, REGLAS, [...FERIADOS, F("2026-10-02", "Feriado de prueba")], []);
  assert.equal(conFeriado.get("2026-10-01").nivel, "alta");
  assert.equal(conFeriado.get("2026-10-02").nivel, "normal"); // ya no es hábil
  assert.equal(conFeriado.get("2026-10-05").nivel, "alta");   // segundo día hábil
  assert.equal(conFeriado.get("2026-10-06").nivel, "media");  // tercer día hábil
});

test("días de pago: alta gana a media y las razones quedan registradas", () => {
  const m = opp.classifyMonth(2026, 10, REGLAS, FERIADOS, []);
  const d = m.get("2026-10-30");
  assert.equal(d.nivel, "alta");
  assert.ok(d.razones.length >= 1);
  assert.equal(d.razones[0].nivel, "alta");
  assert.ok(opp.explain(d).includes("J1"));
  // Un día cubierto por una regla alta y una media debe quedar en alta y listar ambas
  const dos = opp.classifyMonth(2026, 10, [
    { id: "a", nombre: "A", nivel: "media", tipo: "primeros_habiles", params: { n: 3 }, activo: true, orden: 1 },
    { id: "b", nombre: "B", nivel: "alta", tipo: "primeros_habiles", params: { n: 1 }, activo: true, orden: 2 },
  ], FERIADOS, []);
  assert.equal(dos.get("2026-10-01").nivel, "alta");
  assert.equal(dos.get("2026-10-01").razones.length, 2);
  assert.equal(dos.get("2026-10-02").nivel, "media");
});

test("días de pago: el ajuste manual manda sobre las reglas y explica la diferencia", () => {
  const m = opp.classifyMonth(2026, 10, REGLAS, FERIADOS, [
    { fecha: "2026-10-30", nivel: "normal", motivo: "Pago adelantado" },
    { fecha: "2026-10-20", nivel: "alta", motivo: "Cyber" },
  ]);
  assert.equal(m.get("2026-10-30").nivel, "normal");
  assert.equal(m.get("2026-10-30").calculado, "alta");
  assert.ok(opp.explain(m.get("2026-10-30")).includes("Pago adelantado"));
  assert.ok(opp.explain(m.get("2026-10-30")).includes("Las reglas darían: Alta oportunidad"));
  assert.equal(m.get("2026-10-20").nivel, "alta");
  assert.equal(m.get("2026-10-20").calculado, "normal");
});

test("días de pago: reglas desactivadas no se aplican y feriados inactivos no cuentan", () => {
  const sinReglas = REGLAS.map((r) => ({ ...r, activo: false }));
  const m = opp.classifyMonth(2026, 10, sinReglas, FERIADOS, []);
  assert.ok([...m.values()].every((v) => v.nivel === "normal"));
  const activo = [...FERIADOS, F("2026-10-05", "Feriado de prueba")];
  const inactivo = [...FERIADOS, { ...F("2026-10-05", "Feriado de prueba"), activo: false }];
  assert.ok(!nivelesDe(2026, 10, { feriados: activo }).media.includes("05"));
  assert.ok(nivelesDe(2026, 10, { feriados: activo }).media.includes("08")); // el conteo se corre
  assert.ok(nivelesDe(2026, 10, { feriados: inactivo }).media.includes("05"));
});

test("días de pago: regla de fin de semana (hipótesis) solo actúa si se activa", () => {
  const act = REGLAS.map((r) => (r.id === "r6" ? { ...r, activo: true } : r));
  const m = opp.classifyMonth(2026, 10, act, FERIADOS, []);
  // 30/10 (viernes) es alta → sábado 31 (el domingo 01/11 ya es del mes siguiente)
  assert.equal(m.get("2026-10-31").nivel, "media");
  assert.equal(m.get("2026-10-31").razones[0].nombre, "Fin de semana tras pago");
  // el sábado 3/10 sigue a 02/10 (viernes, alta por ser 2º hábil) → media
  assert.equal(m.get("2026-10-03").nivel, "media");
  assert.equal(m.get("2026-10-04").nivel, "media");
  // el fin de semana del 10 y 11 no sigue a un día alta
  assert.equal(m.get("2026-10-10").nivel, "normal");
  // y sin activar, los fines de semana quedan en normal
  const sin = opp.classifyMonth(2026, 10, REGLAS, FERIADOS, []);
  assert.equal(sin.get("2026-10-31").nivel, "normal");
});

test("días de pago: la quincena que cae en fin de semana no se marca (solo días hábiles)", () => {
  // 15/08/2026 es sábado (y feriado); 16/08 domingo
  const m = opp.classifyMonth(2026, 8, REGLAS, [F("2026-08-15", "Asunción")], []);
  assert.equal(m.get("2026-08-15").nivel, "normal");
  assert.equal(m.get("2026-08-16").nivel, "normal");
});
