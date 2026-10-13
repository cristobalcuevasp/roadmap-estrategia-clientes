/* Pruebas de la lógica pura del módulo Feedback & Desarrollo (fechas de Chile, texto enriquecido, cumplimiento,
   alertas, filtros, minuta automática, preparación de reuniones y validaciones).  node tests/run.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import * as dt from "../src/lib/fb/datetime.js";
import * as rt from "../src/lib/fb/richtext.js";
import * as L from "../src/lib/fb/logic.js";

const HOY = "2026-10-14";
const P1 = { id: "p1", nombre: "Ana Prueba", estado: "activo", created_at: "2026-01-05T12:00:00Z" };
const P2 = { id: "p2", nombre: "Beto Prueba", estado: "activo", created_at: "2026-01-05T12:00:00Z" };
const P3 = { id: "p3", nombre: "Carla Inactiva", estado: "inactivo", created_at: "2026-01-05T12:00:00Z" };
const C = (o) => ({ id: "c" + Math.random(), persona_id: "p1", sesion_id: null, descripcion: "Compromiso", categoria: "", prioridad: "media", estado: "pendiente", avance: 0,
  fecha_vencimiento: "2026-10-20", fecha_vencimiento_original: "2026-10-20", fecha_proxima_revision: null, fecha_cumplimiento: null, reprogramaciones: 0, created_at: "2026-10-01T12:00:00Z", ...o });
const S = (o) => ({ id: "s" + Math.random(), persona_id: "p1", estado: "publicada", tipo: "1a1", modalidad: "virtual", fecha_hora: "2026-10-01T14:00:00Z", minuta: {}, ...o });
const base = (o = {}) => ({ personas: [P1, P2, P3], personaRoles: [], roles: [], objetivos: [], objetivoRoles: [], sesiones: [], compromisos: [], revisiones: [], seguimientos: [], ...o });

/* ---------------- fechas en hora de Chile ---------------- */
test("hora de Santiago → UTC respeta el horario de verano e invierno", () => {
  assert.equal(dt.santiagoLocalToISO("2026-10-14T10:00"), "2026-10-14T13:00:00.000Z"); // verano: UTC-3
  assert.equal(dt.santiagoLocalToISO("2026-07-10T10:00"), "2026-07-10T14:00:00.000Z"); // invierno: UTC-4
  assert.equal(dt.santiagoLocalToISO("2026-02-30T10:00"), null);
  assert.equal(dt.santiagoLocalToISO("2026-10-14T25:00"), null);
  assert.equal(dt.santiagoLocalToISO(""), null);
});
test("UTC → hora de Santiago de ida y vuelta", () => {
  for (const l of ["2026-10-14T10:00", "2026-07-10T23:30", "2027-01-01T00:00", "2026-12-31T23:55"]) {
    assert.equal(dt.isoToSantiagoLocal(dt.santiagoLocalToISO(l)), l);
  }
  assert.equal(dt.fmtFechaHora("2026-10-14T13:00:00Z"), "14/10/2026 10:00");
  assert.equal(dt.fechaCL("2026-10-15T01:30:00Z"), "2026-10-14"); // 22:30 del 14 en Chile
  assert.equal(dt.fechaCL("2026-10-15T03:30:00Z"), "2026-10-15");
});

/* ---------------- texto enriquecido ---------------- */
test("texto enriquecido: negrita, cursiva, listas y subtítulos", () => {
  assert.deepEqual(rt.parseInline("hola **mundo** y _tú_ ok"), [{ t: "text", v: "hola " }, { t: "b", v: "mundo" }, { t: "text", v: " y " }, { t: "i", v: "tú" }, { t: "text", v: " ok" }]);
  assert.deepEqual(rt.parseInline("snake_case_name"), [{ t: "text", v: "snake_case_name" }]);
  const b = rt.parseBlocks("## Título\nlinea 1\nlinea 2\n\n- a\n- b\n1. x\n2. y");
  assert.deepEqual(b.map((x) => x.type), ["h", "p", "ul", "ol"]);
  assert.deepEqual(b[1].lines, ["linea 1", "linea 2"]);
  assert.equal(rt.toPlain("**Hola** _mundo_\n- uno\n- dos"), "Hola mundo\nuno\ndos");
});
test("el HTML de impresión escapa todo (no se puede inyectar código)", () => {
  const html = rt.toHtml('<script>alert(1)</script> **<img src=x onerror=alert(2)>**\n- <b>x</b>');
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<b>x"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<strong>&lt;img"));
});
test("extracto recorta sin marcas", () => {
  assert.equal(rt.excerpt("**hola** mundo", 50), "hola mundo");
  assert.ok(rt.excerpt("x".repeat(300), 20).length <= 20);
  assert.ok(rt.isBlank("  \n ") && !rt.isBlank("a"));
});

