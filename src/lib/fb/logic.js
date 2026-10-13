/* Lógica pura del módulo Feedback & Desarrollo (sin pantalla ni base de datos): estados, cumplimiento, alertas,
   series de gráficos, filtros, minuta automática, preparación de reuniones y validaciones. Todas las fechas son
   "AAAA-MM-DD" y "hoy" se recibe como parámetro (la pantalla usa la fecha de Chile). */
import { addDaysISO, diffDays, fmtDMY, fmtDM, isValidISO, isoOf, parts, mondayOf, MESES } from "../crm/calendar";
import { fechaCL, fmtFechaHora } from "./datetime";
import { toPlain, isBlank } from "./richtext";
import { CONFIG_DEFECTO, tipoLabel, modalidadLabel, prioridadMeta } from "./constants";

export const ABIERTOS = ["pendiente", "en_progreso", "bloqueado"];
export const OBJ_ACTIVOS = ["pendiente", "en_curso", "en_riesgo"];

/* ------------------------------ compromisos ------------------------------ */

/** "vencido" no se guarda: un compromiso abierto cuya fecha ya pasó se muestra como vencido. */
export function estadoEfectivo(c, hoy) {
  if (ABIERTOS.includes(c.estado) && c.fecha_vencimiento < hoy) return "vencido";
  return c.estado;
}
export const esAbierto = (c) => ABIERTOS.includes(c.estado);
export const diasParaVencer = (c, hoy) => diffDays(c.fecha_vencimiento, hoy);
export const reprogramadoReiterado = (c) => (c.reprogramaciones || 0) >= 2;

/**
 * Cumplimiento = cumplidos ÷ (cumplidos + vencidos), sobre los compromisos cuya fecha de vencimiento cae en el rango.
 * Los abiertos que aún no vencen y los cancelados no cuentan. "A tiempo" = cumplidos hasta su fecha original.
 * Devuelve null cuando no hay base para calcularlo (no se inventa un 0 % ni un 100 %).
 */
export function cumplimiento(compromisos, hoy, rango = {}) {
  const dentro = compromisos.filter((c) => (!rango.desde || c.fecha_vencimiento >= rango.desde) && (!rango.hasta || c.fecha_vencimiento <= rango.hasta));
  const cumplidos = dentro.filter((c) => c.estado === "cumplido");
  const vencidos = dentro.filter((c) => estadoEfectivo(c, hoy) === "vencido");
  const base = cumplidos.length + vencidos.length;
  const aTiempo = cumplidos.filter((c) => c.fecha_cumplimiento && c.fecha_cumplimiento <= c.fecha_vencimiento_original).length;
  return {
    cumplidos: cumplidos.length, vencidos: vencidos.length, base,
    pct: base ? Math.round((cumplidos.length / base) * 100) : null,
    aTiempoPct: cumplidos.length ? Math.round((aTiempo / cumplidos.length) * 100) : null,
  };
}

export function conteoCompromisos(compromisos, hoy, aviso = CONFIG_DEFECTO.dias_aviso_vencimiento) {
  const o = { total: compromisos.length, pendiente: 0, en_progreso: 0, bloqueado: 0, cumplido: 0, vencido: 0, cancelado: 0, abiertos: 0, porVencer: 0, reprogramados: 0 };
  for (const c of compromisos) {
    const e = estadoEfectivo(c, hoy);
    o[e] += 1;
    if (esAbierto(c)) {
      o.abiertos += 1;
      const d = diasParaVencer(c, hoy);
      if (d >= 0 && d <= aviso) o.porVencer += 1;
    }
    if (reprogramadoReiterado(c)) o.reprogramados += 1;
  }
  return o;
}

/* -------------------------------- objetivos -------------------------------- */

export const objetivoActivo = (o) => OBJ_ACTIVOS.includes(o.estado);
/** Atrasado: sigue activo y su fecha objetivo ya pasó, o fue marcado en riesgo. */
export const objetivoAtrasado = (o, hoy) => objetivoActivo(o) && (o.estado === "en_riesgo" || (!!o.fecha_objetivo && o.fecha_objetivo < hoy));
export function objetivoSinActualizar(o, hoy, dias = CONFIG_DEFECTO.dias_objetivo_sin_actualizar) {
  if (!objetivoActivo(o) || !o.updated_at) return false;
  return diffDays(hoy, fechaCL(o.updated_at)) > dias;
}

/** Resumen de objetivos sin promediar: cada objetivo tiene su propio avance y no son comparables entre sí. */
export function conteoObjetivos(objetivos, hoy) {
  const o = { total: objetivos.length, pendiente: 0, en_curso: 0, en_riesgo: 0, cumplido: 0, cancelado: 0, activos: 0, atrasados: 0 };
  for (const x of objetivos) {
    o[x.estado] += 1;
    if (objetivoActivo(x)) o.activos += 1;
    if (objetivoAtrasado(x, hoy)) o.atrasados += 1;
  }
  return o;
}

