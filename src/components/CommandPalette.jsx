import { useState, useEffect, useRef } from "react";
import { Command } from "lucide-react";
import { sortTasks } from "../lib/dates";
import { tokens } from "../lib/theme";
import { TypeSquare } from "./ui";

export function CommandPalette({ open, onClose, tasks, setView, openTask, openNew, dark, setDark, hidden = [] }) {
  const c = tokens(dark);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);
  if (!open) return null;
  const actions = [
    { label: "Crear tarea", hint: "C", run: () => { onClose(); openNew(); } },
    { label: "Ir al Board", run: () => { onClose(); setView("kanban"); } },
    { label: "Ir a Lista", run: () => { onClose(); setView("all"); } },
    { label: "Ir a Mis tareas", run: () => { onClose(); setView("mine"); } },
    { label: "Ir a Rompelíneas", run: () => { onClose(); setView("breakers"); } },
    { label: "Ir a Roadmap", run: () => { onClose(); setView("roadmap"); } },
    { label: "Ir a Weekly Review", run: () => { onClose(); setView("weekly"); } },
    { label: "Ir a Reportes", run: () => { onClose(); setView("dashboard"); } },
    { label: "Ir a Programación CRM", run: () => { onClose(); setView("crm"); } },
    ...(hidden.includes("fb") ? [] : [{ label: "Ir a Feedback & Desarrollo", run: () => { onClose(); setView("fb"); } }]),
    { label: dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro", run: () => { onClose(); setDark(!dark); } },
  ];
  const ql = q.toLowerCase();
  const filteredActions = actions.filter((a) => a.label.toLowerCase().includes(ql));
  const matchingTasks = q.trim() ? sortTasks(tasks.filter((t) => t.title.toLowerCase().includes(ql) || t.id.toLowerCase().includes(ql))).slice(0, 6) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black bg-opacity-50" onClick={onClose}>
      <div className={`w-full max-w-lg rounded-lg border shadow-2xl overflow-hidden ${c.panel} ${c.panelBorder}`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${c.panelBorder}`}>
          <Command className={`w-4 h-4 ${c.textFaint}`} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tareas o acciones…" className={`flex-1 bg-transparent outline-none text-sm ${dark ? "text-slate-200 placeholder-slate-500" : "text-slate-800 placeholder-slate-400"}`} />
          <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${c.kbd}`}>Esc</span>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {matchingTasks.length > 0 && (
            <div className="mb-1">
              <p className={`text-xs uppercase font-semibold px-2 py-1 ${c.textFaint}`}>Tareas</p>
              {matchingTasks.map((t) => (
                <button key={t.id} onClick={() => { onClose(); openTask(t.id); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left ${c.rowHover}`}>
                  <TypeSquare type={t.type} />
                  <span className={`text-xs truncate flex-1 ${dark ? "text-slate-200" : "text-slate-700"}`}>{t.title}</span>
                  <span className={`text-xs font-mono ${c.textFaint}`}>{t.id}</span>
                </button>
              ))}
            </div>
          )}
          <p className={`text-xs uppercase font-semibold px-2 py-1 ${c.textFaint}`}>Acciones</p>
          {filteredActions.length === 0 && <p className={`text-xs px-2 py-2 ${c.textFaint}`}>Sin resultados.</p>}
          {filteredActions.map((a) => (
            <button key={a.label} onClick={a.run} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left ${c.rowHover}`}>
              <span className={`text-xs ${dark ? "text-slate-200" : "text-slate-700"}`}>{a.label}</span>
              {a.hint && <span className={`text-xs px-1.5 rounded border font-mono ${c.kbd}`}>{a.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