/* ---------------- compromisos ---------------- */
test("vencido se calcula por fecha y solo en compromisos abiertos", () => {
  assert.equal(L.estadoEfectivo(C({ fecha_vencimiento: "2026-10-13" }), HOY), "vencido");
  assert.equal(L.estadoEfectivo(C({ fecha_vencimiento: "2026-10-14" }), HOY), "pendiente"); // vence hoy: aún no vencido
  assert.equal(L.estadoEfectivo(C({ estado: "bloqueado", fecha_vencimiento: "2026-10-01" }), HOY), "vencido");
  assert.equal(L.estadoEfectivo(C({ estado: "cumplido", fecha_vencimiento: "2026-10-01" }), HOY), "cumplido");
  assert.equal(L.estadoEfectivo(C({ estado: "cancelado", fecha_vencimiento: "2026-10-01" }), HOY), "cancelado");
});
test("cumplimiento = cumplidos ÷ (cumplidos + vencidos); sin base devuelve null", () => {
  assert.equal(L.cumplimiento([], HOY).pct, null);
  assert.equal(L.cumplimiento([C({ fecha_vencimiento: "2026-12-01" })], HOY).pct, null); // abierto sin vencer: no cuenta
  const cs = [
    C({ estado: "cumplido", fecha_vencimiento: "2026-10-05", fecha_vencimiento_original: "2026-10-05", fecha_cumplimiento: "2026-10-04" }),
    C({ estado: "cumplido", fecha_vencimiento: "2026-10-09", fecha_vencimiento_original: "2026-10-01", fecha_cumplimiento: "2026-10-08" }), // tarde respecto a la original
    C({ fecha_vencimiento: "2026-10-02" }), // vencido
    C({ estado: "cancelado", fecha_vencimiento: "2026-10-02" }), // no cuenta
  ];
  const r = L.cumplimiento(cs, HOY);
  assert.deepEqual([r.cumplidos, r.vencidos, r.base, r.pct, r.aTiempoPct], [2, 1, 3, 67, 50]);
  assert.equal(L.cumplimiento(cs, HOY, { desde: "2026-10-06", hasta: "2026-10-31" }).base, 1);
});
test("conteo de compromisos: abiertos, por vencer y reprogramados", () => {
  const cs = [C({}), C({ estado: "en_progreso", fecha_vencimiento: "2026-10-30" }), C({ estado: "bloqueado", fecha_vencimiento: "2026-10-10", reprogramaciones: 2 }), C({ estado: "cumplido" })];
  const n = L.conteoCompromisos(cs, HOY, 7);
  assert.deepEqual([n.abiertos, n.pendiente, n.en_progreso, n.vencido, n.cumplido, n.porVencer, n.reprogramados], [3, 1, 1, 1, 1, 1, 1]);
});

/* ---------------- objetivos ---------------- */
test("objetivos atrasados y sin actualizar", () => {
  const o = (x) => ({ id: "o" + Math.random(), persona_id: "p1", titulo: "Obj", estado: "en_curso", avance: 20, fecha_objetivo: "2026-12-01", updated_at: "2026-10-10T12:00:00Z", ...x });
  assert.ok(!L.objetivoAtrasado(o(), HOY));
  assert.ok(L.objetivoAtrasado(o({ fecha_objetivo: "2026-10-01" }), HOY));
  assert.ok(L.objetivoAtrasado(o({ estado: "en_riesgo" }), HOY));
  assert.ok(!L.objetivoAtrasado(o({ estado: "cumplido", fecha_objetivo: "2026-10-01" }), HOY));
  assert.ok(L.objetivoSinActualizar(o({ updated_at: "2026-08-01T12:00:00Z" }), HOY, 30));
  assert.ok(!L.objetivoSinActualizar(o({ estado: "cumplido", updated_at: "2026-08-01T12:00:00Z" }), HOY, 30));
  const n = L.conteoObjetivos([o(), o({ estado: "cumplido" }), o({ estado: "en_riesgo" })], HOY);
  assert.deepEqual([n.total, n.activos, n.cumplido, n.en_riesgo, n.atrasados], [3, 2, 1, 1, 1]);
  assert.equal(L.textoMetas(n), "1 de 3 cumplidos · 1 en riesgo");
  assert.equal(L.textoMetas({ total: 0 }), "Sin objetivos");
});