/* --------------------------- resumen y alertas por persona --------------------------- */

export const sesionesPublicadas = (sesiones) => sesiones.filter((s) => s.estado === "publicada").sort((a, b) => (a.fecha_hora < b.fecha_hora ? 1 : -1));

export function resumenPersona(persona, d, hoy, cfg = CONFIG_DEFECTO) {
  const pid = persona.id;
  const ses = sesionesPublicadas(d.sesiones.filter((s) => s.persona_id === pid));
  const comps = d.compromisos.filter((c) => c.persona_id === pid);
  const objs = d.objetivos.filter((o) => o.persona_id === pid);
  const segs = d.seguimientos.filter((s) => s.persona_id === pid && s.estado === "programado").sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const roles = d.personaRoles.filter((r) => r.persona_id === pid && r.estado === "activo");
  const ultimoFeedback = ses[0] ? fechaCL(ses[0].fecha_hora) : null;
  const proximo = segs.find((s) => s.fecha >= hoy) || null;
  return {
    persona, roles, sesiones: ses,
    ultimoFeedback,
    diasSinFeedback: ultimoFeedback ? diffDays(hoy, ultimoFeedback) : null,
    proximoSeguimiento: proximo,
    seguimientosAtrasados: segs.filter((s) => s.fecha < hoy),
    compromisos: conteoCompromisos(comps, hoy, cfg.dias_aviso_vencimiento),
    cumplimiento: cumplimiento(comps, hoy),
    objetivos: conteoObjetivos(objs, hoy),
  };
}

const SEV = { alta: 0, media: 1, baja: 2 };

/**
 * Alertas que requieren atención del líder, ordenadas por severidad y fecha.
 * Cada alerta dice a qué ficha o compromiso lleva (ref).
 */
export function alertasEquipo(personas, d, hoy, cfg = CONFIG_DEFECTO) {
  const out = [];
  const nombre = new Map(personas.map((p) => [p.id, p.nombre]));
  for (const p of personas) {
    if (p.estado === "inactivo") continue;
    const pid = p.id;
    const r = resumenPersona(p, d, hoy, cfg);
    const add = (tipo, severidad, texto, ref, fecha = null) => out.push({ tipo, severidad, personaId: pid, persona: nombre.get(pid), texto, ref, fecha });

    if (p.estado === "activo") {
      if (r.ultimoFeedback === null) {
        const alta = p.created_at ? diffDays(hoy, fechaCL(p.created_at)) : 0;
        if (alta > cfg.dias_sin_feedback) add("sin_feedback", "media", "Aún no tiene feedback registrado", { kind: "persona", id: pid });
      } else if (r.diasSinFeedback > cfg.dias_sin_feedback) {
        add("sin_feedback", "media", `Sin feedback hace ${r.diasSinFeedback} días`, { kind: "persona", id: pid }, r.ultimoFeedback);
      }
    }
    for (const s of r.seguimientosAtrasados) add("seguimiento_atrasado", "media", `Seguimiento del ${fmtDMY(s.fecha)} sin realizar${s.motivo ? `: ${s.motivo}` : ""}`, { kind: "persona", id: pid }, s.fecha);

    for (const c of d.compromisos.filter((x) => x.persona_id === pid && esAbierto(x))) {
      const dias = diasParaVencer(c, hoy);
      const ref = { kind: "compromiso", id: c.id };
      if (dias < 0) add("vencido", "alta", `Compromiso vencido hace ${-dias} día${-dias === 1 ? "" : "s"}: ${c.descripcion}`, ref, c.fecha_vencimiento);
      else if (dias <= cfg.dias_aviso_vencimiento) add("por_vencer", "media", `Compromiso vence ${dias === 0 ? "hoy" : `en ${dias} día${dias === 1 ? "" : "s"}`}: ${c.descripcion}`, ref, c.fecha_vencimiento);
      if (c.estado === "bloqueado") add("bloqueado", "media", `Compromiso bloqueado: ${c.descripcion}`, ref, c.fecha_vencimiento);
      if (reprogramadoReiterado(c)) add("reprogramado", "media", `Compromiso reprogramado ${c.reprogramaciones} veces: ${c.descripcion}`, ref, c.fecha_vencimiento);
      if (c.fecha_proxima_revision && c.fecha_proxima_revision <= hoy) add("revision_pendiente", "media", `Revisión pendiente desde el ${fmtDMY(c.fecha_proxima_revision)}: ${c.descripcion}`, ref, c.fecha_proxima_revision);
    }
    for (const o of d.objetivos.filter((x) => x.persona_id === pid && objetivoActivo(x))) {
      const ref = { kind: "objetivo", id: o.id };
      if (o.estado === "en_riesgo") add("objetivo_riesgo", "alta", `Objetivo en riesgo: ${o.titulo}`, ref, o.fecha_objetivo);
      else if (o.fecha_objetivo && o.fecha_objetivo < hoy) add("objetivo_atrasado", "alta", `Objetivo con fecha vencida (${fmtDMY(o.fecha_objetivo)}): ${o.titulo}`, ref, o.fecha_objetivo);
      if (objetivoSinActualizar(o, hoy, cfg.dias_objetivo_sin_actualizar)) add("objetivo_sin_actualizar", "baja", `Objetivo sin actualizar hace más de ${cfg.dias_objetivo_sin_actualizar} días: ${o.titulo}`, ref);
    }
  }
  return out.sort((a, b) => SEV[a.severidad] - SEV[b.severidad] || String(a.fecha || "9999").localeCompare(String(b.fecha || "9999")) || a.persona.localeCompare(b.persona));
}

