import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Lock, Trash2, Search, Info } from "lucide-react";
import { useFbCtx } from "./ctx";
import { inputCls, btnPrimary, btnOutline, btnGhost, CenterModal } from "../crm/crmUi";
import { Card, Chip, Empty, Bar, Rich, PrioridadChip, Confirm, LoadingBlock, RichEditor } from "./FbParts";
import { ListaCompromisos, ordenarCompromisos } from "./FbCompromisoParts";
import { filtrarSesiones, compararSesiones, estadoEfectivo, objetivoAtrasado, objetivoActivo, fmtFecha } from "../../lib/fb/logic";
import { estadoObjetivoMeta, TIPOS_SESION, tipoLabel, modalidadLabel } from "../../lib/fb/constants";
import { fmtFechaHora } from "../../lib/fb/datetime";
import { excerpt, isBlank } from "../../lib/fb/richtext";
import { fmtDMY } from "../../lib/crm/calendar";

/* ------------------------------ Roles y expectativas ------------------------------ */

export function RolesTab({ persona }) {
  const { fb, c, dark, esLider, openAsignarRol, openRol } = useFbCtx();
  const asigs = useMemo(() => fb.personaRoles.filter((r) => r.persona_id === persona.id).sort((a, b) => (a.estado === b.estado ? b.fecha_asignacion.localeCompare(a.fecha_asignacion) : a.estado === "activo" ? -1 : 1)), [fb.personaRoles, persona.id]);
  const objsDeRol = (rolId) => fb.objetivoRoles.filter((x) => x.rol_id === rolId).map((x) => fb.objetivos.find((o) => o.id === x.objetivo_id)).filter((o) => o && o.persona_id === persona.id);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className={`text-xs flex-1 ${c.textDim}`}>Una persona puede tener varios roles a la vez. Las expectativas de cada rol dicen qué esperas; puedes ajustarlas solo para esta persona.</p>
        {esLider && <button onClick={() => openAsignarRol(persona.id)} className={`${btnPrimary} flex items-center gap-1.5 shrink-0`}><Plus className="w-3.5 h-3.5" />Asignar rol</button>}
      </div>
      {asigs.length === 0 ? (
        <Card c={c}><Empty c={c} title="Sin roles asignados" text={esLider ? "Asigna un rol del catálogo o crea uno nuevo (por ejemplo «Mentor Técnico» o «Referente de Calidad») y deja escritas tus expectativas." : "Tu líder todavía no te ha asignado roles."}
          action={esLider ? <button onClick={() => openAsignarRol(persona.id)} className={btnPrimary}>Asignar el primer rol</button> : null} /></Card>
      ) : asigs.map((a) => {
        const rol = fb.rolesPorId.get(a.rol_id);
        if (!rol) return null;
        const personalizado = a.responsabilidades != null || a.expectativas != null;
        const objs = objsDeRol(rol.id);
        return (
          <Card key={a.id} c={c} title={rol.nombre} right={<div className="flex items-center gap-2">
            <Chip color={a.estado === "activo" ? "emerald" : "slate"} dark={dark}>{a.estado === "activo" ? "Activo" : "Histórico"}</Chip>
            {esLider && <button onClick={() => openAsignarRol(persona.id, a.id)} className="text-xs text-blue-500 flex items-center gap-1"><Pencil className="w-3 h-3" />Editar</button>}</div>}>
          <div className="space-y-3">
            <p className={`text-xs ${c.textFaint}`}>Asignado el {fmtDMY(a.fecha_asignacion)}{a.fecha_termino ? ` · hasta el ${fmtDMY(a.fecha_termino)}` : ""}{personalizado ? " · con ajustes para esta persona" : ""}</p>
            {!isBlank(rol.descripcion) && <div><h4 className={`text-xs font-semibold mb-0.5 ${c.textDim}`}>Descripción</h4><Rich text={rol.descripcion} c={c} /></div>}
            <div className="grid md:grid-cols-2 gap-4">
              <div><h4 className={`text-xs font-semibold mb-0.5 ${c.textDim}`}>Responsabilidades principales</h4><Rich text={a.responsabilidades ?? rol.responsabilidades} empty="Sin responsabilidades escritas." c={c} /></div>
              <div><h4 className={`text-xs font-semibold mb-0.5 ${c.textDim}`}>Expectativas del líder</h4><Rich text={a.expectativas ?? rol.expectativas} empty="Sin expectativas escritas." c={c} /></div>
            </div>
            {objs.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className={`text-xs ${c.textFaint}`}>Objetivos vinculados:</span>{objs.map((o) => <Chip key={o.id} color={estadoObjetivoMeta(o.estado).color} dark={dark}>{o.titulo}</Chip>)}</div>}
            {esLider && <button onClick={() => openRol(rol.id)} className={`text-xs ${c.textFaint} hover:underline`}>Editar la definición del rol (afecta a todas las personas que lo tienen)</button>}
          </div></Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------ Objetivos ------------------------------------ */

function ObjetivoCard({ o, persona }) {
  const { fb, c, dark, hoy, esLider, openObjetivo, openNuevoCompromiso, openCompromiso } = useFbCtx();
  const [abierto, setAbierto] = useState(false);
  const m = estadoObjetivoMeta(o.estado);
  const atrasado = objetivoAtrasado(o, hoy);
  const roles = fb.objetivoRoles.filter((x) => x.objetivo_id === o.id).map((x) => fb.rolesPorId.get(x.rol_id)?.nombre).filter(Boolean);
  const comps = fb.compromisos.filter((x) => x.objetivo_id === o.id);
  const cumplidos = comps.filter((x) => x.estado === "cumplido").length;
  const campos = [["Descripción", o.descripcion], ["Resultado esperado", o.resultado_esperado], ["Criterios de éxito", o.criterios_exito], ["Observaciones", o.observaciones]].filter(([, t]) => !isBlank(t));
  return (
    <li className={`rounded-lg border p-3 space-y-2 ${c.panel} ${c.panelBorder}`}>
      <div className="flex flex-wrap items-start gap-2">
        <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex-1 min-w-[12rem] text-left">
          <span className={`block text-sm font-medium ${c.text}`}>{o.titulo}</span>
          <span className={`text-xs ${atrasado ? "text-amber-500" : c.textFaint}`}>{o.fecha_objetivo ? `${o.estado === "cumplido" ? "Cumplido" : "Fecha objetivo"}: ${fmtDMY(o.estado === "cumplido" && o.fecha_cierre ? o.fecha_cierre : o.fecha_objetivo)}` : "Sin fecha objetivo"}{atrasado && o.estado !== "en_riesgo" ? " (vencida)" : ""}{o.categoria ? ` · ${o.categoria}` : ""}</span>
        </button>
        <div className="flex items-center gap-1.5"><PrioridadChip prioridad={o.prioridad} dark={dark} /><Chip color={m.color} dark={dark}>{m.label}</Chip></div>
        {esLider && <button onClick={() => openObjetivo(persona.id, o.id)} aria-label={`Editar objetivo ${o.titulo}`} className={`p-1 ${c.textFaint}`}><Pencil className="w-3.5 h-3.5" /></button>}
      </div>
      <div className="flex items-center gap-2"><div className="flex-1"><Bar value={o.avance} color={o.estado === "cumplido" ? "emerald" : o.estado === "en_riesgo" ? "orange" : "blue"} c={c} label={`Avance de ${o.titulo}`} /></div><span className={`text-xs w-9 text-right ${c.textDim}`}>{o.avance}%</span></div>
      {(roles.length > 0 || comps.length > 0) && <div className="flex flex-wrap items-center gap-1.5">{roles.map((r) => <Chip key={r} color="violet" dark={dark}>{r}</Chip>)}{comps.length > 0 && <span className={`text-xs ${c.textFaint}`}>{cumplidos} de {comps.length} compromisos cumplidos</span>}</div>}
      {abierto && (
        <div className="space-y-2 pt-1">
          {campos.length === 0 && <p className={`text-xs ${c.textFaint}`}>Sin detalles escritos.</p>}
          {campos.map(([l, t]) => <div key={l}><h4 className={`text-xs font-semibold mb-0.5 ${c.textDim}`}>{l}</h4><Rich text={t} c={c} /></div>)}
          {comps.length > 0 && <div><h4 className={`text-xs font-semibold mb-0.5 ${c.textDim}`}>Compromisos vinculados</h4><ul className="space-y-0.5">{comps.map((x) => <li key={x.id}><button type="button" onClick={() => openCompromiso(x.id)} className={`text-xs text-left hover:underline ${c.text}`}>{x.descripcion} <span className={c.textFaint}>({estadoEfectivo(x, hoy).replace("_", " ")}, {fmtDMY(x.fecha_vencimiento)})</span></button></li>)}</ul></div>}
          {esLider && <button onClick={() => openNuevoCompromiso(persona.id, { objetivoId: o.id })} className={btnOutline(c)}>Registrar compromiso para este objetivo</button>}
        </div>
      )}
    </li>
  );
}

export function ObjetivosTab({ persona }) {
  const { fb, c, esLider, openObjetivo } = useFbCtx();
  const [cerrados, setCerrados] = useState(false);
  const todos = fb.objetivos.filter((o) => o.persona_id === persona.id);
  const peso = { alta: 0, media: 1, baja: 2 };
  const activos = todos.filter(objetivoActivo).sort((a, b) => peso[a.prioridad] - peso[b.prioridad] || String(a.fecha_objetivo || "9999").localeCompare(String(b.fecha_objetivo || "9999")));
  const cerradosL = todos.filter((o) => !objetivoActivo(o)).sort((a, b) => String(b.fecha_cierre || b.updated_at).localeCompare(String(a.fecha_cierre || a.updated_at)));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className={`text-xs flex-1 ${c.textDim}`}><strong className={c.text}>¿Qué espero de esta persona?</strong> Objetivos claros, con resultado esperado y criterios de éxito verificables.</p>
        {esLider && <button onClick={() => openObjetivo(persona.id)} className={`${btnPrimary} flex items-center gap-1.5 shrink-0`}><Plus className="w-3.5 h-3.5" />Nuevo objetivo</button>}
      </div>
      {todos.length === 0 ? (
        <Card c={c}><Empty c={c} title="Aún no hay objetivos" text={esLider ? "Define qué esperas lograr con esta persona. Puedes vincular cada objetivo a sus roles." : "Tu líder todavía no ha definido objetivos."} action={esLider ? <button onClick={() => openObjetivo(persona.id)} className={btnPrimary}>Crear el primer objetivo</button> : null} /></Card>
      ) : (
        <>
          {activos.length === 0 ? <p className={`text-xs ${c.textFaint}`}>No hay objetivos activos.</p> : <ul className="space-y-2">{activos.map((o) => <ObjetivoCard key={o.id} o={o} persona={persona} />)}</ul>}
          {cerradosL.length > 0 && <div><button onClick={() => setCerrados((v) => !v)} className={`text-xs font-semibold mb-1.5 ${c.textDim} hover:underline`}>{cerrados ? "Ocultar" : "Ver"} cumplidos y cancelados ({cerradosL.length})</button>{cerrados && <ul className="space-y-2">{cerradosL.map((o) => <ObjetivoCard key={o.id} o={o} persona={persona} />)}</ul>}</div>}
        </>
      )}
      <p className={`flex gap-1.5 text-xs ${c.textFaint}`}><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />Cada objetivo tiene su propio avance: no se promedian porque no son comparables entre sí. Los indicadores numéricos (KPIs con valor inicial, meta y mediciones) aún no están disponibles en esta versión.</p>
    </div>
  );
}

/* --------------------------------- Historial de feedback --------------------------------- */

function CompararModal({ a, b, onClose }) {
  const { fb, c } = useFbCtx();
  const r = compararSesiones(a, b, fb.compromisos);
  const cabecera = (s) => `${fmtFechaHora(s.fecha_hora)} · ${tipoLabel(s.tipo)}`;
  return (
    <CenterModal title="Comparar reuniones" width="max-w-4xl" onClose={onClose} c={c} footer={<div className="flex justify-end"><button onClick={onClose} className={btnPrimary}>Cerrar</button></div>}>
      <div className="overflow-x-auto"><div className="min-w-[36rem] space-y-4">
        <div className="grid grid-cols-2 gap-4"><p className={`text-xs font-semibold ${c.text}`}>{cabecera(a)}</p><p className={`text-xs font-semibold ${c.text}`}>{cabecera(b)}</p></div>
        {r.filas.map((f) => (
          <div key={f.label}><h4 className={`text-xs font-semibold mb-1 ${c.textDim}`}>{f.label}</h4><div className="grid grid-cols-2 gap-4"><Rich text={f.a} empty="Sin contenido" c={c} /><Rich text={f.b} empty="Sin contenido" c={c} /></div></div>
        ))}
        <div><h4 className={`text-xs font-semibold mb-1 ${c.textDim}`}>Compromisos de cada reunión</h4><div className="grid grid-cols-2 gap-4">
          {[r.compromisosA, r.compromisosB].map((l, i) => <ul key={i} className={`text-xs list-disc pl-4 ${c.text}`}>{l.length ? l.map((x) => <li key={x}>{x}</li>) : <li className={`list-none -ml-4 ${c.textFaint}`}>Sin compromisos</li>}</ul>)}
        </div></div>
      </div></div>
    </CenterModal>
  );
}

export function HistorialTab({ persona }) {
  const { fb, c, dark, esLider, go } = useFbCtx();
  const [f, setF] = useState({ q: "", tipo: "", desde: "", hasta: "", estado: "" });
  const [comparar, setComparar] = useState(false);
  const [sel, setSel] = useState([]);
  const [modal, setModal] = useState(false);
  const todas = useMemo(() => fb.sesiones.filter((s) => s.persona_id === persona.id).sort((a, b) => (a.fecha_hora < b.fecha_hora ? 1 : -1)), [fb.sesiones, persona.id]);
  const lista = useMemo(() => filtrarSesiones(todas, f, fb.compromisos), [todas, f, fb.compromisos]);
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((i) => i !== id) : x.length >= 2 ? [x[1], id] : [...x, id]));
  const publicadas = todas.filter((s) => s.estado === "publicada");
  const sa = fb.sesiones.find((s) => s.id === sel[0]), sb = fb.sesiones.find((s) => s.id === sel[1]);
  const ordenadas = sa && sb && sa.fecha_hora > sb.fecha_hora ? [sb, sa] : [sa, sb];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${c.textFaint}`} /><input aria-label="Buscar en las minutas" className={inputCls(c, "w-52 pl-8")} placeholder="Buscar palabras clave" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} /></div>
        <select aria-label="Tipo de reunión" className={inputCls(c, "w-48")} value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value }))}><option value="">Todos los tipos</option>{TIPOS_SESION.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <label className={`flex items-center gap-1 text-xs ${c.textDim}`}>Desde<input aria-label="Fecha inicial" type="date" className={inputCls(c, "w-36")} value={f.desde} max={f.hasta || undefined} onChange={(e) => setF((x) => ({ ...x, desde: e.target.value }))} /></label>
        <label className={`flex items-center gap-1 text-xs ${c.textDim}`}>Hasta<input aria-label="Fecha final" type="date" className={inputCls(c, "w-36")} value={f.hasta} min={f.desde || undefined} onChange={(e) => setF((x) => ({ ...x, hasta: e.target.value }))} /></label>
        {esLider && <select aria-label="Estado de la minuta" className={inputCls(c, "w-36")} value={f.estado} onChange={(e) => setF((x) => ({ ...x, estado: e.target.value }))}><option value="">Todas</option><option value="publicada">Publicadas</option><option value="borrador">Borradores</option></select>}
        {(f.q || f.tipo || f.desde || f.hasta || f.estado) && <button onClick={() => setF({ q: "", tipo: "", desde: "", hasta: "", estado: "" })} className="text-xs text-blue-500">Limpiar</button>}
        <span className="flex-1" />
        {publicadas.length >= 2 && <button onClick={() => { setComparar((v) => !v); setSel([]); }} aria-pressed={comparar} className={btnOutline(c)}>{comparar ? "Salir de comparar" : "Comparar acuerdos"}</button>}
        {comparar && sel.length === 2 && <button onClick={() => setModal(true)} className={btnPrimary}>Comparar las 2 elegidas</button>}
        {esLider && <button onClick={() => go({ name: "feedback", personaId: persona.id })} className={`${btnPrimary} flex items-center gap-1.5`}><Plus className="w-3.5 h-3.5" />Nuevo feedback</button>}
      </div>
      {comparar && <p className={`text-xs ${c.textDim}`}>Marca dos reuniones publicadas ({sel.length} de 2) para ver lado a lado sus acuerdos, mejoras y compromisos.</p>}

      {todas.length === 0 ? (
        <Card c={c}><Empty c={c} title="Aún no hay reuniones registradas" text={esLider ? "Cada feedback que registres genera una minuta que queda guardada aquí, ordenada en el tiempo." : "Cuando tu líder publique una minuta, la verás aquí."} action={esLider ? <button onClick={() => go({ name: "feedback", personaId: persona.id })} className={btnPrimary}>Registrar feedback</button> : null} /></Card>
      ) : lista.length === 0 ? <Card c={c}><Empty c={c} title="Ninguna reunión coincide con los filtros" /></Card> : (
        <ol className="relative space-y-2 pl-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-400/40">
          {lista.map((s) => {
            const cs = fb.compromisos.filter((x) => x.sesion_id === s.id);
            const hechos = cs.filter((x) => x.estado === "cumplido").length;
            const borrador = s.estado === "borrador";
            return (
              <li key={s.id} className="relative">
                <span className={`absolute -left-5 top-3 w-3.5 h-3.5 rounded-full border-2 ${borrador ? "bg-transparent border-amber-500" : "bg-blue-500 border-transparent"}`} />
                <div className={`rounded-lg border p-3 ${c.panel} ${c.panelBorder}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {comparar && !borrador && <input type="checkbox" aria-label={`Elegir reunión del ${fmtFechaHora(s.fecha_hora)}`} checked={sel.includes(s.id)} onChange={() => toggle(s.id)} />}
                    <span className={`text-xs font-medium ${c.text}`}>{fmtFechaHora(s.fecha_hora)}</span>
                    <Chip dark={dark} color="blue">{tipoLabel(s.tipo)}</Chip><span className={`text-xs ${c.textFaint}`}>{modalidadLabel(s.modalidad)}</span>
                    {borrador && <Chip color="amber" dark={dark}>Borrador</Chip>}{s.version > 1 && <Chip dark={dark} title="La minuta fue editada después de publicarse">v{s.version}</Chip>}
                    <span className="flex-1" />
                    <button onClick={() => (borrador ? go({ name: "feedback", personaId: persona.id, sesionId: s.id }) : go({ name: "minuta", sesionId: s.id }))} className="text-xs text-blue-500">{borrador ? "Continuar editando" : "Abrir minuta"}</button>
                  </div>
                  <p className={`text-xs mt-1.5 ${c.textDim}`}>{excerpt(s.minuta?.resumen || s.temas, 220) || "Sin resumen todavía."}</p>
                  {cs.length > 0 && <p className={`text-xs mt-1 ${c.textFaint}`}>{cs.length} compromiso{cs.length === 1 ? "" : "s"} · {hechos} cumplido{hechos === 1 ? "" : "s"}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {modal && ordenadas[0] && ordenadas[1] && <CompararModal a={ordenadas[0]} b={ordenadas[1]} onClose={() => setModal(false)} />}
    </div>
  );
}

/* ------------------------------------- Compromisos ------------------------------------- */

export function CompromisosTab({ persona }) {
  const { fb, c, hoy, esLider, openNuevoCompromiso } = useFbCtx();
  const [cerrados, setCerrados] = useState(false);
  const todos = fb.compromisos.filter((x) => x.persona_id === persona.id);
  const abiertos = ordenarCompromisos(todos.filter((x) => x.estado !== "cumplido" && x.estado !== "cancelado"), hoy);
  const cerradosL = todos.filter((x) => x.estado === "cumplido" || x.estado === "cancelado").sort((a, b) => String(b.fecha_cumplimiento || b.updated_at).localeCompare(String(a.fecha_cumplimiento || a.updated_at)));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><p className={`text-xs flex-1 ${c.textDim}`}>Compromisos nacidos de las minutas (vinculados a su reunión) o registrados directamente.</p>
        {esLider && <button onClick={() => openNuevoCompromiso(persona.id)} className={`${btnPrimary} flex items-center gap-1.5 shrink-0`}><Plus className="w-3.5 h-3.5" />Registrar compromiso</button>}</div>
      {todos.length === 0 ? <Card c={c}><Empty c={c} title="Sin compromisos" text={esLider ? "Se crean al publicar una minuta con compromisos definidos, o puedes registrar uno directamente." : "Aquí verás los compromisos acordados en tus reuniones."} /></Card> : (
        <>
          <div><h3 className={`text-xs font-semibold mb-1.5 ${c.textDim}`}>Abiertos ({abiertos.length})</h3><ListaCompromisos compromisos={abiertos} vacio={<p className={`text-xs ${c.textFaint}`}>No hay compromisos abiertos.</p>} /></div>
          {cerradosL.length > 0 && <div><button onClick={() => setCerrados((v) => !v)} className={`text-xs font-semibold mb-1.5 ${c.textDim} hover:underline`}>{cerrados ? "Ocultar" : "Ver"} cumplidos y cancelados ({cerradosL.length})</button>{cerrados && <ListaCompromisos compromisos={cerradosL} />}</div>}
        </>
      )}
    </div>
  );
}

/* ----------------------------------- Notas privadas ----------------------------------- */

export function NotasTab({ persona }) {
  const { fb, c, go, hoy } = useFbCtx();
  const [nueva, setNueva] = useState("");
  const [edit, setEdit] = useState(null); // { id, cuerpo }
  const [borrar, setBorrar] = useState(null);
  const notas = useMemo(() => fb.notas.filter((n) => n.persona_id === persona.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), [fb.notas, persona.id]);
  const agregar = async () => { if (isBlank(nueva)) return; const out = await fb.addNota({ persona_id: persona.id, cuerpo: nueva }); if (out) setNueva(""); };
  const guardarEdicion = async () => { if (isBlank(edit.cuerpo)) return; const out = await fb.updateNota(edit.id, edit.cuerpo); if (out) setEdit(null); };
  return (
    <div className="space-y-3">
      <p className={`flex items-center gap-1.5 text-xs ${c.textDim}`}><Lock className="w-3.5 h-3.5" />Solo tú ves estas notas. No se comparten con la persona, no aparecen en las minutas ni en la impresión.</p>
      <Card c={c} title="Nueva nota">
        <textarea aria-label="Nueva nota privada" className={inputCls(c)} rows={3} value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={20000} placeholder="Observaciones, ideas para la próxima conversación, contexto que prefieres no compartir…" />
        <div className="flex justify-end mt-2"><button onClick={agregar} disabled={isBlank(nueva)} className={btnPrimary}>Guardar nota</button></div>
      </Card>
      {notas.length === 0 ? <p className={`text-xs ${c.textFaint}`}>Todavía no hay notas privadas sobre {persona.nombre.split(" ")[0]}.</p> : (
        <ul className="space-y-2">{notas.map((n) => (
          <li key={n.id} className={`rounded-lg border p-3 ${c.panel} ${c.panelBorder}`}>
            <div className="flex items-center gap-2 mb-1"><span className={`text-xs ${c.textFaint}`}>{fmtFechaHora(n.created_at)}{n.updated_at !== n.created_at && Math.abs(Date.parse(n.updated_at) - Date.parse(n.created_at)) > 1000 ? " · editada" : ""}</span>
              {n.sesion_id && fb.sesiones.some((s) => s.id === n.sesion_id) && <button type="button" onClick={() => go({ name: "feedback", personaId: persona.id, sesionId: n.sesion_id })} className="text-xs text-blue-500">Ligada a una reunión</button>}
              <span className="flex-1" />
              <button onClick={() => setEdit({ id: n.id, cuerpo: n.cuerpo })} aria-label="Editar nota" className={`p-1 ${c.textFaint}`}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => setBorrar(n)} aria-label="Eliminar nota" className={`p-1 ${c.textFaint}`}><Trash2 className="w-3.5 h-3.5" /></button></div>
            {edit?.id === n.id ? (
              <div><textarea aria-label="Editar nota privada" className={inputCls(c)} rows={4} value={edit.cuerpo} onChange={(e) => setEdit({ ...edit, cuerpo: e.target.value })} maxLength={20000} />
                <div className="flex justify-end gap-2 mt-2"><button onClick={() => setEdit(null)} className={btnGhost(c)}>Cancelar</button><button onClick={guardarEdicion} disabled={isBlank(edit.cuerpo)} className={btnPrimary}>Guardar</button></div></div>
            ) : <p className={`text-xs whitespace-pre-wrap break-words ${c.text}`}>{n.cuerpo}</p>}
          </li>
        ))}</ul>
      )}
      {borrar && <Confirm title="Eliminar nota privada" c={c} danger confirmLabel="Eliminar" onCancel={() => setBorrar(null)} onConfirm={async () => { const id = borrar.id; setBorrar(null); await fb.deleteNota(id); }}><p>La nota se elimina de forma definitiva. Esta acción no se puede deshacer.</p></Confirm>}
    </div>
  );
}

