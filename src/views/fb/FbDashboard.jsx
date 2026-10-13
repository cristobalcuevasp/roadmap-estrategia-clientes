import { useMemo, useState } from "react";
import { Plus, Users, CalendarDays, Filter, Flag, Search } from "lucide-react";
import { useFbCtx } from "./ctx";
import { MultiSelect, inputCls, btnPrimary, btnOutline } from "../crm/crmUi";
import { Card, Kpi, ColumnChart, HBars, Empty, PersonaAvatar, Chip } from "./FbParts";
import {
  aplicarFiltros, rangoPeriodo, enRango, conteoCompromisos, cumplimiento, alertasEquipo, feedbackPorMes, compromisosPorMes, objetivosCumplidosPorMes,
  objetivoAtrasado, conteoObjetivos, fmtFecha,
} from "../../lib/fb/logic";
import { fechaCL } from "../../lib/fb/datetime";
import { CATEGORIAS_SUGERIDAS, ESTADOS_COMPROMISO } from "../../lib/fb/constants";
import { fmtDMY, fmtDow } from "../../lib/crm/calendar";

const PERIODOS = [
  { id: "semana", label: "Esta semana" }, { id: "mes", label: "Este mes" }, { id: "trimestre", label: "Este trimestre" }, { id: "anio", label: "Este año" },
  { id: "90d", label: "Últimos 90 días" }, { id: "todo", label: "Todo el historial" }, { id: "custom", label: "Personalizado" },
];
const SEV_DOT = { alta: "bg-red-500", media: "bg-amber-500", baja: "bg-slate-400" };

