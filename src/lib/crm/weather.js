/* Clima para Programación CRM.
   Dato: probabilidad de precipitación diaria (%) entregada por la fuente meteorológica, por comuna.
   Región = promedio ponderado por tiendas abiertas de las comunas con dato. Nada se inventa:
   sin dato no hay valor, y se informa la cobertura (comunas y tiendas que sí tienen dato). */

import { diffDays } from "./calendar";

export const CORTES_POR_DEFECTO = [20, 40, 60, 80];

/* Escala roja: más oscuro = más probabilidad. Clases completas para que Tailwind las incluya.
   El tema claro/oscuro de la app es una opción propia (no el del sistema), por eso hay un par [claro, oscuro]. */
export const BANDAS = [
  { id: 0, label: "Muy baja", tint: "", bar: "bg-red-500/10", chip: ["bg-red-500/5 text-red-700", "bg-red-500/10 text-red-300"] },
  { id: 1, label: "Baja", tint: "bg-red-500/5", bar: "bg-red-500/25", chip: ["bg-red-500/10 text-red-700", "bg-red-500/[.15] text-red-300"] },
  { id: 2, label: "Moderada", tint: "bg-red-500/10", bar: "bg-red-500/[.45]", chip: ["bg-red-500/20 text-red-800", "bg-red-500/25 text-red-200"] },
  { id: 3, label: "Alta", tint: "bg-red-500/20", bar: "bg-red-500/70", chip: ["bg-red-500/[.35] text-red-900", "bg-red-500/[.45] text-red-100"] },
  { id: 4, label: "Muy alta", tint: "bg-red-500/30", bar: "bg-red-600", chip: ["bg-red-600 text-white", "bg-red-600 text-white"] },
];

/** Normaliza los cortes (4 valores crecientes entre 1 y 99); si vienen mal, usa los de fábrica. */
export function normalizeCortes(c) {
  const arr = Array.isArray(c) ? c.map(Number) : [];
  const ok = arr.length === 4 && arr.every((x) => Number.isFinite(x) && x > 0 && x < 100) && arr.every((x, i) => i === 0 || x > arr[i - 1]);
  return ok ? arr : CORTES_POR_DEFECTO;
}

/** Banda 0..4 según los cortes; null si no hay dato. */
export function bandIndex(prob, cortes = CORTES_POR_DEFECTO) {
  if (prob === null || prob === undefined || Number.isNaN(Number(prob))) return null;
  const p = Number(prob);
  let i = 0;
  while (i < cortes.length && p >= cortes[i]) i++;
  return i;
}

export function bandRangeLabel(i, cortes = CORTES_POR_DEFECTO) {
  const lo = i === 0 ? 0 : cortes[i - 1];
  const hi = i === cortes.length ? 100 : cortes[i] - 1;
  return i === cortes.length ? `${lo} % o más` : `${lo} a ${hi} %`;
}

/** Índice del pronóstico vigente: Map "comunaId|fecha" -> fila. */
export function indexForecast(rows) {
  const m = new Map();
  for (const r of rows || []) m.set(`${r.comuna_id}|${r.fecha}`, r);
  return m;
}

/**
 * Probabilidad regional de lluvia en una fecha.
 * @param comunas  filas de crm_comunas { id, region_id, tiendas_abiertas }
 * @param index    resultado de indexForecast
 * @param regionId id de región o "todas"
 * @returns null si no hay ningún dato; si no, { prob, comunasConDato, comunasTotal, tiendasConDato, tiendasTotal, parcial, obtenidoEl, fuente, sobreUmbral(u) }
 */
export function regionDay(comunas, index, regionId, fecha) {
  let pesoTotal = 0, suma = 0, comunasConDato = 0, tiendasConDato = 0, tiendasTotal = 0, comunasTotal = 0;
  let obtenidoEl = null, fuente = null;
  const datos = [];
  for (const c of comunas || []) {
    if (regionId !== "todas" && c.region_id !== regionId) continue;
    const w = Number(c.tiendas_abiertas) || 0;
    if (w <= 0) continue; // sin tiendas abiertas no pesa ni se consulta
    comunasTotal++; tiendasTotal += w;
    const row = index.get(`${c.id}|${fecha}`);
    if (!row || row.prob_precip === null || row.prob_precip === undefined) continue;
    comunasConDato++; tiendasConDato += w;
    suma += Number(row.prob_precip) * w; pesoTotal += w;
    datos.push({ prob: Number(row.prob_precip), w });
    if (!obtenidoEl || row.obtenido_el > obtenidoEl) obtenidoEl = row.obtenido_el;
    fuente = row.fuente || fuente;
  }
  if (pesoTotal === 0) return null;
  return {
    prob: Math.round(suma / pesoTotal),
    comunasConDato, comunasTotal, tiendasConDato, tiendasTotal,
    parcial: comunasConDato < comunasTotal,
    obtenidoEl, fuente,
    /** % de las tiendas con dato cuya comuna supera el umbral */
    sobreUmbral: (umbral) => Math.round((datos.filter((d) => d.prob >= umbral).reduce((a, d) => a + d.w, 0) / pesoTotal) * 100),
  };
}

