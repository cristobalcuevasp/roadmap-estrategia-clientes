import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TIPOS_REGLA, NIVEL_LABEL } from "../../lib/crm/opportunity";
import { fmtDMY, parseFlexibleDate } from "../../lib/crm/calendar";
import { inputCls, btnPrimary, btnOutline, btnGhost, Field } from "./crmUi";

const defaultsFor = (tipo) => Object.fromEntries((TIPOS_REGLA[tipo]?.params || []).filter((p) => !p.list).map((p) => [p.key, p.def]));

function ParamInputs({ tipo, params, onChange, c }) {
  const defs = TIPOS_REGLA[tipo]?.params || [];
  return (
    <div className="flex flex-wrap gap-2">
      {defs.map((p) => p.list ? (
        <label key={p.key} className={`text-xs ${c.textDim}`}>{p.label}
          <input className={`${inputCls(c, "mt-0.5")}`} value={Array.isArray(params[p.key]) ? params[p.key].join(", ") : ""} placeholder="15, 16"
            onChange={(e) => onChange({ ...params, [p.key]: e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31) })} />
        </label>
      ) : (
        <label key={p.key} className={`text-xs ${c.textDim}`}>{p.label}
          <input type="number" min={p.min} max={p.max} className={`${inputCls(c, "mt-0.5 w-24")}`} value={params[p.key] ?? p.def} onChange={(e) => onChange({ ...params, [p.key]: Number(e.target.value) })} />
        </label>
      ))}
    </div>
  );
}

function ReglaEditor({ regla, crm, c, onDone, isNew }) {
  const [d, setD] = useState(() => regla ? { nombre: regla.nombre, nivel: regla.nivel, tipo: regla.tipo, params: regla.params || {}, justificacion: regla.justificacion || "", activo: regla.activo } : { nombre: "", nivel: "media", tipo: "ultimo_habil", params: defaultsFor("ultimo_habil"), justificacion: "", activo: true });
  const [confirmDel, setConfirmDel] = useState(false);
  const same = regla && JSON.stringify([d.nombre, d.nivel, d.tipo, d.params, d.justificacion, d.activo]) === JSON.stringify([regla.nombre, regla.nivel, regla.tipo, regla.params || {}, regla.justificacion || "", regla.activo]);
  const paramsOk = (TIPOS_REGLA[d.tipo]?.params || []).every((p) => p.list ? Array.isArray(d.params[p.key]) && d.params[p.key].length > 0 : Number(d.params[p.key] ?? p.def) >= (p.min || 1));
  const rangoOk = d.tipo !== "habiles_rango" || Number(d.params.desde ?? 3) <= Number(d.params.hasta ?? 5);
  const valid = d.nombre.trim() && paramsOk && rangoOk;
  const save = async () => { const r = await crm.saveRegla(regla?.id || null, d); if (r && isNew) onDone(); };
  return (
    <div className={`rounded-md border p-2.5 space-y-2 ${c.panelBorder} ${isNew ? "" : ""} ${c.card}`}>
      <div className="grid grid-cols-2 gap-2">
        <Field c={c} label="Nombre de la regla" full><input className={inputCls(c)} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></Field>
        <Field c={c} label="Nivel que asigna">
          <select className={inputCls(c)} value={d.nivel} onChange={(e) => setD({ ...d, nivel: e.target.value })}><option value="alta">Alta oportunidad</option><option value="media">Oportunidad media</option></select>
        </Field>
        <Field c={c} label="Tipo de regla">
          <select className={inputCls(c)} value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value, params: defaultsFor(e.target.value) })}>
            {Object.entries(TIPOS_REGLA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
      </div>
      <ParamInputs tipo={d.tipo} params={d.params} onChange={(params) => setD({ ...d, params })} c={c} />
      {!rangoOk && <p className="text-xs text-red-500">“Desde” no puede ser mayor que “Hasta”.</p>}
      <Field c={c} label="Justificación (se muestra al pasar el mouse y en el panel del día)" full><input className={inputCls(c)} value={d.justificacion} onChange={(e) => setD({ ...d, justificacion: e.target.value })} placeholder="¿Por qué se cree que este día es una oportunidad?" /></Field>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className={`flex items-center gap-1.5 text-xs ${c.textDim}`}><input type="checkbox" checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} />Regla activa</label>
        <div className="flex items-center gap-2">
          {!isNew && (confirmDel ? (
            <span className="flex items-center gap-1.5"><span className="text-xs text-red-500">¿Eliminar?</span><button type="button" onClick={() => crm.deleteRegla(regla.id)} className="text-xs font-medium bg-red-600 text-white px-2 py-1 rounded">Sí</button><button type="button" onClick={() => setConfirmDel(false)} className={`text-xs ${c.textFaint}`}>No</button></span>
          ) : <button type="button" onClick={() => setConfirmDel(true)} className="text-xs text-red-500 flex items-center gap-1"><Trash2 className="w-3 h-3" />Eliminar</button>)}
          {isNew && <button type="button" onClick={onDone} className={btnGhost(c)}>Cancelar</button>}
          {(isNew || !same) && <button type="button" disabled={!valid} onClick={save} className={btnPrimary}>{isNew ? "Crear regla" : "Guardar"}</button>}
        </div>
      </div>
    </div>
  );
}

