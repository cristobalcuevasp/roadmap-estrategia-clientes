/* Exportar e importar mailings en CSV (compatible con Excel en español: separador ";", UTF-8 con BOM).
   La importación nunca escribe nada por sí sola: devuelve una vista previa con errores y avisos por fila. */

import { parseFlexibleDate, fmtDMY } from "./calendar";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;

export const COLUMNAS = [
  { key: "fecha", label: "Fecha", alias: ["fecha", "fecha envio", "fecha de envio", "dia"] },
  { key: "hora", label: "Hora", alias: ["hora"] },
  { key: "titulo", label: "Título", alias: ["titulo", "mailing", "nombre", "campana", "nombre del mailing"] },
  { key: "responsable", label: "Responsable", alias: ["responsable", "resp", "encargado"] },
  { key: "einstein", label: "Einstein", alias: ["einstein"] },
  { key: "configuracion", label: "Configuración", alias: ["configuracion", "config"] },
  { key: "estado", label: "Estado", alias: ["estado"] },
  { key: "segmento", label: "Segmento", alias: ["segmento", "audiencia", "publico"] },
  { key: "marca", label: "Marca", alias: ["marca"] },
  { key: "objetivo", label: "Objetivo", alias: ["objetivo"] },
  { key: "canal", label: "Canal", alias: ["canal"] },
  { key: "observaciones", label: "Observaciones", alias: ["observaciones", "observacion", "notas", "comentarios"] },
  { key: "enviado_en", label: "Enviado el", alias: ["enviado el", "fecha de envio real", "enviado"] },
  { key: "id_externo", label: "ID externo", alias: ["id externo", "id", "id marketing cloud", "id mc"] },
];

export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ---------------------------- exportar ---------------------------- */

