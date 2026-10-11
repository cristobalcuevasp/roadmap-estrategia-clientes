import { useState } from "react";
import { MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { useTheme, tokens } from "../lib/theme";
import { getRisk, sortTasks } from "../lib/dates";
import { KANBAN_STATUSES } from "../lib/constants";
import { Avatar, PriorityDot, RiskBadge, TypeSquare, ProjectPill, ProgressBar, useHoverCard, HoverDescription } from "../components/ui";
import { FilterBar } from "../components/FilterBar";

export function KanbanCard({ task, onClick, onDragStart }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const risk = getRisk(task);
  const hover = useHoverCard();
  return (
    <>
    <div draggable onDragStart={onDragStart} onClick={onClick} onMouseEnter={hover.onEnter} onMouseMove={hover.onMove} onMouseLeave={hover.onLeave}
      className={`rounded-md border p-2.5 mb-2 cursor-pointer transition-colors ${c.card} ${c.cardBorder} ${c.cardHover}`}>
      <p className={`text-xs font-medium leading-snug mb-1.5 line-clamp-2 ${dark ? "text-slate-100" : "text-slate-800"}`}>{task.title}</p>
      {task.project && <div className="mb-1.5"><ProjectPill name={task.project} /></div>}
      {task.progress > 0 && task.status !== "Terminada" && <div className="mb-1.5"><ProgressBar value={task.progress} /></div>}
      <div className="flex items-center gap-1.5">
        <TypeSquare type={task.type} />
        <span className={`text-xs font-mono ${c.textFaint}`}>{task.id}</span>
        <div className="flex-1" />
        {(task.comments || []).length > 0 && (
          <span className={`flex items-center gap-0.5 text-xs ${c.textFaint}`}><MessageSquare className="w-3 h-3" />{task.comments.length}</span>
        )}
        <PriorityDot id={task.priority} />
        <Avatar userId={task.assignee} />
      </div>
      {risk && risk !== "En plazo" && (
        <div className="mt-1.5"><RiskBadge task={task} /></div>
      )}
    </div>
    <HoverDescription pos={hover.pos} task={task} />
    </>
  );
}

export function KanbanView({ tasks, filters, setFilters, projects, openTask, onDrop }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const [dragId, setDragId] = useState(null);
  const [collapsedCols, setCollapsedCols] = useState({});
  const toggleCol = (s) => setCollapsedCols((m) => ({ ...m, [s]: !m[s] }));
  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} projects={projects} />
      <div className="flex gap-2 overflow-x-auto pb-2">
        {KANBAN_STATUSES.map((status) => {
          const col = sortTasks(tasks.filter((t) => t.status === status));
          const collapsed = collapsedCols[status];
          return (
            <div key={status} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragId) onDrop(dragId, status); setDragId(null); }}
              style={{ minHeight: 160 }} className={`rounded-lg p-1.5 shrink-0 ${c.column} ${collapsed ? "w-10" : "w-64"} transition-all`}>
              <button onClick={() => toggleCol(status)} className={`w-full flex items-center gap-1 px-1 py-1 mb-1 rounded ${c.textDim} hover:${dark ? "text-slate-200" : "text-slate-700"}`}>
                {collapsed ? (
                  <span className="flex flex-col items-center gap-1 mx-auto py-1">
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold" style={{ writingMode: "vertical-rl" }}>{status}</span>
                    <span className="text-xs font-mono">{col.length}</span>
                  </span>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold uppercase tracking-wide truncate">{status}</span>
                    <span className="text-xs font-mono ml-auto">{col.length}</span>
                  </>
                )}
              </button>
              {!collapsed && (
                <>
                  {col.length === 0 && <div className={`text-xs text-center py-6 border border-dashed rounded-md ${dark ? "border-slate-800 text-slate-700" : "border-slate-200 text-slate-300"}`}>Sin tareas</div>}
                  {col.map((t) => <KanbanCard key={t.id} task={t} onClick={() => openTask(t.id)} onDragStart={() => setDragId(t.id)} />)}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
