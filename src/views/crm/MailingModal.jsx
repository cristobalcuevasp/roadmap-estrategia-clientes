import { useMemo, useRef, useState } from "react";
import { History, AlertTriangle, Copy, Ban, Info, Plus } from "lucide-react";
import { useCrmHistory } from "../../lib/useCrm";
import { fmtLong, fmtDMY, todayCL } from "../../lib/crm/calendar";
import { conflictsForDraft, CAMPO_LABEL, semanticaDe } from "../../lib/crm/analysis";
import { explain, NIVEL_LABEL } from "../../lib/crm/opportunity";
import { SidePanel, Field, inputCls, btnPrimary, btnGhost, btnOutline } from "./crmUi";

const CAMPOS = ["fecha", "hora", "titulo_id", "responsable_id", "einstein_id", "configuracion_id", "estado_id", "segmento", "marca_id", "objetivo", "canal_id", "observaciones", "id_externo"];
const norm5 = (h) => (h ? String(h).slice(0, 5) : "");
const val = (row, k) => (k === "hora" ? norm5(row[k]) : row[k] ?? "");
const fmtStamp = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
};

export function HistoryList({ rows, nameOf, c, fmtValue }) {
  if (rows.length === 0) return <p className={`text-xs ${c.textFaint}`}>Sin cambios registrados.</p>;
  const show = (campo, v) => (v === null || v === undefined || v === "" ? "vacío" : fmtValue ? fmtValue(campo, v) : v);
  return (
    <div className="space-y-1 max-h-44 overflow-y-auto">
      {[...rows].reverse().map((h) => (
        <p key={h.id} className={`text-xs ${c.textDim}`}>
          <span className={`font-medium ${c.dark ? "text-slate-300" : "text-slate-700"}`}>{nameOf(h.actor) || "Alguien"}</span>{" "}
          {h.campo === "creacion" ? <>creó: <span className="font-mono">{h.hasta}</span></>
            : h.campo === "eliminado" ? <>eliminó: <span className="font-mono">{h.desde}</span></>
            : <>cambió {CAMPO_LABEL[h.campo] || h.campo} de <span className="font-mono">{show(h.campo, h.desde)}</span> a <span className="font-mono">{show(h.campo, h.hasta)}</span></>}
          <span className={c.textFaint}> · {fmtStamp(h.created_at)}</span>
        </p>
      ))}
    </div>
  );
}

function CatSelect({ crm, lista, value, onChange, c, placeholder = "—", disabled }) {
  const items = crm.lista(lista).filter((x) => x.activo || x.id === value);
  return (
    <select disabled={disabled} className={inputCls(c)} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.activo ? "" : " (inactivo)"}</option>)}
    </select>
  );
}

