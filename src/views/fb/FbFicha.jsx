import { useMemo, useState } from "react";
import { Pencil, Plus, Lock } from "lucide-react";
import { useFbCtx } from "./ctx";
import { btnPrimary, btnOutline } from "../crm/crmUi";
import { Card, Kpi, Chip, Tabs, PersonaAvatar, Bar, Empty, Rich, ColumnChart, EstadoCompromiso } from "./FbParts";
import { RolesTab, ObjetivosTab, HistorialTab, CompromisosTab, NotasTab, RegistroTab } from "./FbFichaTabs";
import {
  resumenPersona, alertasEquipo, feedbackPorMes, compromisosPorMes, objetivosCumplidosPorMes, eventosPersona, fmtFecha, objetivoActivo, estadoEfectivo,
} from "../../lib/fb/logic";
import { estadoPersonaMeta, tipoLabel, estadoObjetivoMeta } from "../../lib/fb/constants";
import { fmtFechaHora } from "../../lib/fb/datetime";
import { excerpt } from "../../lib/fb/richtext";
import { fmtDMY, fmtDow, diffDays } from "../../lib/crm/calendar";

function Dato({ label, children, c }) {
  return <div><p className={`text-xs ${c.textFaint}`}>{label}</p><div className={`text-xs ${c.text}`}>{children || <span className={c.textFaint}>—</span>}</div></div>;
}