/** Evita que Excel interprete una celda de texto como fórmula (=, +, -, @). */
function safeCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return s;
}
function csvCell(v, sep) {
  const s = safeCell(v);
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** lookups: { nombre(id) → texto } por lista. mailings: filas de crm_mailings. */
export function mailingsToCSV(mailings, names, sep = ";") {
  const head = COLUMNAS.map((c) => c.label);
  const lines = [head.map((h) => csvCell(h, sep)).join(sep)];
  const sorted = [...mailings].sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
  for (const m of sorted) {
    const row = [
      fmtDMY(m.fecha), (m.hora || "").slice(0, 5), names.catalogo(m.titulo_id), names.responsable(m.responsable_id),
      names.catalogo(m.einstein_id), names.catalogo(m.configuracion_id), names.catalogo(m.estado_id), m.segmento,
      names.catalogo(m.marca_id), m.objetivo, names.catalogo(m.canal_id), m.observaciones, m.enviado_en ? fmtDMY(m.enviado_en) : "", m.id_externo,
    ];
    lines.push(row.map((c) => csvCell(c, sep)).join(sep));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* ---------------------------- importar ---------------------------- */

/** Analizador CSV con comillas, saltos de línea dentro de celdas y detección de separador. */
export function parseCSV(text) {
  let src = String(text ?? "").replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] || "";
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let q = false;
  for (const ch of firstLine) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
  const [best, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const delimiter = bestCount > 0 ? best : ";";

  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") inQ = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return { delimiter, rows, unclosedQuote: inQ };
}

const unsafe = (s) => String(s ?? "").replace(/^'(?=[=+\-@])/, "").trim();

const exact = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Coincidencia exacta (sin distinguir mayúsculas) y, si no hay, coincidencia sin tildes ni signos solo cuando es única. */
function findByName(list, text) {
  const e = exact(text);
  if (!e) return null;
  const hit = list.find((x) => exact(x.nombre) === e);
  if (hit) return hit;
  const n = norm(text);
  const loose = list.filter((x) => norm(x.nombre) === n);
  return loose.length === 1 ? loose[0] : null;
}

function parseHora(text) {
  const s = String(text ?? "").trim();
  if (!s) return { ok: true, value: null };
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return { ok: false };
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return { ok: false };
  return { ok: true, value: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}` };
}

/**
 * Vista previa de una importación.
 * ctx: { catalogo: [{id, lista, nombre}], responsables: [{id, nombre, iniciales, email}], existentes: [mailing] }
 * Cada fila: { linea, data, errores[], avisos[], tituloNuevo, duplicada, ok }
 */
export function previewImport(text, ctx) {
  const out = { delimiter: ";", columnas: [], faltantes: [], filas: [], errorGeneral: null };
  if (typeof text !== "string" || text.trim() === "") { out.errorGeneral = "El archivo está vacío."; return out; }
  if (text.length > MAX_IMPORT_BYTES) { out.errorGeneral = "El archivo supera los 2 MB. Divídelo en partes."; return out; }
  const parsed = parseCSV(text);
  out.delimiter = parsed.delimiter;
  if (parsed.unclosedQuote) { out.errorGeneral = "El archivo tiene comillas sin cerrar; revísalo antes de importar."; return out; }
  if (parsed.rows.length < 2) { out.errorGeneral = "No hay filas de datos: se necesita una fila de encabezados y al menos un mailing."; return out; }
  if (parsed.rows.length - 1 > MAX_IMPORT_ROWS) { out.errorGeneral = `El archivo tiene más de ${MAX_IMPORT_ROWS} filas. Divídelo en partes.`; return out; }

  const header = parsed.rows[0].map(norm);
  const colIndex = {};
  for (const c of COLUMNAS) {
    const i = header.findIndex((h) => c.alias.includes(h));
    if (i !== -1) colIndex[c.key] = i;
  }
  out.columnas = COLUMNAS.filter((c) => colIndex[c.key] !== undefined).map((c) => c.label);
  out.faltantes = ["fecha", "titulo"].filter((k) => colIndex[k] === undefined).map((k) => COLUMNAS.find((c) => c.key === k).label);
  if (out.faltantes.length) { out.errorGeneral = `Faltan columnas obligatorias: ${out.faltantes.join(", ")}.`; return out; }

  const by = (lista) => ctx.catalogo.filter((x) => x.lista === lista && x.activo !== false);
  const titulos = by("titulo"), estados = by("estado"), einstein = by("einstein"), configs = by("configuracion"), marcas = by("marca"), canales = by("canal");
  const respList = (ctx.responsables || []).filter((r) => r.activo !== false);
  const pendiente = estados.find((e) => e.semantica === "pendiente");
  const claveExistente = new Set((ctx.existentes || []).map((m) => `${m.fecha}|${m.titulo_id}|${norm(m.segmento)}|${(m.hora || "").slice(0, 5)}`));
  const vistas = new Set();

  parsed.rows.slice(1).forEach((cells, idx) => {
    const get = (k) => (colIndex[k] === undefined ? "" : unsafe(cells[colIndex[k]]));
    const errores = [], avisos = [];
    const data = {};
    const linea = idx + 2;

    data.fecha = parseFlexibleDate(get("fecha"));
    if (!data.fecha) errores.push(get("fecha") ? `Fecha inválida: "${get("fecha")}" (usa DD/MM/AAAA)` : "Falta la fecha");

    const h = parseHora(get("hora"));
    if (!h.ok) errores.push(`Hora inválida: "${get("hora")}" (usa HH:MM)`); else data.hora = h.value;

    const tituloTxt = get("titulo");
    let tituloNuevo = null;
    if (!tituloTxt) errores.push("Falta el título");
    else {
      const t = findByName(titulos, tituloTxt);
      if (t) data.titulo_id = t.id; else { tituloNuevo = tituloTxt.replace(/\s+/g, " "); avisos.push(`Título nuevo: se agregará "${tituloNuevo}" al catálogo`); }
    }

    const resolveList = (key, list, label, out_key) => {
      const v = get(key);
      if (!v) { data[out_key] = null; return; }
      const item = findByName(list, v);
      if (item) data[out_key] = item.id; else errores.push(`${label} no existe en el catálogo: "${v}"`);
    };
    resolveList("einstein", einstein, "Einstein", "einstein_id");
    resolveList("configuracion", configs, "Configuración", "configuracion_id");
    resolveList("marca", marcas, "Marca", "marca_id");
    resolveList("canal", canales, "Canal", "canal_id");

    const estadoTxt = get("estado");
    if (!estadoTxt) {
      if (pendiente) { data.estado_id = pendiente.id; avisos.push("Sin estado: quedará Pendiente"); } else errores.push("Falta el estado y no hay un estado Pendiente en el catálogo");
    } else {
      const e = findByName(estados, estadoTxt);
      if (e) data.estado_id = e.id; else errores.push(`Estado no existe en el catálogo: "${estadoTxt}"`);
    }

    const respTxt = get("responsable");
    if (!respTxt) data.responsable_id = null;
    else {
      const n = norm(respTxt);
      const r = respList.find((x) => norm(x.nombre) === n || norm(x.iniciales) === n || (x.email && norm(x.email) === n));
      if (r) data.responsable_id = r.id; else errores.push(`Responsable no existe: "${respTxt}"`);
    }

    data.segmento = get("segmento"); data.objetivo = get("objetivo"); data.observaciones = get("observaciones"); data.id_externo = get("id_externo");
    const env = get("enviado_en");
    if (env) { const d = parseFlexibleDate(env); if (d) data.enviado_en = d; else avisos.push(`"Enviado el" no se pudo leer ("${env}"); se ignora`); }

    let duplicada = false;
    if (data.fecha && (data.titulo_id || tituloNuevo)) {
      const clave = `${data.fecha}|${data.titulo_id || "nuevo:" + norm(tituloNuevo)}|${norm(data.segmento)}|${data.hora || ""}`;
      if (data.titulo_id && claveExistente.has(clave)) { duplicada = true; avisos.push("Ya existe un mailing igual (misma fecha, título, segmento y hora): se omitirá salvo que lo incluyas"); }
      else if (vistas.has(clave)) { duplicada = true; avisos.push("Repetida dentro del mismo archivo"); }
      vistas.add(clave);
    }

    out.filas.push({ linea, data, errores, avisos, tituloNuevo, duplicada, ok: errores.length === 0 });
  });
  return out;
}