export function MailingModal({ crm, ctx, mailingId, defaultFecha, me, nameOf, onClose, onDone }) {
  const { c, dark } = ctx;
  const isNew = !mailingId;
  const live = mailingId ? crm.mailings.find((m) => m.id === mailingId) : null;
  const miResp = crm.responsables.find((r) => r.member_id === me?.id && r.activo);
  const canalUnico = crm.lista("canal", { soloActivos: true });

  const initial = useMemo(() => (live ? Object.fromEntries(CAMPOS.map((k) => [k, val(live, k)])) : {
    fecha: defaultFecha, hora: "", titulo_id: "", responsable_id: miResp?.id || "", einstein_id: "", configuracion_id: "",
    estado_id: crm.estadoPendiente?.id || "", segmento: "", marca_id: "", objetivo: "", canal_id: canalUnico.length === 1 ? canalUnico[0].id : "", observaciones: "", id_externo: "",
  }), []); // eslint-disable-line react-hooks/exhaustive-deps -- solo al abrir
  const [draft, setDraft] = useState(initial);
  const baseline = useRef({ values: initial, updatedAt: live?.updated_at || null });
  const [conflict, setConflict] = useState(null); // fila actual cuando otra persona guardó antes
  const [dupOpen, setDupOpen] = useState(false);
  const [dup, setDup] = useState({ modo: "una", fecha: defaultFecha || live?.fecha || todayCL(), veces: 4 });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const history = useCrmHistory("mailing", mailingId, live?.updated_at);

  // ¿Alguien más modificó este mailing mientras lo tengo abierto?
  const liveChanges = useMemo(() => {
    if (!live || !baseline.current.updatedAt) return [];
    if (Date.parse(live.updated_at) === Date.parse(baseline.current.updatedAt)) return [];
    return CAMPOS.filter((k) => val(live, k) !== baseline.current.values[k]);
  }, [live]);
  const externalEdit = liveChanges.length > 0 || (live && Date.parse(live.updated_at) !== Date.parse(baseline.current.updatedAt) && baseline.current.updatedAt);

  const applyTheirs = () => {
    const row = conflict || live;
    setDraft((d) => Object.fromEntries(CAMPOS.map((k) => [k, d[k] === baseline.current.values[k] ? val(row, k) : d[k]])));
    baseline.current = { values: Object.fromEntries(CAMPOS.map((k) => [k, val(row, k)])), updatedAt: row.updated_at };
    setConflict(null);
  };

  const changed = CAMPOS.filter((k) => draft[k] !== baseline.current.values[k]);
  const valid = !!draft.fecha && !!draft.titulo_id && !!draft.estado_id;
  const conflicts = useMemo(() => conflictsForDraft({ ...draft, id: mailingId }, crm.mailings, ctx.catById), [draft, crm.mailings, ctx.catById, mailingId]);
  const esPasado = !!draft.fecha && draft.fecha < ctx.hoy;

  const feriados = ctx.feriadosPorFecha.get(draft.fecha) || [];
  const pago = draft.fecha ? ctx.oportunidad(draft.fecha) : null;
  const clima = draft.fecha ? ctx.climaDe(draft.fecha) : null;

  const einstein = ctx.catById.get(draft.einstein_id);
  const config = ctx.catById.get(draft.configuracion_id);

  const crearTitulo = async () => {
    const nombre = newTitle.trim().replace(/\s+/g, " ");
    if (!nombre) return;
    const existente = crm.lista("titulo").find((t) => t.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente) { set("titulo_id", existente.id); setNewTitle(""); return; }
    const row = await crm.createCatalogItem("titulo", nombre);
    if (row) { set("titulo_id", row.id); setNewTitle(""); }
  };

  const save = async (force = false) => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (isNew) {
        const row = await crm.createMailing(draft);
        if (row) onDone(`Mailing creado: ${ctx.catById.get(row.titulo_id)?.nombre || ""} (${fmtDMY(row.fecha)})`);
      } else {
        const patch = Object.fromEntries(changed.map((k) => [k, draft[k]]));
        if (changed.length === 0) { onClose(); return; }
        const res = await crm.updateMailing(mailingId, patch, { baseUpdatedAt: baseline.current.updatedAt, force });
        if (res?.conflict) setConflict(res.conflict);
        else if (res?.gone) { onDone("Este mailing ya no existe."); }
        else if (res?.ok) onDone("Cambios guardados.");
      }
    } finally { setBusy(false); }
  };

  const duplicar = async () => {
    setBusy(true);
    try {
      const rows = await crm.duplicateMailing({ ...live, ...Object.fromEntries(CAMPOS.map((k) => [k, draft[k]])) , id: live.id }, dup);
      if (rows) onDone(`Se creó${rows.length > 1 ? "ron" : ""} ${rows.length} copia${rows.length > 1 ? "s" : ""} como Pendiente (${rows.map((r) => fmtDMY(r.fecha)).slice(0, 4).join(", ")}${rows.length > 4 ? "…" : ""}).`);
    } finally { setBusy(false); }
  };

  const cancelar = async () => {
    if (!crm.estadoCancelado) return;
    setBusy(true);
    try {
      const res = await crm.setEstado(mailingId, crm.estadoCancelado.id);
      if (res?.ok) onDone("Mailing cancelado. Sigue visible en el calendario y en el historial.");
    } finally { setBusy(false); }
  };

  const sem = live ? semanticaDe(live, ctx.catById) : null;
  const titleCount = crm.lista("titulo", { soloActivos: true }).length;
  const marcas = crm.lista("marca", { soloActivos: true });

  const footer = (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      {!isNew ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDupOpen((v) => !v)} className={`${btnOutline(c)} flex items-center gap-1`}><Copy className="w-3.5 h-3.5" />Duplicar</button>
          {sem !== "cancelado" && crm.estadoCancelado && (confirmCancel ? (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-red-500">¿Cancelar este mailing?</span>
              <button type="button" onClick={cancelar} disabled={busy} className="text-xs font-medium bg-red-600 text-white px-2 py-1 rounded">Sí, cancelar</button>
              <button type="button" onClick={() => setConfirmCancel(false)} className={`text-xs ${c.textFaint}`}>No</button>
            </span>
          ) : <button type="button" onClick={() => setConfirmCancel(true)} className="flex items-center gap-1 text-xs text-red-500 font-medium"><Ban className="w-3.5 h-3.5" />Cancelar mailing</button>)}
        </div>
      ) : <span />}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className={btnGhost(c)}>Cerrar</button>
        <button type="button" disabled={!valid || busy || (!isNew && changed.length === 0)} onClick={() => save(false)} className={btnPrimary}>{isNew ? "Crear mailing" : "Guardar"}</button>
      </div>
    </div>
  );

  return (
    <SidePanel c={c} onClose={onClose} subtitle={isNew ? "Nuevo mailing" : "Mailing"} title={isNew ? "Programar mailing" : ctx.catById.get(draft.titulo_id)?.nombre || "Editar mailing"} footer={footer}>
      {(externalEdit && !conflict) && (
        <div className={`rounded-md border p-2.5 text-xs ${dark ? "bg-amber-500/10 border-amber-700 text-amber-300" : "bg-amber-50 border-amber-300 text-amber-800"}`} role="status">
          <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{nameOf(live.updated_by) || "Otra persona"} modificó este mailing mientras lo editabas{liveChanges.length ? `: ${liveChanges.map((k) => (CAMPO_LABEL[k] || k).replace(/^(el|la|las) /, "")).join(", ")}` : ""}.</p>
          <button type="button" onClick={applyTheirs} className="mt-1.5 font-medium underline">Traer sus cambios a mi formulario (conservo lo que yo cambié)</button>
        </div>
      )}
      {conflict && (
        <div className={`rounded-md border p-2.5 text-xs ${dark ? "bg-red-500/10 border-red-800 text-red-300" : "bg-red-50 border-red-300 text-red-800"}`} role="alert">
          <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />No se guardó: {nameOf(conflict.updated_by) || "otra persona"} cambió este mailing antes que tú.</p>
          <div className="mt-1.5 flex gap-3">
            <button type="button" onClick={applyTheirs} className="font-medium underline">Traer sus cambios y revisar</button>
            <button type="button" onClick={() => save(true)} className="font-medium underline">Guardar igualmente (sobrescribe)</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Field c={c} label="Fecha *">
          <input type="date" className={inputCls(c)} value={draft.fecha || ""} onChange={(e) => set("fecha", e.target.value)} />
        </Field>
        <Field c={c} label="Hora (opcional)"><input type="time" className={inputCls(c)} value={draft.hora || ""} onChange={(e) => set("hora", e.target.value)} /></Field>
      </div>

      {draft.fecha && (
        <div className={`rounded-md border px-2.5 py-2 text-xs space-y-0.5 ${c.panelBorder} ${dark ? "bg-slate-800/60" : "bg-slate-50"} ${c.textDim}`}>
          <p className="font-medium">{fmtLong(draft.fecha)}</p>
          {feriados.map((f) => <p key={f.id}>Feriado {f.ambito === "regional" ? "regional" : "nacional"}: {f.nombre}{f.verificado ? "" : " (por confirmar)"}</p>)}
          {pago && pago.nivel !== "normal" && <p title={explain(pago)}>{NIVEL_LABEL[pago.nivel]} por día de pago · {(pago.manual?.motivo || pago.razones[0]?.nombre) || ""}</p>}
          {clima && <p>Probabilidad de lluvia ({ctx.regionLabel}): {clima.prob} %{clima.parcial ? " (cobertura parcial)" : ""}</p>}
          {esPasado && <p className="text-amber-500">Esta fecha ya pasó.</p>}
        </div>
      )}

      <Field c={c} label="Título del mailing *" hint={titleCount === 0 ? "Aún no hay títulos en el catálogo: crea el primero aquí abajo." : undefined}>
        <CatSelect crm={crm} lista="titulo" value={draft.titulo_id} onChange={(v) => set("titulo_id", v)} c={c} placeholder="Elige un título…" />
        <div className="flex gap-1.5 mt-1.5">
          <input className={inputCls(c)} placeholder="…o escribe un título nuevo" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crearTitulo(); } }} />
          <button type="button" onClick={crearTitulo} disabled={!newTitle.trim()} className={`${btnOutline(c)} shrink-0 flex items-center gap-1 disabled:opacity-50`}><Plus className="w-3.5 h-3.5" />Crear</button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field c={c} label="Responsable"><CatSelectResp crm={crm} value={draft.responsable_id} onChange={(v) => set("responsable_id", v)} c={c} /></Field>
        <Field c={c} label="Estado *"><CatSelect crm={crm} lista="estado" value={draft.estado_id} onChange={(v) => set("estado_id", v)} c={c} placeholder="Elige…" /></Field>
        <Field c={c} label="Einstein" hint={einstein?.definicion || undefined}><CatSelect crm={crm} lista="einstein" value={draft.einstein_id} onChange={(v) => set("einstein_id", v)} c={c} /></Field>
        <Field c={c} label="Configuración" hint={config?.definicion || undefined}><CatSelect crm={crm} lista="configuracion" value={draft.configuracion_id} onChange={(v) => set("configuracion_id", v)} c={c} /></Field>
        <Field c={c} label="Marca" hint={marcas.length === 0 ? "Sin marcas en el catálogo (se pueden agregar en Configuración)." : undefined}><CatSelect crm={crm} lista="marca" value={draft.marca_id} onChange={(v) => set("marca_id", v)} c={c} /></Field>
        <Field c={c} label="Canal"><CatSelect crm={crm} lista="canal" value={draft.canal_id} onChange={(v) => set("canal_id", v)} c={c} /></Field>
        <Field c={c} label="Segmento" full><input className={inputCls(c)} value={draft.segmento} onChange={(e) => set("segmento", e.target.value)} placeholder="Ej: Clientes activos últimos 90 días" /></Field>
        <Field c={c} label="Objetivo" full><input className={inputCls(c)} value={draft.objetivo} onChange={(e) => set("objetivo", e.target.value)} /></Field>
        <Field c={c} label="Observaciones" full><textarea rows={2} className={inputCls(c)} value={draft.observaciones} onChange={(e) => set("observaciones", e.target.value)} /></Field>
        <Field c={c} label="ID externo (Marketing Cloud)" full><input className={inputCls(c)} value={draft.id_externo} onChange={(e) => set("id_externo", e.target.value)} placeholder="Opcional" /></Field>
      </div>

      {conflicts.length > 0 && (
        <div className={`rounded-md border p-2.5 text-xs ${dark ? "bg-amber-500/10 border-amber-700 text-amber-300" : "bg-amber-50 border-amber-300 text-amber-800"}`}>
          <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Posible conflicto (aviso, puedes guardar igualmente)</p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">{conflicts.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      {!isNew && live && (
        <>
          <p className={`text-xs flex items-start gap-1 ${c.textFaint}`}><Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            {live.enviado_en ? `Enviado el ${fmtDMY(live.enviado_en)}. ` : ""}
            {live.estado_cambiado_por ? `Último cambio de estado: ${nameOf(live.estado_cambiado_por) || "alguien"}${live.estado_cambiado_en ? `, ${fmtStamp(live.estado_cambiado_en)}` : ""}. ` : ""}
            Creado por {nameOf(live.created_by) || "—"} · actualizado por {nameOf(live.updated_by) || "—"} ({fmtStamp(live.updated_at)}).
            {live.duplicado_de ? " Es una copia de otro mailing." : ""}
          </p>
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 mb-1.5 ${c.textDim}`}><History className="w-3.5 h-3.5" />Historial <span className={`font-mono ${c.textFaint}`}>{history.length}</span></h4>
            <HistoryList rows={history} nameOf={nameOf} c={c} fmtValue={(campo, v) => (campo === "fecha" || campo === "enviado_en" ? fmtDMY(v) : campo === "hora" ? String(v).slice(0, 5) : v)} />
          </div>
        </>
      )}

      {dupOpen && !isNew && (
        <div className={`rounded-md border p-2.5 space-y-2 ${c.panelBorder} ${dark ? "bg-slate-800/60" : "bg-slate-50"}`}>
          <p className={`text-xs font-semibold ${c.text}`}>Duplicar mailing</p>
          <p className={`text-xs ${c.textFaint}`}>Las copias quedan como Pendiente, sin fecha de envío ni ID externo.</p>
          <div className="grid grid-cols-2 gap-2">
            <Field c={c} label="Repetición">
              <select className={inputCls(c)} value={dup.modo} onChange={(e) => setDup({ ...dup, modo: e.target.value })}>
                <option value="una">Una copia</option><option value="semanal">Semanal (cada 7 días)</option><option value="mensual">Mensual (mismo día del mes)</option>
              </select>
            </Field>
            <Field c={c} label={dup.modo === "una" ? "Fecha de la copia" : "Fecha de la primera copia"}><input type="date" className={inputCls(c)} value={dup.fecha} onChange={(e) => setDup({ ...dup, fecha: e.target.value })} /></Field>
            {dup.modo !== "una" && <Field c={c} label="Cantidad de copias (máx. 52)"><input type="number" min="1" max="52" className={inputCls(c)} value={dup.veces} onChange={(e) => setDup({ ...dup, veces: e.target.value })} /></Field>}
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setDupOpen(false)} className={btnGhost(c)}>Cancelar</button><button type="button" disabled={busy || !dup.fecha} onClick={duplicar} className={btnPrimary}>Crear copias</button></div>
        </div>
      )}
    </SidePanel>
  );
}

function CatSelectResp({ crm, value, onChange, c }) {
  const items = crm.responsables.filter((r) => r.activo || r.id === value);
  return (
    <select className={inputCls(c)} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin responsable</option>
      {items.map((r) => <option key={r.id} value={r.id}>{r.nombre} ({r.iniciales}){r.activo ? "" : " (inactivo)"}</option>)}
    </select>
  );
}
