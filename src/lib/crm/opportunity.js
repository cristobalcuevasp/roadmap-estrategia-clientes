/* Motor de oportunidad comercial por días de pago.
   Las reglas son supuestos editables (tabla crm_reglas_oportunidad), no hechos medidos.
   Día hábil = lunes a viernes que no sea feriado nacional activo.
   Prioridad: ajuste manual > alta > media > normal. Cada día devuelve las razones que lo explican. */

import { daysInMonth, isoOf, parts, weekdayIdx, isWeekend, addDaysISO } from "./calendar";

export const NIVELES = ["alta", "media", "normal"];
export const NIVEL_LABEL = { alta: "Alta oportunidad", media: "Oportunidad media", normal: "Oportunidad normal" };

export const TIPOS_REGLA = {
  ultimo_habil: { label: "Últimos días hábiles del mes", params: [{ key: "n", label: "Cantidad de días", min: 1, max: 5, def: 1 }] },
  primeros_habiles: { label: "Primeros días hábiles del mes", params: [{ key: "n", label: "Cantidad de días", min: 1, max: 10, def: 2 }] },
  previos_ultimo_habil: { label: "Días hábiles previos al último día hábil", params: [{ key: "n", label: "Cantidad de días", min: 1, max: 10, def: 2 }] },
  habiles_rango: { label: "Rango de días hábiles del mes", params: [{ key: "desde", label: "Desde el día hábil N°", min: 1, max: 23, def: 3 }, { key: "hasta", label: "Hasta el día hábil N°", min: 1, max: 23, def: 5 }] },
  dias_del_mes: { label: "Días fijos del mes (solo si son hábiles)", params: [{ key: "dias", label: "Días del mes (separados por coma)", list: true }] },
  fin_de_semana_tras_pago: { label: "Fin de semana siguiente a un día de alta oportunidad", params: [{ key: "max_dias", label: "Máx. días de distancia", min: 1, max: 7, def: 3 }] },
};

/** Conjunto de fechas de feriado nacional activo. */
export function nationalHolidaySet(feriados) {
  const set = new Set();
  for (const f of feriados || []) if (f.activo !== false && f.ambito === "nacional") set.add(f.fecha);
  return set;
}

export const isBusinessDay = (iso, holidays) => !isWeekend(iso) && !holidays.has(iso);

/** Días hábiles de un mes (year, month 1..12), en orden. */
export function businessDaysOfMonth(year, month, holidays) {
  const out = [];
  const n = daysInMonth(year, month);
  for (let d = 1; d <= n; d++) {
    const iso = isoOf(year, month, d);
    if (isBusinessDay(iso, holidays)) out.push(iso);
  }
  return out;
}

const num = (v, def) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.floor(x) : def; };

/** Días del mes que cumplen una regla de tipo calendario (todas menos fin_de_semana_tras_pago). */
function matchMonthRule(regla, year, month, bd) {
  const p = regla.params || {};
  const last = bd.length;
  switch (regla.tipo) {
    case "ultimo_habil": {
      const n = num(p.n, 1);
      const tail = bd.slice(Math.max(0, last - n));
      return tail.map((iso, i) => {
        const desdeElFinal = tail.length - i;
        return { iso, detalle: desdeElFinal === 1 ? "Último día hábil del mes" : `${desdeElFinal}° día hábil contando desde el final del mes` };
      });
    }
    case "primeros_habiles": {
      const n = num(p.n, 2);
      return bd.slice(0, n).map((iso, i) => ({ iso, detalle: `Día hábil N° ${i + 1} del mes` }));
    }
    case "previos_ultimo_habil": {
      const n = num(p.n, 2);
      const prev = bd.slice(Math.max(0, last - 1 - n), Math.max(0, last - 1));
      return prev.map((iso, i) => ({ iso, detalle: `A ${prev.length - i} día(s) hábil(es) del último día hábil` }));
    }
    case "habiles_rango": {
      const desde = num(p.desde, 3), hasta = num(p.hasta, 5);
      const out = [];
      for (let i = desde; i <= Math.min(hasta, last); i++) out.push({ iso: bd[i - 1], detalle: `Día hábil N° ${i} del mes` });
      return out;
    }
    case "dias_del_mes": {
      const dias = Array.isArray(p.dias) ? p.dias.map(Number).filter((d) => d >= 1 && d <= 31) : [];
      const soloHabiles = p.solo_habiles !== false;
      const bdSet = new Set(bd);
      const out = [];
      for (const d of dias) {
        if (d > daysInMonth(year, month)) continue;
        const iso = isoOf(year, month, d);
        if (!soloHabiles || bdSet.has(iso)) out.push({ iso, detalle: `Día ${d} del mes` });
      }
      return out;
    }
    default:
      return [];
  }
}

const RANK = { alta: 2, media: 1, normal: 0 };

/**
 * Clasifica todos los días de un mes.
 * Devuelve un Map iso -> { nivel, razones: [{ reglaId, nombre, nivel, justificacion, detalle }], manual: { nivel, motivo } | null, calculado }
 *  - `calculado` es el nivel que dan las reglas, sin el ajuste manual (sirve para explicar un ajuste).
 */