/* ---------------- alertas ---------------- */
test("alertas: sin feedback, vencidos, por vencer, bloqueados, reprogramados, objetivos y seguimientos", () => {
  const d = base({
    sesiones: [S({ fecha_hora: "2026-08-01T14:00:00Z" })], // hace más de 30 días
    compromisos: [
      C({ descripcion: "Vencido", fecha_vencimiento: "2026-10-10" }),
      C({ descripcion: "Por vencer", fecha_vencimiento: "2026-10-16" }),
      C({ descripcion: "Bloqueado", estado: "bloqueado", fecha_vencimiento: "2026-11-30" }),
      C({ descripcion: "Reprog", reprogramaciones: 3, fecha_vencimiento: "2026-12-30" }),
      C({ descripcion: "Revisar", fecha_proxima_revision: "2026-10-12", fecha_vencimiento: "2026-12-30" }),
      C({ descripcion: "Cerrado", estado: "cumplido", fecha_vencimiento: "2026-10-01" }),
      C({ descripcion: "Del inactivo", persona_id: "p3", fecha_vencimiento: "2026-10-01" }),
    ],
    objetivos: [{ id: "o1", persona_id: "p1", titulo: "Riesgo", estado: "en_riesgo", fecha_objetivo: null, updated_at: "2026-10-12T12:00:00Z" }, { id: "o2", persona_id: "p1", titulo: "Viejo", estado: "en_curso", fecha_objetivo: "2026-09-01", updated_at: "2026-06-01T12:00:00Z" }],
    seguimientos: [{ id: "g1", persona_id: "p1", fecha: "2026-10-05", estado: "programado", motivo: "Revisar" }, { id: "g2", persona_id: "p1", fecha: "2026-10-05", estado: "realizado", motivo: "" }],
  });
  const a = L.alertasEquipo([P1, P2, P3], d, HOY);
  const tipos = (pid) => a.filter((x) => x.personaId === pid).map((x) => x.tipo);
  for (const t of ["sin_feedback", "vencido", "por_vencer", "bloqueado", "reprogramado", "revision_pendiente", "objetivo_riesgo", "objetivo_atrasado", "objetivo_sin_actualizar", "seguimiento_atrasado"]) assert.ok(tipos("p1").includes(t), `falta ${t}`);
  assert.equal(tipos("p3").length, 0, "los inactivos no generan alertas");
  assert.equal(tipos("p1").filter((t) => t === "vencido").length, 1);
  assert.equal(a[0].severidad, "alta"); // las altas primero
  assert.ok(a.every((x, i) => i === 0 || ["alta", "media", "baja"].indexOf(a[i - 1].severidad) <= ["alta", "media", "baja"].indexOf(x.severidad)));
  assert.ok(a.find((x) => x.tipo === "vencido").ref.kind === "compromiso");
  // P2 (creada hace más de 30 días y sin ninguna reunión)
  assert.ok(tipos("p2").includes("sin_feedback"));
  // un integrante recién creado no genera alerta de "sin feedback"
  const nueva = { ...P2, id: "p9", created_at: "2026-10-10T12:00:00Z" };
  assert.ok(!L.alertasEquipo([nueva], base({ personas: [nueva] }), HOY).some((x) => x.tipo === "sin_feedback"));
  // umbral configurable
  assert.ok(!L.alertasEquipo([P1], base({ sesiones: [S({ fecha_hora: "2026-08-01T14:00:00Z" })] }), HOY, { dias_sin_feedback: 90, dias_aviso_vencimiento: 7, dias_objetivo_sin_actualizar: 30 }).some((x) => x.tipo === "sin_feedback"));
});
test("resumen de la persona: último feedback, próximo seguimiento y roles activos", () => {
  const d = base({
    sesiones: [S({ fecha_hora: "2026-10-01T14:00:00Z" }), S({ fecha_hora: "2026-09-01T14:00:00Z" }), S({ estado: "borrador", fecha_hora: "2026-10-12T14:00:00Z" })],
    seguimientos: [{ id: "g1", persona_id: "p1", fecha: "2026-10-30", estado: "programado" }, { id: "g2", persona_id: "p1", fecha: "2026-10-20", estado: "programado" }, { id: "g3", persona_id: "p1", fecha: "2026-10-18", estado: "cancelado" }],
    personaRoles: [{ persona_id: "p1", rol_id: "r1", estado: "activo" }, { persona_id: "p1", rol_id: "r2", estado: "historico" }],
  });
  const r = L.resumenPersona(P1, d, HOY);
  assert.equal(r.ultimoFeedback, "2026-10-01"); // el borrador no cuenta
  assert.equal(r.diasSinFeedback, 13);
  assert.equal(r.proximoSeguimiento.fecha, "2026-10-20");
  assert.equal(r.roles.length, 1);
});

