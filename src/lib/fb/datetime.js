/* Fechas y horas en hora de Chile (America/Santiago). La base guarda instantes en UTC; el formulario trabaja con la
   hora local de Santiago para que "10:00" sea siempre las 10:00 de Chile, esté donde esté el navegador. */
import { todayCL } from "../crm/calendar";

const TZ = "America/Santiago";
const pad = (n) => String(n).padStart(2, "0");

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function partsAt(ms) {
  const o = {};
  for (const p of fmt.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
}

/** Diferencia (en minutos) entre la hora de Santiago y UTC en ese instante. */
function offsetMin(ms) {
  const p = partsAt(ms);
  return (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000;
}

/** "2026-10-14T10:00" (hora de Santiago) → instante ISO en UTC. Devuelve null si el texto no es una fecha y hora real. */
export function santiagoLocalToISO(local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(local || ""));
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const chk = new Date(naive);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d || h > 23 || mi > 59) return null;
  let guess = naive - offsetMin(naive) * 60000;
  guess = naive - offsetMin(guess) * 60000;
  return new Date(guess).toISOString();
}

/** Instante ISO (UTC) → "2026-10-14T10:00" en hora de Santiago, listo para un campo datetime-local. */
export function isoToSantiagoLocal(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const p = partsAt(ms);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** "2026-10-14T13:00:00Z" → "14/10/2026 10:00" (hora de Chile). */
export function fmtFechaHora(iso) {
  const l = isoToSantiagoLocal(iso);
  if (!l) return "";
  const [d, t] = l.split("T");
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y} ${t}`;
}

/** Fecha (AAAA-MM-DD) en Chile de un instante. */
export function fechaCL(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return todayCL(new Date(ms));
}

/** Fecha y hora actuales de Santiago para un campo datetime-local, redondeadas a los 5 minutos hacia atrás. */
export function ahoraSantiagoLocal(now = new Date()) {
  const ms = Math.floor(now.getTime() / 300000) * 300000;
  return isoToSantiagoLocal(new Date(ms).toISOString());
}
