import { createContext, useContext } from "react";

/* Colores de avatar. Las clases aparecen completas aquí para que Tailwind las incluya en el build. */
export const COLOR_CLASS = {
  blue: "bg-blue-600",
  pink: "bg-pink-600",
  amber: "bg-amber-600",
  emerald: "bg-emerald-600",
  violet: "bg-violet-600",
  cyan: "bg-cyan-600",
  orange: "bg-orange-600",
  slate: "bg-slate-600",
};
export const COLOR_KEYS = Object.keys(COLOR_CLASS);

export const computeInitials = (name) =>
  (name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/* Contexto del equipo: { users, userById } con usuarios ya mapeados desde la base de datos */
export const TeamCtx = createContext({ users: [], userById: () => undefined });
export const useTeam = () => useContext(TeamCtx);