/* -------------------------------- Registro de cambios -------------------------------- */

const TABLAS = { fb_personas: "Ficha", fb_roles: "Rol", fb_persona_roles: "Asignación de rol", fb_objetivos: "Objetivo", fb_sesiones: "Reunión o minuta", fb_compromisos: "Compromiso", fb_seguimientos: "Seguimiento", fb_notas_privadas: "Nota privada", fb_config: "Configuración" };
const ACCIONES = { insert: "Creó", update: "Modificó", delete: "Eliminó" };
const CAMPOS = { estado: "estado", avance: "avance", nombre: "nombre", titulo: "título", descripcion: "descripción", fecha_vencimiento: "vencimiento", prioridad: "prioridad", version: "versión", minuta: "minuta", fecha_hora: "fecha y hora", fecha: "fecha", cargo: "cargo", area: "área", motivo: "motivo" };

export function RegistroTab({ persona }) {
  const { fb, c, nameOf } = useFbCtx();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const stamp = fb.syncedAt?.getTime?.();
  useEffect(() => {
    let alive = true;
    fb.loadAuditoria(persona.id).then((r) => { if (alive) { setRows(r); setError(""); } }).catch((e) => { if (alive) setError(e.message || "No se pudo cargar el registro."); });
    return () => { alive = false; };
  }, [persona.id, stamp]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p role="alert" className="text-xs text-red-500">{error}</p>;
  if (!rows) return <LoadingBlock c={c} />;
  return (
    <div className="space-y-2">
      <p className={`flex items-center gap-1.5 text-xs ${c.textDim}`}><Lock className="w-3.5 h-3.5" />Quién cambió qué y cuándo (solo lo ve el líder). {rows.length === 1 ? "Último movimiento registrado" : `Los últimos ${rows.length} movimientos`}. De las notas privadas solo se registra que existieron, no su contenido.</p>
      {rows.length === 0 ? <Card c={c}><Empty c={c} title="Sin movimientos registrados" /></Card> : (
        <Card c={c} pad={false}><ul>{rows.map((r) => {
          const campos = r.cambios ? Object.keys(r.cambios).map((k) => CAMPOS[k] || k.replace(/_/g, " ")).slice(0, 6).join(", ") : "";
          return (
            <li key={r.id} className={`px-3 py-2 border-b last:border-b-0 text-xs ${c.panelBorder}`}>
              <span className={c.textFaint}>{fmtFechaHora(r.created_at)}</span> · <span className={c.text}>{nameOf(r.actor) || r.actor || "Sistema"}</span> · {ACCIONES[r.accion] || r.accion} <span className={c.text}>{(TABLAS[r.tabla] || r.tabla).toLowerCase()}</span>
              {r.resumen ? <span className={c.textDim}> «{r.resumen}»</span> : null}{campos ? <span className={c.textFaint}> · cambió: {campos}</span> : null}
            </li>
          );
        })}</ul></Card>
      )}
    </div>
  );
}
