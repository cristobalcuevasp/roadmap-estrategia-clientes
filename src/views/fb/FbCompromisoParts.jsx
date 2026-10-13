import { useMemo, useState } from "react";
import { Pencil, History } from "lucide-react";
import { useFbCtx } from "./ctx";
import { SidePanel, CenterModal, Field, inputCls, btnPrimary, btnGhost, btnOutline } from "../crm/crmUi";
import { ESTADOS_REVISABLES, PRIORIDADES, CATEGORIAS_SUGERIDAS, estadoCompromisoMeta, prioridadMeta } from "../../lib/fb/constants";
import { estadoEfectivo, esAbierto, diasParaVencer, reprogramadoReiterado, validarCompromiso, validarRevision, payloadRevision, revisionVacia, objetivoActivo } from "../../lib/fb/logic";
import { fmtDMY } from "../../lib/crm/calendar";
import { fmtFechaHora, fechaCL } from "../../lib/fb/datetime";
import { Bar, Chip, EstadoCompromiso, PrioridadChip, PersonaAvatar, Rich, RichEditor, FieldError, PersonaSelect, Confirm } from "./FbParts";
import { isBlank } from "../../lib/fb/richtext";

/* ---------------------------- filas y tarjetas reutilizables ---------------------------- */

function textoVence(c, hoy) {
  const e = estadoEfectivo(c, hoy);
  if (!esAbierto(c)) return `Vencía el ${fmtDMY(c.fecha_vencimiento)}`;
  const d = diasParaVencer(c, hoy);
  if (e === "vencido") return `Venció hace ${-d} día${-d === 1 ? "" : "s"} (${fmtDMY(c.fecha_vencimiento)})`;
  if (d === 0) return "Vence hoy";
  return `Vence el ${fmtDMY(c.fecha_vencimiento)} (en ${d} día${d === 1 ? "" : "s"})`;
}

