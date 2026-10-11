import { useState, useEffect, useRef } from "react";
import { Zap, X, MessageSquare, History, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useTheme, tokens } from "../lib/theme";
import { todayISO, fmtDateTime } from "../lib/dates";
import { useTeam } from "../lib/team";
import { STATUSES, PRIORITIES, PRIORITY_LABEL, TYPES, FREQS, IMPACTS, EFFORTS } from "../lib/constants";
import { diffTask } from "../lib/mappers";
import { TypeSquare, SectionTitle } from "./ui";

export function emptyDraft(currentUserId) {
  return {
    title: "", description: "", assignee: currentUserId, additionalAssignees: [],
    requester: "", startDate: todayISO(), deadline: "", status: "Backlog", priority: "P2", type: "Operacional",
    category: "", impact: "Medio", effort: "Medio", progress: 0, project: "", blockers: "", expectedResult: "", links: "",
    recurring: { enabled: false, frequency: "Semanal" }, objective: "", expectedImpact: "", successIndicator: "", nextMilestone: "",
    dependencies: [],
  };
}
export function Field({ label, children, full }) {
  const { dark } = useTheme();
  return <div className={full ? "col-span-2" : ""}><label className={`block text-xs font-medium mb-1 ${dark ? "text-slate-500" : "text-slate-500"}`}>{label}</label>{children}</div>;
}

