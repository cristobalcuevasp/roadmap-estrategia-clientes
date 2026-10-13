import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Link2, Pencil, Info } from "lucide-react";
import { addDaysISO, fmtWeek } from "../../lib/crm/calendar";
import { SidePanel, inputCls, btnPrimary, btnGhost, RespDot, badgeCls } from "./crmUi";

export const ESTADOS_COMENTARIO = ["Pendiente", "En seguimiento", "Resuelto"];
const ESTADO_COLOR = { Pendiente: "amber", "En seguimiento": "blue", Resuelto: "emerald" };
const stamp = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`; };

export function commentLink(id) {
  return `${window.location.origin}${window.location.pathname}#/crm/comentario/${id}`;
}

function CommentItem({ cm, crm, ctx, me, nameOf, focused, showToast }) {
  const { c, dark } = ctx;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(cm.cuerpo);
  const [resp, setResp] = useState(cm.responsable_id || "");
  const ref = useRef(null);
  const resp0 = cm.responsable_id ? ctx.respById.get(cm.responsable_id) : null;
  const isAuthor = !!me && cm.autor === me.id;
  useEffect(() => { if (focused && ref.current) ref.current.scrollIntoView({ block: "center" }); }, [focused]);
  useEffect(() => { if (!editing) { setText(cm.cuerpo); setResp(cm.responsable_id || ""); } }, [cm.cuerpo, cm.responsable_id, editing]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(commentLink(cm.id)); showToast("Enlace copiado.", "ok"); }
    catch (e) { showToast(`No se pudo copiar automáticamente. Enlace: ${commentLink(cm.id)}`); }
  };
  const saveEdit = async () => {
    const patch = {};
    if (text.trim() !== cm.cuerpo) patch.cuerpo = text.trim();
    if ((resp || null) !== (cm.responsable_id || null)) patch.responsable_id = resp || null;
    if (Object.keys(patch).length) await crm.updateComentario(cm.id, patch);
    setEditing(false);
  };

  return (
    <li ref={ref} className={`rounded-md border p-2.5 ${focused ? "border-blue-500 ring-1 ring-blue-500" : c.panelBorder} ${c.card}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${c.text}`}>{nameOf(cm.autor) || "Alguien"} <span className={`font-normal ${c.textFaint}`}>· {stamp(cm.created_at)}</span></span>
        <select aria-label="Estado del comentario" value={cm.estado} onChange={(e) => crm.updateComentario(cm.id, { estado: e.target.value })}
          className={`text-xs rounded px-1.5 py-0.5 border-0 font-medium ${badgeCls(ESTADO_COLOR[cm.estado], dark)}`}>
          {ESTADOS_COMENTARIO.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {editing ? (
        <div className="mt-1.5 space-y-1.5">
          <textarea rows={3} className={inputCls(c)} value={text} onChange={(e) => setText(e.target.value)} />
          <select className={inputCls(c)} value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="">Sin responsable</option>
            {crm.responsables.filter((r) => r.activo || r.id === resp).map((r) => <option key={r.id} value={r.id}>{r.nombre} ({r.iniciales})</option>)}
          </select>
          <div className="flex justify-end gap-2"><button type="button" className={btnGhost(c)} onClick={() => setEditing(false)}>Cancelar</button><button type="button" disabled={!text.trim()} className={btnPrimary} onClick={saveEdit}>Guardar</button></div>
        </div>
      ) : (
        <p className={`text-xs mt-1 whitespace-pre-wrap ${c.textDim}`}>{cm.cuerpo}</p>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
        <span className={`flex items-center gap-1.5 text-xs ${c.textFaint}`}>
          {resp0 ? <><RespDot resp={resp0} />Asignado a {resp0.nombre}</> : "Sin responsable asignado"}
        </span>
        <span className="flex items-center gap-2">
          {isAuthor && !editing && <button type="button" onClick={() => setEditing(true)} className={`flex items-center gap-1 text-xs ${c.textDim}`}><Pencil className="w-3 h-3" />Editar</button>}
          <button type="button" onClick={copy} className="flex items-center gap-1 text-xs text-blue-500"><Link2 className="w-3 h-3" />Copiar enlace</button>
        </span>
      </div>
      {cm.estado === "Resuelto" && cm.resuelto_en && <p className={`text-xs mt-1 ${c.textFaint}`}>Resuelto por {nameOf(cm.resuelto_por) || "alguien"} · {stamp(cm.resuelto_en)}</p>}
    </li>
  );
}

export function WeekComments({ crm, ctx, monday, onChangeWeek, onClose, me, nameOf, focusId, showToast }) {
  const { c } = ctx;
  const [cuerpo, setCuerpo] = useState("");
  const [resp, setResp] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => crm.comentarios.filter((x) => x.semana === monday).sort((a, b) => a.created_at.localeCompare(b.created_at)), [crm.comentarios, monday]);
  const r = resp ? ctx.respById.get(resp) : null;
  const sinCuenta = r && !r.member_id;

  const send = async () => {
    if (!cuerpo.trim() || busy) return;
    setBusy(true);
    try {
      const row = await crm.addComentario({ semana: monday, cuerpo, responsable_id: resp || null, avisar });
      if (row) { setCuerpo(""); showToast(r && avisar && r.member_id ? `Comentario guardado. ${r.nombre} verá un aviso en la campana de la app.` : "Comentario guardado.", "ok"); }
    } finally { setBusy(false); }
  };

  return (
    <SidePanel c={c} onClose={onClose} subtitle="Comentarios de la semana" title={fmtWeek(monday)}>
      <div className="flex items-center justify-between -mt-1">
        <button type="button" onClick={() => onChangeWeek(addDaysISO(monday, -7))} className={`${btnGhost(c)} flex items-center gap-1`} aria-label="Semana anterior"><ChevronLeft className="w-3.5 h-3.5" />Anterior</button>
        <button type="button" onClick={() => onChangeWeek(addDaysISO(monday, 7))} className={`${btnGhost(c)} flex items-center gap-1`} aria-label="Semana siguiente">Siguiente<ChevronRight className="w-3.5 h-3.5" /></button>
      </div>

      {list.length === 0 ? <p className={`text-xs ${c.textFaint}`}>Aún no hay comentarios para esta semana.</p> : (
        <ul className="space-y-2">{list.map((cm) => <CommentItem key={cm.id} cm={cm} crm={crm} ctx={ctx} me={me} nameOf={nameOf} focused={cm.id === focusId} showToast={showToast} />)}</ul>
      )}

      <div className={`rounded-md border p-2.5 space-y-2 ${c.panelBorder}`}>
        <p className={`text-xs font-semibold ${c.text}`}>Nuevo comentario</p>
        <textarea rows={3} className={inputCls(c)} placeholder="Ej: Revisar segmentación del martes antes de programar…" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
        <select aria-label="Asignar a" className={inputCls(c)} value={resp} onChange={(e) => setResp(e.target.value)}>
          <option value="">Sin responsable (comentario general)</option>
          {crm.responsables.filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>Asignar a {x.nombre} ({x.iniciales})</option>)}
        </select>
        <label className={`flex items-center gap-2 text-xs ${c.textDim}`}><input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />Avisar a la persona asignada</label>
        <p className={`text-xs flex items-start gap-1 ${c.textFaint}`}><Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          El aviso llega a la campana de la app; no se envían correos.
          {sinCuenta ? " Esta persona aún no tiene cuenta vinculada en la app, así que no recibirá aviso." : ""}
        </p>
        <div className="flex justify-end"><button type="button" disabled={!cuerpo.trim() || busy} onClick={send} className={btnPrimary}>Guardar comentario</button></div>
      </div>
    </SidePanel>
  );
}