export function ReglasTab({ crm, c }) {
  const [adding, setAdding] = useState(false);
  const [fecha, setFecha] = useState("");
  const [nivel, setNivel] = useState("alta");
  const [motivo, setMotivo] = useState("");
  const [err, setErr] = useState("");
  const addManual = async () => {
    const iso = parseFlexibleDate(fecha);
    if (!iso) { setErr("Escribe una fecha válida (DD/MM/AAAA)."); return; }
    setErr("");
    await crm.setManual(iso, nivel, motivo);
    setFecha(""); setMotivo("");
  };
  return (
    <div className="space-y-4">
      <div className={`rounded-md border p-2.5 text-xs ${c.panelBorder} ${c.textDim}`}>
        Un <b>día hábil</b> es de lunes a viernes y sin feriado nacional activo. Las reglas se aplican mes a mes; si un día cumple varias, gana el nivel más alto, y un ajuste manual manda sobre todas. Son <b>supuestos de negocio editables</b>, no resultados medidos: conviene contrastarlos con las ventas reales.
      </div>
      <div className="space-y-2">
        {crm.reglas.map((r) => <ReglaEditor key={r.id + r.updated_at} regla={r} crm={crm} c={c} />)}
        {adding ? <ReglaEditor isNew crm={crm} c={c} onDone={() => setAdding(false)} /> : (
          <button type="button" onClick={() => setAdding(true)} className={`${btnOutline(c)} flex items-center gap-1`}><Plus className="w-3.5 h-3.5" />Agregar regla</button>
        )}
      </div>

      <div>
        <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${c.textDim}`}>Ajustes manuales por fecha</h4>
        {crm.manuales.length === 0 && <p className={`text-xs ${c.textFaint}`}>No hay ajustes manuales. También se pueden crear desde el panel de cada día.</p>}
        {[...crm.manuales].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((m) => (
          <div key={m.fecha} className={`flex items-center gap-2 py-1.5 border-t text-xs ${c.borderSubtle} ${c.textDim}`}>
            <span className="font-mono w-24">{fmtDMY(m.fecha)}</span><span className="w-36">{NIVEL_LABEL[m.nivel]}</span><span className="flex-1 truncate">{m.motivo || "Sin motivo"}</span>
            <button type="button" onClick={() => crm.setManual(m.fecha, null)} className="text-red-500 flex items-center gap-1"><Trash2 className="w-3 h-3" />Quitar</button>
          </div>
        ))}
        <div className={`flex flex-wrap gap-1.5 pt-2 mt-1 border-t ${c.borderSubtle}`}>
          <input className={`${inputCls(c, "w-32")}`} placeholder="DD/MM/AAAA" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <select className={`${inputCls(c, "w-44")}`} value={nivel} onChange={(e) => setNivel(e.target.value)}><option value="alta">Forzar alta</option><option value="media">Forzar media</option><option value="normal">Forzar normal</option></select>
          <input className={`${inputCls(c, "flex-1 min-w-[10rem]")}`} placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button type="button" onClick={addManual} className={`${btnOutline(c)} shrink-0`}>Agregar ajuste</button>
        </div>
        {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      </div>
    </div>
  );
}
