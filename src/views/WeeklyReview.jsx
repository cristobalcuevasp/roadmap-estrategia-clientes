import { Zap, CalendarRange, Users, AlertTriangle, CheckCircle2, Ban, Flag } from "lucide-react";
import { useTheme } from "../lib/theme";
import { fmtDate, weekRange, inRange, getRisk, sortTasks } from "../lib/dates";
import { useTeam } from "../lib/team";
import { workloadFor } from "../lib/stats";
import { Avatar, EmptyState, SectionTitle, KpiStrip, TaskRow } from "../components/ui";

export function WeeklyReview({ tasks, openTask }) {
  const { dark } = useTheme();
  const { users } = useTeam();
  const active = tasks.filter((t) => t.status !== "Terminada" && t.status !== "Cancelada");
  const breakers = active.filter((t) => t.type === "Rompelínea");
  const p0 = active.filter((t) => t.priority === "P0");
  const p1 = active.filter((t) => t.priority === "P1");
  const overdue = active.filter((t) => getRisk(t) === "Vencida");
  const blocked = active.filter((t) => t.status === "Bloqueada");
  const [wStart, wEnd] = weekRange(0);
  const [nStart, nEnd] = weekRange(1);
  const thisWeek = active.filter((t) => inRange(t.deadline, [wStart, wEnd]));
  const nextWeek = active.filter((t) => inRange(t.deadline, [nStart, nEnd]));
  const doneThisWeek = tasks.filter((t) => t.status === "Terminada" && inRange(t.completedAt, [wStart, wEnd]));

  const sectionsA = [
    { label: "Rompelíneas", icon: Zap, list: breakers },
    { label: "P0", icon: Flag, list: p0 },
    { label: "P1", icon: Flag, list: p1 },
    { label: "Vencidas", icon: AlertTriangle, list: overdue },
    { label: "Bloqueadas", icon: Ban, list: blocked },
    { label: "Esta semana", icon: CalendarRange, list: thisWeek },
    { label: "Próxima semana", icon: CalendarRange, list: nextWeek },
    { label: "Completadas", icon: CheckCircle2, list: doneThisWeek },
  ];

  return (
    <div className="space-y-4">
      <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>Semana del {fmtDate(wStart)} al {fmtDate(wEnd)}</p>
      <KpiStrip items={[
        { label: "Activas", value: active.length },
        { label: "P0", value: p0.length, tone: "text-red-500" },
        { label: "Bloqueadas", value: blocked.length, tone: "text-purple-500" },
        { label: "Vencidas", value: overdue.length, tone: "text-red-500" },
        { label: "Terminadas semana", value: doneThisWeek.length, tone: "text-emerald-500" },
      ]} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sectionsA.map((s) => (
          <div key={s.label}>
            <SectionTitle icon={s.icon} count={s.list.length}>{s.label}</SectionTitle>
            {s.list.length === 0 ? <EmptyState label="Sin elementos." /> : <div className="space-y-1.5">{sortTasks(s.list).slice(0, 6).map((t) => <TaskRow key={t.id} task={t} onClick={() => openTask(t.id)} />)}</div>}
          </div>
        ))}
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
                <span className={`text-xs font-mono ${dark ? "text-slate-600" : "text-slate-400"}`}>{w.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