function Resumen({ persona, r }) {
  const { fb, c, dark, hoy, esLider, go, nameOf, openSeguimiento, openObjetivo } = useFbCtx();
  const alertas = useMemo(() => (esLider ? alertasEquipo([persona], fb.data, hoy, fb.cfg) : []), [esLider, persona, fb.data, hoy, fb.cfg]);
  const ultima = r.sesiones[0];
  const roles = r.roles.map((x) => ({ asig: x, rol: fb.rolesPorId.get(x.rol_id) })).filter((x) => x.rol);
  const objs = fb.objetivos.filter((o) => o.persona_id === persona.id && objetivoActivo(o)).sort((a, b) => String(a.fecha_objetivo || "9999").localeCompare(String(b.fecha_objetivo || "9999")));
  const segs = fb.seguimientos.filter((s) => s.persona_id === persona.id && s.estado === "programado").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cc = r.compromisos;
  return (
    <div className="space-y-3">
      <Card c={c} title="Información general">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Dato label="Cargo formal" c={c}>{persona.cargo}</Dato>
          <Dato label="Área o especialidad" c={c}>{persona.area}</Dato>
          <Dato label="Fecha de incorporación" c={c}>{persona.fecha_incorporacion ? fmtDMY(persona.fecha_incorporacion) : ""}</Dato>
          <Dato label="Líder responsable" c={c}>{nameOf(persona.lider_member_id)}</Dato>
          <Dato label="Estado" c={c}><Chip color={estadoPersonaMeta(persona.estado).color} dark={dark}>{estadoPersonaMeta(persona.estado).label}</Chip></Dato>
          <Dato label="Último feedback" c={c}>{r.ultimoFeedback ? <>{fmtFecha(r.ultimoFeedback)} <span className={c.textFaint}>(hace {r.diasSinFeedback} día{r.diasSinFeedback === 1 ? "" : "s"})</span></> : ""}</Dato>
          <Dato label="Próximo seguimiento" c={c}>{r.proximoSeguimiento ? `${fmtDow(r.proximoSeguimiento.fecha)} ${r.proximoSeguimiento.fecha.slice(0, 4)}${r.proximoSeguimiento.hora ? ` · ${r.proximoSeguimiento.hora.slice(0, 5)}` : ""}` : ""}</Dato>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi c={c} label="Compromisos abiertos" value={cc.abiertos} sub={cc.porVencer ? `${cc.porVencer} por vencer` : undefined} onClick={() => go({ name: "ficha", personaId: persona.id, tab: "compromisos" }, { replace: true })} />
        <Kpi c={c} label="Vencidos" value={cc.vencido} tone={cc.vencido ? "bad" : undefined} onClick={() => go({ name: "ficha", personaId: persona.id, tab: "compromisos" }, { replace: true })} />
        <Kpi c={c} label="Cumplimiento" value={r.cumplimiento.pct == null ? "—" : `${r.cumplimiento.pct}%`} sub={r.cumplimiento.base ? `${r.cumplimiento.cumplidos} de ${r.cumplimiento.base}` : "Sin base para calcular"} hint="Cumplidos ÷ (cumplidos + vencidos)" />
        <Kpi c={c} label="Objetivos activos" value={r.objetivos.activos} tone={r.objetivos.atrasados ? "warn" : undefined} sub={`${r.objetivos.cumplido} cumplido${r.objetivos.cumplido === 1 ? "" : "s"}${r.objetivos.atrasados ? ` · ${r.objetivos.atrasados} atrasado${r.objetivos.atrasados === 1 ? "" : "s"}` : ""}`} onClick={() => go({ name: "ficha", personaId: persona.id, tab: "objetivos" }, { replace: true })} />
      </div>

      {esLider && alertas.length > 0 && (
        <Card c={c} title={`Requiere atención (${alertas.length})`} pad={false}>
          <ul>{alertas.slice(0, 6).map((a, i) => (
            <li key={i} className={`flex items-start gap-2 px-3 py-2 border-b last:border-b-0 text-xs ${c.panelBorder} ${c.text}`}>
              <span className={`w-2 h-2 mt-1 rounded-full shrink-0 ${a.severidad === "alta" ? "bg-red-500" : a.severidad === "media" ? "bg-amber-500" : "bg-slate-400"}`} />{a.texto}
            </li>
          ))}</ul>
        </Card>
      )}

      <Card c={c} title="¿Qué espero de esta persona?" right={<button onClick={() => go({ name: "ficha", personaId: persona.id, tab: "roles" }, { replace: true })} className="text-xs text-blue-500">Ver roles y expectativas</button>}>
        {roles.length === 0 && objs.length === 0 ? (
          <Empty c={c} title="Aún no hay expectativas definidas" text={esLider ? "Asigna uno o más roles y define sus objetivos para dejar claro qué esperas." : "Tu líder todavía no ha registrado roles ni objetivos."}
            action={esLider ? <div className="flex gap-2 justify-center"><button onClick={() => go({ name: "ficha", personaId: persona.id, tab: "roles" }, { replace: true })} className={btnPrimary}>Asignar roles</button><button onClick={() => openObjetivo(persona.id)} className={btnOutline(c)}>Nuevo objetivo</button></div> : null} />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div><h4 className={`text-xs font-semibold mb-1.5 ${c.textDim}`}>Roles actuales</h4>
              {roles.length === 0 ? <p className={`text-xs ${c.textFaint}`}>Sin roles activos.</p> : <ul className="space-y-2">{roles.map(({ asig, rol }) => <li key={asig.id}><p className={`text-xs font-medium ${c.text}`}>{rol.nombre}</p><p className={`text-xs ${c.textDim}`}>{excerpt(asig.expectativas ?? rol.expectativas, 140) || "Sin expectativas escritas"}</p></li>)}</ul>}</div>
            <div><h4 className={`text-xs font-semibold mb-1.5 ${c.textDim}`}>Objetivos activos</h4>
              {objs.length === 0 ? <p className={`text-xs ${c.textFaint}`}>Sin objetivos activos.</p> : <ul className="space-y-2">{objs.slice(0, 5).map((o) => <li key={o.id}><div className="flex items-center justify-between gap-2"><p className={`text-xs font-medium ${c.text}`}>{o.titulo}</p><span className={`text-xs ${c.textFaint}`}>{o.avance}%</span></div><Bar value={o.avance} color={o.estado === "en_riesgo" ? "orange" : "blue"} c={c} label={`Avance de ${o.titulo}`} /></li>)}</ul>}</div>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card c={c} title="Último feedback" right={ultima ? <button onClick={() => go({ name: "minuta", sesionId: ultima.id })} className="text-xs text-blue-500">Ver minuta</button> : null}>
          {ultima ? (
            <div className="space-y-1.5"><p className={`text-xs ${c.textDim}`}>{fmtFechaHora(ultima.fecha_hora)} · {tipoLabel(ultima.tipo)}</p><Rich text={excerpt(ultima.minuta?.resumen, 360)} c={c} /></div>
          ) : <Empty c={c} title="Sin feedback registrado" text={esLider ? "Cada reunión publicada queda como minuta en esta ficha." : "Aquí aparecerán las minutas de tus reuniones."} action={esLider ? <button onClick={() => go({ name: "feedback", personaId: persona.id })} className={btnPrimary}>Registrar el primer feedback</button> : null} />}
        </Card>
        <Card c={c} title="Seguimientos agendados" right={esLider ? <button onClick={() => openSeguimiento(persona.id)} className="text-xs text-blue-500">Agendar</button> : null}>
          {segs.length === 0 ? <p className={`text-xs ${c.textFaint}`}>No hay seguimientos agendados.</p> : (
            <ul className="space-y-1.5">{segs.slice(0, 5).map((s) => (
              <li key={s.id} className="text-xs flex items-center gap-2">
                <button type="button" disabled={!esLider} onClick={() => openSeguimiento(persona.id, s.id)} className={`text-left flex-1 ${s.fecha < hoy ? "text-red-500" : c.text}`}>{fmtDow(s.fecha)} {s.fecha.slice(0, 4)}{s.hora ? ` · ${s.hora.slice(0, 5)}` : ""}{s.motivo ? ` · ${s.motivo}` : ""}</button>
                {s.fecha < hoy && <Chip color="red" dark={dark}>Atrasado</Chip>}
              </li>
            ))}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}

const TIPOS_EVENTO = [["", "Todos los hechos"], ["feedback", "Reuniones"], ["compromiso_creado", "Compromisos creados"], ["compromiso_cumplido", "Compromisos cumplidos"], ["reprogramacion", "Reprogramaciones"], ["objetivo_cumplido", "Objetivos cumplidos"], ["rol", "Roles"]];

function Evolucion({ persona }) {
  const { fb, c, hoy, go, openCompromiso } = useFbCtx();
  const [tipo, setTipo] = useState("");
  const [n, setN] = useState(25);
  const mias = useMemo(() => ({ ...fb.data, sesiones: fb.sesiones.filter((s) => s.persona_id === persona.id), compromisos: fb.compromisos.filter((x) => x.persona_id === persona.id), objetivos: fb.objetivos.filter((o) => o.persona_id === persona.id) }), [fb.data, fb.sesiones, fb.compromisos, fb.objetivos, persona.id]);
  const fm = feedbackPorMes(mias.sesiones, hoy, 12), cm = compromisosPorMes(mias.compromisos, hoy, 12), om = objetivosCumplidosPorMes(mias.objetivos, hoy, 12);
  const eventos = useMemo(() => eventosPersona(persona.id, fb.data).filter((e) => !tipo || e.tipo === tipo), [persona.id, fb.data, tipo]);
  const abrir = (e) => {
    if (e.ref.kind === "sesion") go({ name: "minuta", sesionId: e.ref.id });
    else if (e.ref.kind === "compromiso") openCompromiso(e.ref.id);
    else if (e.ref.kind === "objetivo") go({ name: "ficha", personaId: persona.id, tab: "objetivos" }, { replace: true });
    else go({ name: "ficha", personaId: persona.id, tab: "roles" }, { replace: true });
  };
  const COLOR = { feedback: "bg-blue-500", compromiso_creado: "bg-slate-400", compromiso_cumplido: "bg-emerald-500", compromiso_cancelado: "bg-slate-400", reprogramacion: "bg-orange-500", objetivo_cumplido: "bg-emerald-500", rol: "bg-violet-500" };
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <Card c={c} title="Reuniones por mes (12 meses)"><ColumnChart c={c} alto={90} etiquetas={fm.map((m) => m.label)} series={[{ nombre: "Reuniones", color: "blue", valores: fm.map((m) => m.valor) }]} titulo="Reuniones por mes" /></Card>
        <Card c={c} title="Compromisos creados y cumplidos"><ColumnChart c={c} alto={90} etiquetas={cm.map((m) => m.label)} series={[{ nombre: "Creados", color: "slate", valores: cm.map((m) => m.creados) }, { nombre: "Cumplidos", color: "emerald", valores: cm.map((m) => m.cumplidos) }]} titulo="Compromisos creados y cumplidos" /></Card>
        <Card c={c} title="Objetivos cumplidos por mes"><ColumnChart c={c} alto={90} etiquetas={om.map((m) => m.label)} series={[{ nombre: "Cumplidos", color: "emerald", valores: om.map((m) => m.valor) }]} titulo="Objetivos cumplidos por mes" /></Card>
      </div>
      <Card c={c} title="Línea de tiempo" right={<select aria-label="Filtrar hechos" className="text-xs bg-transparent border rounded px-1.5 py-1" style={{ borderColor: "inherit" }} value={tipo} onChange={(e) => { setTipo(e.target.value); setN(25); }}>{TIPOS_EVENTO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>} pad={false}>
        {eventos.length === 0 ? <Empty c={c} title="Todavía no hay hechos para mostrar" text="A medida que se registren reuniones, compromisos y objetivos cumplidos, aquí verás la evolución en el tiempo." /> : (
          <ol className="px-3 py-2">{eventos.slice(0, n).map((e, i) => (
            <li key={i}><button type="button" onClick={() => abrir(e)} className={`w-full flex items-start gap-3 py-2 text-left ${c.rowHover} rounded`}>
              <span className={`w-2.5 h-2.5 mt-1 rounded-full shrink-0 ${COLOR[e.tipo] || "bg-slate-400"}`} />
              <span className={`w-20 shrink-0 text-xs ${c.textFaint}`}>{fmtDMY(e.fecha)}</span>
              <span className="flex-1 min-w-0"><span className={`block text-xs ${c.text}`}>{e.titulo}</span>{e.detalle && <span className={`block text-xs ${c.textFaint}`}>{e.detalle}</span>}</span>
            </button></li>
          ))}</ol>
        )}
        {eventos.length > n && <div className="px-3 pb-3"><button onClick={() => setN((x) => x + 25)} className="text-xs text-blue-500">Ver más ({eventos.length - n})</button></div>}
      </Card>
    </div>
  );
}

/** Ficha individual con pestañas. El integrante ve solo la suya, en lectura, sin notas privadas ni registro de cambios. */
export function FbFicha({ personaId, tab }) {
  const { fb, c, dark, hoy, esLider, go, nameOf, openPersona } = useFbCtx();
  const persona = fb.personasPorId.get(personaId);
  const r = useMemo(() => (persona ? resumenPersona(persona, fb.data, hoy, fb.cfg) : null), [persona, fb.data, hoy, fb.cfg]);
  if (!persona) return null;
  const tabs = [
    { id: "resumen", label: "Resumen" },
    { id: "roles", label: "Roles y expectativas", badge: r.roles.length || undefined },
    { id: "objetivos", label: "Objetivos", badge: r.objetivos.activos || undefined },
    { id: "historial", label: "Historial de feedback", badge: r.sesiones.length || undefined },
    { id: "compromisos", label: "Compromisos", badge: r.compromisos.abiertos || undefined },
    { id: "evolucion", label: "Evolución" },
    ...(esLider ? [{ id: "notas", label: "Notas privadas" }, { id: "registro", label: "Registro de cambios" }] : []),
  ];
  const actual = tabs.some((t) => t.id === tab) ? tab : "resumen";
  const cambiar = (id) => go({ name: "ficha", personaId, tab: id }, { replace: true });

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border p-3 flex flex-wrap items-center gap-3 ${c.panel} ${c.panelBorder}`}>
        <PersonaAvatar persona={persona} size="lg" />
        <div className="flex-1 min-w-[12rem]">
          <h3 className={`text-base font-semibold ${c.dark ? "text-slate-100" : "text-slate-800"}`}>{persona.nombre}</h3>
          <p className={`text-xs ${c.textDim}`}>{[persona.cargo, persona.area].filter(Boolean).join(" · ") || "Sin cargo definido"}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1"><Chip color={estadoPersonaMeta(persona.estado).color} dark={dark}>{estadoPersonaMeta(persona.estado).label}</Chip>
            {r.roles.map((x) => <Chip key={x.id} color="violet" dark={dark}>{fb.rolesPorId.get(x.rol_id)?.nombre}</Chip>)}</div>
        </div>
        {esLider && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => go({ name: "preparar", personaId })} className={btnOutline(c)}>Preparar feedback</button>
            <button onClick={() => go({ name: "feedback", personaId })} className={`${btnPrimary} flex items-center gap-1.5`}><Plus className="w-3.5 h-3.5" />Nuevo feedback</button>
            <button onClick={() => openPersona(personaId)} className={`${btnOutline(c)} flex items-center gap-1`}><Pencil className="w-3 h-3" />Editar ficha</button>
          </div>
        )}
      </div>
      <Tabs tabs={tabs} value={actual} onChange={cambiar} c={c} />
      <div role="tabpanel">
        {actual === "resumen" && <Resumen persona={persona} r={r} />}
        {actual === "roles" && <RolesTab persona={persona} />}
        {actual === "objetivos" && <ObjetivosTab persona={persona} />}
        {actual === "historial" && <HistorialTab persona={persona} />}
        {actual === "compromisos" && <CompromisosTab persona={persona} />}
        {actual === "evolucion" && <Evolucion persona={persona} />}
        {actual === "notas" && esLider && <NotasTab persona={persona} />}
        {actual === "registro" && esLider && <RegistroTab persona={persona} />}
      </div>
    </div>
  );
}
