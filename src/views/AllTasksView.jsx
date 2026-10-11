import { useTheme, tokens } from "../lib/theme";
import { fmtDate, sortTasks } from "../lib/dates";
import { useTeam } from "../lib/team";
import { Avatar, PriorityBadge, StatusBadge, RiskBadge, TypeSquare, ProjectPill, EmptyState, useHoverCard, HoverDescription } from "../components/ui";
import { FilterBar } from "../components/FilterBar";

export function TaskTableRow({ t, openTask }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const { userById: findUser } = useTeam();
  const hover = useHoverCard();
  return (
    <>
      <button onClick={() => openTask(t.id)} onMouseEnter={hover.onEnter} onMouseMove={hover.onMove} onMouseLeave={hover.onLeave} className={`w-full text-left transition-colors ${c.rowHover}`}>
        <div className="flex lg:hidden items-center gap-2 px-2.5 py-2">
          <TypeSquare type={t.type} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>{t.title}</p>
            <p className={`text-xs font-mono truncate ${c.textFaint}`}>{t.id}{t.project ? " · " + t.project : ""}</p>
          </div>
          <PriorityBadge id={t.priority} />
        </div>
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5">
          <span style={{ width: 70 }} className={`shrink-0 text-xs font-mono ${c.textFaint}`}>{t.id}</span>
          <p className={`flex-1 min-w-0 text-xs font-medium truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>{t.title}</p>
          <div style={{ width: 110 }} className="shrink-0"><ProjectPill name={t.project} /></div>
          <div style={{ width: 90 }} className="shrink-0"><StatusBadge status={t.status} /></div>
          <div style={{ width: 44 }} className="shrink-0"><PriorityBadge id={t.priority} /></div>
          <div style={{ width: 110 }} className="shrink-0 flex items-center gap-1.5"><Avatar userId={t.assignee} /><span className={`text-xs truncate ${c.textDim}`}>{findUser(t.assignee)?.name.split(" ")[0] || "—"}</span></div>
          <div style={{ width: 28 }} className="shrink-0"><TypeSquare type={t.type} /></div>
          <span style={{ width: 56 }} className={`shrink-0 text-xs ${c.textDim}`}>{fmtDate(t.deadline)}</span>
          <div style={{ width: 76 }} className="shrink-0"><RiskBadge task={t} /></div>
        </div>
      </button>
      <HoverDescription pos={hover.pos} task={t} />
    </>
  );
}
export function TaskTable({ tasks, openTask }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  if (tasks.length === 0) return <EmptyState label="No hay tareas que coincidan con los filtros." />;
  const headerCls = `hidden lg:flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide ${dark ? "bg-slate-800 text-slate-500" : "bg-slate-50 text-slate-400"}`;
  return (
    <div className={`rounded-lg border overflow-hidden ${c.panelBorder} ${c.panel}`}>
      <div className={headerCls}>
        <span style={{ width: 70 }} className="shrink-0">ID</span>
        <span className="flex-1">Tarea</span>
        <span style={{ width: 110 }} className="shrink-0">Proyecto</span>
        <span style={{ width: 90 }} className="shrink-0">Estado</span>
        <span style={{ width: 44 }} className="shrink-0">Prior.</span>
        <span style={{ width: 110 }} className="shrink-0">Responsable</span>
        <span style={{ width: 28 }} className="shrink-0">Tipo</span>
        <span style={{ width: 56 }} className="shrink-0">Fecha</span>
        <span style={{ width: 76 }} className="shrink-0">Riesgo</span>
      </div>
      <div className={`divide-y ${c.divide}`}>
        {sortTasks(tasks).map((t) => <TaskTableRow key={t.id} t={t} openTask={openTask} />)}
      </div>
    </div>
  );
}
export function AllTasksView({ tasks, filters, setFilters, projects, openTask }) {
  const { dark } = useTheme();
  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} projects={projects} />
      <p className={`text-xs mb-1.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>{tasks.length} tareas</p>
      <TaskTable tasks={tasks} openTask={openTask} />
    </div>
  );
}