/* ---------------------------------- filtros ---------------------------------- */

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Rango [desde, hasta] de un período predefinido (semana, mes, trimestre, año, últimos 90 días, todo). */
export function rangoPeriodo(periodo, hoy, custom = {}) {
  const { y, m } = parts(hoy);
  switch (periodo) {
    case "semana": { const l = mondayOf(hoy); return { desde: l, hasta: addDaysISO(l, 6) }; }
    case "mes": return { desde: isoOf(y, m, 1), hasta: addDaysISO(isoOf(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1), -1) };
    case "trimestre": { const q0 = Math.floor((m - 1) / 3) * 3 + 1; const nx = q0 + 3; return { desde: isoOf(y, q0, 1), hasta: addDaysISO(isoOf(nx > 12 ? y + 1 : y, nx > 12 ? nx - 12 : nx, 1), -1) }; }
    case "anio": return { desde: isoOf(y, 1, 1), hasta: isoOf(y, 12, 31) };
    case "90d": return { desde: addDaysISO(hoy, -89), hasta: hoy };
    case "custom": return { desde: isValidISO(custom.desde) ? custom.desde : null, hasta: isValidISO(custom.hasta) ? custom.hasta : null };
    default: return { desde: null, hasta: null };
  }
}
export const enRango = (iso, r) => !!iso && (!r.desde || iso >= r.desde) && (!r.hasta || iso <= r.hasta);

/** Texto completo de una reunión para la búsqueda por palabras clave */
export function textoSesion(s) {
  const m = s.minuta || {};
  return norm([
    s.participantes, s.agenda, s.temas, s.fortalezas, s.logros, s.oportunidades, s.comentarios_lider, s.comentarios_colaborador,
    s.acuerdos, s.proximos_pasos, s.temas_pendientes, m.resumen, m.positivos, m.mejoras, m.decisiones, m.compromisos, m.responsables_fechas, m.proximos_pasos,
  ].map(toPlain).join("\n"));
}

export function filtrarSesiones(sesiones, { q = "", tipo = "", desde = "", hasta = "", estado = "" } = {}, compromisos = []) {
  const needle = norm(q.trim());
  return sesiones.filter((s) => {
    const f = fechaCL(s.fecha_hora);
    if (tipo && s.tipo !== tipo) return false;
    if (estado && s.estado !== estado) return false;
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    if (needle) {
      const enCompromisos = compromisos.some((c) => c.sesion_id === s.id && norm(c.descripcion).includes(needle));
      if (!textoSesion(s).includes(needle) && !enCompromisos) return false;
    }
    return true;
  });
}

/* ----------------------------- series para gráficos ----------------------------- */

/** Últimos n meses (más antiguo primero) terminando en el mes de `hoy`: [{ key: "2026-10", label: "Oct", y, m }] */
export function ultimosMeses(hoy, n = 6) {
  const { y, m } = parts(hoy);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12), mm = (total % 12) + 1;
    out.push({ key: `${yy}-${String(mm).padStart(2, "0")}`, label: MESES[mm - 1].slice(0, 3), y: yy, m: mm });
  }
  return out;
}

export function feedbackPorMes(sesiones, hoy, n = 6) {
  const meses = ultimosMeses(hoy, n);
  const cuenta = new Map(meses.map((x) => [x.key, 0]));
  for (const s of sesiones) {
    if (s.estado !== "publicada") continue;
    const k = fechaCL(s.fecha_hora).slice(0, 7);
    if (cuenta.has(k)) cuenta.set(k, cuenta.get(k) + 1);
  }
  return meses.map((x) => ({ ...x, valor: cuenta.get(x.key) }));
}

