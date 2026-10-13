// Proveedor alternativo: Google Maps Platform → Weather API (forecast.days.lookup).
// Documentación: https://developers.google.com/maps/documentation/weather/daily-forecast
//
// Diferencias que importan frente a OpenWeather (verificadas en la documentación oficial el 13/10/2026):
//  • Cada día trae la probabilidad por separado para el tramo diurno (07:00–19:00) y el nocturno
//    (19:00–07:00). Aquí se usa la MAYOR de las dos como probabilidad del día (es una cota inferior
//    de la probabilidad de que llueva en algún momento del día; no se suman ni se promedian).
//  • Un "día" de Google va de 07:00 a 07:00 hora local; displayDate es la fecha civil de su inicio.
//  • Sus términos permiten guardar el pronóstico diario solo 24 horas y luego exigen borrarlo
//    (Maps Service Specific Terms, sección 21): index.ts borra lo anterior en cada corrida y la
//    migración 0005 agrega una purga horaria de seguridad.
import { ErrorClima, type FilaClima } from "./openweather.ts";

export const FUENTE_GOOGLE = "Google Maps Platform Weather API";
export const ENDPOINT_GOOGLE = "https://weather.googleapis.com/v1/forecast/days:lookup";

export function urlGoogle(lat: number, lon: number, clave: string, base = ENDPOINT_GOOGLE): string {
  const p = new URLSearchParams({
    key: clave,
    "location.latitude": String(lat),
    "location.longitude": String(lon),
    days: "10",
    pageSize: "10", // todo en una sola página = una sola consulta facturable por comuna
    unitsSystem: "METRIC",
    languageCode: "es",
  });
  return `${base}?${p.toString()}`;
}

export function errorGooglePorEstado(status: number): ErrorClima {
  if (status === 401 || status === 403) {
    return new ErrorClima(
      "Google rechazó la clave (" + status + "). Revisa que la clave sea válida, que la Weather API esté habilitada en el proyecto de Google Cloud, que la clave permita esa API y que la facturación esté activa.",
      { status, fatal: true },
    );
  }
  if (status === 429) {
    return new ErrorClima("Google informó que se superó la cuota de consultas (429).", { status, fatal: true });
  }
  if (status === 400) {
    return new ErrorClima("Google rechazó la consulta (400): revisa las coordenadas de la comuna.", { status, fatal: false });
  }
  return new ErrorClima("Google respondió con el estado " + status + ".", { status, fatal: false });
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const redondear = (v: number, dec: number) => Math.round(v * 10 ** dec) / 10 ** dec;
const dos = (n: number) => String(n).padStart(2, "0");

/** Milímetros de una cantidad de precipitación de Google; si la unidad no es reconocible, no se usa. */
function milimetros(q: any): number | null {
  const v = num(q?.quantity);
  if (v === null || v < 0) return null;
  const u = String(q?.unit ?? "").toUpperCase();
  if (u === "MILLIMETERS" || u === "MILLIMETER") return v;
  if (u === "INCHES" || u === "INCH") return v * 25.4;
  return null;
}

function grados(t: any): number | null {
  const v = num(t?.degrees);
  if (v === null) return null;
  const u = String(t?.unit ?? "").toUpperCase();
  if (u === "CELSIUS") return v;
  if (u === "FAHRENHEIT") return (v - 32) * 5 / 9;
  return null;
}

/**
 * Convierte la respuesta de forecast.days.lookup en filas diarias. Un día sin probabilidad válida en
 * ninguno de sus dos tramos se descarta (no se inventan datos). Lanza ErrorClima si no hay pronóstico.
 */
export function filasDesdeGoogle(payload: any, comunaId: number, obtenidoEl: string, fuente = FUENTE_GOOGLE): FilaClima[] {
  const dias = payload?.forecastDays;
  if (!Array.isArray(dias) || dias.length === 0) {
    throw new ErrorClima("La respuesta de Google no incluye pronóstico diario.");
  }
  const filas: FilaClima[] = [];
  const vistos = new Set<string>();
  for (const d of dias) {
    const y = num(d?.displayDate?.year);
    const m = num(d?.displayDate?.month);
    const dn = num(d?.displayDate?.day);
    if (y === null || m === null || dn === null || m < 1 || m > 12 || dn < 1 || dn > 31) continue;
    const fecha = `${y}-${dos(m)}-${dos(dn)}`;
    if (vistos.has(fecha)) continue;

    const partes = [d?.daytimeForecast, d?.nighttimeForecast];
    const probs = partes
      .map((p) => num(p?.precipitation?.probability?.percent))
      .filter((v): v is number => v !== null && v >= 0 && v <= 100);
    if (probs.length === 0) continue;
    vistos.add(fecha);

    // Lluvia + nieve (equivalente en agua) de los tramos que traen cantidad en una unidad conocida.
    const cantidades = partes.flatMap((p) => [milimetros(p?.precipitation?.qpf), milimetros(p?.precipitation?.snowQpf)]).filter((v): v is number => v !== null);
    const mm = cantidades.length === 0 ? null : redondear(cantidades.reduce((a, b) => a + b, 0), 1);
    const tmin = grados(d?.minTemperature);
    const tmax = grados(d?.maxTemperature);
    filas.push({
      comuna_id: comunaId,
      fecha,
      obtenido_el: obtenidoEl,
      prob_precip: Math.min(100, Math.max(0, Math.round(Math.max(...probs)))),
      mm,
      tmin: tmin === null ? null : redondear(tmin, 1),
      tmax: tmax === null ? null : redondear(tmax, 1),
      fuente,
    });
  }
  if (filas.length === 0) throw new ErrorClima("Ningún día de la respuesta de Google traía probabilidad de precipitación válida.");
  return filas;
}
