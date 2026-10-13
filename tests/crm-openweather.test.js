// Pruebas de la lógica pura de la función crm-clima (supabase/functions/crm-clima/openweather.ts).
// IMPORTANTE: los payloads de abajo son MUESTRAS SINTÉTICAS con la estructura documentada de One Call 3.0;
// no son datos reales de OpenWeather. Verifican el parseo, no la calidad ni la disponibilidad del servicio.
import test from "node:test";
import assert from "node:assert/strict";
import {
  FUENTE, ErrorClima, limpiar, urlOneCall, fechaLocal, errorPorEstado, filasDesdeRespuesta, estadoCorrida, hoySantiago,
} from "../supabase/functions/crm-clima/openweather.ts";

// 2026-10-13 15:00 UTC = mediodía local en Santiago (UTC-3 en horario de verano)
const NOON = Date.UTC(2026, 9, 13, 15, 0, 0) / 1000;
const DIA = 86400;
const muestra = {
  lat: -33.45, lon: -70.66, timezone: "America/Santiago", timezone_offset: -10800,
  daily: [
    { dt: NOON, pop: 0.0, temp: { min: 8.04, max: 21.96 } },
    { dt: NOON + DIA, pop: 0.35, rain: 1.234, temp: { min: 9, max: 19.5 } },
    { dt: NOON + 2 * DIA, pop: 1, rain: 12.06, snow: 0.5, temp: { min: 5.5, max: 12 } },
    { dt: NOON + 3 * DIA, pop: 0.666, temp: { min: 6, max: 14 } },
  ],
};

test("fechaLocal usa el desfase horario de la fuente (no el UTC)", () => {
  // 02:00 UTC del 14 = 23:00 del 13 en Santiago
  assert.equal(fechaLocal(Date.UTC(2026, 9, 14, 2, 0, 0) / 1000, -10800), "2026-10-13");
  assert.equal(fechaLocal(NOON, -10800), "2026-10-13");
});

test("filasDesdeRespuesta: probabilidad en %, lluvia sumada y fechas locales", () => {
  const f = filasDesdeRespuesta(muestra, 7, "2026-10-13");
  assert.equal(f.length, 4);
  assert.deepEqual(f.map((x) => x.fecha), ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
  assert.deepEqual(f.map((x) => x.prob_precip), [0, 35, 100, 67]);
  assert.equal(f[0].mm, null); // sin campo rain/snow no se inventa 0 mm
  assert.equal(f[1].mm, 1.2);
  assert.equal(f[2].mm, 12.6); // lluvia + nieve (equivalente en agua)
  assert.equal(f[0].tmin, 8);
  assert.equal(f[0].tmax, 22);
  assert.ok(f.every((x) => x.comuna_id === 7 && x.obtenido_el === "2026-10-13" && x.fuente === FUENTE));
});

test("filasDesdeRespuesta descarta días sin probabilidad válida y no inventa datos", () => {
  const p = { timezone_offset: -10800, daily: [{ dt: NOON, pop: "alta" }, { dt: NOON + DIA }, { dt: NOON + 2 * DIA, pop: 1.4 }, { dt: NOON + 3 * DIA, pop: 0.2 }] };
  const f = filasDesdeRespuesta(p, 1, "2026-10-13");
  assert.equal(f.length, 1);
  assert.equal(f[0].fecha, "2026-10-16");
  assert.equal(f[0].mm, null);
  assert.equal(f[0].tmin, null);
});

test("filasDesdeRespuesta falla con una respuesta sin daily o sin días válidos", () => {
  assert.throws(() => filasDesdeRespuesta({}, 1, "2026-10-13"), ErrorClima);
  assert.throws(() => filasDesdeRespuesta({ daily: [] }, 1, "2026-10-13"), ErrorClima);
  assert.throws(() => filasDesdeRespuesta({ daily: [{ dt: NOON }] }, 1, "2026-10-13"), /probabilidad/);
  assert.throws(() => filasDesdeRespuesta(null, 1, "2026-10-13"), ErrorClima);
});

test("filasDesdeRespuesta ignora fechas repetidas", () => {
  const f = filasDesdeRespuesta({ timezone_offset: -10800, daily: [{ dt: NOON, pop: 0.1 }, { dt: NOON + 60, pop: 0.9 }] }, 1, "2026-10-13");
  assert.equal(f.length, 1);
  assert.equal(f[0].prob_precip, 10);
});

test("errorPorEstado: 401/403/429 cortan la corrida; 5xx no", () => {
  assert.equal(errorPorEstado(401).fatal, true);
  assert.match(errorPorEstado(401).message, /One Call by Call/);
  assert.equal(errorPorEstado(403).fatal, true);
  assert.equal(errorPorEstado(429).fatal, true);
  assert.equal(errorPorEstado(500).fatal, false);
  assert.equal(errorPorEstado(404).status, 404);
});

test("limpiar nunca deja pasar la clave ni appid=", () => {
  const clave = "abc123SECRETO";
  assert.ok(!limpiar(`falló https://api.openweathermap.org/x?lat=1&appid=${clave}&units=metric`, clave).includes(clave));
  assert.ok(!limpiar(`error con ${clave} dentro`, clave).includes(clave));
  assert.ok(!limpiar("url ...appid=otraClave999 fin").includes("otraClave999"));
  assert.equal(limpiar(undefined), "");
  assert.ok(limpiar("x".repeat(1000)).length <= 300);
});

test("urlOneCall excluye lo que no se usa y pide métrico", () => {
  const u = new URL(urlOneCall(-33.45, -70.66, "K", "https://ejemplo.test/onecall"));
  assert.equal(u.searchParams.get("lat"), "-33.45");
  assert.equal(u.searchParams.get("lon"), "-70.66");
  assert.equal(u.searchParams.get("units"), "metric");
  assert.equal(u.searchParams.get("exclude"), "current,minutely,hourly,alerts");
  assert.equal(u.searchParams.get("appid"), "K");
});

test("estadoCorrida", () => {
  assert.equal(estadoCorrida(66, 0), "ok");
  assert.equal(estadoCorrida(60, 6), "parcial");
  assert.equal(estadoCorrida(0, 66), "error");
  assert.equal(estadoCorrida(0, 0), "error");
});

test("hoySantiago devuelve el día calendario de Santiago, no el UTC", () => {
  // 2026-10-14 01:00 UTC sigue siendo 13 de octubre en Santiago (UTC-3)
  assert.equal(hoySantiago(new Date(Date.UTC(2026, 9, 14, 1, 0, 0))), "2026-10-13");
  assert.equal(hoySantiago(new Date(Date.UTC(2026, 9, 14, 4, 0, 0))), "2026-10-14");
});