/** Compromisos creados y cumplidos por mes (para ver la evolución). */
export function compromisosPorMes(compromisos, hoy, n = 6) {
  const meses = ultimosMeses(hoy, n);
  const creados = new Map(meses.map((x) => [x.key, 0]));
  const cumplidos = new Map(meses.map((x) => [x.key, 0]));
  for (const c of compromisos) {
    const k1 = c.created_at ? fechaCL(c.created_at).slice(0, 7) : "";
    if (creados.has(k1)) creados.set(k1, creados.get(k1) + 1);
    const k2 = c.estado === "cumplido" && c.fecha_cumplimiento ? c.fecha_cumplimiento.slice(0, 7) : "";
    if (cumplidos.has(k2)) cumplidos.set(k2, cumplidos.get(k2) + 1);
  }
  return meses.map((x) => ({ ...x, creados: creados.get(x.key), cumplidos: cumplidos.get(x.key) }));
}

/** Objetivos cerrados (cumplidos) por mes de cierre */
export function objetivosCumplidosPorMes(objetivos, hoy, n = 6) {
  const meses = ultimosMeses(hoy, n);
  const cuenta = new Map(meses.map((x) => [x.key, 0]));
  for (const o of objetivos) {
    const k = o.estado === "cumplido" && o.fecha_cierre ? o.fecha_cierre.slice(0, 7) : "";
    if (cuenta.has(k)) cuenta.set(k, cuenta.get(k) + 1);
  }
  return meses.map((x) => ({ ...x, valor: cuenta.get(x.key) }));
}

/* ------------------------------- filtros del panel ------------------------------- */

/**
 * Aplica los filtros del panel (integrante, rol, categoría, estado de compromiso) y devuelve los datos ya recortados.
 * El período se aplica aparte, según qué mide cada indicador.
 */
export function aplicarFiltros(d, f) {
  const ids = (f.personas || []);
  const rolesSel = (f.roles || []);
  let personas = d.personas;
  if (ids.length) personas = personas.filter((p) => ids.includes(p.id));
  if (rolesSel.length) {
    const con = new Set(d.personaRoles.filter((r) => r.estado === "activo" && rolesSel.includes(r.rol_id)).map((r) => r.persona_id));
    personas = personas.filter((p) => con.has(p.id));
  }
  const pset = new Set(personas.map((p) => p.id));
  const cats = f.categorias || [];
  const estados = f.estados || [];
  return {
    personas,
    sesiones: d.sesiones.filter((s) => pset.has(s.persona_id)),
    compromisos: d.compromisos.filter((c) => pset.has(c.persona_id) && (!cats.length || cats.includes(c.categoria)) && (!estados.length || estados.includes(estadoEfectivo(c, f.hoy)))),
    objetivos: d.objetivos.filter((o) => pset.has(o.persona_id) && (!cats.length || cats.includes(o.categoria))),
    seguimientos: d.seguimientos.filter((s) => pset.has(s.persona_id)),
    personaRoles: d.personaRoles.filter((r) => pset.has(r.persona_id)),
  };
}

/* -------------------------------- panel comparativo -------------------------------- */

export function filaComparativa(persona, d, hoy, cfg, rolesPorId) {
  const r = resumenPersona(persona, d, hoy, cfg);
  return {
    id: persona.id, persona,
    roles: r.roles.map((x) => rolesPorId.get(x.rol_id)?.nombre).filter(Boolean),
    ultimoFeedback: r.ultimoFeedback,
    diasSinFeedback: r.diasSinFeedback,
    objetivos: r.objetivos,
    compromisos: r.compromisos,
    cumplimiento: r.cumplimiento,
    proxima: r.proximoSeguimiento?.fecha || null,
  };
}

/** Texto de la columna "Metas": detalle por estado, sin promedios entre objetivos que no son comparables. */
export function textoMetas(o) {
  if (!o.total) return "Sin objetivos";
  const partes = [`${o.cumplido} de ${o.total} cumplidos`];
  if (o.en_riesgo) partes.push(`${o.en_riesgo} en riesgo`);
  if (o.atrasados - o.en_riesgo > 0) partes.push(`${o.atrasados - o.en_riesgo} con fecha vencida`);
  return partes.join(" · ");
}

export function textoCompromisos(c) {
  if (!c.total) return "Sin compromisos";
  const partes = [`${c.abiertos} abierto${c.abiertos === 1 ? "" : "s"}`];
  if (c.vencido) partes.push(`${c.vencido} vencido${c.vencido === 1 ? "" : "s"}`);
  if (c.bloqueado) partes.push(`${c.bloqueado} bloqueado${c.bloqueado === 1 ? "" : "s"}`);
  return partes.join(" · ");
}

/* ----------------------------------- minuta ----------------------------------- */

const bloque = (titulo, texto) => (isBlank(texto) ? "" : `**${titulo}**\n${String(texto).trim()}`);

/**
 * Arma la minuta de 7 secciones a partir de lo escrito en el formulario. Es una propuesta que el líder revisa y edita
 * antes de guardarla: no usa inteligencia artificial ni agrega información que no esté en el formulario.
 */