export function FbDashboard() {
  const { fb, c, dark, hoy, go, openSeguimiento, openNuevoCompromiso, openCompromiso, esLider } = useFbCtx();
  const [f, setF] = useState({ personas: [], roles: [], estados: [], categorias: [], periodo: "mes", desde: "", hasta: "" });
  const [verTodas, setVerTodas] = useState(false);
  const d = fb.data;

  const rango = useMemo(() => rangoPeriodo(f.periodo, hoy, { desde: f.desde, hasta: f.hasta }), [f.periodo, f.desde, f.hasta, hoy]);
  const filt = useMemo(() => aplicarFiltros(d, { ...f, hoy }), [d, f, hoy]);
  const base = useMemo(() => aplicarFiltros(d, { personas: f.personas, roles: f.roles, hoy }), [d, f.personas, f.roles, hoy]);
  const dAlertas = useMemo(() => ({ ...base, objetivos: filt.objetivos }), [base, filt.objetivos]);

  const k = useMemo(() => {
    const pub = filt.sesiones.filter((s) => s.estado === "publicada");
    const mes = rangoPeriodo("mes", hoy), trim = rangoPeriodo("trimestre", hoy);
    const cc = conteoCompromisos(filt.compromisos, hoy, fb.cfg.dias_aviso_vencimiento);
    const alertas = alertasEquipo(filt.personas, dAlertas, hoy, fb.cfg);
    return {
      activos: filt.personas.filter((p) => p.estado === "activo").length,
      feedbackPeriodo: pub.filter((s) => enRango(fechaCL(s.fecha_hora), rango)).length,
      feedbackMes: pub.filter((s) => enRango(fechaCL(s.fecha_hora), mes)).length,
      feedbackTrim: pub.filter((s) => enRango(fechaCL(s.fecha_hora), trim)).length,
      reunionesPendientes: filt.seguimientos.filter((s) => s.estado === "programado" && s.fecha <= hoy).length,
      sinFeedback: alertas.filter((a) => a.tipo === "sin_feedback").length,
      cc, alertas,
      cumplidosPeriodo: filt.compromisos.filter((x) => x.estado === "cumplido" && enRango(x.fecha_cumplimiento, rango)).length,
      cumpl: cumplimiento(filt.compromisos, hoy, rango),
      objetivos: conteoObjetivos(filt.objetivos, hoy),
      objetivosAtrasados: filt.objetivos.filter((o) => objetivoAtrasado(o, hoy)).sort((a, b) => String(a.fecha_objetivo || "9999").localeCompare(String(b.fecha_objetivo || "9999"))),
      proximas: filt.seguimientos.filter((s) => s.estado === "programado" && s.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora || "").localeCompare(String(b.hora || ""))).slice(0, 8),
    };
  }, [filt, dAlertas, rango, hoy, fb.cfg]);

  const porMes = useMemo(() => feedbackPorMes(filt.sesiones, hoy, 6), [filt.sesiones, hoy]);
  const compMes = useMemo(() => compromisosPorMes(filt.compromisos, hoy, 6), [filt.compromisos, hoy]);
  const objMes = useMemo(() => objetivosCumplidosPorMes(filt.objetivos, hoy, 6), [filt.objetivos, hoy]);
  const porPersona = useMemo(() => filt.personas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((p) => ({ p, r: cumplimiento(filt.compromisos.filter((x) => x.persona_id === p.id), hoy, rango) })), [filt, hoy, rango]);

  const opcPersonas = fb.personas.map((p) => ({ id: p.id, label: p.nombre }));
  const opcRoles = fb.roles.map((r) => ({ id: r.id, label: r.nombre }));
  const opcEstados = ESTADOS_COMPROMISO.map((e) => ({ id: e.id, label: e.label }));
  const cats = [...new Set([...CATEGORIAS_SUGERIDAS, ...fb.compromisos.map((x) => x.categoria), ...fb.objetivos.map((o) => o.categoria)].filter(Boolean))].sort();
  const hayFiltros = f.personas.length || f.roles.length || f.estados.length || f.categorias.length;
  const sinDatos = !fb.sesiones.length && !fb.compromisos.length && !fb.objetivos.length;

  const abrir = (a) => {
    if (a.ref.kind === "compromiso") openCompromiso(a.ref.id);
    else if (a.ref.kind === "objetivo") go({ name: "ficha", personaId: a.personaId, tab: "objetivos" });
    else go({ name: "ficha", personaId: a.personaId, tab: "resumen" });
  };
  const nombre = (id) => fb.personasPorId.get(id)?.nombre || "—";
  const alertasVisibles = verTodas ? k.alertas : k.alertas.slice(0, 8);
  const cc = k.cc;

  return (
    <div className="space-y-3">
      {/* Accesos rápidos */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => go({ name: "feedback" })} className={`${btnPrimary} flex items-center gap-1.5`}><Plus className="w-3.5 h-3.5" />Nuevo feedback</button>
        <button onClick={() => openNuevoCompromiso()} className={btnOutline(c)}>Registrar compromiso</button>
        <button onClick={() => openSeguimiento()} className={btnOutline(c)}>Agendar seguimiento</button>
        <button onClick={() => go({ name: "preparar" })} className={btnOutline(c)}>Preparar reunión</button>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Ver ficha</span>
          <select aria-label="Ver ficha" className={inputCls(c, "w-44")} value="" onChange={(e) => e.target.value && go({ name: "ficha", personaId: e.target.value, tab: "resumen" })}>
            <option value="">Ver ficha…</option>{fb.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      </div>

      {/* Filtros */}
      <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 ${c.panel} ${c.panelBorder}`}>
        <Filter className={`w-3.5 h-3.5 ${c.textFaint}`} />
        <MultiSelect label="Integrante" options={opcPersonas} value={f.personas} onChange={(v) => setF((x) => ({ ...x, personas: v }))} c={c} icon={Users} />
        <MultiSelect label="Rol" options={opcRoles} value={f.roles} onChange={(v) => setF((x) => ({ ...x, roles: v }))} c={c} icon={Flag} />
        <MultiSelect label="Estado del compromiso" options={opcEstados} value={f.estados} onChange={(v) => setF((x) => ({ ...x, estados: v }))} c={c} />
        <MultiSelect label="Categoría" options={cats.map((x) => ({ id: x, label: x }))} value={f.categorias} onChange={(v) => setF((x) => ({ ...x, categorias: v }))} c={c} />
        <label className="flex items-center gap-1.5 text-xs"><CalendarDays className={`w-3.5 h-3.5 ${c.textFaint}`} /><span className="sr-only">Período</span>
          <select aria-label="Período" className={inputCls(c, "w-40")} value={f.periodo} onChange={(e) => setF((x) => ({ ...x, periodo: e.target.value }))}>{PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        {f.periodo === "custom" && <>
          <input aria-label="Desde" type="date" className={inputCls(c, "w-36")} value={f.desde} max={f.hasta || undefined} onChange={(e) => setF((x) => ({ ...x, desde: e.target.value }))} />
          <input aria-label="Hasta" type="date" className={inputCls(c, "w-36")} value={f.hasta} min={f.desde || undefined} onChange={(e) => setF((x) => ({ ...x, hasta: e.target.value }))} />
        </>}
        {hayFiltros ? <button onClick={() => setF((x) => ({ ...x, personas: [], roles: [], estados: [], categorias: [] }))} className="text-xs text-blue-500 px-1">Limpiar filtros</button> : null}
        <span className={`ml-auto text-xs ${c.textFaint}`}>{rango.desde || rango.hasta ? `${rango.desde ? fmtDMY(rango.desde) : "…"} al ${rango.hasta ? fmtDMY(rango.hasta) : "…"}` : "Todo el historial"}</span>
      </div>

      {sinDatos && (
        <Card c={c}><Empty c={c} icon={Users} title="Aquí verás la visión del equipo" text="Aún no hay reuniones, compromisos ni objetivos. Empieza registrando una conversación de feedback o definiendo lo que esperas de cada persona en su ficha."
          action={<div className="flex gap-2 justify-center"><button onClick={() => go({ name: "feedback" })} className={btnPrimary}>Registrar el primer feedback</button><button onClick={() => go({ name: "equipo" })} className={btnOutline(c)}>Ir al equipo</button></div>} /></Card>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi c={c} label="Integrantes activos" value={k.activos} sub={`${filt.personas.length} en la vista · ${fb.personas.length} en total`} onClick={() => go({ name: "equipo" })} />
        <Kpi c={c} label="Feedbacks en el período" value={k.feedbackPeriodo} sub={`Este mes: ${k.feedbackMes} · Este trimestre: ${k.feedbackTrim}`} hint="Reuniones con minuta publicada" />
        <Kpi c={c} label="Reuniones pendientes" value={k.reunionesPendientes} tone={k.reunionesPendientes ? "warn" : undefined} sub={`${k.sinFeedback} persona${k.sinFeedback === 1 ? "" : "s"} sin feedback hace más de ${fb.cfg.dias_sin_feedback} días`} onClick={() => go({ name: "agenda" })} hint="Seguimientos agendados con fecha de hoy o anterior" />
        <Kpi c={c} label="% de cumplimiento" value={k.cumpl.pct == null ? "—" : `${k.cumpl.pct}%`} tone={k.cumpl.pct == null ? undefined : k.cumpl.pct >= 80 ? "good" : k.cumpl.pct >= 50 ? "warn" : "bad"}
          sub={k.cumpl.base ? `${k.cumpl.cumplidos} de ${k.cumpl.base} con vencimiento en el período${k.cumpl.aTiempoPct != null ? ` · ${k.cumpl.aTiempoPct}% a tiempo` : ""}` : "Sin compromisos con vencimiento en el período"} hint="Cumplidos ÷ (cumplidos + vencidos), sobre los compromisos cuya fecha de vencimiento cae en el período" />
        <Kpi c={c} label="Compromisos abiertos (hoy)" value={cc.abiertos} sub={`${cc.porVencer} por vencer en ${fb.cfg.dias_aviso_vencimiento} días`} onClick={() => go({ name: "compromisos" })} />
        <Kpi c={c} label="Vencidos (hoy)" value={cc.vencido} tone={cc.vencido ? "bad" : undefined} sub={cc.reprogramados ? `${cc.reprogramados} reprogramados 2+ veces` : undefined} onClick={() => go({ name: "compromisos" })} />
        <Kpi c={c} label="Bloqueados (hoy)" value={cc.bloqueado} tone={cc.bloqueado ? "warn" : undefined} onClick={() => go({ name: "compromisos" })} />
        <Kpi c={c} label="Cumplidos en el período" value={k.cumplidosPeriodo} tone={k.cumplidosPeriodo ? "good" : undefined} sub={`${cc.cumplido} en total`} />
      </div>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card c={c} title="Frecuencia de feedback (últimos 6 meses)"><ColumnChart c={c} etiquetas={porMes.map((m) => m.label)} series={[{ nombre: "Reuniones", color: "blue", valores: porMes.map((m) => m.valor) }]} titulo="Reuniones de feedback por mes" /></Card>
        <Card c={c} title="Evolución de compromisos (últimos 6 meses)"><ColumnChart c={c} etiquetas={compMes.map((m) => m.label)} series={[{ nombre: "Creados", color: "slate", valores: compMes.map((m) => m.creados) }, { nombre: "Cumplidos", color: "emerald", valores: compMes.map((m) => m.cumplidos) }]} titulo="Compromisos creados y cumplidos por mes" /></Card>
        <Card c={c} title="Compromisos por estado (hoy)">
          {cc.total === 0 ? <Empty c={c} title="Sin compromisos" text="Los compromisos nacen de las minutas o se registran directamente." /> : <HBars c={c} titulo="Compromisos por estado" items={[
            { label: "Pendientes", valor: cc.pendiente, color: "slate" }, { label: "En progreso", valor: cc.en_progreso, color: "blue" }, { label: "Bloqueados", valor: cc.bloqueado, color: "orange" },
            { label: "Vencidos", valor: cc.vencido, color: "red" }, { label: "Cumplidos", valor: cc.cumplido, color: "emerald" }, { label: "Cancelados", valor: cc.cancelado, color: "slate" }]} />}
        </Card>
        <Card c={c} title="Cumplimiento de compromisos por integrante" right={<span className={`text-xs ${c.textFaint}`}>Orden alfabético: no es un ranking</span>}>
          {porPersona.length === 0 ? <Empty c={c} title="Sin integrantes en esta vista" /> : <HBars c={c} total={100} titulo="Cumplimiento por integrante" items={porPersona.map(({ p, r }) => ({ label: p.nombre, valor: r.pct || 0, texto: r.pct == null ? "—" : `${r.pct}%`, color: r.pct == null ? "slate" : r.pct >= 80 ? "emerald" : r.pct >= 50 ? "amber" : "red" }))} />}
          <p className={`text-xs mt-2 ${c.textFaint}`}>«—» significa que no hay compromisos con vencimiento en el período: no se inventa un porcentaje.</p>
        </Card>
        <Card c={c} title="Objetivos: estado actual">
          {k.objetivos.total === 0 ? <Empty c={c} title="Sin objetivos" text="Define lo que esperas de cada persona en la pestaña Objetivos de su ficha." /> : <HBars c={c} titulo="Objetivos por estado" items={[
            { label: "Pendientes", valor: k.objetivos.pendiente, color: "slate" }, { label: "En curso", valor: k.objetivos.en_curso, color: "blue" }, { label: "En riesgo", valor: k.objetivos.en_riesgo, color: "orange" },
            { label: "Cumplidos", valor: k.objetivos.cumplido, color: "emerald" }, { label: "Cancelados", valor: k.objetivos.cancelado, color: "slate" }]} />}
        </Card>
        <Card c={c} title="Objetivos cumplidos por mes"><ColumnChart c={c} etiquetas={objMes.map((m) => m.label)} series={[{ nombre: "Cumplidos", color: "emerald", valores: objMes.map((m) => m.valor) }]} titulo="Objetivos cumplidos por mes" /></Card>
      </div>

      {/* Prioridades de seguimiento */}
      <Card c={c} title={`Prioridades de seguimiento (${k.alertas.length})`} right={k.alertas.length > 8 ? <button onClick={() => setVerTodas((v) => !v)} className="text-xs text-blue-500">{verTodas ? "Ver menos" : `Ver las ${k.alertas.length}`}</button> : null} pad={false}>
        {k.alertas.length === 0 ? <Empty c={c} title="Nada urgente" text="No hay compromisos vencidos, objetivos en riesgo ni personas sin feedback reciente en esta vista." /> : (
          <ul>{alertasVisibles.map((a, i) => (
            <li key={i} className={`border-b last:border-b-0 ${c.panelBorder}`}>
              <button type="button" onClick={() => abrir(a)} className={`w-full flex items-start gap-2.5 px-3 py-2 text-left ${c.rowHover}`}>
                <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${SEV_DOT[a.severidad]}`} title={`Prioridad ${a.severidad}`} />
                <span className="flex-1 min-w-0"><span className={`block text-xs ${c.text}`}>{a.texto}</span><span className={`text-xs ${c.textFaint}`}>{a.persona}{a.fecha ? ` · ${fmtFecha(a.fecha)}` : ""}</span></span>
                <span className="text-xs text-blue-500 shrink-0">{a.ref.kind === "compromiso" ? "Abrir compromiso" : "Ver ficha"}</span>
              </button>
            </li>
          ))}</ul>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card c={c} title="Próximas reuniones de seguimiento" right={<button onClick={() => openSeguimiento()} className="text-xs text-blue-500">Agendar</button>} pad={false}>
          {k.proximas.length === 0 ? <Empty c={c} title="Sin seguimientos agendados" text="Al publicar una minuta con próxima revisión, se agenda sola." /> : (
            <ul>{k.proximas.map((s) => (
              <li key={s.id} className={`flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0 ${c.panelBorder}`}>
                <PersonaAvatar persona={fb.personasPorId.get(s.persona_id)} size="sm" />
                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => openSeguimiento(s.persona_id, s.id)}>
                  <span className={`block text-xs ${c.text}`}>{nombre(s.persona_id)}</span>
                  <span className={`text-xs ${c.textFaint}`}>{fmtDow(s.fecha)}{s.hora ? ` · ${s.hora.slice(0, 5)}` : ""}{s.motivo ? ` · ${s.motivo}` : ""}</span>
                </button>
                <button type="button" onClick={() => go({ name: "preparar", personaId: s.persona_id })} className="text-xs text-blue-500 shrink-0">Preparar</button>
                <button type="button" onClick={() => go({ name: "ficha", personaId: s.persona_id, tab: "resumen" })} className="text-xs text-blue-500 shrink-0">Ver ficha</button>
              </li>
            ))}</ul>
          )}
        </Card>
        <Card c={c} title={`Objetivos con avance atrasado (${k.objetivosAtrasados.length})`} pad={false}>
          {k.objetivosAtrasados.length === 0 ? <Empty c={c} title="Sin objetivos atrasados" text="Se consideran atrasados los objetivos en riesgo o con la fecha objetivo vencida." /> : (
            <ul>{k.objetivosAtrasados.slice(0, 8).map((o) => (
              <li key={o.id} className={`border-b last:border-b-0 ${c.panelBorder}`}>
                <button type="button" onClick={() => go({ name: "ficha", personaId: o.persona_id, tab: "objetivos" })} className={`w-full text-left px-3 py-2 ${c.rowHover}`}>
                  <span className={`block text-xs ${c.text}`}>{o.titulo}</span>
                  <span className={`text-xs ${c.textFaint}`}>{nombre(o.persona_id)} · avance {o.avance}% · {o.estado === "en_riesgo" ? "en riesgo" : `venció el ${fmtFecha(o.fecha_objetivo)}`}</span>
                </button>
              </li>
            ))}</ul>
          )}
        </Card>
      </div>
      {!esLider && null}
    </div>
  );
}
