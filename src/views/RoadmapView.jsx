import { useState } from "react";
import { useTheme, tokens } from "../lib/theme";
import { addDays, fmtDate, getMonday, sortTasks, toISODate } from "../lib/dates";
import { PRIORITY_DOT } from "../lib/constants";
import { TypeSquare, EmptyState } from "../components/ui";

export function RoadmapView({ tasks, openTask }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const [weeks, setWeeks] = useState(8);
  const active = sortTasks(tasks.filter((t) => t.status !== "Cancelada"));
  const rangeStart = getMonday(new Date());
  rangeStart.setDate(rangeStart.getDate() - 7);
  const totalDays = (weeks + 1) * 7;
  const rangeStartISO = toISODate(rangeStart);
  const rangeEndISO = addDays(totalDays, rangeStartISO);
  const inWindow = active.filter((t) => {
    const s = t.startDate || t.createdAt.slice(0, 10);
    const e = t.deadline || s;
    return e >= rangeStartISO && s <= rangeEndISO;
  });
  const dayWidth = 100 / totalDays;
  const clampDay = (iso) => Math.max(0, Math.min(totalDays, Math.round((new Date(iso + "T00:00:00") - new Date(rangeStartISO + "T00:00:00")) / 86400000)));
  const weekLabels = Array.from({ length: weeks + 1 }, (_, i) => fmtDate(addDays(i * 7, rangeStartISO)));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs ${c.textFaint}`}>{inWindow.length} elementos en rango</p>
        <div className={`flex items-center gap-0.5 rounded-md p-0.5 ${dark ? "bg-slate-800" : "bg-slate-100"}`}>
          {[["Semana", 4], ["Mes", 8], ["Trimestre", 13]].map(([lbl, val]) => (
            <button key={lbl} onClick={() => setWeeks(val)} className={`px-2 py-1 rounded text-xs font-medium ${weeks === val ? (dark ? "bg-slate-700 text-white" : "bg-white shadow-sm text-slate-700") : c.textFaint}`}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className={`rounded-lg border p-3 overflow-x-auto ${c.panelBorder} ${c.panel}`}>
        <div style={{ minWidth: `${(weeks + 1) * 80}px` }}>
          <div className={`flex border-b pb-1.5 mb-1.5 ${c.borderSubtle}`}>
            <div className={`w-40 shrink-0 text-xs font-semibold uppercase ${c.textFaint}`}>Tarea</div>
            <div className="flex-1 relative h-3">
              {weekLabels.map((l, i) => <span key={i} className={`absolute text-xs ${c.textFaint}`} style={{ left: `${i * 7 * dayWidth}%` }}>{l}</span>)}
            </div>
          </div>
          <div className="space-y-1">
            {inWindow.length === 0 && <EmptyState label="No hay tareas en este rango de tiempo." />}
            {inWindow.map((t) => {
              const s = t.startDate || t.createdAt.slice(0, 10);
              const e = t.deadline || s;
              const left = clampDay(s) * dayWidth;
              const width = Math.max(1.4, (clampDay(e) - clampDay(s)) * dayWidth);
              return (
                <button key={t.id} onClick={() => openTask(t.id)} className={`w-full flex items-center rounded-md transition-colors ${c.rowHover}`}>
                  <div className="w-40 shrink-0 pr-2 text-left flex items-center gap-1">
                    <TypeSquare type={t.type} />
                    <p className={`text-xs font-medium truncate ${dark ? "text-slate-300" : "text-slate-700"}`}>{t.title}</p>
                  </div>
                  <div className="flex-1 relative h-5">
                    <div className={`absolute h-3 top-1 rounded ${t.type === "Rompelínea" ? "bg-violet-500" : PRIORITY_DOT[t.priority]}`} style={{ left: `${left}%`, width: `${width}%`, opacity: t.status === "Terminada" ? 0.4 : 0.9 }} title={`${fmtDate(s)} → ${fmtDate(e)}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
