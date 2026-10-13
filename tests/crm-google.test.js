// Pruebas del proveedor Google (supabase/functions/crm-clima/google.ts).
// IMPORTANTE: los payloads son MUESTRAS SINTÉTICAS con la estructura documentada de
// forecast.days.lookup (https://developers.google.com/maps/documentation/weather/daily-forecast);
// no son datos reales de Google. Verifican el parseo y las reglas de negocio, no el servicio.
import test from "node:test";
import assert from "node:assert/strict";
import { FUENTE_GOOGLE, urlGoogle, errorGooglePorEstado, filasDesdeGoogle } from "../supabase/functions/crm-clima/google.ts";
import { ErrorClima, limpiar } from "../supabase/functions/crm-clima/openweather.ts";

const dia = (d, noche, diaPart, extra = {}) => ({
  displayDate: { year: 2026, month: 10, day: d },
  daytimeForecast: diaPart,
  nighttimeForecast: noche,
  maxTemperature: { degrees: 21.96, unit: "CELSIUS" },
  minTemperature: { degrees: 8.04, unit: "CELSIUS" },
  ...extra,
});
const parte = (pct, mm, unit = "MILLIMETERS") => ({
  precipitation: { probability: { percent: pct, type: "RAIN" }, ...(mm === undefined ? {} : { qpf: { quantity: mm, unit } }) },
});

const muestra = {
  forecastDays: [
    dia(13, parte(10, 0), parte(30, 0.4)),
    dia(14, parte(70, 5.26), parte(20, 1.04)),
    dia(15, parte(0), parte(0)),
  ],
  timeZone: { id: "America/Santiago" },
};

test("google: la probabilidad del día es la mayor entre el tramo diurno y el nocturno", () => {
  const f = filasDesdeGoogle(muestra, 7, "2026-10-13");
  assert.deepEqual(f.map((x) => x.fecha), ["2026-10-13", "2026-10-14", "2026-10-15"]);
  assert.deepEqual(f.map((x) => x.prob_precip), [30, 70, 0]);
  assert.ok(f.every((x) => x.comuna_id === 7 && x.obtenido_el === "2026-10-13" && x.fuente === FUENTE_GOOGLE));
});

test("google: milímetros suman día y noche; sin cantidad no se inventa 0", () => {
  const f = filasDesdeGoogle(muestra, 1, "2026-10-13");
  assert.equal(f[0].mm, 0.4);
  assert.equal(f[1].mm, 6.3);
  const sinQpf = filasDesdeGoogle({ forecastDays: [dia(13, parte(40), parte(10))] }, 1, "2026-10-13");
  assert.equal(sinQpf[0].mm, null);
});

test("google: unidades — pulgadas se convierten, unidad desconocida se ignora", () => {
  const f = filasDesdeGoogle({ forecastDays: [dia(13, parte(50, 1, "INCHES"), parte(10, 3, "FURLONGS"))] }, 1, "2026-10-13");
  assert.equal(f[0].mm, 25.4);
});

test("google: temperaturas en Celsius, Fahrenheit convertido, unidad desconocida = null", () => {
  const base = parte(10);
  const c = filasDesdeGoogle({ forecastDays: [dia(13, base, base)] }, 1, "2026-10-13")[0];
  assert.equal(c.tmax, 22);
  assert.equal(c.tmin, 8);
  const fa = filasDesdeGoogle({ forecastDays: [dia(13, base, base, { maxTemperature: { degrees: 68, unit: "FAHRENHEIT" }, minTemperature: { degrees: 50, unit: "FAHRENHEIT" } })] }, 1, "2026-10-13")[0];
  assert.equal(fa.tmax, 20);
  assert.equal(fa.tmin, 10);
  const raro = filasDesdeGoogle({ forecastDays: [dia(13, base, base, { maxTemperature: { degrees: 5 }, minTemperature: { degrees: 1, unit: "KELVIN" } })] }, 1, "2026-10-13")[0];
  assert.equal(raro.tmax, null);
  assert.equal(raro.tmin, null);
});

test("google: si solo un tramo trae probabilidad se usa ese; si ninguno, el día se descarta", () => {
  const f = filasDesdeGoogle({ forecastDays: [dia(13, {}, parte(45)), dia(14, {}, {}), dia(15, parte(120), parte("x"))] }, 1, "2026-10-13");
  assert.equal(f.length, 1);
  assert.equal(f[0].prob_precip, 45);
});

test("google: respuestas sin pronóstico o con fechas inválidas fallan o se descartan", () => {
  assert.throws(() => filasDesdeGoogle({}, 1, "2026-10-13"), ErrorClima);
  assert.throws(() => filasDesdeGoogle({ forecastDays: [] }, 1, "2026-10-13"), ErrorClima);
  assert.throws(() => filasDesdeGoogle(null, 1, "2026-10-13"), ErrorClima);
  assert.throws(() => filasDesdeGoogle({ forecastDays: [{ displayDate: { year: 2026, month: 13, day: 1 }, daytimeForecast: parte(10) }] }, 1, "2026-10-13"), /válida/);
  const f = filasDesdeGoogle({ forecastDays: [dia(13, parte(10), parte(20)), dia(13, parte(90), parte(90))] }, 1, "2026-10-13");
  assert.equal(f.length, 1); // fecha repetida: se queda la primera
  assert.equal(f[0].prob_precip, 20);
});

test("google: urlGoogle pide métrico, 10 días en una sola página y coordenadas", () => {
  const u = new URL(urlGoogle(-33.45, -70.66, "K", "https://ejemplo.test/v1/forecast/days:lookup"));
  assert.equal(u.searchParams.get("location.latitude"), "-33.45");
  assert.equal(u.searchParams.get("location.longitude"), "-70.66");
  assert.equal(u.searchParams.get("days"), "10");
  assert.equal(u.searchParams.get("pageSize"), "10");
  assert.equal(u.searchParams.get("unitsSystem"), "METRIC");
  assert.equal(u.searchParams.get("key"), "K");
});

test("google: errores por estado y la clave nunca queda en un mensaje", () => {
  assert.equal(errorGooglePorEstado(403).fatal, true);
  assert.match(errorGooglePorEstado(403).message, /facturación/);
  assert.equal(errorGooglePorEstado(401).fatal, true);
  assert.equal(errorGooglePorEstado(429).fatal, true);
  assert.equal(errorGooglePorEstado(400).fatal, false);
  assert.equal(errorGooglePorEstado(503).fatal, false);
  const clave = "AIzaSECRETO123";
  assert.ok(!limpiar(`fallo https://weather.googleapis.com/v1/forecast/days:lookup?key=${clave}&days=10`, clave).includes(clave));
  assert.ok(!limpiar("url ...?key=otraClave999&x=1").includes("otraClave999"));
  assert.ok(!limpiar("url ...&key=otraClave999").includes("otraClave999"));
});
