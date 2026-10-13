import { COLOR_CLASS, computeInitials } from "./team";
import { fmtDate } from "./dates";

/* ---- Equipo -------------------------------------------------------------- */
export const memberFromRow = (r) => ({
  id: r.id,
  userId: r.user_id || null,
  email: r.email || "",
  name: r.name,
  role: r.role || "",
  initials: r.initials || computeInitials(r.name),
  colorKey: r.color,
  color: COLOR_CLASS[r.color] || COLOR_CLASS.slate,
  order: r.sort_order ?? 0,
});

/* ---- Tareas -------------------------------------------------------------- */
/* Realtime puede entregar arrays de Postgres como texto "{a,b}"; los normalizamos. */
const toArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.startsWith("{") && v.endsWith("}")) {
    const inner = v.slice(1, -1).trim();
    return inner ? inner.split(",").map((s) => s.replace(/^"|"$/g, "")) : [];
  }
  return [];
};

export function taskFromRow(r, comments, nameOf) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || "",
    assignee: r.assignee || "",
    additionalAssignees: toArr(r.additional_assignees),
    requester: r.requester || "",
    startDate: r.start_date || "",
    deadline: r.deadline || "",
    status: r.status,
    priority: r.priority,
    type: r.type,
    category: r.category || "",
    impact: r.impact,
    effort: r.effort,
    progress: r.progress || 0,
    project: r.project || "",
    dependencies: toArr(r.dependencies),
    blockers: r.blockers || "",
    expectedResult: r.expected_result || "",
    links: r.links || "",
    recurring: { enabled: !!r.recurring_enabled, frequency: r.recurring_frequency || "Semanal" },
    objective: r.objective || "",
    expectedImpact: r.expected_impact || "",
    successIndicator: r.success_indicator || "",
    nextMilestone: r.next_milestone || "",
    completedAt: r.completed_at || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by ? nameOf(r.updated_by) : "Sistema",
    comments: comments.map((c) => ({ id: c.id, date: c.created_at, user: c.author ? nameOf(c.author) : "Alguien", text: c.body })),
  };
}

const nullIfEmpty = (v) => (v === "" || v === undefined ? null : v);

/* Campos de la app -> columnas de la base. Solo se incluyen las claves presentes en `patch`. */
const COLUMN_OF = {
  title: "title", description: "description", additionalAssignees: "additional_assignees", status: "status",
  priority: "priority", type: "type", category: "category", impact: "impact", effort: "effort", progress: "progress",
  project: "project", dependencies: "dependencies", blockers: "blockers", expectedResult: "expected_result", links: "links",
  objective: "objective", expectedImpact: "expected_impact", successIndicator: "success_indicator", nextMilestone: "next_milestone",
};
const NULLABLE_COLUMN_OF = { assignee: "assignee", requester: "requester", startDate: "start_date", deadline: "deadline" };

export function taskToRow(patch) {
  const row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (COLUMN_OF[k]) row[COLUMN_OF[k]] = v;
    else if (NULLABLE_COLUMN_OF[k]) row[NULLABLE_COLUMN_OF[k]] = nullIfEmpty(v);
    else if (k === "recurring" && v) {
      row.recurring_enabled = !!v.enabled;
      row.recurring_frequency = v.frequency || "Semanal";
    }
  }
  return row;
}

/* Solo los campos que cambiaron respecto de la versión original (evita pisar ediciones de otros). */
export function diffTask(original, draft) {
  const patch = {};
  for (const k of Object.keys(draft)) {
    if (["id", "createdAt", "updatedAt", "updatedBy", "completedAt", "comments", "history"].includes(k)) continue;
    if (JSON.stringify(original[k]) !== JSON.stringify(draft[k])) patch[k] = draft[k];
  }
  return patch;
}

/* ---- Historial ----------------------------------------------------------- */
const FIELD_LABEL = {
  creation: "creación", title: "título", priority: "prioridad", status: "estado",
  assignee: "responsable", deadline: "fecha límite", progress: "avance", type: "tipo",
};

export function historyFromRow(h, nameOf) {
  const base = { id: h.id, date: h.created_at, user: h.actor ? nameOf(h.actor) : "Sistema", field: FIELD_LABEL[h.field] || h.field };
  if (h.field === "creation") return { ...base, from: "", to: h.to_value || "Tarea creada" };
  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "—";
    if (h.field === "assignee") return nameOf(v) || "—";
    if (h.field === "deadline") return fmtDate(v);
    if (h.field === "progress") return `${v}%`;
    return v;
  };
  return { ...base, from: fmt(h.from_value), to: fmt(h.to_value) };
}

/* ---- Notificaciones ------------------------------------------------------ */
export function notificationFromRow(n, meId, readIds, nameOf) {
  return {
    id: n.id,
    date: n.created_at,
    type: n.type,
    actorId: n.actor,
    actorName: n.actor ? nameOf(n.actor) : "Sistema",
    taskId: n.task_id,
    taskTitle: n.task_title,
    link: n.link || null,
    targetUserId: n.target ?? null,
    message: n.message,
    readBy: readIds.has(n.id) ? [meId] : [],
  };
}