export function buildMinuta({ persona, fechaHora, tipo, modalidad, participantes, temas, fortalezas, logros, oportunidades, comentariosLider, comentariosColaborador, acuerdos, proximosPasos, temasPendientes, proximaRevision, compromisos = [], nombrePorPersona = () => "" }) {
  const cabecera = `Reunión ${tipoLabel(tipo).toLowerCase()} con ${persona?.nombre || "—"} el ${fmtFechaHora(fechaHora)} (${modalidadLabel(modalidad).toLowerCase()})${isBlank(participantes) ? "" : `. Participantes: ${participantes.trim()}`}.`;
  const resumen = [cabecera, bloque("Temas tratados", temas), bloque("Comentarios del líder", comentariosLider), bloque("Comentarios del colaborador", comentariosColaborador)].filter(Boolean).join("\n\n");
  const positivos = [bloque("Fortalezas identificadas", fortalezas), bloque("Logros destacados", logros)].filter(Boolean).join("\n\n");
  const mejoras = isBlank(oportunidades) ? "" : String(oportunidades).trim();
  const decisiones = isBlank(acuerdos) ? "" : String(acuerdos).trim();
  const validos = compromisos.filter((c) => !isBlank(c.descripcion));
  const lc = validos.map((c) => `- ${c.descripcion.trim()}${c.fecha_vencimiento ? ` (vence el ${fmtDMY(c.fecha_vencimiento)}; prioridad ${prioridadMeta(c.prioridad).label.toLowerCase()})` : ""}`).join("\n");
  const rf = validos.map((c) => `- ${nombrePorPersona(c.persona_id) || persona?.nombre || "—"}: ${c.descripcion.trim()} — ${c.fecha_vencimiento ? fmtDMY(c.fecha_vencimiento) : "sin fecha"}`).join("\n");
  const pasos = [isBlank(proximosPasos) ? "" : String(proximosPasos).trim(), isBlank(temasPendientes) ? "" : bloque("Temas pendientes para la próxima reunión", temasPendientes), proximaRevision ? `Próxima revisión: ${fmtDMY(proximaRevision)}.` : ""].filter(Boolean).join("\n\n");
  return { resumen, positivos, mejoras, decisiones, compromisos: lc, responsables_fechas: rf, proximos_pasos: pasos };
}

/* ------------------------ comparación y versiones de minutas ------------------------ */

const CAMPOS_SESION = [
  ["tipo", "Tipo de reunión"], ["modalidad", "Modalidad"], ["fecha_hora", "Fecha y hora"], ["participantes", "Participantes"], ["agenda", "Agenda"], ["temas", "Temas tratados"],
  ["fortalezas", "Fortalezas"], ["logros", "Logros"], ["oportunidades", "Oportunidades de mejora"], ["comentarios_lider", "Comentarios del líder"],
  ["comentarios_colaborador", "Comentarios del colaborador"], ["acuerdos", "Acuerdos"], ["proximos_pasos", "Próximos pasos"], ["temas_pendientes", "Temas pendientes"],
  ["proxima_revision", "Próxima revisión"],
];
const CAMPOS_MINUTA = [
  ["resumen", "Minuta · Resumen"], ["positivos", "Minuta · Aspectos positivos"], ["mejoras", "Minuta · Oportunidades de mejora"], ["decisiones", "Minuta · Decisiones y acuerdos"],
  ["compromisos", "Minuta · Compromisos"], ["responsables_fechas", "Minuta · Responsables y fechas"], ["proximos_pasos", "Minuta · Próximos pasos"],
];

/** Qué cambió entre dos versiones (contenido guardado en fb_minuta_versiones). */
export function diffVersiones(antes, despues) {
  const out = [];
  const a = antes || {}, b = despues || {};
  for (const [k, label] of CAMPOS_SESION) {
    const x = String(a[k] ?? ""), y = String(b[k] ?? "");
    if (x !== y) out.push({ campo: k, label, antes: x, despues: y });
  }
  for (const [k, label] of CAMPOS_MINUTA) {
    const x = String(a.minuta?.[k] ?? ""), y = String(b.minuta?.[k] ?? "");
    if (x !== y) out.push({ campo: `minuta.${k}`, label, antes: x, despues: y });
  }
  return out;
}

/** Acuerdos, compromisos y puntos de dos reuniones, lado a lado (para comparar la evolución). */
export function compararSesiones(a, b, compromisos) {
  const lista = (s) => compromisos.filter((c) => c.sesion_id === s.id).map((c) => `${c.descripcion} (${fmtDMY(c.fecha_vencimiento_original)})`);
  const filas = [
    { label: "Decisiones y acuerdos", a: a.minuta?.decisiones || a.acuerdos || "", b: b.minuta?.decisiones || b.acuerdos || "" },
    { label: "Oportunidades de mejora", a: a.minuta?.mejoras || a.oportunidades || "", b: b.minuta?.mejoras || b.oportunidades || "" },
    { label: "Aspectos positivos", a: a.minuta?.positivos || "", b: b.minuta?.positivos || "" },
    { label: "Próximos pasos", a: a.minuta?.proximos_pasos || a.proximos_pasos || "", b: b.minuta?.proximos_pasos || b.proximos_pasos || "" },
  ];
  return { filas, compromisosA: lista(a), compromisosB: lista(b) };
}

