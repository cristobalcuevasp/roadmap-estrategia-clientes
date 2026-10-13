/* Utilidades de calendario para Programación CRM.
   Todo trabaja con fechas ISO "AAAA-MM-DD" y aritmética en UTC, para que el cambio de hora de Chile
   no mueva ningún día. Semanas de lunes a domingo; se muestran como DD/MM/AAAA. */

const pad = (n) => String(n).padStart(2, "0");

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m: 1..12

export function isValidISO(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const toUTC = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fromUTC = (dt) => isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());

export const parts = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };

export function addDaysISO(iso, n) {
  const dt = toUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

/** Suma meses conservando el día; si el mes destino es más corto, usa su último día (31 ene + 1 mes = 28/29 feb). */
export function addMonthsISO(iso, n) {
  const { y, m, d } = parts(iso);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  return isoOf(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12

export const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 86400000);

/** 0 = lunes … 6 = domingo */
export function weekdayIdx(iso) {
  const js = toUTC(iso).getUTCDay(); // 0 = domingo
  return (js + 6) % 7;
}
export const isWeekend = (iso) => weekdayIdx(iso) >= 5;

export const mondayOf = (iso) => addDaysISO(iso, -weekdayIdx(iso));
export const sundayOf = (iso) => addDaysISO(mondayOf(iso), 6);

/** Número de semana ISO 8601 (la semana 1 es la que contiene el primer jueves del año). */
export function isoWeek(iso) {
  const dt = toUTC(iso);
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((dt - firstThursday) / (7 * 86400000));
}

/** Matriz de semanas (lunes a domingo) que cubre el mes: cada semana es un arreglo de 7 fechas ISO. */
export function monthGrid(year, month) {
  const first = isoOf(year, month, 1);
  const last = isoOf(year, month, daysInMonth(year, month));
  const weeks = [];
  let cursor = mondayOf(first);
  const end = sundayOf(last);
  while (cursor <= end) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysISO(cursor, i)));
    cursor = addDaysISO(cursor, 7);
  }
  return weeks;
}

export const weekDays = (mondayISO) => Array.from({ length: 7 }, (_, i) => addDaysISO(mondayISO, i));

/** "15/10/2026" */
export function fmtDMY(iso) {
  if (!iso) return "";
  const { y, m, d } = parts(iso);
  return `${pad(d)}/${pad(m)}/${y}`;
}
/** "15/10" */
export function fmtDM(iso) {
  if (!iso) return "";
  const { m, d } = parts(iso);
  return `${pad(d)}/${pad(m)}`;
}
/** "jue 15/10" */
export const fmtDow = (iso) => `${DIAS_CORTOS[weekdayIdx(iso)].toLowerCase()} ${fmtDM(iso)}`;
/** "Jueves 15 de octubre de 2026" */
export function fmtLong(iso) {
  const { y, m, d } = parts(iso);
  return `${DIAS_LARGOS[weekdayIdx(iso)]} ${d} de ${MESES[m - 1].toLowerCase()} de ${y}`;
}
export const fmtMonth = (year, month) => `${MESES[month - 1]} ${year}`;

/** Semana: "Semana 42 · 12/10 al 18/10/2026" */
export function fmtWeek(mondayISO) {
  const sun = addDaysISO(mondayISO, 6);
  return `Semana ${isoWeek(mondayISO)} · ${fmtDM(mondayISO)} al ${fmtDMY(sun)}`;
}

/** Acepta DD/MM/AAAA, DD-MM-AAAA, D/M/AAAA y AAAA-MM-DD. Devuelve ISO o null si no es una fecha real. */
export function parseFlexibleDate(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else {
    m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
    if (!m) return null;
    d = +m[1]; mo = +m[2]; y = +m[3];
  }
  const iso = isoOf(y, mo, d);
  return isValidISO(iso) ? iso : null;
}

/** Fecha de hoy en Chile (no la del navegador, por si el equipo viaja o el reloj está en otro huso). */
export function todayCL(now = new Date()) {
  const parts_ = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts_; // en-CA entrega AAAA-MM-DD
}
