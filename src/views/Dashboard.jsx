import { Users, AlertTriangle } from "lucide-react";
import { useTheme, tokens } from "../lib/theme";
import { sortTasks } from "../lib/dates";
import { useTeam } from "../lib/team";
import { workloadFor, countBy } from "../lib/stats";
import { Avatar, EmptyState, SectionTitle, TaskRow } from "../components/ui";

export function KpiCard({ label, value, tone, onClick }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  return (
    <button onClick={onClick} className={`text-left rounded-md border px-2.5 py-2 transition-colors ${c.panelBorder} ${c.panel} ${dark ? "hover:bg-slate-800" : "hover:bg-slate-50"}`}>
      <p className={`text-xs uppercase tracking-wide mb-0.5 ${c.textFaint}`}>{label}</p>
      <p className={`text-lg font-mono font-semibold ${tone || (dark ? "text-slate-100" : "text-slate-800")}`}>{value}</p>
    </button>
  );
}
export function DistributionBars({ title, data, colorMap }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className={`rounded-lg border p-3 ${c.panelBorder} ${c.panel}`}>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-1.5">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className={`text-xs w-24 truncate shrink-0 ${c.textDim}`}>{k}</span>
            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dark ? "bg-slate-800" : "bg-slate-100"}`}>
              <div className={`h-full rounded-full ${(colorMap && colorMap[k]) || "bg-blue-500"}`} style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className={`text-xs font-mono w-4 text-right shrink-0 ${c.textFaint}`}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Dashboard({ tasks, kpis, openTask, goFiltered }) {
  const { dark } = useTheme();
  const { users } = useTeam();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <KpiCard label="Activas" value={kpis.active.length} onClick={() => goFiltered({})} />
        <KpiCard label="Terminadas" value={kpis.done.length} tone="text-emerald-500" onClick={() => goFiltered({ status: "Terminada" })} />
        <KpiCard label="Vencidas" value={kpis.overdue.length} tone="text-red-500" onClick={() => goFiltered({ onlyOverdue: true })} />
        <KpiCard label="Bloqueadas" value={kpis.blocked.length} tone="text-purple-500" onClick={() => goFiltered({ onlyBlocked: true })} />
        <KpiCard label="P0" value={kpis.p0.length} tone="text-red-500" onClick={() => goFiltered({ priority: "P0" })} />
        <KpiCard label="P1" value={kpis.p1.length} tone="text-orange-500" onClick={() => goFiltered({ priority: "P1" })} />
        <KpiCard label="Rompelíneas" value={kpis.breakersActive.length} tone="text-violet-500" onClick={() => goFiltered({ type: "Rompelínea" })} />
        <KpiCard label="Vencen ≤3 días" value={kpis.upcoming.length} tone="text-amber-500" />
        <KpiCard label="Sin responsable" value={kpis.unassigned.length} onClick={() => goFiltered({ onlyUnassigned: true })} />
        <KpiCard label="Creadas semana" value={kpis.createdThisWeek.length} />
        <KpiCard label="Avance promedio" value={`${kpis.avgProgress}%`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <DistributionBars title="Por prioridad" data={countBy(kpis.active, "priority")} colorMap={{ P0: "bg-red-500", P1: "bg-orange-500", P2: "bg-blue-500", P3: "bg-slate-400" }} />
        <DistributionBars title="Por estado" data={countBy(tasks, "status")} />
        <DistributionBars title="Por tipo" data={countBy(kpis.active, "type")} colorMap={{ "Rompelínea": "bg-violet-500" }} />
      </div>
      <div>
        <SectionTitle icon={Users}>Carga de trabajo</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {users.map((u) => {
            const w = workloadFor(u.id, tasks);
            return (
              <div key={u.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-md border ${dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
                <Avatar userId={u.id} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium truncate ${dark ? "text-slate-200" : "text-slate-700"}`}>{u.name.split(" ")[0]}</p>
                  <span className={`text-xs font-semibold ${w.tone}`}>{w.level}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <SectionTitle icon={AlertTriangle} count={kpis.overdue.length + kpis.blocked.length}>Atención inmediata</SectionTitle>
        <div className="space-y-1.5">
          {[...kpis.overdue, ...kpis.blocked].length === 0 && <EmptyState label="Sin tareas vencidas ni bloqueadas." />}
          {sortTasks([...new Map([...kpis.overdue, ...kpis.blocked].map((t) => [t.id, t])).values()]).slice(0, 8).map((t) => <TaskRow key={t.id} task={t} onClick={() => openTask(t.id)} />)}
        </div>
      </div>
    </div>
  );
}