/* ---------------------------- preparación de reuniones ---------------------------- */

export function prepararReunion(persona, d, hoy, cfg = CONFIG_DEFECTO) {
  const pid = persona.id;
  const ses = sesionesPublicadas(d.sesiones.filter((s) => s.persona_id === pid));
  const ultima = ses[0] || null;
  const fUlt = ultima ? fechaCL(ultima.fecha_hora) : null;
  const comps = d.compromisos.filter((c) => c.persona_id === pid);
  const abiertos = comps.filter(esAbierto).sort((a, b) => (a.fecha_vencimiento < b.fecha_vencimiento ? -1 : 1));
  const cumplidosDesde = comps.filter((c) => c.estado === "cumplido" && c.fecha_cumplimiento && (!fUlt || c.fecha_cumplimiento >= fUlt)).sort((a, b) => (a.fecha_cumplimiento < b.fecha_cumplimiento ? 1 : -1));
  const objetivos = d.objetivos.filter((o) => o.persona_id === pid && objetivoActivo(o));
  const objetivosAtencion = objetivos.filter((o) => objetivoAtrasado(o, hoy) || objetivoSinActualizar(o, hoy, cfg.dias_objetivo_sin_actualizar));
  const logrosRecientes = ses.slice(0, 3).filter((s) => !isBlank(s.logros)).map((s) => ({ sesionId: s.id, fecha: fechaCL(s.fecha_hora), texto: s.logros }));
  const temasPendientes = ses.slice(0, 3).filter((s) => !isBlank(s.temas_pendientes)).map((s) => ({ sesionId: s.id, fecha: fechaCL(s.fecha_hora), texto: s.temas_pendientes }));
  const alertas = alertasEquipo([persona], d, hoy, cfg);
  const vencidos = abiertos.filter((c) => c.fecha_vencimiento < hoy);
  const preguntas = [
    "¿Cómo te has sentido con la carga y el foco de trabajo estas semanas?",
    "¿Qué te gustaría que hiciéramos distinto para apoyarte mejor?",
  ];
  if (ultima) preguntas.push(`En nuestra última conversación (${fmtDMY(fUlt)}) acordamos algunos puntos: ¿cuáles sientes que avanzaron y cuáles no?`);
  if (vencidos.length) preguntas.push(`Hay ${vencidos.length} compromiso${vencidos.length === 1 ? "" : "s"} con fecha vencida: ¿qué se interpuso y qué necesitas para destrabarlo${vencidos.length === 1 ? "" : "s"}?`);
  if (abiertos.some((c) => c.estado === "bloqueado")) preguntas.push("Algunos compromisos están bloqueados: ¿qué decisión o recurso falta, y de quién depende?");
  if (abiertos.some(reprogramadoReiterado)) preguntas.push("Hay compromisos reprogramados más de una vez: ¿la fecha era realista o cambió la prioridad?");
  if (objetivosAtencion.length) preguntas.push(`Sobre «${objetivosAtencion[0].titulo}»: ¿qué ha costado más y qué apoyo concreto ayudaría?`);
  if (cumplidosDesde.length) preguntas.push("Cerraste compromisos desde la última vez: ¿qué aprendiste que quieras repetir?");
  if (logrosRecientes.length) preguntas.push("¿De qué logro reciente te sientes más orgulloso/a y cómo lo podemos visibilizar?");
  preguntas.push("¿Qué quieres desarrollar en los próximos meses y cómo puedo ayudarte a lograrlo?");

  const agenda = [
    ultima ? `**Seguimiento de la reunión anterior (${fmtDMY(fUlt)})**\n${abiertos.length ? abiertos.slice(0, 6).map((c) => `- Revisar: ${c.descripcion} (vence ${fmtDMY(c.fecha_vencimiento)})`).join("\n") : "- Sin compromisos abiertos"}` : "**Apertura**\n- Contexto del rol y expectativas",
    cumplidosDesde.length ? `**Reconocer avances**\n${cumplidosDesde.slice(0, 4).map((c) => `- ${c.descripcion}`).join("\n")}` : "",
    objetivosAtencion.length ? `**Objetivos que requieren atención**\n${objetivosAtencion.slice(0, 4).map((o) => `- ${o.titulo}`).join("\n")}` : "",
    temasPendientes.length ? `**Temas pendientes de reuniones anteriores**\n${temasPendientes.map((t) => toPlain(t.texto).split("\n").filter(Boolean).map((l) => `- ${l}`).join("\n")).join("\n")}` : "",
    "**Temas de esta conversación**\n- ",
    "**Acuerdos y próximos pasos**\n- ",
  ].filter(Boolean).join("\n\n");

  return { ultima, fechaUltima: fUlt, abiertos, vencidos, cumplidosDesde, objetivosAtencion, logrosRecientes, temasPendientes, alertas, preguntas, agenda };
}