export function TaskModal({ liveTask, history = [], isNew, currentUser, allTasks, onClose, onSave, onDelete, onAddComment }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const { users } = useTeam();
  const [draft, setDraft] = useState(() => (liveTask ? { ...liveTask } : emptyDraft(currentUser.id)));
  // Versión con la que se abrió: al guardar solo se envían los campos que esta persona realmente cambió.
  const baseline = useRef(liveTask ? { ...liveTask } : null);
  const [commentText, setCommentText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMore, setShowMore] = useState(!isNew);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const canSave = draft.title.trim().length > 0;
  const inputCls = `w-full border rounded-md px-2.5 py-1.5 text-xs outline-none ${c.input}`;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black bg-opacity-50">
      <div className={`w-full max-w-lg h-full shadow-2xl overflow-y-auto flex flex-col ${c.panel}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${c.panelBorder}`}>
          <div className="flex items-center gap-2">
            <TypeSquare type={draft.type} size="md" />
            <div>
              <p className={`text-xs font-mono ${c.textFaint}`}>{isNew ? "Nueva tarea" : draft.id}</p>
              <h3 className={`text-sm font-semibold ${dark ? "text-slate-100" : "text-slate-800"}`}>{isNew ? "Crear tarea" : "Editar tarea"}</h3>
            </div>
          </div>
          <button onClick={onClose} className={c.textFaint}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 flex-1">
          <Field label="Título *" full><input className={inputCls} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="¿Qué hay que hacer?" autoFocus /></Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Responsable">
              <select className={inputCls} value={draft.assignee} onChange={(e) => set("assignee", e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Prioridad">
              <select className={inputCls} value={draft.priority} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select className={inputCls} value={draft.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <select className={inputCls} value={draft.type} onChange={(e) => set("type", e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Deadline" full={!isNew}><input type="date" className={inputCls} value={draft.deadline || ""} onChange={(e) => set("deadline", e.target.value)} /></Field>
            {isNew && <Field label="Proyecto"><input className={inputCls} value={draft.project} onChange={(e) => set("project", e.target.value)} placeholder="Opcional" /></Field>}
          </div>

          {isNew && (
            <button onClick={() => setShowMore((v) => !v)} className={`text-xs font-medium flex items-center gap-1 ${dark ? "text-blue-400" : "text-blue-600"}`}>
              {showMore ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {showMore ? "Ocultar campos" : "Mostrar más campos"}
            </button>
          )}

          {showMore && (
            <>
              <Field label="Descripción" full><textarea rows={3} className={inputCls} value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="Detalle, contexto, criterios de éxito…" /></Field>

              <div className="grid grid-cols-2 gap-2.5">
                {!isNew && <Field label="Proyecto / categoría"><input className={inputCls} value={draft.project} onChange={(e) => set("project", e.target.value)} placeholder="Ej: Reactivación Q4" /></Field>}
                <Field label="Solicitante">
                  <select className={inputCls} value={draft.requester || ""} onChange={(e) => set("requester", e.target.value)}>
                    <option value="">—</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Fecha de inicio"><input type="date" className={inputCls} value={draft.startDate || ""} onChange={(e) => set("startDate", e.target.value)} /></Field>
                <Field label="Impacto"><select className={inputCls} value={draft.impact} onChange={(e) => set("impact", e.target.value)}>{IMPACTS.map((i) => <option key={i}>{i}</option>)}</select></Field>
                <Field label="Esfuerzo"><select className={inputCls} value={draft.effort} onChange={(e) => set("effort", e.target.value)}>{EFFORTS.map((i) => <option key={i}>{i}</option>)}</select></Field>
              </div>

              <Field label={`Avance — ${draft.progress || 0}%`} full>
                <input type="range" min="0" max="100" step="5" value={draft.progress || 0} onChange={(e) => set("progress", Number(e.target.value))} className="w-full accent-blue-600" />
              </Field>

              <Field label="Responsables adicionales" full>
                <div className="flex flex-wrap gap-1.5">
                  {users.filter((u) => u.id !== draft.assignee).map((u) => {
                    const on = (draft.additionalAssignees || []).includes(u.id);
                    return (
                      <button key={u.id} type="button" onClick={() => set("additionalAssignees", on ? draft.additionalAssignees.filter((x) => x !== u.id) : [...(draft.additionalAssignees || []), u.id])}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${on ? "bg-blue-500 bg-opacity-10 border-blue-500 text-blue-500" : `${c.panelBorder} ${c.textFaint}`}`}>{u.name.split(" ")[0]}</button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Bloqueadores" full><input className={inputCls} value={draft.blockers} onChange={(e) => set("blockers", e.target.value)} placeholder="¿Qué está impidiendo el avance?" /></Field>
              <Field label="Resultado esperado" full><input className={inputCls} value={draft.expectedResult} onChange={(e) => set("expectedResult", e.target.value)} /></Field>
              <Field label="Links o referencias" full><input className={inputCls} value={draft.links} onChange={(e) => set("links", e.target.value)} placeholder="https://…" /></Field>

              <Field label="Dependencias — no puede iniciar hasta que terminen" full>
                <div className={`max-h-24 overflow-y-auto border rounded-md p-2 space-y-1 ${c.panelBorder}`}>
                  {allTasks.filter((t) => t.id !== draft.id).map((t) => {
                    const on = (draft.dependencies || []).includes(t.id);
                    return (
                      <label key={t.id} className={`flex items-center gap-2 text-xs ${c.textDim}`}>
                        <input type="checkbox" checked={on} onChange={() => set("dependencies", on ? draft.dependencies.filter((x) => x !== t.id) : [...(draft.dependencies || []), t.id])} />
                        <span className="truncate">{t.title}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              <div className={`rounded-md p-2.5 border ${dark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                <label className={`flex items-center gap-2 text-xs font-medium mb-2 ${dark ? "text-slate-300" : "text-slate-700"}`}>
                  <input type="checkbox" checked={draft.recurring?.enabled || false} onChange={(e) => set("recurring", { ...draft.recurring, enabled: e.target.checked })} />
                  Tarea recurrente
                </label>
                {draft.recurring?.enabled && (
                  <select className={inputCls} value={draft.recurring.frequency} onChange={(e) => set("recurring", { ...draft.recurring, frequency: e.target.value })}>
                    {FREQS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                )}
              </div>

              {draft.type === "Rompelínea" && (
                <div className={`rounded-md p-2.5 border space-y-2.5 ${dark ? "bg-violet-500 bg-opacity-10 border-violet-800" : "bg-violet-50 border-violet-200"}`}>
                  <p className={`text-xs font-semibold flex items-center gap-1.5 ${dark ? "text-violet-400" : "text-violet-700"}`}><Zap className="w-3.5 h-3.5" />Detalle Rompelínea</p>
                  <Field label="Objetivo" full><input className={inputCls} value={draft.objective} onChange={(e) => set("objective", e.target.value)} /></Field>
                  <Field label="Impacto esperado" full><input className={inputCls} value={draft.expectedImpact} onChange={(e) => set("expectedImpact", e.target.value)} /></Field>
                  <Field label="Indicador de éxito" full><input className={inputCls} value={draft.successIndicator} onChange={(e) => set("successIndicator", e.target.value)} /></Field>
                  <Field label="Próximo hito" full><input className={inputCls} value={draft.nextMilestone} onChange={(e) => set("nextMilestone", e.target.value)} /></Field>
                </div>
              )}
            </>
          )}

          {!isNew && (
            <>
              <div>
                <SectionTitle icon={MessageSquare} count={(liveTask.comments || []).length}>Comentarios</SectionTitle>
                <div className="space-y-1.5 mb-2 max-h-44 overflow-y-auto">
                  {(liveTask.comments || []).length === 0 && <p className={`text-xs ${c.textFaint}`}>Sin comentarios aún.</p>}
                  {(liveTask.comments || []).map((cm) => (
                    <div key={cm.id} className={`rounded-md p-2 ${dark ? "bg-slate-800" : "bg-slate-50"}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-semibold ${dark ? "text-slate-300" : "text-slate-700"}`}>{cm.user}</span>
                        <span className={`text-xs ${c.textFaint}`}>{fmtDateTime(cm.date)}</span>
                      </div>
                      <p className={`text-xs ${c.textDim}`}>{cm.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input className={inputCls} placeholder={`Comentar como ${currentUser.name.split(" ")[0]}… @mencionar`} value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && commentText.trim()) { onAddComment(liveTask.id, commentText); setCommentText(""); } }} />
                  <button onClick={() => { if (commentText.trim()) { onAddComment(liveTask.id, commentText); setCommentText(""); } }} className={`px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0 ${dark ? "bg-slate-700 text-white" : "bg-slate-800 text-white"}`}>Enviar</button>
                </div>
              </div>

              <div>
                <SectionTitle icon={History} count={history.length}>Historial</SectionTitle>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {[...history].reverse().map((h) => (
                    <p key={h.id} className={`text-xs ${c.textDim}`}>
                      <span className={`font-medium ${dark ? "text-slate-300" : "text-slate-700"}`}>{h.user}</span>{" "}
                      {h.field === "creación" ? h.to : <>cambió {h.field} de <span className="font-mono">{h.from}</span> a <span className="font-mono">{h.to}</span></>}
                      <span className={c.textFaint}> · {fmtDateTime(h.date)}</span>
                    </p>
                  ))}
                </div>
              </div>
              <p className={`text-xs ${c.textFaint}`}>Actualizado {fmtDateTime(liveTask.updatedAt)} por {liveTask.updatedBy}</p>
            </>
          )}
        </div>

        <div className={`p-3 border-t flex items-center justify-between shrink-0 ${c.panelBorder} ${c.panel}`}>
          {!isNew ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-500">¿Eliminar definitivamente?</span>
                <button onClick={() => onDelete(draft.id)} className="text-xs font-medium bg-red-600 text-white px-2 py-1 rounded">Sí, eliminar</button>
                <button onClick={() => setConfirmDelete(false)} className={`text-xs ${c.textFaint}`}>Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs text-red-500 font-medium"><Trash2 className="w-3.5 h-3.5" />Eliminar</button>
            )
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={`px-3 py-1.5 text-xs font-medium rounded-md ${c.textFaint} ${dark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>Cancelar</button>
            <button disabled={!canSave} onClick={() => onSave(isNew ? draft : diffTask(baseline.current, draft))} className={`px-3 py-1.5 text-xs font-medium rounded-md text-white transition-colors ${canSave ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-400 opacity-50 cursor-not-allowed"}`}>{isNew ? "Crear tarea" : "Guardar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