/** Por comuna dentro de la región, ordenado de mayor a menor probabilidad (para el panel del día). */
export function communeDetail(comunas, index, regionId, fecha) {
  return (comunas || [])
    .filter((c) => (regionId === "todas" || c.region_id === regionId) && (Number(c.tiendas_abiertas) || 0) > 0)
    .map((c) => { const row = index.get(`${c.id}|${fecha}`); return { comuna: c, prob: row ? row.prob_precip : null, mm: row ? row.mm : null, tmin: row ? row.tmin : null, tmax: row ? row.tmax : null }; })
    .sort((a, b) => (b.prob ?? -1) - (a.prob ?? -1) || b.comuna.tiendas_abiertas - a.comuna.tiendas_abiertas);
}

/**
 * Qué representa el dato de esa fecha:
 *  - "pasado": fecha anterior a hoy → es el último pronóstico emitido, no una medición.
 *  - "pronostico": dentro de los días de pronóstico confiable configurados (por defecto 7).
 *  - "tendencia": más allá, solo referencial.
 */
export function horizonKind(fecha, hoy, diasPronostico = 7) {
  const d = diffDays(fecha, hoy);
  if (d < 0) return "pasado";
  if (d < diasPronostico) return "pronostico";
  return "tendencia";
}
export const HORIZON_LABEL = { pasado: "Último pronóstico emitido (no es una medición)", pronostico: "Pronóstico", tendencia: "Tendencia (menos confiable)" };

/**
 * Sugerencia contextual (hipótesis, no dato): si más de `proporcion` % de las tiendas con dato supera `umbral` % de lluvia.
 * Siempre requiere validación humana; el sistema nunca programa ni envía nada por el clima.
 */
export function rainSuggestion(day, cfg = { umbral: 60, proporcion: 50 }) {
  if (!day) return null;
  const pct = day.sobreUmbral(cfg.umbral);
  if (pct > cfg.proporcion) {
    return { texto: "Evaluar campaña contextual de lluvia", detalle: `${pct} % de las tiendas con dato están en comunas con probabilidad de lluvia de ${cfg.umbral} % o más.`, etiqueta: "Sugerencia, requiere validación humana" };
  }
  return null;
}

/** Textos de atribución que exige cada proveedor de clima cuando se muestran sus datos. */
export const CREDITO_OPENWEATHER = "Weather data © OpenWeather.";
export const CREDITO_GOOGLE = "Source: Includes weather data from Google.";

/**
 * Atribución que corresponde a las fuentes de los datos que se están mostrando.
 * @param fuentes lista de textos `fuente` (p. ej. "OpenWeather One Call 3.0", "Google Maps Platform Weather API")
 * @returns "" si no hay datos o la fuente no es una de las conocidas
 */
export function creditoClima(fuentes) {
  const set = new Set((fuentes || []).map((f) => String(f || "")));
  const out = [];
  for (const f of set) {
    if (/openweather/i.test(f) && !out.includes(CREDITO_OPENWEATHER)) out.push(CREDITO_OPENWEATHER);
    if (/google/i.test(f) && !out.includes(CREDITO_GOOGLE)) out.push(CREDITO_GOOGLE);
  }
  return out.join(" ");
}

/** Proveedores de clima distintos presentes en los datos cargados ("openweather" | "google"). */
export function proveedoresClima(fuentes) {
  const set = new Set((fuentes || []).map((f) => String(f || "")));
  const out = [];
  for (const f of set) {
    if (/openweather/i.test(f) && !out.includes("openweather")) out.push("openweather");
    if (/google/i.test(f) && !out.includes("google")) out.push("google");
  }
  return out;
}
