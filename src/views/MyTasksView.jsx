import { CalendarRange, AlertTriangle, CheckCircle2, Clock, Ban } from "lucide-react";
import { todayISO, addDays, daysUntil, weekRange, getRisk, sortTasks } from "../lib/dates";
import { EmptyState, SectionTitle, KpiStrip, TaskRow } from "../components/ui";

export function MyTasksView({ tasks, currentUser, openTask }) {
  const mine = tasks.filter((t) => t.assignee === currentUser.id || (t.additionalAssignees || []).includes(currentUser.id));
  const active = mine.filter((t) => t.status !== "Terminada" && t.status !== "Cancelada");
  const today = active.filter((t) => t.deadline === todayISO());
  const proximas = active.filter((t) => { const d = daysUntil(t.deadline); return d !== null && d > 0 && d <= 7; });
  const overdue = active.filter((t) => getRisk(t) === "Vencida");
  const sinFecha = active.filter((t) => !t.deadline);
  const [wStart] = weekRange(0);
  const doneRecent = mine.filter((t) => t.status === "Terminada" && t.completedAt && t.completedAt >= addDays(-7));

  const groups = [
    { label: "Hoy", icon: Clock, list: today },
    { label: "Próximas (7 días)", icon: CalendarRange, list: proximas },
    { label: "Vencidas", icon: AlertTriangle, list: overdue },
    { label: "Sin fecha", icon: Ban, list: sinFecha },
    { label: "Terminadas recientemente", icon: CheckCircle2, list: doneRecent },
  ];

  return (
    <div className="space-y-4">
      <KpiStrip items={[
        { label: "Activas", value: active.length },
        { label: "Hoy", value: today.length },
        { label: "Vencidas", value: overdue.length, tone: "text-red-500" },
        { label: "Sin fecha", value: sinFecha.length },
      ]} />
      {groups.map((g) => (
        <div key={g.label}>
          <SectionTitle icon={g.icon} count={g.list.length}>{g.label}</SectionTitle>
          {g.list.length === 0 ? <EmptyState label="Nada por aquí." /> : <div className="space-y-1.5">{sortTasks(g.list).map((t) => <TaskRow key={t.id} task={t} onClick={() => openTask(t.id)} />)}</div>}
        </div>
      ))}
    </div>
  );
}
