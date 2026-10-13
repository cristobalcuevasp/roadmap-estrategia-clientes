// Lógica pura de la función crm-clima: arma la consulta a OpenWeather One Call y
// convierte la respuesta en filas para crm_clima_pronostico. Está separada de index.ts
// para poder probarla con Node (tests/crm-openweather.test.js) sin necesitar Deno.

export const FUENTE = "OpenWeather One Call 3.0";
export const ENDPOINT = "https://api.openweathermap.org/data/3.0/onecall";

export interface FilaClima {
  comuna_id: number;
  fecha: string; // AAAA-MM-DD, día local de la comuna
  obtenido_el: string; // AAAA-MM-DD en Santiago: cuándo se consultó
  prob_precip: number; // 0..100
  mm: number | null;
  tmin: number | null;
  tmax: number | null;
  fuente: string;
}

export class ErrorClima extends Error {
  status?: number;
  fatal: boolean; // true: no tiene sentido seguir consultando otras comunas
  constructor(message: string, opts: { status?: number; fatal?: boolean } = {}) {
    super(message);
    this.name = "ErrorClima";
    this.status = opts.status;
    this.fatal = !!opts.fatal;
  }
}

/** Quita la clave y cualquier "appid=..." de un texto antes de guardarlo o devolverlo. */
export function limpiar(texto: unknown, clave?: string): string {
  let t = String(texto ?? "");
  if (clave) t = t.split(clave).join("[clave]");
  return t.replace(/appid=[^&\s"')]+/gi, "appid=[clave]").slice(0, 300);
}

export function urlOneCall(lat: number, lon: number, clave: string, base = ENDPOINT): string {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    exclude: "current,minutely,hourly,alerts",
    units: "metric",
    appid: clave,
  });
  return `${base}?${p.toString()}`;
}

/** Fecha local (AAAA-MM-DD) de un instante Unix, con el desfase horario que informa la fuente. */
export function fechaLocal(dt: number, offsetSegundos: number): string {
  return new Date((dt + offsetSegundos) * 1000).toISOString().slice(0, 10);
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const redondear = (v: number, dec: number) => Math.round(v * 10 ** dec) / 10 ** dec;

/** Texto de error según el estado HTTP de OpenWeather. */
export function errorPorEstado(status: number): ErrorClima {
  if (status === 401 || status === 403) {
    return new ErrorClima(
      "OpenWeather rechazó la clave (" + status + "). Revisa que la clave esté activa y que la suscripción “One Call by Call” esté habilitada en la cuenta de OpenWeather.",
      { status, fatal: true },
    );
  }
  if (status === 429) {
    return new ErrorClima("OpenWeather informó que se superó el límite de consultas (429).", { status, fatal: true });
  }
  return new ErrorClima("OpenWeather respondió con el estado " + status + ".", { status, fatal: false });
}

/**
 * Convierte la respuesta de One Call en filas diarias. Descarta los días cuya probabilidad
 * no es un número entre 0 y 1 (no se inventan datos). Lanza ErrorClima si la respuesta no
 * trae pronóstico diario.
 */
export function filasDesdeRespuesta(payload: any, comunaId: number, obtenidoEl: string, fuente = FUENTE): FilaClima[] {
  const daily = payload?.daily;
  if (!Array.isArray(daily) || daily.length === 0) {
    throw new ErrorClima("La respuesta de OpenWeather no incluye pronóstico diario.");
  }
  const offset = num(payload?.timezone_offset) ?? 0;
  const filas: FilaClima[] = [];
  const vistos = new Set<string>();
  for (const d of daily) {
    const dt = num(d?.dt);
    const pop = num(d?.pop);
    if (dt === null || pop === null || pop < 0 || pop > 1) continue;
    const fecha = fechaLocal(dt, offset);
    if (vistos.has(fecha)) continue;
    vistos.add(fecha);
    const rain = num(d?.rain);
    const snow = num(d?.snow);
    const mm = rain === null && snow === null ? null : redondear(Math.max(0, (rain ?? 0) + (snow ?? 0)), 1);
    const tmin = num(d?.temp?.min);
    const tmax = num(d?.temp?.max);
    filas.push({
      comuna_id: comunaId,
      fecha,
      obtenido_el: obtenidoEl,
      prob_precip: Math.min(100, Math.max(0, Math.round(pop * 100))),
      mm,
      tmin: tmin === null ? null : redondear(tmin, 1),
      tmax: tmax === null ? null : redondear(tmax, 1),
      fuente,
    });
  }
  if (filas.length === 0) throw new ErrorClima("Ningún día de la respuesta traía probabilidad de precipitación válida.");
  return filas;
}

/** Estado final de una corrida según cuántas comunas salieron bien. */
export function estadoCorrida(ok: number, error: number): "ok" | "parcial" | "error" {
  if (ok > 0 && error === 0) return "ok";
  if (ok > 0) return "parcial";
  return "error";
}

/** Fecha de hoy en Santiago (AAAA-MM-DD). */
export function hoySantiago(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora);
}
