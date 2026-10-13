// Pruebas del proveedor gratuito de OpenWeather (supabase/functions/crm-clima/openweather5.ts).
// IMPORTANTE: los payloads son MUESTRAS SINTÉTICAS con la estructura documentada de
// "5 day / 3 hour forecast" (https://openweathermap.org/forecast5); no son datos reales de OpenWeather.
// Verifican el agrupamiento por día local y las reglas de negocio, no el servicio.
import test from "node:test";
import assert from "node:assert/strict";
import { FUENTE_OW5, MIN_BLOQUES, urlOw5, errorOw5PorEstado, filasDesdeOw5 } from "../supabase/functions/crm-clima/openweather5.ts";
import { ErrorClima, limpiar } from "../supabase/functions/crm-clima/openweather.ts";

const H = 3600;
// 2026-10-13 12:00 UTC = 09:00 hora de Santiago con desfase -3 h (-10800 s)
const T0 = Date.UTC(2026, 9, 13, 12, 0, 0) / 1000;
const TZ = -3 * H;
const bloque = (i, pop, extra = {}) => ({
  dt: T0 + i * 3 * H,
  main: { temp_min: 9 + i * 0.1, temp_max: 15 + i * 0.1 },
  pop,
  ...extra,
});
/** 40 bloques consecutivos desde las 09:00 locales del 13/10 (el último cae el 18/10 a las 06:00 locales). */
const muestra = (popDe = () => 0.1) => ({ cod: "200", cnt: 40, list: Array.from({ length: 40 }, (_, i) => bloque(i, popDe(i))), city: { timezone: TZ } });

test("ow5: agrupa por día local y descarta los días con pocos bloques", () => {
  const filas = filasDesdeOw5(muestra(), 7, "2026-10-13");
  // 13/10: bloques 09,12,15,18,21 = 5 (se queda). 14..17/10: 8 cada uno. 18/10: 00,03,06 = 3 (se descarta).
  assert.deepEqual(filas.map((f) => f.fecha), ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]);
  assert.ok(filas.every((f) => f.comuna_id === 7 && f.obtenido_el === "2026-10-13" && f.fuente === FUENTE_OW5));
  assert.equal(MIN_BLOQUES, 4);
});

test("ow5: la probabilidad del día es la MAYOR de sus bloques (no el promedio)", () => {
  // Bloques 5..12 son el 14/10 (de 00:00 a 21:00 locales): uno con 0,85 y el resto con 0,1
  const m = muestra((i) => (i === 8 ? 0.85 : 0.1));
  const f = filasDesdeOw5(m, 1, "2026-10-13").find((x) => x.fecha === "2026-10-14");
  assert.equal(f.prob_precip, 85);
  const g = filasDesdeOw5(m, 1, "2026-10-13").find((x) => x.fecha === "2026-10-15");
  assert.equal(g.prob_precip, 10);
});

test("ow5: el día se toma en hora local de la comuna, no en UTC", () => {
  // 8 bloques desde las 03:00 UTC del 14/10 (= 00:00 locales con desfase -3 h) hasta las 00:00 UTC del 15/10 (= 21:00 locales del 14/10).
  // El último bloque (el único con 90 %) cae en el 15/10 según UTC, pero en el 14/10 según la hora local.
  const inicio = Date.UTC(2026, 9, 14, 3, 0, 0) / 1000;
  const list = Array.from({ length: 8 }, (_, k) => ({ dt: inicio + k * 3 * H, pop: k === 7 ? 0.9 : 0.1 }));
  const filas = filasDesdeOw5({ list, city: { timezone: TZ } }, 1, "2026-10-14");
  assert.deepEqual(filas.map((f) => f.fecha), ["2026-10-14"]);
  assert.equal(filas[0].prob_precip, 90);
  // sin desfase informado se asume UTC (el comportamiento solo cambia si la fuente informa city.timezone)
  const utc = filasDesdeOw5({ list, city: {} }, 1, "2026-10-14");
  assert.equal(utc[0].prob_precip, 10);
});

test("ow5: milímetros suman lluvia y nieve; sin cantidad no se inventa 0", () => {
  const m = muestra();
  m.list[8] = bloque(8, 0.7, { rain: { "3h": 1.26 } });
  m.list[9] = bloque(9, 0.7, { rain: { "3h": 2.05 }, snow: { "3h": 0.5 } });
  const filas = filasDesdeOw5(m, 1, "2026-10-13");
  assert.equal(filas.find((x) => x.fecha === "2026-10-14").mm, 3.8); // 1,26 + 2,05 + 0,5 = 3,81 → 3,8
  assert.equal(filas.find((x) => x.fecha === "2026-10-15").mm, null);
});

test("ow5: temperaturas = mínima de las mínimas y máxima de las máximas", () => {
  const f = filasDesdeOw5(muestra(), 1, "2026-10-13").find((x) => x.fecha === "2026-10-14");
  // bloques 5..12 → temp_min 9,5..10,2 y temp_max 15,5..16,2
  assert.equal(f.tmin, 9.5);
  assert.equal(f.tmax, 16.2);
});

test("ow5: bloques con probabilidad inválida no cuentan; sin datos suficientes falla", () => {
  const m = muestra();
  m.list[8] = { ...m.list[8], pop: 1.4 }; // fuera de rango
  m.list[9] = { ...m.list[9], pop: undefined };
  const f = filasDesdeOw5(m, 1, "2026-10-13").find((x) => x.fecha === "2026-10-14");
  assert.equal(f.prob_precip, 10);
  assert.throws(() => filasDesdeOw5({ list: [bloque(0, 0.3), bloque(1, 0.3)], city: { timezone: TZ } }, 1, "2026-10-13"), ErrorClima);
  assert.throws(() => filasDesdeOw5({ cod: "200" }, 1, "2026-10-13"), ErrorClima);
  assert.throws(() => filasDesdeOw5({ list: [] }, 1, "2026-10-13"), ErrorClima);
  assert.throws(() => filasDesdeOw5(null, 1, "2026-10-13"), ErrorClima);
});

test("ow5: urlOw5 usa el endpoint de 5 días, coordenadas y sistema métrico", () => {
  const u = new URL(urlOw5(-33.45, -70.66, "CLAVE_DE_PRUEBA"));
  assert.equal(u.origin + u.pathname, "https://api.openweathermap.org/data/2.5/forecast");
  assert.equal(u.searchParams.get("lat"), "-33.45");
  assert.equal(u.searchParams.get("lon"), "-70.66");
  assert.equal(u.searchParams.get("units"), "metric");
  assert.equal(u.searchParams.get("appid"), "CLAVE_DE_PRUEBA");
});

test("ow5: errores por estado y la clave nunca queda en un mensaje", () => {
  assert.equal(errorOw5PorEstado(401).fatal, true);
  assert.match(errorOw5PorEstado(401).message, /tardar un rato/);
  assert.equal(errorOw5PorEstado(429).fatal, true);
  assert.equal(errorOw5PorEstado(500).fatal, false);
  const e = "fetch failed: https://api.openweathermap.org/data/2.5/forecast?lat=-33&lon=-70&appid=CLAVE_DE_PRUEBA";
  assert.ok(!limpiar(e, "CLAVE_DE_PRUEBA").includes("CLAVE_DE_PRUEBA"));
});
