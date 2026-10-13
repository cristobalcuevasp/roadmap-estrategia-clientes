// Proveedor gratuito de OpenWeather: "5 day / 3 hour forecast" (endpoint /data/2.5/forecast).
// Documentación: https://openweathermap.org/forecast5
//
// Es el plan gratuito de OpenWeather (1.000.000 de llamadas al mes; uso comercial permitido con
// atribución visible «Weather data © OpenWeather»). La misma clave sirve para One Call 3.0 si algún
// día se contrata esa suscripción (secreto OPENWEATHER_API_KEY).
//
// Diferencia importante frente a One Call: no entrega un pronóstico diario sino bloques de 3 horas
// (hasta 40 bloques = 5 días), todos en UTC. Aquí se agrupan por DÍA LOCAL de la comuna usando
// city.timezone (segundos de desfase respecto de UTC):
//   • probabilidad del día = la MAYOR `pop` entre los bloques de ese día (cota inferior de la
//     probabilidad de que llueva en algún momento; no se promedian ni se suman);
//   • mm = suma de rain.3h + snow.3h de los bloques que traen cantidad (sin cantidad → null);
//   • tmin/tmax = mínima de main.temp_min y máxima de main.temp_max.
// Un día con menos de MIN_BLOQUES bloques (menos de 12 horas cubiertas, típico del último día
// y de un "hoy" que ya casi termina) se descarta: con tan pocas horas el máximo subestimaría el día.
// Un bloque se asigna al día local de su marca de tiempo; en el borde (±3 h) puede haber un
// pequeño corrimiento, porque OpenWeather informa el volumen de lluvia de las 3 horas anteriores.
import { ErrorClima, fechaLocal, type FilaClima } from "./openweather.ts";

export const FUENTE_OW5 = "OpenWeather 5 day / 3 hour forecast";
export const ENDPOINT_OW5 = "https://api.openweathermap.org/data/2.5/forecast";
export const MIN_BLOQUES = 4;

export function urlOw5(lat: number, lon: number, clave: string, base = ENDPOINT_OW5): string {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units: "metric",
    appid: clave,
  });
  return `${base}?${p.toString()}`;
}

export function errorOw5PorEstado(status: number): ErrorClima {
  if (status === 401 || status === 403) {
    return new ErrorClima(
      "OpenWeather rechazó la clave (" + status + "). Si la clave es nueva puede tardar un rato (a veces un par de horas) en activarse; si ya pasó ese tiempo, revisa que esté copiada completa y activa en tu cuenta de OpenWeather.",
      { status, fatal: true },
    );
  }
  if (status === 429) {
    return new ErrorClima("OpenWeather informó que se superó el límite de consultas (429).", { status, fatal: true });
  }
  return new ErrorClima("OpenWeather respondió con el estado " + status + ".", { status, fatal: false });
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const redondear = (v: number, dec: number) => Math.round(v * 10 ** dec) / 10 ** dec;

interface Acumulado { bloques: number; pop: number; mm: number; hayMm: boolean; tmin: number | null; tmax: number | null }

/**
 * Convierte la respuesta del pronóstico de 5 días / 3 horas en filas diarias. Los bloques sin una
 * probabilidad válida (número entre 0 y 1) no cuentan; no se inventan datos. Lanza ErrorClima si la
 * respuesta no trae bloques o ningún día alcanza la cobertura mínima.
 */
export function filasDesdeOw5(payload: any, comunaId: number, obtenidoEl: string, fuente = FUENTE_OW5): FilaClima[] {
  const lista = payload?.list;
  if (!Array.isArray(lista) || lista.length === 0) {
    throw new ErrorClima("La respuesta de OpenWeather no incluye pronóstico.");
  }
  const offset = num(payload?.city?.timezone) ?? 0;
  const dias = new Map<string, Acumulado>();
  for (const b of lista) {
    const dt = num(b?.dt);
    const pop = num(b?.pop);
    if (dt === null || pop === null || pop < 0 || pop > 1) continue;
    const fecha = fechaLocal(dt, offset);
    const a = dias.get(fecha) ?? { bloques: 0, pop: 0, mm: 0, hayMm: false, tmin: null, tmax: null };
    a.bloques++;
    a.pop = Math.max(a.pop, pop);
    const rain = num(b?.rain?.["3h"]);
    const snow = num(b?.snow?.["3h"]);
    if (rain !== null || snow !== null) { a.mm += Math.max(0, (rain ?? 0) + (snow ?? 0)); a.hayMm = true; }
    const tmin = num(b?.main?.temp_min);
    const tmax = num(b?.main?.temp_max);
    if (tmin !== null) a.tmin = a.tmin === null ? tmin : Math.min(a.tmin, tmin);
    if (tmax !== null) a.tmax = a.tmax === null ? tmax : Math.max(a.tmax, tmax);
    dias.set(fecha, a);
  }
  const filas: FilaClima[] = [];
  for (const [fecha, a] of [...dias.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    if (a.bloques < MIN_BLOQUES) continue;
    filas.push({
      comuna_id: comunaId,
      fecha,
      obtenido_el: obtenidoEl,
      prob_precip: Math.min(100, Math.max(0, Math.round(a.pop * 100))),
      mm: a.hayMm ? redondear(a.mm, 1) : null,
      tmin: a.tmin === null ? null : redondear(a.tmin, 1),
      tmax: a.tmax === null ? null : redondear(a.tmax, 1),
      fuente,
    });
  }
  if (filas.length === 0) throw new ErrorClima("Ningún día de la respuesta de OpenWeather tenía datos suficientes (al menos " + MIN_BLOQUES + " bloques de 3 horas con probabilidad válida).");
  return filas;
}
