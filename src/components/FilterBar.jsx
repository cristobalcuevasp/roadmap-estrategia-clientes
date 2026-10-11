import { useTheme, tokens } from "../lib/theme";
import { useTeam } from "../lib/team";
import { STATUSES, PRIORITIES, PRIORITY_LABEL, TYPES } from "../lib/constants";
import { Avatar } from "./ui";

export function FilterBar({ filters, setFilters, projects }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const { users } = useTeam();
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleAssignee = (id) => set("assignees", filters.assignees.includes(id) ? filters.assignees.filter((x) => x !== id) : [...filters.assignees, id]);
  const selectCls = `text-xs border rounded-md px-2 py-1.5 ${c.input}`;
  const hasFilters = filters.assignees.length || filters.priority !== "all" || filters.status !== "all" || filters.type !== "all" || filters.project !== "all" || filters.onlyOverdue || filters.onlyBlocked || filters.onlyUnassigned;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      <div className="flex items-center -space-x-1 mr-1">
        {users.map((u) => {
          const on = filters.assignees.includes(u.id);
          return (
            <button key={u.id} onClick={() => toggleAssignee(u.id)} className={`rounded-full transition-all ${on ? "ring-2 ring-blue-500" : "ring-2 ring-transparent opacity-60 hover:opacity-100"}`}>
              <Avatar userId={u.id} />
            </button>
          );
        })}
      </div>
      <select value={filters.priority} onChange={(e) => set("priority", e.target.value)} className={selectCls}>
        <option value="all">Prioridad</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
      </select>
      <select value={filters.status} onChange={(e) => set("status", e.target.value)} className={selectCls}>
        <option value="all">Estado</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={filters.type} onChange={(e) => set("type", e.target.value)} className={selectCls}>
        <option value="all">Tipo</option>
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={filters.project} onChange={(e) => set("project", e.target.value)} className={selectCls}>
        <option value="all">Proyecto</option>
        {projects.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <button onClick={() => set("onlyOverdue", !filters.onlyOverdue)} className={`px-2 py-1.5 rounded-md text-xs font-medium border ${filters.onlyOverdue ? "bg-red-500 bg-opacity-10 border-red-500 text-red-500" : `${c.panelBorder} ${c.textFaint}`}`}>Vencidas</button>
      <button onClick={() => set("onlyBlocked", !filters.onlyBlocked)} className={`px-2 py-1.5 rounded-md text-xs font-medium border ${filters.onlyBlocked ? "bg-purple-500 bg-opacity-10 border-purple-500 text-purple-500" : `${c.panelBorder} ${c.textFaint}`}`}>Bloqueadas</button>
      <button onClick={() => set("onlyUnassigned", !filters.onlyUnassigned)} className={`px-2 py-1.5 rounded-md text-xs font-medium border ${filters.onlyUnassigned ? `${dark ? "bg-slate-700" : "bg-slate-200"} ${c.panelBorder}` : `${c.panelBorder} ${c.textFaint}`}`}>Sin responsable</button>
      {!!hasFilters && (
        <button onClick={() => setFilters({ assignees: [], priority: "all", status: "all", type: "all", project: "all", onlyOverdue: false, onlyBlocked: false, onlyUnassigned: false })} className={`text-xs ${c.textFaint} hover:${dark ? "text-slate-200" : "text-slate-700"} px-1`}>Limpiar filtros</button>
      )}
    </div>
  );
}
