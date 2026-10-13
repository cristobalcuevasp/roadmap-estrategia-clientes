import { ListChecks, Zap, Users, User, Search, MessageSquare, AlertTriangle, AlertOctagon, CheckCircle2, Clock, TrendingUp, RefreshCw, Ban, Flag } from "lucide-react";

export const STATUSES = ["Backlog", "Por hacer", "En curso", "En revisión", "Bloqueada", "Terminada", "Cancelada"];
export const KANBAN_STATUSES = ["Backlog", "Por hacer", "En curso", "En revisión", "Bloqueada", "Terminada"];
export function statusCls(status, dark) {
  const light = {
    "Backlog": "bg-slate-100 text-slate-600", "Por hacer": "bg-slate-200 text-slate-700",
    "En curso": "bg-sky-50 text-sky-700", "En revisión": "bg-violet-50 text-violet-700",
    "Bloqueada": "bg-red-50 text-red-700", "Terminada": "bg-emerald-50 text-emerald-700",
    "Cancelada": "bg-slate-100 text-slate-400",
  };
  const darkMap = {
    "Backlog": "bg-slate-800 text-slate-400", "Por hacer": "bg-slate-700 text-slate-300",
    "En curso": "bg-sky-500 bg-opacity-10 text-sky-400", "En revisión": "bg-violet-500 bg-opacity-10 text-violet-400",
    "Bloqueada": "bg-red-500 bg-opacity-10 text-red-400", "Terminada": "bg-emerald-500 bg-opacity-10 text-emerald-400",
    "Cancelada": "bg-slate-800 text-slate-600",
  };
  return (dark ? darkMap : light)[status] || light["Backlog"];
}

export const PRIORITIES = ["P0", "P1", "P2", "P3"];
export const PRIORITY_LABEL = { P0: "P0 · Urgente", P1: "P1 · Alta", P2: "P2 · Normal", P3: "P3 · Baja" };
export const PRIORITY_DOT = { P0: "bg-red-500", P1: "bg-orange-500", P2: "bg-blue-500", P3: "bg-slate-400" };
export function prioCls(id, dark) {
  const light = { P0: "bg-red-50 text-red-700", P1: "bg-orange-50 text-orange-700", P2: "bg-blue-50 text-blue-700", P3: "bg-slate-100 text-slate-500" };
  const darkMap = { P0: "bg-red-500 bg-opacity-10 text-red-400", P1: "bg-orange-500 bg-opacity-10 text-orange-400", P2: "bg-blue-500 bg-opacity-10 text-blue-400", P3: "bg-slate-800 text-slate-400" };
  return (dark ? darkMap : light)[id] || light.P2;
}
export const PW = { P0: 4, P1: 3, P2: 2, P3: 1 };

export const TYPES = ["Rompelínea", "Diaria", "Proyecto", "Operacional", "Seguimiento", "Mejora", "Incidente", "Reunión", "Análisis"];
export const TYPE_META = {
  "Rompelínea": { icon: Zap, color: "bg-violet-500" },
  "Diaria": { icon: RefreshCw, color: "bg-cyan-500" },
  "Proyecto": { icon: Flag, color: "bg-blue-500" },
  "Operacional": { icon: ListChecks, color: "bg-slate-500" },
  "Seguimiento": { icon: Clock, color: "bg-teal-500" },
  "Mejora": { icon: TrendingUp, color: "bg-emerald-500" },
  "Incidente": { icon: AlertOctagon, color: "bg-red-500" },
  "Reunión": { icon: Users, color: "bg-amber-500" },
  "Análisis": { icon: Search, color: "bg-indigo-500" },
};
export const NOTIF_META = {
  assigned: { icon: User, color: "text-blue-500" },
  priority: { icon: Flag, color: "text-orange-500" },
  mention: { icon: MessageSquare, color: "text-sky-500" },
  blocked: { icon: Ban, color: "text-purple-500" },
  p0: { icon: AlertTriangle, color: "text-red-500" },
  rompelinea: { icon: Zap, color: "text-violet-500" },
  crm_comment: { icon: MessageSquare, color: "text-sky-500" },
  crm_reminder: { icon: Clock, color: "text-amber-500" },
};
export const FREQS = ["Diaria", "Días hábiles", "Semanal", "Quincenal", "Mensual", "Personalizada"];
export const IMPACTS = ["Alto", "Medio", "Bajo"];
export const EFFORTS = ["Alto", "Medio", "Bajo"];
export const EW = { Alto: 3, Medio: 2, Bajo: 1 };

export function riskCls(risk, dark) {
  const light = { "Vencida": "bg-red-50 text-red-700", "Bloqueada": "bg-purple-50 text-purple-700", "Atención": "bg-amber-50 text-amber-700", "En plazo": "bg-emerald-50 text-emerald-700" };
  const darkMap = { "Vencida": "bg-red-500 bg-opacity-10 text-red-400", "Bloqueada": "bg-purple-500 bg-opacity-10 text-purple-400", "Atención": "bg-amber-500 bg-opacity-10 text-amber-400", "En plazo": "bg-emerald-500 bg-opacity-10 text-emerald-400" };
  return (dark ? darkMap : light)[risk];
}
export const RISK_ICON = { "Vencida": AlertTriangle, "Bloqueada": Ban, "Atención": Clock, "En plazo": CheckCircle2 };

export const PROJECT_PALETTE = [
  { light: "bg-blue-50 text-blue-700", dark: "bg-blue-500 bg-opacity-10 text-blue-400" },
  { light: "bg-emerald-50 text-emerald-700", dark: "bg-emerald-500 bg-opacity-10 text-emerald-400" },
  { light: "bg-violet-50 text-violet-700", dark: "bg-violet-500 bg-opacity-10 text-violet-400" },
  { light: "bg-amber-50 text-amber-700", dark: "bg-amber-500 bg-opacity-10 text-amber-400" },
  { light: "bg-pink-50 text-pink-700", dark: "bg-pink-500 bg-opacity-10 text-pink-400" },
  { light: "bg-cyan-50 text-cyan-700", dark: "bg-cyan-500 bg-opacity-10 text-cyan-400" },
];
export function projectCls(name, dark) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const p = PROJECT_PALETTE[h % PROJECT_PALETTE.length];
  return dark ? p.dark : p.light;
}
