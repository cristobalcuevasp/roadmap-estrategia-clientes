/* Filtros, conflictos, indicadores y carga de trabajo del calendario CRM (funciones puras). */

import { norm } from "./csv";

/** Semántica del estado de un mailing: pendiente | enviado | cancelado | otro. */
export const semanticaDe = (m, catById) => catById.get(m.estado_id)?.semantica || "otro";

export const FILTROS_VACIOS = { responsables: [], estado: "todos", titulo: "todos", q: "" };

export function filterMailings(mailings, f, catById) {
  const q = norm(f.q || "");
  return mailings.filter((m) => {
    if (f.responsables.length) {
      const key = m.responsable_id || "sin";
      if (!f.responsables.includes(key)) return false;
    }
    if (f.estado !== "todos" && m.estado_id !== f.estado) return false;
    if (f.titulo !== "todos" && m.titulo_id !== f.titulo) return false;
    if (q) {
      const hay = norm([catById.get(m.titulo_id)?.nombre, m.segmento, m.objetivo, m.observaciones, m.id_externo].join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function groupByDate(mailings, catById) {
  const map = new Map();
  for (const m of mailings) {
    const list = map.get(m.fecha) || [];
    list.push(m);
    map.set(m.fecha, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99") || (catById.get(a.titulo_id)?.nombre || "").localeCompare(catById.get(b.titulo_id)?.nombre || "") || a.id.localeCompare(b.id));
  }
  return map;
}

/**
 * Posibles conflictos entre mailings no cancelados del mismo día. Son avisos, nunca bloqueos:
 *  - mismo segmento (texto exacto, sin distinguir mayúsculas ni tildes) el mismo día
 *  - misma hora exacta el mismo día
 * Con el segmento como texto libre no se puede saber si dos audiencias distintas se solapan; esto solo detecta coincidencias exactas.
 * @returns Map idMailing -> [{ tipo, con: idOtro, texto }]
 */
export function conflictMap(mailings, catById) {
  const out = new Map();
  const live = mailings.filter((m) => semanticaDe(m, catById) !== "cancelado");
  const byDay = new Map();
  for (const m of live) { const l = byDay.get(m.fecha) || []; l.push(m); byDay.set(m.fecha, l); }
  const add = (id, item) => { const l = out.get(id) || []; l.push(item); out.set(id, l); };
  const name = (m) => catById.get(m.titulo_id)?.nombre || "otro mailing";
  for (const list of byDay.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const segA = norm(a.segmento), segB = norm(b.segmento);
        if (segA && segA === segB) {
          add(a.id, { tipo: "segmento", con: b.id, texto: `Mismo segmento («${a.segmento}») el mismo día que «${name(b)}»` });
          add(b.id, { tipo: "segmento", con: a.id, texto: `Mismo segmento («${b.segmento}») el mismo día que «${name(a)}»` });
        }
        const hA = (a.hora || "").slice(0, 5), hB = (b.hora || "").slice(0, 5);
        if (hA && hA === hB) {
          add(a.id, { tipo: "hora", con: b.id, texto: `Misma hora (${hA}) que «${name(b)}»` });
          add(b.id, { tipo: "hora", con: a.id, texto: `Misma hora (${hB}) que «${name(a)}»` });
        }
      }
    }
  }
  return out;
}

/** Conflictos que tendría un mailing (existente o por crear) frente a los demás de su día. */
export function conflictsForDraft(draft, mailings, catById) {
  const others = mailings.filter((m) => m.id !== draft.id && m.fecha === draft.fecha && semanticaDe(m, catById) !== "cancelado");
  const name = (m) => catById.get(m.titulo_id)?.nombre || "otro mailing";
  const out = [];
  const seg = norm(draft.segmento);
  const h = (draft.hora || "").slice(0, 5);
  for (const o of others) {
    if (seg && norm(o.segmento) === seg) out.push(`Mismo segmento («${o.segmento}») que «${name(o)}» ese día`);
    if (h && (o.hora || "").slice(0, 5) === h) out.push(`Misma hora (${h}) que «${name(o)}»`);
  }
  return out;
}

/**
 * Indicadores de un rango de fechas [desde, hasta].
 * planificados = no cancelados; enviados = estado con semántica "enviado".
 * vencidosPendientes = fecha anterior a hoy y todavía Pendiente (probable olvido de marcar el envío).
 */
export function rangeKpis(mailings, { desde, hasta, hoy, catById, feriadoDe, esFinDeSemana, oportunidadDe }) {
  const inRange = mailings.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  let planificados = 0, enviados = 0, pendientes = 0, cancelados = 0, vencidosPendientes = 0, enFeriado = 0, enFinDeSemana = 0, enAlta = 0;
  const porDia = new Map();
  for (const m of inRange) {
    const s = semanticaDe(m, catById);
    if (s === "cancelado") { cancelados++; continue; }
    planificados++;
    if (s === "enviado") enviados++;
    if (s === "pendiente") { pendientes++; if (m.fecha < hoy) vencidosPendientes++; }
    porDia.set(m.fecha, (porDia.get(m.fecha) || 0) + 1);
    if (feriadoDe && feriadoDe(m.fecha)) enFeriado++;
    if (esFinDeSemana && esFinDeSemana(m.fecha)) enFinDeSemana++;
    if (oportunidadDe && oportunidadDe(m.fecha) === "alta") enAlta++;
  }
  const diasConVarios = [...porDia.values()].filter((n) => n > 1).length;
  return { total: inRange.length, planificados, enviados, pendientes, cancelados, vencidosPendientes, enFeriado, enFinDeSemana, enAlta, diasConVarios, cumplimiento: planificados ? Math.round((enviados / planificados) * 100) : null };
}

/** Carga por responsable en el rango: cantidad de mailings no cancelados (y cuántos ya enviados). */
export function workload(mailings, responsables, { desde, hasta, catById }) {
  const rows = new Map(responsables.map((r) => [r.id, { responsable: r, total: 0, enviados: 0 }]));
  rows.set("sin", { responsable: null, total: 0, enviados: 0 });
  for (const m of mailings) {
    if (m.fecha < desde || m.fecha > hasta) continue;
    const s = semanticaDe(m, catById);
    if (s === "cancelado") continue;
    const row = rows.get(m.responsable_id || "sin") || rows.get("sin");
    row.total++;
    if (s === "enviado") row.enviados++;
  }
  return [...rows.values()].filter((r) => r.total > 0 || r.responsable?.activo).sort((a, b) => b.total - a.total);
}

/** Etiquetas legibles para el historial (nombre de la columna → texto). */
export const CAMPO_LABEL = {
  fecha: "la fecha", hora: "la hora", titulo_id: "el título", responsable_id: "el responsable", einstein_id: "Einstein", configuracion_id: "la configuración",
  estado_id: "el estado", segmento: "el segmento", marca_id: "la marca", objetivo: "el objetivo", canal_id: "el canal", observaciones: "las observaciones",
  enviado_en: "la fecha de envío", id_externo: "el ID externo", estado: "el estado", cuerpo: "el texto", semana: "la semana", avisar: "el aviso", activo: "si está activo",
  nombre: "el nombre", definicion: "la definición", color: "el color", orden: "el orden", iniciales: "las iniciales", email: "el correo", nivel: "el nivel", params: "los parámetros", justificacion: "la justificación",
};
