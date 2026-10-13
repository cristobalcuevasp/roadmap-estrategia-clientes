import test from "node:test";
import assert from "node:assert/strict";
import * as a from "../src/lib/crm/analysis.js";

const cat = new Map([
  ["t1", { nombre: "Cyber" }], ["t2", { nombre: "Newsletter" }],
  ["pen", { nombre: "Pendiente", semantica: "pendiente" }], ["env", { nombre: "Enviado", semantica: "enviado" }], ["can", { nombre: "Cancelado", semantica: "cancelado" }],
]);
const M = (id, fecha, o = {}) => ({ id, fecha, hora: null, titulo_id: "t1", estado_id: "pen", responsable_id: "r1", segmento: "", objetivo: "", observaciones: "", id_externo: "", ...o });

test("conflictos: mismo segmento o misma hora el mismo día; cancelados y otros días no cuentan", () => {
  const list = [
    M("a", "2026-10-15", { segmento: "Clientes Activos", hora: "10:00:00" }),
    M("b", "2026-10-15", { segmento: "clientes  activos", titulo_id: "t2", hora: "10:00" }),
    M("c", "2026-10-15", { segmento: "Clientes Activos", estado_id: "can" }),
    M("d", "2026-10-16", { segmento: "Clientes Activos" }),
    M("e", "2026-10-15", { segmento: "Otros", hora: "11:00" }),
  ];
  const c = a.conflictMap(list, cat);
  // "clientes  activos" no es idéntico a "Clientes Activos" una vez normalizado (espacio doble → se colapsa) → sí coincide
  assert.deepEqual((c.get("a") || []).map((x) => x.tipo).sort(), ["hora", "segmento"]);
  assert.deepEqual((c.get("b") || []).map((x) => x.tipo).sort(), ["hora", "segmento"]);
  assert.equal(c.has("c"), false);
  assert.equal(c.has("d"), false);
  assert.equal(c.has("e"), false);
  assert.ok(c.get("a")[0].texto.includes("Newsletter"));
});

test("conflictos: borrador frente a los demás del día", () => {
  const list = [M("a", "2026-10-15", { segmento: "VIP", hora: "09:00" })];
  assert.equal(a.conflictsForDraft({ id: "nuevo", fecha: "2026-10-15", segmento: "vip", hora: "10:00" }, list, cat).length, 1);
  assert.equal(a.conflictsForDraft({ id: "nuevo", fecha: "2026-10-15", segmento: "x", hora: "09:00" }, list, cat).length, 1);
  assert.equal(a.conflictsForDraft({ id: "nuevo", fecha: "2026-10-16", segmento: "VIP", hora: "09:00" }, list, cat).length, 0);
  assert.equal(a.conflictsForDraft({ id: "a", fecha: "2026-10-15", segmento: "VIP", hora: "09:00" }, list, cat).length, 0); // no se compara consigo mismo
  assert.equal(a.conflictsForDraft({ id: "n", fecha: "2026-10-15", segmento: "", hora: "" }, list, cat).length, 0);
});

test("filtros: responsable, estado, título y texto", () => {
  const list = [
    M("a", "2026-10-15", { segmento: "Clientes Activos" }),
    M("b", "2026-10-15", { responsable_id: null, titulo_id: "t2", estado_id: "env", objetivo: "Reactivación" }),
    M("c", "2026-10-16", { responsable_id: "r2" }),
  ];
  const f = (o) => a.filterMailings(list, { ...a.FILTROS_VACIOS, ...o }, cat).map((m) => m.id);
  assert.deepEqual(f({}), ["a", "b", "c"]);
  assert.deepEqual(f({ responsables: ["r1"] }), ["a"]);
  assert.deepEqual(f({ responsables: ["sin"] }), ["b"]);
  assert.deepEqual(f({ responsables: ["r1", "r2"] }), ["a", "c"]);
  assert.deepEqual(f({ estado: "env" }), ["b"]);
  assert.deepEqual(f({ titulo: "t2" }), ["b"]);
  assert.deepEqual(f({ q: "reactivacion" }), ["b"]); // sin tildes
  assert.deepEqual(f({ q: "activos" }), ["a"]);
});

test("indicadores del rango: planificados vs enviados, vencidos y días con varios", () => {
  const list = [
    M("a", "2026-10-05", { estado_id: "env" }), M("b", "2026-10-05"), M("c", "2026-10-06", { estado_id: "can" }),
    M("d", "2026-10-20"), M("e", "2026-10-31", { estado_id: "env" }), M("f", "2026-11-02"),
  ];
  const k = a.rangeKpis(list, { desde: "2026-10-01", hasta: "2026-10-31", hoy: "2026-10-13", catById: cat,
    feriadoDe: (d) => d === "2026-10-31", esFinDeSemana: (d) => d === "2026-10-31", oportunidadDe: (d) => (d === "2026-10-05" ? "alta" : "normal") });
  assert.equal(k.total, 5);
  assert.equal(k.planificados, 4);
  assert.equal(k.cancelados, 1);
  assert.equal(k.enviados, 2);
  assert.equal(k.pendientes, 2);
  assert.equal(k.vencidosPendientes, 1); // b (5/10) ya pasó y sigue pendiente
  assert.equal(k.diasConVarios, 1);
  assert.equal(k.enFeriado, 1);
  assert.equal(k.enFinDeSemana, 1);
  assert.equal(k.enAlta, 2);
  assert.equal(k.cumplimiento, 50);
});

test("carga por responsable: ignora cancelados y fuera de rango", () => {
  const list = [M("a", "2026-10-05"), M("b", "2026-10-06", { estado_id: "env" }), M("c", "2026-10-07", { estado_id: "can" }), M("d", "2026-11-07"), M("e", "2026-10-08", { responsable_id: null }), M("f", "2026-10-09", { responsable_id: "r2" })];
  const resp = [{ id: "r1", nombre: "Uno", activo: true }, { id: "r2", nombre: "Dos", activo: true }, { id: "r3", nombre: "Tres", activo: true }];
  const w = a.workload(list, resp, { desde: "2026-10-01", hasta: "2026-10-31", catById: cat });
  const get = (id) => w.find((x) => (x.responsable ? x.responsable.id : "sin") === id);
  assert.equal(get("r1").total, 2); assert.equal(get("r1").enviados, 1);
  assert.equal(get("r2").total, 1);
  assert.equal(get("r3").total, 0); // activo sin carga: aparece con 0
  assert.equal(get("sin").total, 1);
});

test("agrupar por día ordena por hora y luego por título", () => {
  const list = [M("a", "2026-10-15", { hora: "11:00" }), M("b", "2026-10-15", { hora: "09:00" }), M("c", "2026-10-15", { titulo_id: "t2" }), M("d", "2026-10-15", { hora: null })];
  const g = a.groupByDate(list, cat).get("2026-10-15").map((m) => m.id);
  assert.deepEqual(g, ["b", "a", "d", "c"]);
});