/** Fila de compromiso: se usa en la ficha, en la lista de compromisos y en el panel del equipo. */
export function CompromisoFila({ comp, mostrarPersona }) {
  const { fb, c, dark, hoy, esLider, openCompromiso, openRevisar } = useFbCtx();
  const e = estadoEfectivo(comp, hoy);
  const persona = fb.personasPorId.get(comp.persona_id);
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 border-b last:border-b-0 ${c.panelBorder}`}>
      <button type="button" onClick={() => openCompromiso(comp.id)} className="flex-1 min-w-[14rem] text-left">
        <span className={`block text-xs font-medium ${c.text} ${comp.estado === "cancelado" ? "line-through opacity-60" : ""}`}>{comp.descripcion}</span>
        <span className={`flex flex-wrap items-center gap-x-2 text-xs mt-0.5 ${e === "vencido" ? "text-red-500" : c.textDim}`}>
          {mostrarPersona && persona && <span className="flex items-center gap-1"><PersonaAvatar persona={persona} size="sm" />{persona.nombre}</span>}
          <span>{textoVence(comp, hoy)}</span>
          {comp.categoria && <span>· {comp.categoria}</span>}
        </span>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {reprogramadoReiterado(comp) && <Chip color="orange" dark={dark} title="Reprogramado más de una vez">↻ {comp.reprogramaciones}</Chip>}
        {!reprogramadoReiterado(comp) && comp.reprogramaciones === 1 && <Chip color="slate" dark={dark} title="Reprogramado una vez">↻ 1</Chip>}
        <PrioridadChip prioridad={comp.prioridad} dark={dark} />
        <EstadoCompromiso estado={e} dark={dark} />
        <div className="w-20" title={`Avance ${comp.avance}%`}><Bar value={comp.avance} color={e === "vencido" ? "red" : e === "cumplido" ? "emerald" : "blue"} c={c} label="Avance" /><p className={`text-[10px] text-right ${c.textFaint}`}>{comp.avance}%</p></div>
        {esLider && <button type="button" onClick={() => openRevisar(comp.id)} className={btnOutline(c)}>Revisar</button>}
      </div>
    </li>
  );
}

export function ListaCompromisos({ compromisos, mostrarPersona, vacio }) {
  const { c } = useFbCtx();
  if (!compromisos.length) return vacio || null;
  return <ul className={`rounded-lg border overflow-hidden ${c.panel} ${c.panelBorder}`}>{compromisos.map((x) => <CompromisoFila key={x.id} comp={x} mostrarPersona={mostrarPersona} />)}</ul>;
}

/** Orden útil: vencidos primero, luego por fecha de vencimiento */
export const ordenarCompromisos = (lista, hoy) => lista.slice().sort((a, b) => {
  const va = estadoEfectivo(a, hoy) === "vencido" ? 0 : 1, vb = estadoEfectivo(b, hoy) === "vencido" ? 0 : 1;
  return va - vb || a.fecha_vencimiento.localeCompare(b.fecha_vencimiento) || a.descripcion.localeCompare(b.descripcion);
});

export function TarjetaCompromiso({ comp }) {
  const { fb, c, dark, hoy, openCompromiso } = useFbCtx();
  const e = estadoEfectivo(comp, hoy);
  const persona = fb.personasPorId.get(comp.persona_id);
  return (
    <button type="button" onClick={() => openCompromiso(comp.id)} className={`w-full text-left rounded-md border p-2.5 space-y-1.5 ${c.card} ${c.cardBorder} ${c.cardHover}`}>
      <p className={`text-xs font-medium ${c.text}`}>{comp.descripcion}</p>
      <div className="flex items-center gap-1.5">{persona && <PersonaAvatar persona={persona} size="sm" />}<span className={`text-xs truncate ${c.textDim}`}>{persona?.nombre}</span></div>
      <div className="flex flex-wrap items-center gap-1.5"><PrioridadChip prioridad={comp.prioridad} dark={dark} />{reprogramadoReiterado(comp) && <Chip color="orange" dark={dark}>↻ {comp.reprogramaciones}</Chip>}</div>
      <p className={`text-xs ${e === "vencido" ? "text-red-500" : c.textFaint}`}>{textoVence(comp, hoy)}</p>
      <Bar value={comp.avance} color={e === "vencido" ? "red" : e === "cumplido" ? "emerald" : "blue"} c={c} label="Avance" />
    </button>
  );
}

/* ------------------------------------ detalle ------------------------------------ */

function Dato({ label, children, c }) {
  return <div><p className={`text-xs ${c.textFaint}`}>{label}</p><div className={`text-xs ${c.text}`}>{children || "—"}</div></div>;
}

export function CompromisoPanel({ id }) {
  const { fb, c, dark, hoy, esLider, setOverlay, go, nameOf, openRevisar, openEditarCompromiso } = useFbCtx();
  const comp = fb.compromisos.find((x) => x.id === id);
  const revs = useMemo(() => fb.revisiones.filter((r) => r.compromiso_id === id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)), [fb.revisiones, id]);
  if (!comp) {
    return <SidePanel title="Compromiso" onClose={() => setOverlay(null)} c={c}><p className={`text-xs ${c.textDim}`}>Este compromiso ya no está disponible.</p></SidePanel>;
  }
  const e = estadoEfectivo(comp, hoy);
  const persona = fb.personasPorId.get(comp.persona_id);
  const sesion = comp.sesion_id ? fb.sesiones.find((s) => s.id === comp.sesion_id) : null;
  const objetivo = comp.objetivo_id ? fb.objetivos.find((o) => o.id === comp.objetivo_id) : null;
  return (
    <SidePanel title={comp.descripcion} subtitle={persona ? `Compromiso de ${persona.nombre}` : "Compromiso"} width="max-w-xl" onClose={() => setOverlay(null)} c={c}
      footer={esLider ? <div className="flex gap-2"><button type="button" onClick={() => openEditarCompromiso(comp.id)} className={btnOutline(c)}><span className="inline-flex items-center gap-1"><Pencil className="w-3 h-3" />Editar datos</span></button><span className="flex-1" /><button type="button" onClick={() => openRevisar(comp.id)} className={btnPrimary}>{esAbierto(comp) ? "Revisar compromiso" : "Revisar o reabrir"}</button></div> : null}>
      <div className="flex flex-wrap items-center gap-2"><EstadoCompromiso estado={e} dark={dark} /><PrioridadChip prioridad={comp.prioridad} dark={dark} />{comp.categoria && <Chip dark={dark}>{comp.categoria}</Chip>}{reprogramadoReiterado(comp) && <Chip color="orange" dark={dark}>Reprogramado {comp.reprogramaciones} veces</Chip>}</div>
      <div><div className="flex justify-between text-xs mb-1"><span className={c.textDim}>Avance</span><span className={c.text}>{comp.avance}%</span></div><Bar value={comp.avance} color={e === "vencido" ? "red" : e === "cumplido" ? "emerald" : "blue"} c={c} label="Avance" /></div>
      <div className="grid grid-cols-2 gap-3">
        <Dato label="Vencimiento" c={c}><span className={e === "vencido" ? "text-red-500" : ""}>{fmtDMY(comp.fecha_vencimiento)}</span></Dato>
        <Dato label="Fecha original" c={c}>{fmtDMY(comp.fecha_vencimiento_original)}{comp.fecha_vencimiento !== comp.fecha_vencimiento_original ? " (reprogramado)" : ""}</Dato>
        <Dato label="Creado" c={c}>{fmtDMY(fechaCL(comp.created_at))}</Dato>
        <Dato label="Última revisión" c={c}>{comp.fecha_ultima_revision ? fmtDMY(comp.fecha_ultima_revision) : "Aún sin revisar"}</Dato>
        <Dato label="Próxima revisión" c={c}>{comp.fecha_proxima_revision ? fmtDMY(comp.fecha_proxima_revision) : ""}</Dato>
        <Dato label="Última actualización" c={c}>{fmtFechaHora(comp.updated_at)}</Dato>
        {comp.estado === "cumplido" && <Dato label="Cumplido el" c={c}>{fmtDMY(comp.fecha_cumplimiento)}</Dato>}
        <Dato label="Objetivo asociado" c={c}>{objetivo?.titulo}</Dato>
      </div>
      <Dato label="Origen" c={c}>
        {sesion ? <button type="button" className="text-blue-500 hover:underline" onClick={() => go({ name: "minuta", sesionId: sesion.id })}>Minuta del {fmtFechaHora(sesion.fecha_hora)}</button> : comp.sesion_id ? "Una reunión que ya no está disponible" : "Registrado directamente (sin reunión)"}
      </Dato>
      {!isBlank(comp.evidencias) && <div><p className={`text-xs ${c.textFaint} mb-0.5`}>Evidencias y comentarios</p><Rich text={comp.evidencias} c={c} /></div>}
      {(comp.estado === "cumplido" || comp.estado === "cancelado") && <div><p className={`text-xs ${c.textFaint} mb-0.5`}>Resultado final</p><Rich text={comp.resultado_final} c={c} /></div>}

      <div>
        <h4 className={`flex items-center gap-1.5 text-xs font-semibold mb-2 ${c.text}`}><History className="w-3.5 h-3.5" />Historial de revisiones ({revs.length})</h4>
        {revs.length === 0 ? <p className={`text-xs ${c.textDim}`}>Todavía no hay revisiones. Cada revisión queda como un evento fechado y no se puede modificar.</p> : (
          <ol className="space-y-2">
            {revs.map((r) => {
              const cambioEstado = r.estado_anterior !== r.estado_nuevo;
              const reprog = r.vencimiento_anterior !== r.vencimiento_nuevo;
              return (
                <li key={r.id} className={`rounded-md border p-2.5 text-xs space-y-1 ${c.panelBorder}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className={`font-medium ${c.text}`}>{fmtDMY(r.fecha)}</span><span className={c.textFaint}>{nameOf(r.autor) || r.autor || ""}</span>
                    {cambioEstado && <span className="flex items-center gap-1"><EstadoCompromiso estado={r.estado_anterior} dark={dark} /><span className={c.textFaint}>→</span><EstadoCompromiso estado={r.estado_nuevo} dark={dark} /></span>}
                    <span className={c.textDim}>Avance {r.avance_anterior ?? "—"}% → {r.avance_pct}%</span>
                    {reprog && <Chip color="orange" dark={dark}>Reprogramado: {fmtDMY(r.vencimiento_anterior)} → {fmtDMY(r.vencimiento_nuevo)}</Chip>}</div>
                  {[["Avance", r.avance_texto], ["Obstáculos", r.obstaculos], ["Evidencias", r.evidencias], ["Comentarios del líder", r.comentarios_lider], ["Comentarios del integrante", r.comentarios_integrante], ["Acciones correctivas", r.acciones_correctivas], ["Resultado", r.resultado]]
                    .filter(([, t]) => !isBlank(t)).map(([l, t]) => <p key={l} className={c.text}><span className={`font-medium ${c.textDim}`}>{l}: </span>{t}</p>)}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </SidePanel>
  );
}