export function classifyMonth(year, month, reglas, feriados, manuales) {
  const holidays = nationalHolidaySet(feriados);
  const bd = businessDaysOfMonth(year, month, holidays);
  const activas = (reglas || []).filter((r) => r.activo !== false).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const byDay = new Map();
  const push = (iso, regla, detalle) => {
    const list = byDay.get(iso) || [];
    if (!list.some((x) => x.reglaId === regla.id)) list.push({ reglaId: regla.id, nombre: regla.nombre, nivel: regla.nivel, justificacion: regla.justificacion || "", detalle });
    byDay.set(iso, list);
  };

  for (const r of activas) {
    if (r.tipo === "fin_de_semana_tras_pago") continue;
    for (const m of matchMonthRule(r, year, month, bd)) push(m.iso, r, m.detalle);
  }

  // Regla de fin de semana: depende de qué días ya son "alta" por las demás reglas (también las del mes vecino).
  const weekendRules = activas.filter((r) => r.tipo === "fin_de_semana_tras_pago");
  if (weekendRules.length) {
    const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
    const altaDays = new Set();
    const collect = (y, mo, bdList) => {
      for (const r of activas) {
        if (r.tipo === "fin_de_semana_tras_pago" || r.nivel !== "alta") continue;
        for (const m of matchMonthRule(r, y, mo, bdList)) altaDays.add(m.iso);
      }
    };
    collect(year, month, bd);
    collect(prevMonth.y, prevMonth.m, businessDaysOfMonth(prevMonth.y, prevMonth.m, holidays));
    const manualAlta = (manuales || []).filter((m) => m.nivel === "alta").map((m) => m.fecha);
    manualAlta.forEach((f) => altaDays.add(f));
    const days = daysInMonth(year, month);
    for (let d = 1; d <= days; d++) {
      const iso = isoOf(year, month, d);
      if (!isWeekend(iso)) continue;
      for (const r of weekendRules) {
        const max = num((r.params || {}).max_dias, 3);
        const sabado = weekdayIdx(iso) === 5 ? iso : addDaysISO(iso, -1); // el sábado de este fin de semana
        for (let back = 1; back <= max; back++) {
          const src = addDaysISO(iso, -back);
          // cuenta solo si el día alta es anterior al sábado y no hay otro fin de semana entre ambos
          if (src < sabado && altaDays.has(src) && !weekendBetween(src, sabado)) { push(iso, r, `Fin de semana tras la alta oportunidad del ${src.slice(8, 10)}/${src.slice(5, 7)}`); break; }
        }
      }
    }
  }

  const manualMap = new Map((manuales || []).map((m) => [m.fecha, m]));
  const result = new Map();
  const n = daysInMonth(year, month);
  for (let d = 1; d <= n; d++) {
    const iso = isoOf(year, month, d);
    const razones = (byDay.get(iso) || []).slice().sort((a, b) => RANK[b.nivel] - RANK[a.nivel]);
    const calculado = razones.length ? razones[0].nivel : "normal";
    const manual = manualMap.get(iso) || null;
    result.set(iso, { nivel: manual ? manual.nivel : calculado, calculado, razones, manual: manual ? { nivel: manual.nivel, motivo: manual.motivo || "" } : null });
  }
  return result;
}

/** ¿Hay un sábado o domingo estrictamente entre src y dst (ambos excluidos)? Evita unir un día alta con el fin de semana de otra semana. */
function weekendBetween(src, dst) {
  let cur = addDaysISO(src, 1);
  while (cur < dst) { if (weekdayIdx(cur) >= 5) return true; cur = addDaysISO(cur, 1); }
  return false;
}

/** Caché sencilla por mes para no recalcular en cada render. La clave incluye una firma de los insumos. */
export function makeOpportunityIndex(reglas, feriados, manuales) {
  const cache = new Map();
  return (iso) => {
    const { y, m } = parts(iso);
    const key = `${y}-${m}`;
    if (!cache.has(key)) cache.set(key, classifyMonth(y, m, reglas, feriados, manuales));
    return cache.get(key).get(iso);
  };
}

/** Texto corto para el tooltip: "Alta oportunidad: Último día hábil del mes". */
export function explain(info) {
  if (!info) return "";
  const lines = [];
  if (info.manual) lines.push(`Ajuste manual → ${NIVEL_LABEL[info.manual.nivel]}${info.manual.motivo ? `: ${info.manual.motivo}` : ""}`);
  if (info.razones.length) {
    for (const r of info.razones) lines.push(`${NIVEL_LABEL[r.nivel]} · ${r.nombre} (${r.detalle})${r.justificacion ? ` — ${r.justificacion}` : ""}`);
  } else if (!info.manual) lines.push("Ninguna regla de día de pago aplica a esta fecha.");
  if (info.manual && info.calculado !== info.nivel) lines.push(`Las reglas darían: ${NIVEL_LABEL[info.calculado]}.`);
  return lines.join("\n");
}