/* ---------------- filtros y períodos ---------------- */
test("períodos: semana, mes, trimestre, año y 90 días", () => {
  assert.deepEqual(L.rangoPeriodo("semana", HOY), { desde: "2026-10-12", hasta: "2026-10-18" });
  assert.deepEqual(L.rangoPeriodo("mes", HOY), { desde: "2026-10-01", hasta: "2026-10-31" });
  assert.deepEqual(L.rangoPeriodo("trimestre", HOY), { desde: "2026-10-01", hasta: "2026-12-31" });
  assert.deepEqual(L.rangoPeriodo("trimestre", "2026-05-20"), { desde: "2026-04-01", hasta: "2026-06-30" });
  assert.deepEqual(L.rangoPeriodo("mes", "2026-12-15"), { desde: "2026-12-01", hasta: "2026-12-31" });
  assert.deepEqual(L.rangoPeriodo("anio", HOY), { desde: "2026-01-01", hasta: "2026-12-31" });
  assert.deepEqual(L.rangoPeriodo("90d", HOY), { desde: "2026-07-17", hasta: "2026-10-14" });
  assert.deepEqual(L.rangoPeriodo("todo", HOY), { desde: null, hasta: null });
  assert.deepEqual(L.rangoPeriodo("custom", HOY, { desde: "2026-01-01", hasta: "x" }), { desde: "2026-01-01", hasta: null });
});
test("filtros del panel por integrante, rol, categoría y estado", () => {
  const d = base({
    personaRoles: [{ persona_id: "p1", rol_id: "r1", estado: "activo" }, { persona_id: "p2", rol_id: "r1", estado: "historico" }, { persona_id: "p2", rol_id: "r2", estado: "activo" }],
    compromisos: [C({ persona_id: "p1", categoria: "Calidad" }), C({ persona_id: "p1", categoria: "Desarrollo", fecha_vencimiento: "2026-10-01" }), C({ persona_id: "p2", categoria: "Calidad" })],
  });
  assert.equal(L.aplicarFiltros(d, { hoy: HOY }).personas.length, 3);
  assert.deepEqual(L.aplicarFiltros(d, { hoy: HOY, roles: ["r1"] }).personas.map((p) => p.id), ["p1"]); // el rol histórico no cuenta
  assert.equal(L.aplicarFiltros(d, { hoy: HOY, personas: ["p2"] }).compromisos.length, 1);
  assert.equal(L.aplicarFiltros(d, { hoy: HOY, categorias: ["Calidad"] }).compromisos.length, 2);
  assert.equal(L.aplicarFiltros(d, { hoy: HOY, estados: ["vencido"] }).compromisos.length, 1);
});
test("búsqueda de reuniones: palabras clave sin tildes, tipo y fechas", () => {
  const ss = [
    S({ id: "a", tipo: "mejora", fecha_hora: "2026-09-10T14:00:00Z", temas: "Revisión de **calidad** del código", minuta: { resumen: "Hablamos de estimaciones" } }),
    S({ id: "b", tipo: "positivo", fecha_hora: "2026-10-02T14:00:00Z", logros: "Entregó la automatización" }),
  ];
  assert.deepEqual(L.filtrarSesiones(ss, { q: "revision CALIDAD" }).map((s) => s.id), []); // ambas palabras juntas no aparecen seguidas
  assert.deepEqual(L.filtrarSesiones(ss, { q: "calidad" }).map((s) => s.id), ["a"]);
  assert.deepEqual(L.filtrarSesiones(ss, { q: "estimaciones" }).map((s) => s.id), ["a"]);
  assert.deepEqual(L.filtrarSesiones(ss, { q: "automatizacion" }).map((s) => s.id), ["b"]);
  assert.deepEqual(L.filtrarSesiones(ss, { tipo: "positivo" }).map((s) => s.id), ["b"]);
  assert.deepEqual(L.filtrarSesiones(ss, { desde: "2026-10-01" }).map((s) => s.id), ["b"]);
  assert.deepEqual(L.filtrarSesiones(ss, { hasta: "2026-09-30" }).map((s) => s.id), ["a"]);
  assert.deepEqual(L.filtrarSesiones(ss, { q: "informe trimestral" }, [{ sesion_id: "b", descripcion: "Informe trimestral" }]).map((s) => s.id), ["b"]); // también busca en sus compromisos
});