/* ------------------------------ revisar compromiso ------------------------------ */

export function RevisarModal({ id }) {
  const { fb, c, hoy, setOverlay, nameOf } = useFbCtx();
  const comp = fb.compromisos.find((x) => x.id === id);
  const ultima = useMemo(() => fb.revisiones.filter((r) => r.compromiso_id === id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0], [fb.revisiones, id]);
  const [r, setR] = useState(() => ({
    avance_texto: "", avance_pct: comp?.avance ?? 0, estado_nuevo: comp?.estado ?? "pendiente", obstaculos: "", evidencias: "", comentarios_lider: "", comentarios_integrante: "", acciones_correctivas: "",
    vencimiento_nuevo: comp?.fecha_vencimiento ?? "", resultado: "", fecha_cumplimiento: hoy, proxima_revision: comp?.fecha_proxima_revision || "",
  }));
  const [err, setErr] = useState({});
  const [aviso, setAviso] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!comp) return null;
  const set = (k, v) => setR((x) => ({ ...x, [k]: v }));
  const cierra = r.estado_nuevo === "cumplido" || r.estado_nuevo === "cancelado";
  const reprog = !!r.vencimiento_nuevo && r.vencimiento_nuevo !== comp.fecha_vencimiento;
  const persona = fb.personasPorId.get(comp.persona_id);
  const lleno = { ...r, estado_nuevo: r.estado_nuevo, fecha_cumplimiento: r.estado_nuevo === "cumplido" ? r.fecha_cumplimiento : "" };

  const validar = () => {
    const e = validarRevision(comp, lleno, hoy);
    setErr(e);
    const p = payloadRevision(comp, lleno);
    if (!Object.keys(e).length && revisionVacia(p)) { setAviso("No hay nada que registrar: cambia el avance, el estado o la fecha, o agrega un comentario."); return null; }
    setAviso("");
    return Object.keys(e).length ? null : p;
  };
  const enviar = async (p) => {
    setSaving(true);
    const out = await fb.revisarCompromiso(comp.id, p);
    setSaving(false);
    setConfirmar(false);
    if (out) { fb.refresh(); setOverlay({ kind: "compromiso", id: comp.id }); }
  };
  const guardar = () => {
    const p = validar();
    if (!p) return;
    if (cierra || reprog) setConfirmar(p); else enviar(p);
  };

  return (
    <>
      <CenterModal title="Revisar compromiso" width="max-w-2xl" onClose={() => setOverlay({ kind: "compromiso", id: comp.id })} c={c}
        footer={<div className="flex items-center gap-2"><span className={`text-xs flex-1 ${c.textFaint}`}>Cada revisión queda registrada con fecha y autor; no sobrescribe las anteriores.</span>
          <button type="button" onClick={() => setOverlay({ kind: "compromiso", id: comp.id })} className={btnGhost(c)}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={saving} className={btnPrimary}>{saving ? "Guardando…" : cierra ? (r.estado_nuevo === "cumplido" ? "Registrar y cerrar como cumplido" : "Registrar y cancelar") : "Registrar revisión"}</button></div>}>
        <div className="space-y-3">
          <div className={`rounded-md p-2.5 text-xs ${c.dark ? "bg-slate-800" : "bg-slate-50"}`}>
            <p className={`font-medium ${c.text}`}>{comp.descripcion}</p>
            <p className={c.textDim}>{persona?.nombre} · vence el {fmtDMY(comp.fecha_vencimiento)} · {estadoCompromisoMeta(estadoEfectivo(comp, hoy)).label} · avance {comp.avance}%{comp.reprogramaciones ? ` · reprogramado ${comp.reprogramaciones} ${comp.reprogramaciones === 1 ? "vez" : "veces"}` : ""}</p>
            {ultima ? <p className={`mt-1 ${c.textDim}`}>Última revisión ({fmtDMY(ultima.fecha)}, {nameOf(ultima.autor) || ultima.autor}): {[ultima.avance_texto, ultima.obstaculos && `Obstáculos: ${ultima.obstaculos}`].filter(Boolean).join(" · ") || "sin comentarios"}</p> : <p className={`mt-1 ${c.textFaint}`}>Aún no tiene revisiones.</p>}
          </div>
          {aviso && <p role="alert" className="text-xs text-amber-500">{aviso}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Avance desde la última revisión" full c={c}><textarea className={inputCls(c)} rows={2} value={r.avance_texto} onChange={(e) => set("avance_texto", e.target.value)} maxLength={5000} placeholder="¿Qué se hizo desde la última vez?" /></Field>
            <Field label="Estado" c={c}><select className={inputCls(c)} value={r.estado_nuevo} onChange={(e) => set("estado_nuevo", e.target.value)}>{ESTADOS_REVISABLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              {estadoEfectivo(comp, hoy) === "vencido" && r.estado_nuevo === comp.estado && <p className={`text-xs mt-1 ${c.textFaint}`}>Está vencido por fecha: reprográmalo o ciérralo.</p>}</Field>
            <Field label={`Porcentaje actualizado: ${r.estado_nuevo === "cumplido" ? 100 : Number(r.avance_pct) || 0}%`} c={c}>
              <input type="range" min={0} max={100} step={5} value={r.estado_nuevo === "cumplido" ? 100 : r.avance_pct} disabled={r.estado_nuevo === "cumplido"} onChange={(e) => set("avance_pct", Number(e.target.value))} className="w-full" aria-label="Porcentaje de avance" /><FieldError msg={err.avance_pct} />
            </Field>
            <Field label="Obstáculos encontrados" full c={c}><textarea className={inputCls(c)} rows={2} value={r.obstaculos} onChange={(e) => set("obstaculos", e.target.value)} maxLength={5000} /><FieldError msg={err.obstaculos} /></Field>
            <Field label="Evidencias o entregables" full c={c}><textarea className={inputCls(c)} rows={2} value={r.evidencias} onChange={(e) => set("evidencias", e.target.value)} maxLength={5000} placeholder="Enlaces, documentos, resultados observables" /></Field>
            <Field label="Comentarios del líder" c={c}><textarea className={inputCls(c)} rows={2} value={r.comentarios_lider} onChange={(e) => set("comentarios_lider", e.target.value)} maxLength={5000} /></Field>
            <Field label="Comentarios del integrante" c={c}><textarea className={inputCls(c)} rows={2} value={r.comentarios_integrante} onChange={(e) => set("comentarios_integrante", e.target.value)} maxLength={5000} /></Field>
            <Field label="Acciones correctivas" full c={c}><textarea className={inputCls(c)} rows={2} value={r.acciones_correctivas} onChange={(e) => set("acciones_correctivas", e.target.value)} maxLength={5000} /></Field>
            {!cierra && <>
              <Field label="Nueva fecha comprometida" c={c} hint={reprog ? `Se registrará como reprogramación n.º ${comp.reprogramaciones + 1}.` : "Cámbiala solo si se reprograma."}><input type="date" className={inputCls(c)} value={r.vencimiento_nuevo} min={hoy} onChange={(e) => set("vencimiento_nuevo", e.target.value)} /><FieldError msg={err.vencimiento_nuevo} /></Field>
              <Field label="Próxima revisión" c={c}><input type="date" className={inputCls(c)} value={r.proxima_revision} min={hoy} onChange={(e) => set("proxima_revision", e.target.value)} /><FieldError msg={err.proxima_revision} /></Field>
            </>}
            {r.estado_nuevo === "cumplido" && <Field label="Fecha real de cumplimiento" c={c}><input type="date" className={inputCls(c)} value={r.fecha_cumplimiento} max={hoy} onChange={(e) => set("fecha_cumplimiento", e.target.value)} /><FieldError msg={err.fecha_cumplimiento} /></Field>}
            <Field label={cierra ? "Resultado final *" : "Resultado de la revisión"} full c={c} hint={cierra ? "Obligatorio para cerrar: qué se logró o por qué se cancela." : undefined}><textarea className={inputCls(c)} rows={2} value={r.resultado} onChange={(e) => set("resultado", e.target.value)} maxLength={5000} /><FieldError msg={err.resultado} /></Field>
          </div>
        </div>
      </CenterModal>
      {confirmar && (
        <Confirm title={cierra ? (r.estado_nuevo === "cumplido" ? "Cerrar como cumplido" : "Cancelar compromiso") : "Reprogramar compromiso"} c={c} busy={saving}
          confirmLabel={cierra ? "Cerrar compromiso" : "Reprogramar"} onCancel={() => setConfirmar(false)} onConfirm={() => enviar(confirmar)}>
          {cierra ? <p>El compromiso quedará {r.estado_nuevo === "cumplido" ? `cumplido con fecha ${fmtDMY(r.fecha_cumplimiento)}` : "cancelado"} y su resultado se guardará en el historial. Podrás reabrirlo con otra revisión.</p>
            : <p>La fecha comprometida cambia del {fmtDMY(comp.fecha_vencimiento)} al {fmtDMY(r.vencimiento_nuevo)}. Quedará registrada como reprogramación n.º {comp.reprogramaciones + 1} y se conserva la fecha original ({fmtDMY(comp.fecha_vencimiento_original)}).</p>}
        </Confirm>
      )}
    </>
  );
}

/* --------------------------------- crear o editar --------------------------------- */

export function CompromisoForm({ personaId, objetivoId, id }) {
  const { fb, c, hoy, setOverlay } = useFbCtx();
  const actual = id ? fb.compromisos.find((x) => x.id === id) : null;
  const [d, setD] = useState(() => actual ? { persona_id: actual.persona_id, descripcion: actual.descripcion, categoria: actual.categoria, prioridad: actual.prioridad, objetivo_id: actual.objetivo_id || "", fecha_proxima_revision: actual.fecha_proxima_revision || "", evidencias: actual.evidencias, fecha_vencimiento: actual.fecha_vencimiento }
    : { persona_id: personaId || "", descripcion: "", categoria: "", prioridad: "media", objetivo_id: objetivoId || "", fecha_proxima_revision: "", evidencias: "", fecha_vencimiento: "" });
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const objetivos = fb.objetivos.filter((o) => o.persona_id === d.persona_id && (objetivoActivo(o) || o.id === d.objetivo_id));
  const personas = fb.personas.filter((p) => p.estado !== "inactivo" || p.id === d.persona_id);

  const guardar = async () => {
    const e = {};
    if (!d.persona_id) e.persona_id = "Elige al responsable.";
    if (!id) { const m = validarCompromiso(d, { desde: hoy }); if (m) e.descripcion = m; }
    else if (isBlank(d.descripcion)) e.descripcion = "Falta la descripción del compromiso.";
    if (d.fecha_proxima_revision && d.fecha_proxima_revision < hoy && d.fecha_proxima_revision !== actual?.fecha_proxima_revision) e.fecha_proxima_revision = "La próxima revisión no puede ser anterior a hoy.";
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const out = id ? await fb.updateCompromiso(id, d) : await fb.crearCompromiso(d);
    setSaving(false);
    if (out) setOverlay(id ? { kind: "compromiso", id } : null);
  };

  return (
    <SidePanel title={id ? "Editar compromiso" : "Registrar compromiso"} subtitle={fb.personasPorId.get(d.persona_id)?.nombre} width="max-w-lg" onClose={() => setOverlay(id ? { kind: "compromiso", id } : null)} c={c}
      footer={<div className="flex gap-2"><span className="flex-1" /><button type="button" onClick={() => setOverlay(id ? { kind: "compromiso", id } : null)} className={btnGhost(c)}>Cancelar</button><button type="button" onClick={guardar} disabled={saving} className={btnPrimary}>{saving ? "Guardando…" : id ? "Guardar cambios" : "Registrar compromiso"}</button></div>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsable *" full c={c}><PersonaSelect personas={personas} value={d.persona_id} onChange={(v) => setD((x) => ({ ...x, persona_id: v, objetivo_id: "" }))} c={c} disabled={!!id} /><FieldError msg={err.persona_id} /></Field>
        <Field label="Descripción *" full c={c}><textarea className={inputCls(c)} rows={3} value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} maxLength={2000} placeholder="Qué se compromete, con un resultado verificable" /><FieldError msg={err.descripcion} /></Field>
        {!id && <Field label="Fecha de vencimiento *" c={c}><input type="date" className={inputCls(c)} value={d.fecha_vencimiento} min={hoy} onChange={(e) => set("fecha_vencimiento", e.target.value)} /></Field>}
        {id && <Field label="Vencimiento" c={c} hint="Para cambiarlo usa «Revisar compromiso»: queda registrado como reprogramación."><input className={inputCls(c)} value={fmtDMY(d.fecha_vencimiento)} disabled /></Field>}
        <Field label="Prioridad" c={c}><select className={inputCls(c)} value={d.prioridad} onChange={(e) => set("prioridad", e.target.value)}>{PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
        <Field label="Categoría" c={c}><input className={inputCls(c)} list="fb-cats2" value={d.categoria} onChange={(e) => set("categoria", e.target.value)} maxLength={60} /><datalist id="fb-cats2">{CATEGORIAS_SUGERIDAS.map((x) => <option key={x} value={x} />)}</datalist></Field>
        <Field label="Objetivo asociado" c={c}><select className={inputCls(c)} value={d.objetivo_id} onChange={(e) => set("objetivo_id", e.target.value)}><option value="">Ninguno</option>{objetivos.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}</select></Field>
        <Field label="Próxima revisión" full c={c}><input type="date" className={inputCls(c)} value={d.fecha_proxima_revision} min={hoy} onChange={(e) => set("fecha_proxima_revision", e.target.value)} /><FieldError msg={err.fecha_proxima_revision} /></Field>
        {id && <Field label="Evidencias y comentarios" full c={c}><RichEditor value={d.evidencias} onChange={(v) => set("evidencias", v)} rows={3} c={c} ariaLabel="Evidencias" /></Field>}
      </div>
    </SidePanel>
  );
}
