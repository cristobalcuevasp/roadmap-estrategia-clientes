import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { fmtDMY, todayCL, parts } from "../../lib/crm/calendar";
import { Field, inputCls, btnPrimary, btnGhost, btnOutline } from "./crmUi";

const VACIO = { fecha: "", nombre: "", ambito: "nacional", region_id: "", alcance: "", irrenunciable: false, fuente: "", verificado: false, activo: true };

function Editor({ draft, setDraft, crm, c, onSave, onCancel, isNew, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const valid = draft.fecha && draft.nombre.trim() && (draft.ambito === "nacional" || draft.region_id);
  return (
    <div className={`rounded-md border p-2.5 space-y-2 mb-3 ${c.panelBorder} ${c.card}`}>
      <p className={`text-xs font-semibold ${c.text}`}>{isNew ? "Agregar feriado" : "Editar feriado"}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field c={c} label="Fecha *"><input type="date" className={inputCls(c)} value={draft.fecha} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} /></Field>
        <Field c={c} label="Nombre *"><input className={inputCls(c)} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} /></Field>
        <Field c={c} label="Ámbito">
          <select className={inputCls(c)} value={draft.ambito} onChange={(e) => setDraft({ ...draft, ambito: e.target.value })}><option value="nacional">Nacional</option><option value="regional">Regional</option></select>
        </Field>
        {draft.ambito === "regional" && (
          <Field c={c} label="Región *">
            <select className={inputCls(c)} value={draft.region_id || ""} onChange={(e) => setDraft({ ...draft, region_id: e.target.value })}><option value="">Elige…</option>{crm.regiones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>
          </Field>
        )}
        {draft.ambito === "regional" && <Field c={c} label="Alcance (ej: solo ciertas comunas)" full><input className={inputCls(c)} value={draft.alcance} onChange={(e) => setDraft({ ...draft, alcance: e.target.value })} /></Field>}
        <Field c={c} label="Fuente" full><input className={inputCls(c)} value={draft.fuente} onChange={(e) => setDraft({ ...draft, fuente: e.target.value })} placeholder="Ej: texto de la ley, diario oficial, sitio…" /></Field>
      </div>
      <div className={`flex flex-wrap gap-4 text-xs ${c.textDim}`}>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.irrenunciable} onChange={(e) => setDraft({ ...draft, irrenunciable: e.target.checked })} />Irrenunciable</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.verificado} onChange={(e) => setDraft({ ...draft, verificado: e.target.checked })} />Confirmado contra fuente oficial</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.activo} onChange={(e) => setDraft({ ...draft, activo: e.target.checked })} />Activo (cuenta en el calendario)</label>
      </div>
      <div className="flex items-center justify-between">
        {!isNew ? (confirmDel ? (
          <span className="flex items-center gap-1.5"><span className="text-xs text-red-500">¿Eliminar definitivamente?</span><button type="button" onClick={onDelete} className="text-xs font-medium bg-red-600 text-white px-2 py-1 rounded">Sí</button><button type="button" onClick={() => setConfirmDel(false)} className={`text-xs ${c.textFaint}`}>No</button></span>
        ) : <button type="button" onClick={() => setConfirmDel(true)} className="text-xs text-red-500 flex items-center gap-1"><Trash2 className="w-3 h-3" />Eliminar</button>) : <span />}
        <div className="flex gap-2"><button type="button" onClick={onCancel} className={btnGhost(c)}>Cancelar</button><button type="button" disabled={!valid} onClick={onSave} className={btnPrimary}>Guardar</button></div>
      </div>
    </div>
  );
}

export function FeriadosTab({ crm, c }) {
  const years = useMemo(() => {
    const s = new Set(crm.feriados.map((f) => parts(f.fecha).y));
    const now = parts(todayCL()).y;
    s.add(now); s.add(now + 1);
    return [...s].sort();
  }, [crm.feriados]);
  const [year, setYear] = useState(parts(todayCL()).y);
  const [editing, setEditing] = useState(null); // { id|null, draft }
  const regionName = (id) => crm.regiones.find((r) => r.id === id)?.nombre || id;
  const list = crm.feriados.filter((f) => parts(f.fecha).y === year);
  const sinConfirmar = crm.feriados.filter((f) => f.activo && !f.verificado).length;

  const save = async () => {
    const r = await crm.saveFeriado(editing.id, editing.draft);
    if (r) setEditing(null);
  };

  return (
    <div>
      <p className={`text-xs mb-2 ${c.textFaint}`}>Los feriados nacionales de 2026 y 2027 se cargaron cotejando dos medios de prensa (no el texto oficial de la ley). Los regionales cargados quedan “por confirmar” hasta que alguien los valide. Si hay otra fuente o un cambio legal, edítalos aquí: el cálculo de días hábiles y de días de pago se actualiza solo.{sinConfirmar ? ` Hay ${sinConfirmar} feriado(s) activo(s) por confirmar.` : ""}</p>
      <div className="flex items-center gap-2 mb-3">
        <select aria-label="Año" className={`${inputCls(c, "w-28")}`} value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <button type="button" onClick={() => setEditing({ id: null, draft: { ...VACIO } })} className={`${btnOutline(c)} flex items-center gap-1`}><Plus className="w-3.5 h-3.5" />Agregar feriado</button>
      </div>
      {editing && <Editor isNew={!editing.id} draft={editing.draft} setDraft={(d) => setEditing({ ...editing, draft: d })} crm={crm} c={c} onSave={save} onCancel={() => setEditing(null)} onDelete={async () => { await crm.deleteFeriado(editing.id); setEditing(null); }} />}
      {list.length === 0 && <p className={`text-xs ${c.textFaint}`}>No hay feriados cargados para {year}.</p>}
      {list.map((f) => (
        <div key={f.id} className={`flex items-center gap-2 py-1.5 border-t text-xs ${c.borderSubtle} ${f.activo ? c.textDim : `${c.textFaint} line-through`}`}>
          <span className="font-mono w-24 shrink-0">{fmtDMY(f.fecha)}</span>
          <span className="flex-1 min-w-0 truncate"><span className="font-medium">{f.nombre}</span> · {f.ambito === "nacional" ? "nacional" : `${regionName(f.region_id)}${f.alcance ? ` (${f.alcance})` : ""}`}{f.irrenunciable ? " · irrenunciable" : ""}</span>
          <span className={f.verificado ? "text-emerald-500 shrink-0" : "text-amber-500 shrink-0"}>{f.verificado ? "confirmado" : "por confirmar"}</span>
          <button type="button" aria-label={`Editar ${f.nombre}`} onClick={() => setEditing({ id: f.id, draft: { fecha: f.fecha, nombre: f.nombre, ambito: f.ambito, region_id: f.region_id || "", alcance: f.alcance || "", irrenunciable: f.irrenunciable, fuente: f.fuente || "", verificado: f.verificado, activo: f.activo } })} className={c.textFaint}><Pencil className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
}