/* ---------------- series para gráficos ---------------- */
test("series por mes: feedback, compromisos creados y cumplidos", () => {
  const m = L.ultimosMeses(HOY, 4).map((x) => x.key);
  assert.deepEqual(m, ["2026-07", "2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(L.ultimosMeses("2026-02-10", 3).map((x) => x.key), ["2025-12", "2026-01", "2026-02"]);
  const f = L.feedbackPorMes([S({ fecha_hora: "2026-10-01T14:00:00Z" }), S({ fecha_hora: "2026-10-05T14:00:00Z" }), S({ fecha_hora: "2026-08-05T14:00:00Z" }), S({ estado: "borrador", fecha_hora: "2026-10-06T14:00:00Z" }), S({ fecha_hora: "2025-01-05T14:00:00Z" })], HOY, 4);
  assert.deepEqual(f.map((x) => x.valor), [0, 1, 0, 2]);
  const c = L.compromisosPorMes([C({ created_at: "2026-10-02T12:00:00Z", estado: "cumplido", fecha_cumplimiento: "2026-10-09" }), C({ created_at: "2026-09-02T12:00:00Z" })], HOY, 3);
  assert.deepEqual(c.map((x) => [x.creados, x.cumplidos]), [[0, 0], [1, 0], [1, 1]]);
  // un mes recién empezado en Chile pero ya en el siguiente día en UTC cuenta en el mes de Chile
  assert.equal(L.feedbackPorMes([S({ fecha_hora: "2026-11-01T01:00:00Z" })], HOY, 1)[0].valor, 1);
});

/* ---------------- minuta automática ---------------- */
test("la minuta automática arma las 7 secciones solo con lo escrito en el formulario", () => {
  const m = L.buildMinuta({
    persona: P1, fechaHora: "2026-10-14T13:00:00Z", tipo: "mejora", modalidad: "virtual", participantes: "Ana, Cristobal",
    temas: "Calidad de las entregas", fortalezas: "Buen trabajo en equipo", logros: "Cerró la migración", oportunidades: "Documentar mejor",
    comentariosLider: "Va bien", comentariosColaborador: "Necesito más foco", acuerdos: "Revisar PRs antes del viernes", proximosPasos: "Agendar demo", temasPendientes: "Carga de trabajo",
    proximaRevision: "2026-10-28", compromisos: [{ descripcion: "Entregar guía", fecha_vencimiento: "2026-10-21", prioridad: "alta", persona_id: "p1" }, { descripcion: "  " }],
    nombrePorPersona: (id) => (id === "p1" ? "Ana Prueba" : ""),
  });
  assert.deepEqual(Object.keys(m), ["resumen", "positivos", "mejoras", "decisiones", "compromisos", "responsables_fechas", "proximos_pasos"]);
  assert.ok(m.resumen.includes("14/10/2026 10:00") && m.resumen.includes("feedback de mejora") && m.resumen.includes("Calidad de las entregas") && m.resumen.includes("Necesito más foco"));
  assert.ok(m.positivos.includes("Buen trabajo en equipo") && m.positivos.includes("Cerró la migración"));
  assert.equal(m.mejoras, "Documentar mejor");
  assert.equal(m.decisiones, "Revisar PRs antes del viernes");
  assert.equal(m.compromisos, "- Entregar guía (vence el 21/10/2026; prioridad alta)");
  assert.equal(m.responsables_fechas, "- Ana Prueba: Entregar guía — 21/10/2026");
  assert.ok(m.proximos_pasos.includes("Agendar demo") && m.proximos_pasos.includes("Carga de trabajo") && m.proximos_pasos.includes("Próxima revisión: 28/10/2026."));
  // sin datos no inventa contenido
  const v = L.buildMinuta({ persona: P1, fechaHora: "2026-10-14T13:00:00Z", tipo: "1a1", modalidad: "presencial", compromisos: [] });
  assert.equal(v.positivos, ""); assert.equal(v.mejoras, ""); assert.equal(v.compromisos, ""); assert.equal(v.proximos_pasos, "");
});

/* ---------------- versiones y comparación ---------------- */
test("diferencias entre versiones de una minuta", () => {
  const a = { temas: "A", minuta: { resumen: "R1", positivos: "P" }, proxima_revision: "2026-10-28" };
  const b = { temas: "B", minuta: { resumen: "R2", positivos: "P" }, proxima_revision: "2026-10-28" };
  assert.deepEqual(L.diffVersiones(a, b).map((x) => [x.campo, x.antes, x.despues]), [["temas", "A", "B"], ["minuta.resumen", "R1", "R2"]]);
  assert.deepEqual(L.diffVersiones(a, a), []);
});
test("comparar acuerdos de dos reuniones", () => {
  const r = L.compararSesiones({ id: "a", minuta: { decisiones: "X" } }, { id: "b", acuerdos: "Y", minuta: {} }, [{ sesion_id: "a", descripcion: "Uno", fecha_vencimiento_original: "2026-10-20" }]);
  assert.equal(r.filas[0].a, "X"); assert.equal(r.filas[0].b, "Y");
  assert.deepEqual(r.compromisosA, ["Uno (20/10/2026)"]); assert.deepEqual(r.compromisosB, []);
});

/* ---------------- preparar reunión ---------------- */
test("preparar reunión reúne compromisos, logros, temas pendientes, alertas y preguntas", () => {
  const d = base({
    sesiones: [
      S({ id: "s2", fecha_hora: "2026-10-01T14:00:00Z", logros: "Cerró el piloto", temas_pendientes: "Plan de carrera" }),
      S({ id: "s1", fecha_hora: "2026-09-01T14:00:00Z", logros: "", temas_pendientes: "Capacitación" }),
    ],
    compromisos: [
      C({ descripcion: "Vencido uno", fecha_vencimiento: "2026-10-08" }),
      C({ descripcion: "Abierto dos", fecha_vencimiento: "2026-10-30", estado: "bloqueado" }),
      C({ descripcion: "Hecho", estado: "cumplido", fecha_cumplimiento: "2026-10-07" }),
      C({ descripcion: "Hecho antes", estado: "cumplido", fecha_cumplimiento: "2026-09-20" }),
    ],
    objetivos: [{ id: "o1", persona_id: "p1", titulo: "Migrar CRM", estado: "en_riesgo", updated_at: "2026-10-10T12:00:00Z" }],
  });
  const r = L.prepararReunion(P1, d, HOY);
  assert.equal(r.fechaUltima, "2026-10-01");
  assert.deepEqual(r.abiertos.map((c) => c.descripcion), ["Vencido uno", "Abierto dos"]);
  assert.deepEqual(r.cumplidosDesde.map((c) => c.descripcion), ["Hecho"]); // solo desde la última reunión
  assert.equal(r.objetivosAtencion.length, 1);
  assert.equal(r.logrosRecientes.length, 1);
  assert.deepEqual(r.temasPendientes.map((t) => t.texto), ["Plan de carrera", "Capacitación"]);
  assert.ok(r.alertas.some((a) => a.tipo === "vencido"));
  assert.ok(r.preguntas.some((q) => q.includes("fecha vencida")) && r.preguntas.some((q) => q.includes("bloqueados") || q.includes("bloqueado")) && r.preguntas.some((q) => q.includes("Migrar CRM")));
  assert.ok(r.agenda.includes("Vencido uno") && r.agenda.includes("Plan de carrera") && r.agenda.includes("Reconocer avances"));
  // primera reunión: sin referencias a una anterior
  const nuevo = L.prepararReunion(P2, base(), HOY);
  assert.equal(nuevo.ultima, null);
  assert.ok(nuevo.agenda.includes("Apertura"));
  assert.ok(!nuevo.preguntas.some((q) => q.includes("última conversación")));
});

/* ---------------- validaciones ---------------- */
test("validación de una reunión", () => {
  const ok = { persona_id: "p1", fecha_hora: "2026-10-14T13:00:00Z", proxima_revision: "2026-10-28", compromisos_borrador: [{ descripcion: "x", fecha_vencimiento: "2026-10-20" }], minuta: { resumen: "r" } };
  assert.deepEqual(L.validarSesion(ok, { hoy: HOY, publicar: true }), {});
  assert.ok(L.validarSesion({ ...ok, persona_id: "" }, { hoy: HOY }).persona_id);
  assert.ok(L.validarSesion({ ...ok, fecha_hora: "" }, { hoy: HOY }).fecha_hora);
  assert.ok(L.validarSesion({ ...ok, proxima_revision: "2026-10-01" }, { hoy: HOY }).proxima_revision);
  assert.ok(L.validarSesion({ ...ok, compromisos_borrador: [{ descripcion: "x" }] }, { hoy: HOY }).compromiso_0);
  assert.ok(L.validarSesion({ ...ok, compromisos_borrador: [{ descripcion: "x", fecha_vencimiento: "2026-10-01" }] }, { hoy: HOY }).compromiso_0); // antes de la reunión
  assert.ok(L.validarSesion({ ...ok, minuta: {} }, { hoy: HOY, publicar: true }).resumen);
  assert.deepEqual(L.validarSesion({ ...ok, minuta: {} }, { hoy: HOY }), {}); // un borrador puede guardarse sin resumen
});
test("validación y cuerpo de una revisión de compromiso", () => {
  const c = C({ estado: "en_progreso", avance: 40, fecha_vencimiento: "2026-10-20" });
  assert.deepEqual(L.validarRevision(c, { avance_pct: 50 }, HOY), {});
  assert.ok(L.validarRevision(c, { avance_pct: 150 }, HOY).avance_pct);
  assert.ok(L.validarRevision(c, { estado_nuevo: "cumplido" }, HOY).resultado);
  assert.ok(L.validarRevision(c, { estado_nuevo: "cancelado", resultado: " " }, HOY).resultado);
  assert.deepEqual(L.validarRevision(c, { estado_nuevo: "cumplido", resultado: "Hecho" }, HOY), {});
  assert.ok(L.validarRevision(c, { vencimiento_nuevo: "2026-10-30" }, HOY).obstaculos); // reprogramar exige un motivo
  assert.deepEqual(L.validarRevision(c, { vencimiento_nuevo: "2026-10-30", obstaculos: "Dependencia" }, HOY), {});
  assert.ok(L.validarRevision(c, { vencimiento_nuevo: "2026-10-01", obstaculos: "x" }, HOY).vencimiento_nuevo);
  assert.ok(L.validarRevision(c, { estado_nuevo: "cumplido", resultado: "ok", vencimiento_nuevo: "2026-11-01" }, HOY).vencimiento_nuevo);
  assert.ok(L.validarRevision(c, { estado_nuevo: "cumplido", resultado: "ok", fecha_cumplimiento: "2026-10-30" }, HOY).fecha_cumplimiento);
  // cuerpo: solo lo que cambia
  assert.deepEqual(L.payloadRevision(c, { estado_nuevo: "en_progreso", avance_pct: "40", obstaculos: "  ", comentarios_lider: " Bien " }), { comentarios_lider: "Bien" });
  assert.deepEqual(L.payloadRevision(c, { estado_nuevo: "bloqueado", avance_pct: "55", obstaculos: "Sin acceso", vencimiento_nuevo: "2026-10-20" }), { estado_nuevo: "bloqueado", avance_pct: 55, obstaculos: "Sin acceso" });
  assert.ok(L.revisionVacia(L.payloadRevision(c, { estado_nuevo: "en_progreso", avance_pct: "40" })));
});

test("umbrales de configuración con valores por defecto", () => {
  assert.deepEqual(L.cfgDesdeFilas([]), { dias_sin_feedback: 30, dias_aviso_vencimiento: 7, dias_objetivo_sin_actualizar: 30 });
  assert.equal(L.cfgDesdeFilas([{ clave: "dias_sin_feedback", valor: { dias: 45 } }, { clave: "otra", valor: { dias: 1 } }, { clave: "dias_aviso_vencimiento", valor: { dias: "x" } }]).dias_sin_feedback, 45);
  assert.equal(L.cfgDesdeFilas([{ clave: "dias_aviso_vencimiento", valor: { dias: "x" } }]).dias_aviso_vencimiento, 7);
});

/* ---------------- barra de formato del editor ---------------- */
test("barra de formato: negrita, cursiva, listas y subtítulo (con deshacer)", () => {
  let r = rt.applyFormat("hola mundo", 5, 10, "bold");
  assert.equal(r.value, "hola **mundo**"); assert.equal(r.value.slice(r.start, r.end), "mundo");
  r = rt.applyFormat(r.value, r.start, r.end, "bold"); // aplicar de nuevo con la palabra seleccionada la desenvuelve
  assert.equal(r.value, "hola mundo");
  assert.equal(rt.applyFormat("hola **mundo**", 5, 14, "bold").value, "hola mundo"); // seleccionando también las marcas
  assert.equal(rt.applyFormat("", 0, 0, "italic").value, "_texto en cursiva_");
  assert.equal(rt.applyFormat("a\nb\nc", 0, 5, "ul").value, "- a\n- b\n- c");
  assert.equal(rt.applyFormat("- a\n- b", 0, 7, "ul").value, "a\nb"); // todas con viñeta: se quita
  assert.equal(rt.applyFormat("a\n\nb", 0, 4, "ol").value, "1. a\n\n2. b");
  assert.equal(rt.applyFormat("uno\ndos\ntres", 5, 5, "h").value, "uno\n## dos\ntres"); // solo la línea del cursor
  assert.equal(rt.applyFormat("1. a\n- b", 0, 8, "ul").value, "- a\n- b"); // cambia numerada a viñeta
});

/* ---------------- impresión de minutas ---------------- */
import * as pr from "../src/lib/fb/print.js";
test("el documento impreso incluye las 7 secciones, escapa el texto y no lleva notas privadas", () => {
  const html = pr.minutaHtml({
    sesion: {
      estado: "publicada", tipo: "1a1", modalidad: "virtual", fecha_hora: "2026-10-14T13:00:00Z", participantes: "Ana <b>X</b>", temas: "Tema <script>x</script>", comentarios_lider: "Va bien",
      minuta: { resumen: "Resumen **claro**", positivos: "- Uno\n- Dos", mejoras: "", decisiones: "Decisión", compromisos: "- C1", responsables_fechas: "- Ana: C1", proximos_pasos: "Seguir" },
      contexto: { roles: [{ nombre: "Rol <i>A</i>", expectativas: "Entregar" }], objetivos: [{ titulo: "Obj", estado: "en_curso", avance: 40, fecha_objetivo: "2026-12-01" }] },
    },
    nombrePersona: "Ana Prueba", version: 2, hoy: "2026-10-14", publicadaPor: "cristobal_cuevas",
    compromisos: [{ descripcion: "Entregar <guía>", fecha_vencimiento: "2026-10-20", fecha_vencimiento_original: "2026-10-18", prioridad: "alta", estado: "pendiente" }],
  });
  for (const t of ["1. Resumen de la conversación", "2. Aspectos positivos", "3. Oportunidades de mejora", "4. Decisiones y acuerdos", "5. Compromisos adquiridos", "6. Responsables y fechas", "7. Próximos pasos"]) assert.ok(html.includes(t), t);
  assert.ok(html.includes("<strong>claro</strong>") && html.includes("<li>Uno</li>"));
  assert.ok(html.includes("Sin contenido.")); // sección vacía
  assert.ok(html.includes("14/10/2026 10:00") && html.includes("versión 2") && html.includes("18/10/2026"));
  assert.ok(!html.includes("<script>x") && !html.includes("<b>X</b>") && !html.includes("<guía>") && !html.includes("<i>A</i>"));
  assert.ok(html.includes("&lt;script&gt;x") && html.includes("Entregar &lt;guía&gt;"));
  assert.ok(html.includes("No incluye las notas privadas"));
  const sinRegistro = pr.minutaHtml({ sesion: { estado: "borrador", tipo: "1a1", modalidad: "presencial", fecha_hora: "2026-10-14T13:00:00Z", temas: "Solo en el registro", minuta: {} }, nombrePersona: "Ana", hoy: "2026-10-14", incluirRegistro: false });
  assert.ok(!sinRegistro.includes("Solo en el registro") && sinRegistro.includes("Borrador (aún no publicada)"));
});

test("línea de tiempo de la persona: reuniones, compromisos, reprogramaciones, objetivos y roles", () => {
  const d = base({
    roles: [{ id: "r1", nombre: "Mentor Técnico" }],
    personaRoles: [{ id: "pr1", persona_id: "p1", rol_id: "r1", estado: "activo", fecha_asignacion: "2026-02-01" }],
    sesiones: [S({ id: "s1", fecha_hora: "2026-10-01T14:00:00Z", tipo: "mejora", minuta: { resumen: "**Hablamos** de calidad\nsegunda línea" } }), S({ id: "s0", estado: "borrador", fecha_hora: "2026-10-05T14:00:00Z" }), S({ id: "sx", persona_id: "p2" })],
    compromisos: [C({ id: "c1", descripcion: "Guía", created_at: "2026-10-01T15:00:00Z", estado: "cumplido", fecha_cumplimiento: "2026-10-09", resultado_final: "Entregada" }), C({ id: "c2", descripcion: "Otro", persona_id: "p2" })],
    revisiones: [{ id: "v1", persona_id: "p1", compromiso_id: "c1", fecha: "2026-10-05", created_at: "2026-10-05T12:00:00Z", vencimiento_anterior: "2026-10-08", vencimiento_nuevo: "2026-10-12", obstaculos: "Dependencia" }, { id: "v2", persona_id: "p1", compromiso_id: "c1", fecha: "2026-10-06", created_at: "2026-10-06T12:00:00Z", vencimiento_anterior: "2026-10-12", vencimiento_nuevo: "2026-10-12", obstaculos: "" }],
    objetivos: [{ id: "o1", persona_id: "p1", titulo: "Migrar", estado: "cumplido", fecha_cierre: "2026-10-08" }, { id: "o2", persona_id: "p1", titulo: "Abierto", estado: "en_curso", fecha_cierre: null }],
  });
  const ev = L.eventosPersona("p1", d);
  assert.deepEqual(ev.map((e) => e.tipo), ["compromiso_cumplido", "objetivo_cumplido", "reprogramacion", "compromiso_creado", "feedback", "rol"]); // más reciente primero
  assert.equal(ev.find((e) => e.tipo === "feedback").detalle, "Hablamos de calidad");
  assert.equal(ev.filter((e) => e.tipo === "reprogramacion").length, 1); // la revisión sin cambio de fecha no es una reprogramación
  assert.ok(ev.every((e) => e.ref && e.fecha));
  assert.ok(!ev.some((e) => e.titulo.includes("Otro")));
  assert.equal(ev[ev.length - 1].tipo, "rol");
});
