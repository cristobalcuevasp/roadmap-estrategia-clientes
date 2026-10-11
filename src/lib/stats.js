import { PW, EW } from "./constants";

export function workloadFor(userId, tasks) {
  const active = tasks.filter((t) => t.status !== "Terminada" && t.status !== "Cancelada" && (t.assignee === userId || (t.additionalAssignees || []).includes(userId)));
  const score = active.reduce((s, t) => s + (PW[t.priority] || 2) + (EW[t.effort] || 2), 0);
  let level = "Baja", tone = "text-emerald-500";
  if (score > 20) { level = "Sobrecarga"; tone = "text-red-500"; }
  else if (score > 12) { level = "Alta"; tone = "text-orange-500"; }
  else if (score > 6) { level = "Media"; tone = "text-sky-500"; }
  return { count: active.length, score, level, tone };
}
export function countBy(list, key) {
  const out = {};
  list.forEach((t) => { const k = t[key] || "Sin dato"; out[k] = (out[k] || 0) + 1; });
  return out;
}