/* ---------------------------------- validaciones ---------------------------------- */

/** Errores por campo de una reunión. `publicar` exige además el resumen de la minuta y revisa los compromisos. */
export function validarSesion(s, { hoy, publicar = false } = {}) {
  const e = {};
  if (!s.persona_id) e.persona_id = "Elige a la persona.";
  const f = s.fecha_hora ? fechaCL(s.fecha_hora) : "";
  if (!s.fecha_hora || !f) e.fecha_hora = "Indica fecha y hora válidas.";
  if (s.proxima_revision) {
    if (!isValidISO(s.proxima_revision)) e.proxima_revision = "La fecha de próxima revisión no es válida.";
    else if (f && s.proxima_revision < f) e.proxima_revision = "La próxima revisión no puede ser anterior a la reunión.";
  }
  const cs = s.compromisos_borrador || [];
  cs.forEach((c, i) => {
    const err = validarCompromiso(c, { desde: f || hoy });
    if (err) e[`compromiso_${i}`] = err;
  });
  if (publicar && isBlank(s.minuta?.resumen)) e.resumen = "La minuta necesita al menos el resumen de la conversación.";
  return e;
}

/** Valida un compromiso (descripción, responsable, fecha). `desde` es la primera fecha permitida. */
export function validarCompromiso(c, { desde } = {}) {
  if (isBlank(c.descripcion)) return "Falta la descripción del compromiso.";
  if (String(c.descripcion).trim().length > 2000) return "La descripción es demasiado larga (máximo 2.000 caracteres).";
  if (!c.fecha_vencimiento) return "Falta la fecha de vencimiento.";
  if (!isValidISO(c.fecha_vencimiento)) return "La fecha de vencimiento no es válida.";
  if (desde && c.fecha_vencimiento < desde) return `La fecha de vencimiento no puede ser anterior al ${fmtDMY(desde)}.`;
  return "";
}

/** Valida los datos de una revisión de compromiso antes de enviarla. */
export function validarRevision(c, r, hoy) {
  const e = {};
  const estado = r.estado_nuevo || c.estado;
  const pct = r.avance_pct === "" || r.avance_pct == null ? c.avance : Number(r.avance_pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) e.avance_pct = "El avance debe estar entre 0 y 100.";
  const cierra = estado === "cumplido" || estado === "cancelado";
  if (cierra && isBlank(r.resultado)) e.resultado = "Para cerrar el compromiso registra su resultado.";
  const reprog = !!r.vencimiento_nuevo && r.vencimiento_nuevo !== c.fecha_vencimiento;
  if (r.vencimiento_nuevo && !isValidISO(r.vencimiento_nuevo)) e.vencimiento_nuevo = "La nueva fecha no es válida.";
  else if (reprog) {
    if (cierra) e.vencimiento_nuevo = "No se reprograma un compromiso que se está cerrando.";
    else if (r.vencimiento_nuevo < hoy) e.vencimiento_nuevo = "La nueva fecha no puede ser anterior a hoy.";
    else if (isBlank(`${r.obstaculos || ""}${r.acciones_correctivas || ""}${r.comentarios_lider || ""}`)) e.obstaculos = "Al reprogramar indica el obstáculo, la acción correctiva o un comentario.";
  }
  if (estado === "cumplido" && r.fecha_cumplimiento) {
    if (!isValidISO(r.fecha_cumplimiento)) e.fecha_cumplimiento = "La fecha de cumplimiento no es válida.";
    else if (r.fecha_cumplimiento > hoy) e.fecha_cumplimiento = "La fecha de cumplimiento no puede estar en el futuro.";
  }
  if (r.proxima_revision && !cierra && r.proxima_revision !== c.fecha_proxima_revision && r.proxima_revision < hoy) e.proxima_revision = "La próxima revisión no puede ser anterior a hoy.";
  return e;
}

/** Cuerpo para la función fb_revisar_compromiso: solo los campos con contenido. */
export function payloadRevision(c, r) {
  const p = {};
  if (r.estado_nuevo && r.estado_nuevo !== c.estado) p.estado_nuevo = r.estado_nuevo;
  if (r.avance_pct !== "" && r.avance_pct != null && Number(r.avance_pct) !== c.avance) p.avance_pct = Number(r.avance_pct);
  for (const k of ["avance_texto", "obstaculos", "evidencias", "comentarios_lider", "comentarios_integrante", "acciones_correctivas", "resultado"]) {
    if (!isBlank(r[k])) p[k] = String(r[k]).trim();
  }
  if (r.vencimiento_nuevo && r.vencimiento_nuevo !== c.fecha_vencimiento) p.vencimiento_nuevo = r.vencimiento_nuevo;
  if (r.fecha_cumplimiento) p.fecha_cumplimiento = r.fecha_cumplimiento;
  if (r.proxima_revision !== undefined && r.proxima_revision !== (c.fecha_proxima_revision || "")) p.proxima_revision = r.proxima_revision || "";
  return p;
}

