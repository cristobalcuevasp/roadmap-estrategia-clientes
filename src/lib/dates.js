import { STATUSES, PW } from "./constants";

/* Fechas en hora local (el equipo está en Chile): evitamos toISOString(), que usa UTC
   y adelanta el día al caer la tarde. */
const pad = (n) => String(n).padStart(2, "0");
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (iso) => new Date(iso + "T00:00:00");

export const todayISO = () => toISODate(new Date());

export const addDays = (n, base) => {
  const d = base ? parseISO(base) : new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const daysUntil = (iso) => {
  if (!iso) return null;
  const d = parseISO(iso);
  const t = parseISO(todayISO());
  return Math.round((d - t) / 86400000);
};

export const fmtDate = (iso) => {
  if (!iso) return "Sin fecha";
  return parseISO(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
};

export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
};

export const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const weekRange = (offset = 0) => {
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return [toISODate(monday), toISODate(sunday)];
};

export const inRange = (iso, [start, end]) => !!iso && iso >= start && iso <= end;

/* Riesgo de una tarea según estado y fecha límite */
export function getRisk(task) {
  if (task.status === "Terminada" || task.status === "Cancelada") return null;
  if (task.status === "Bloqueada") return "Bloqueada";
  const d = daysUntil(task.deadline);
  if (d === null) return "En plazo";
  if (d < 0) return "Vencida";
  if (d <= 2) return "Atención";
  return "En plazo";
}

const IMPACT_ORDER = { Alto: 0, Medio: 1, Bajo: 2 };
/* Orden: prioridad > fecha límite > estado > impacto */
export function sortTasks(list) {
  return [...list].sort((a, b) => {
    const p = (PW[b.priority] || 0) - (PW[a.priority] || 0);
    if (p !== 0) return p;
    const da = a.deadline || "9999-99-99", db = b.deadline || "9999-99-99";
    if (da !== db) return da < db ? -1 : 1;
    const sa = STATUSES.indexOf(a.status), sb = STATUSES.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    return (IMPACT_ORDER[a.impact] ?? 3) - (IMPACT_ORDER[b.impact] ?? 3);
  });
}
