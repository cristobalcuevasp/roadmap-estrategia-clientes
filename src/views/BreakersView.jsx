import { Zap } from "lucide-react";
import { useTheme, tokens } from "../lib/theme";
import { fmtDate, sortTasks } from "../lib/dates";
import { useTeam } from "../lib/team";
import { Avatar, PriorityBadge, StatusBadge, ProgressBar, EmptyState, useHoverCard, HoverDescription } from "../components/ui";

export function BreakerRow({ t, openTask }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const { userById: findUser } = useTeam();
  const hover = useHoverCard();
  return (
    <>
      <button onClick={() => openTask(t.id)} onMouseEnter={hover.onEnter} onMouseMove={hover.onMove} onMouseLeave={hover.onLeave} className={`w-full text-left transition-colors ${c.rowHover}`}>
        <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2 px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium flex items-center gap-1.5 truncate ${dark ? "text-slate-100" : "text-slate-800"}`}><Zap className="w-3 h-3 text-violet-500 shrink-0" />{t.title}</p>
            {t.nextMilestone && <p className={`text-xs truncate ${c.textFaint}`}>Próximo hito: {t.nextMilestone}</p>}
          </div>
          <div style={{ width: 110 }} className="hidden md:flex shrink-0 items-center gap-1.5"><Avatar userId={t.assignee} /><span className={`text-xs truncate ${c.textDim}`}>{findUser(t.assignee)?.name.split(" ")[0]}</span></div>
          <div style={{ width: 90 }} className="hidden md:block shrink-0"><StatusBadge status={t.status} /></div>
          <div style={{ width: 44 }} className="hidden md:block shrink-0"><PriorityBadge id={t.priority} /></div>
          <span style={{ width: 150 }} className={`hidden md:block shrink-0 text-xs truncate ${c.textDim}`}>{t.successIndicator || "—"}</span>
          <span style={{ width: 56 }} className={`hidden md:inline shrink-0 text-xs ${c.textDim}`}>{fmtDate(t.deadline)}</span>
          <div style={{ width: 60 }} className="hidden md:block shrink-0"><ProgressBar value={t.progress} /></div>
        </div>
      </button>
      <HoverDescription pos={hover.pos} task={t} />
    </>
  );
}
export function BreakersView({ tasks, openTask }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const breakers = sortTasks(tasks.filter((t) => t.type === "Rompelínea"));
  if (breakers.length === 0) return <EmptyState label="Aún no hay Rompelíneas registradas. Crea una desde “+ Nueva tarea”." />;
  return (
    <div className={`rounded-lg border overflow-hidden ${c.panelBorder} ${c.panel}`}>
      <div className={`hidden md:flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide ${dark ? "bg-slate-800 text-slate-500" : "bg-slate-50 text-slate-400"}`}>
        <span className="flex-1">Rompelínea</span>
        <span style={{ width: 110 }} className="shrink-0">Responsable</span>
        <span style={{ width: 90 }} className="shrink-0">Estado</span>
        <span style={{ width: 44 }} className="shrink-0">Prior.</span>
        <span style={{ width: 150 }} className="shrink-0">Indicador de éxito</span>
        <span style={{ width: 56 }} className="shrink-0">Deadline</span>
        <span style={{ width: 60 }} className="shrink-0">Avance</span>
      </div>
      <div className={`divide-y ${c.divide}`}>
        {breakers.map((t) => <BreakerRow key={t.id} t={t} openTask={openTask} />)}
      </div>
    </div>
  );
}