/** Hay algo para registrar? (evita revisiones vacías) */
export const revisionVacia = (p) => Object.keys(p).length === 0;

/* ----------------------------------- utilidades ----------------------------------- */

export const fmtFechaCorta = (iso) => (iso ? fmtDM(iso) : "—");
export const fmtFecha = (iso) => (iso ? fmtDMY(iso) : "—");
export const iniciales = (nombre) => (nombre || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/** Lee un umbral de fb_config (filas { clave, valor: { dias } }) con valor por defecto. */
export function cfgDesdeFilas(filas = []) {
  const o = { ...CONFIG_DEFECTO };
  for (const f of filas) {
    const n = Number(f.valor?.dias);
    if (f.clave in o && Number.isFinite(n) && n > 0) o[f.clave] = Math.round(n);
  }
  return o;
}

/* ------------------------- evolución de una persona en el tiempo ------------------------- */

/**
 * Línea de tiempo de hechos de una persona (más reciente primero): reuniones publicadas, compromisos creados y cerrados,
 * revisiones que cambiaron estado o fecha, objetivos cumplidos y roles asignados. Cada hecho dice a qué registro lleva.
 */
export function eventosPersona(personaId, d) {
  const out = [];
  const rolNombre = new Map((d.roles || []).map((r) => [r.id, r.nombre]));
  for (const s of d.sesiones.filter((x) => x.persona_id === personaId && x.estado === "publicada")) {
    out.push({ fecha: fechaCL(s.fecha_hora), orden: s.fecha_hora, tipo: "feedback", titulo: `Reunión: ${tipoLabel(s.tipo)}`, detalle: (s.minuta?.resumen ? toPlain(s.minuta.resumen).split("\n").slice(0, 1).join(" ") : ""), ref: { kind: "sesion", id: s.id } });
  }
  for (const c of d.compromisos.filter((x) => x.persona_id === personaId)) {
    out.push({ fecha: fechaCL(c.created_at), orden: c.created_at, tipo: "compromiso_creado", titulo: `Compromiso creado: ${c.descripcion}`, detalle: `Vence el ${fmtDMY(c.fecha_vencimiento_original)}`, ref: { kind: "compromiso", id: c.id } });
    if ((c.estado === "cumplido" || c.estado === "cancelado") && c.fecha_cumplimiento !== undefined) {
      const f = c.estado === "cumplido" ? c.fecha_cumplimiento : (c.updated_at ? fechaCL(c.updated_at) : null);
      if (f) out.push({ fecha: f, orden: `${f}T23:59:59Z`, tipo: c.estado === "cumplido" ? "compromiso_cumplido" : "compromiso_cancelado", titulo: `Compromiso ${c.estado === "cumplido" ? "cumplido" : "cancelado"}: ${c.descripcion}`, detalle: c.resultado_final || "", ref: { kind: "compromiso", id: c.id } });
    }
  }
  for (const r of (d.revisiones || []).filter((x) => x.persona_id === personaId)) {
    const reprog = r.vencimiento_nuevo !== r.vencimiento_anterior;
    if (reprog) out.push({ fecha: r.fecha, orden: r.created_at, tipo: "reprogramacion", titulo: "Compromiso reprogramado", detalle: `${fmtDMY(r.vencimiento_anterior)} → ${fmtDMY(r.vencimiento_nuevo)}${r.obstaculos ? ` · ${r.obstaculos}` : ""}`, ref: { kind: "compromiso", id: r.compromiso_id } });
  }
  for (const o of d.objetivos.filter((x) => x.persona_id === personaId && x.estado === "cumplido" && x.fecha_cierre)) {
    out.push({ fecha: o.fecha_cierre, orden: `${o.fecha_cierre}T23:59:59Z`, tipo: "objetivo_cumplido", titulo: `Objetivo cumplido: ${o.titulo}`, detalle: "", ref: { kind: "objetivo", id: o.id } });
  }
  for (const pr of d.personaRoles.filter((x) => x.persona_id === personaId)) {
    out.push({ fecha: pr.fecha_asignacion, orden: `${pr.fecha_asignacion}T00:00:01Z`, tipo: "rol", titulo: `Rol asignado: ${rolNombre.get(pr.rol_id) || "—"}`, detalle: pr.estado === "historico" && pr.fecha_termino ? `Hasta el ${fmtDMY(pr.fecha_termino)}` : "", ref: { kind: "rol", id: pr.id } });
  }
  return out.filter((e) => e.fecha).sort((a, b) => String(b.orden).localeCompare(String(a.orden)));
}
