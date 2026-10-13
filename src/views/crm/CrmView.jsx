import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Settings, Download, Search, CloudRain, CircleDollarSign, Flag, MessageSquare, CalendarDays, HelpCircle, AlertTriangle, Filter } from "lucide-react";
import { tokens } from "../../lib/theme";
import { useCrm } from "../../lib/useCrm";
import {
  todayCL, parts, isoOf, daysInMonth, addMonthsISO, addDaysISO, mondayOf, fmtMonth, fmtWeek, weekDays, weekdayIdx, isWeekend, fmtDMY, fmtDM,
} from "../../lib/crm/calendar";
import { makeOpportunityIndex } from "../../lib/crm/opportunity";
import { regionDay, BANDAS, bandRangeLabel, creditoClima } from "../../lib/crm/weather";
import { FILTROS_VACIOS, filterMailings, groupByDate, conflictMap, rangeKpis, workload } from "../../lib/crm/analysis";
import { MonthGrid, WeekGrid, Agenda, daysOfMonth } from "./Calendars";
import { MailingModal } from "./MailingModal";
import { DayPanel } from "./DayPanel";
import { WeekComments } from "./WeekComments";
import { SettingsModal } from "./SettingsModal";
import { ImportExportModal } from "./ImportExportModal";
import { MultiSelect, RespDot, inputCls, btnPrimary, btnOutline, swatchCls } from "./crmUi";

const PREFS_KEY = "crm-prefs";
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); } catch (e) { return {}; } };
const savePrefs = (p) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...p })); } catch (e) { /* almacenamiento no disponible: solo se pierde la preferencia */ } };

const CAPAS = [
  { id: "mailings", label: "Mailings", icon: CalendarDays },
  { id: "clima", label: "Clima", icon: CloudRain },
  { id: "pago", label: "Días de pago", icon: CircleDollarSign },
  { id: "feriados", label: "Feriados", icon: Flag },
  { id: "comentarios", label: "Comentarios", icon: MessageSquare },
];
const ESTADO_EJEC = { ok: "completa", parcial: "parcial", error: "con error", en_curso: "en curso" };
const CAPAS_INICIAL = { mailings: true, clima: true, pago: true, feriados: true, comentarios: true };

function Legend({ crm, ctx }) {
  const { c, dark } = ctx;
  const estados = crm.lista("estado", { soloActivos: true });
  return (
    <div className={`rounded-lg border p-3 text-xs grid gap-3 md:grid-cols-2 lg:grid-cols-4 ${c.panel} ${c.panelBorder} ${c.textDim}`}>
      <div>
        <p className={`font-semibold mb-1 ${c.text}`}>Probabilidad de lluvia (promedio por región, ponderado por tiendas)</p>
        <div className="space-y-1">{BANDAS.map((b) => <p key={b.id} className="flex items-center gap-2"><span className={`w-8 h-3 rounded ${b.bar}`} />{b.label}: {bandRangeLabel(b.id, ctx.cortes)}</p>)}</div>
        <p className={`mt-1 ${c.textFaint}`}>Borde punteado = tendencia (más allá de {ctx.diasPronostico} días). “*” = no todas las comunas tienen dato.</p>
      </div>
      <div>
        <p className={`font-semibold mb-1 ${c.text}`}>Días de pago</p>
        <p className="flex items-center gap-1.5"><CircleDollarSign className="w-3.5 h-3.5 text-emerald-500" />Alta oportunidad</p>
        <p className="flex items-center gap-1.5"><CircleDollarSign className="w-3.5 h-3.5 text-amber-500" />Oportunidad media</p>
        <p className={`mt-1 ${c.textFaint}`}>Pasa el mouse o abre el día para ver la regla y su justificación. Son supuestos editables.</p>
      </div>
      <div>
        <p className={`font-semibold mb-1 ${c.text}`}>Estado del mailing (franja izquierda)</p>
        {estados.map((e) => <p key={e.id} className="flex items-center gap-2"><span className={`w-1 h-3.5 rounded ${swatchCls(e.color)}`} />{e.nombre}</p>)}
        <p className="mt-1 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-500" />Posible conflicto (mismo segmento u hora el mismo día)</p>
      </div>
      <div>
        <p className={`font-semibold mb-1 ${c.text}`}>Feriados y fines de semana</p>
        <p className="flex items-center gap-1.5"><Flag className={`w-3 h-3 ${dark ? "text-rose-300" : "text-rose-700"}`} />Feriado nacional</p>
        <p className="flex items-center gap-1.5"><Flag className={`w-3 h-3 ${dark ? "text-fuchsia-300" : "text-fuchsia-700"}`} />Feriado regional (según la región elegida)</p>
        <p className={`mt-1 ${c.textFaint}`}>Los fines de semana tienen fondo más apagado. “Por confirmar” = fecha aún sin validar contra fuente oficial.</p>
      </div>
    </div>
  );
}

export function CrmView({ session, me, users, nameOf, showToast, dark, deepLink, clearDeepLink }) {
  const c = tokens(dark);
  const crm = useCrm({ userId: session.user.id, showToast });
  const hoy = todayCL();

  const prefs0 = useMemo(loadPrefs, []);
  const [modo, setModo] = useState("mes");
  const [cursor, setCursor] = useState(hoy);
  const [region, setRegionState] = useState(prefs0.region || "RM");
  const [layers, setLayersState] = useState({ ...CAPAS_INICIAL, ...(prefs0.layers || {}) });
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [dragId, setDragId] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [filtrosOpen, setFiltrosOpen] = useState(false); // solo afecta al celular: en pantallas medianas en adelante todo se ve
  const [dayOpen, setDayOpen] = useState(null);
  const [mailing, setMailing] = useState(null); // { id } | { fecha }
  const [weekOpen, setWeekOpen] = useState(null); // { monday, focusId }
  const [settingsTab, setSettingsTab] = useState(null);
  const [ioOpen, setIoOpen] = useState(false);

  const setRegion = (r) => { setRegionState(r); savePrefs({ region: r }); };
  const toggleLayer = (id) => setLayersState((l) => { const n = { ...l, [id]: !l[id] }; savePrefs({ layers: n }); return n; });

  const { y, m } = parts(cursor);
  const monday = mondayOf(cursor);
  const desde = modo === "mes" ? isoOf(y, m, 1) : monday;
  const hasta = modo === "mes" ? isoOf(y, m, daysInMonth(y, m)) : addDaysISO(monday, 6);

  const go = (dir) => setCursor((cur) => (modo === "mes" ? addMonthsISO(isoOf(parts(cur).y, parts(cur).m, 1), dir) : addDaysISO(cur, 7 * dir)));

  /* ---------- derivados ---------- */
  const catById = crm.byId.cat, respById = crm.byId.res;
  const regionLabel = region === "todas" ? "todas las regiones" : crm.regiones.find((r) => r.id === region)?.nombre || region;
  const visibles = useMemo(() => filterMailings(crm.mailings, filtros, catById), [crm.mailings, filtros, catById]);
  const byDate = useMemo(() => groupByDate(visibles, catById), [visibles, catById]);
  const allByDate = useMemo(() => groupByDate(crm.mailings, catById), [crm.mailings, catById]);
  const conflicts = useMemo(() => conflictMap(crm.mailings, catById), [crm.mailings, catById]);
  const oportunidad = useMemo(() => makeOpportunityIndex(crm.reglas, crm.feriados, crm.manuales), [crm.reglas, crm.feriados, crm.manuales]);

  const feriadosPorFecha = useMemo(() => {
    const map = new Map();
    for (const f of crm.feriados) {
      if (!f.activo) continue;
      if (f.ambito === "regional" && region !== "todas" && f.region_id !== region) continue;
      const l = map.get(f.fecha) || [];
      l.push(f); map.set(f.fecha, l);
    }
    return map;
  }, [crm.feriados, region]);

  const climaCache = useMemo(() => new Map(), [crm.comunas, crm.climaIndex, region]);
  const climaDe = useCallback((iso) => {
    if (!climaCache.has(iso)) climaCache.set(iso, regionDay(crm.comunas, crm.climaIndex, region, iso));
    return climaCache.get(iso);
  }, [climaCache, crm.comunas, crm.climaIndex, region]);

  const comentariosSemana = useCallback((mon) => {
    const l = crm.comentarios.filter((x) => x.semana === mon);
    return { count: l.length, pendientes: l.filter((x) => x.estado !== "Resuelto").length };
  }, [crm.comentarios]);

  const ctx = useMemo(() => ({
    c, dark, hoy, region, regionLabel, cortes: crm.settings.cortes, diasPronostico: crm.settings.diasPronostico,
    catById, respById, conflicts, layers, byDate, allByDate, feriadosPorFecha, oportunidad, climaDe, comentariosSemana,
    dragId, setDragId,
    onOpenDay: (iso) => setDayOpen(iso),
    onOpenMailing: (id) => setMailing({ id }),
    onNewMailing: (fecha) => { setDayOpen(null); setMailing({ fecha }); },
    onOpenWeek: (mon) => { setDayOpen(null); setWeekOpen({ monday: mon }); },
    onDropMailing: async (id, fecha) => {
      const mm = crm.mailings.find((x) => x.id === id);
      if (!mm || mm.fecha === fecha) return;
      const res = await crm.moveMailing(id, fecha);
      if (res?.ok) {
        const nota = (feriadosPorFecha.get(fecha) || []).some((f) => f.ambito === "nacional") ? " (es feriado)" : isWeekend(fecha) ? " (es fin de semana)" : "";
        showToast(`Mailing movido al ${fmtDMY(fecha)}${nota}.`, "ok");
      }
    },
  }), [c, dark, hoy, region, regionLabel, crm.settings, catById, respById, conflicts, layers, byDate, allByDate, feriadosPorFecha, oportunidad, climaDe, comentariosSemana, dragId, crm.mailings, crm.moveMailing, showToast]);

  /* ---------- indicadores ---------- */
  const hastaKpi = hasta;
  const kpi = useMemo(() => rangeKpis(visibles, {
    desde, hasta: hastaKpi, hoy, catById,
    feriadoDe: (iso) => (crm.feriados.some((f) => f.activo && f.ambito === "nacional" && f.fecha === iso)),
    esFinDeSemana: isWeekend,
    oportunidadDe: (iso) => oportunidad(iso)?.nivel,
  }), [visibles, desde, hastaKpi, hoy, catById, crm.feriados, oportunidad]);

  const diasPeriodo = useMemo(() => (modo === "mes" ? daysOfMonth(y, m) : weekDays(monday)), [modo, y, m, monday]);
  const altasSinMailing = useMemo(() => diasPeriodo.filter((iso) => iso >= hoy && !isWeekend(iso) && oportunidad(iso)?.nivel === "alta" && !(allByDate.get(iso) || []).some((x) => catById.get(x.estado_id)?.semantica !== "cancelado")), [diasPeriodo, hoy, oportunidad, allByDate, catById]);
  const lluviaAlta = useMemo(() => diasPeriodo.filter((iso) => { const cl = climaDe(iso); return cl && cl.prob >= crm.settings.sugerencia.umbral; }), [diasPeriodo, climaDe, crm.settings.sugerencia.umbral]);
  const carga = useMemo(() => workload(visibles, crm.responsables, { desde, hasta, catById }), [visibles, crm.responsables, desde, hasta, catById]);
  const hayFiltros = filtros.responsables.length > 0 || filtros.estado !== "todos" || filtros.titulo !== "todos" || filtros.q.trim() !== "";
  const nFiltros = (filtros.responsables.length > 0 ? 1 : 0) + (filtros.estado !== "todos" ? 1 : 0) + (filtros.titulo !== "todos" ? 1 : 0) + (filtros.q.trim() !== "" ? 1 : 0);

  /* ---------- enlaces profundos (campana, #/crm/...) ---------- */
  useEffect(() => {
    if (!deepLink || crm.phase !== "ready") return;
    if (deepLink.tipo === "semana") {
      const mon = mondayOf(deepLink.fecha);
      setModo("semana"); setCursor(mon); setWeekOpen({ monday: mon });
    } else if (deepLink.tipo === "comentario") {
      const cm = crm.comentarios.find((x) => x.id === deepLink.id);
      if (cm) { setModo("semana"); setCursor(cm.semana); setWeekOpen({ monday: cm.semana, focusId: cm.id }); }
      else showToast("No encontré ese comentario. Puede que no exista o que no tengas acceso.");
    }
    clearDeepLink();
  }, [deepLink, crm.phase]); // eslint-disable-line react-hooks/exhaustive-deps -- se procesa una vez por enlace

  /* ---------- carga y errores ---------- */
  if (crm.phase === "loading") return <p className={`text-xs py-10 text-center ${c.textFaint}`} role="status">Cargando Programación CRM…</p>;
  if (crm.phase === "error") {
    return (
      <div className={`max-w-md mx-auto mt-10 rounded-lg border p-4 text-xs ${c.panel} ${c.panelBorder} ${c.textDim}`} role="alert">
        <p className="font-semibold text-red-500 mb-1">No se pudo cargar Programación CRM</p>
        <p className="mb-3">{crm.loadError || "Error desconocido."}</p>
        <button type="button" onClick={crm.refresh} className={btnPrimary}>Reintentar</button>
      </div>
    );
  }

  const titulos = crm.lista("titulo");
  const estados = crm.lista("estado");
  const respOpts = [...crm.responsables.filter((r) => r.activo).map((r) => ({ id: r.id, label: `${r.nombre} (${r.iniciales})`, node: <span className="flex items-center gap-1.5"><RespDot resp={r} />{r.nombre}</span> })), { id: "sin", label: "Sin responsable" }];
  const periodoLabel = modo === "mes" ? fmtMonth(y, m) : fmtWeek(monday);
  const ultimaClima = crm.ultimaEjecucion;
  const diasConClima = diasPeriodo.filter((iso) => climaDe(iso)).length;

  return (
    <div className="space-y-3 max-w-[1500px] mx-auto">
      {/* Encabezado y navegación */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={`text-base font-semibold mr-1 ${dark ? "text-white" : "text-slate-900"}`}>Programación CRM</h2>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={modo === "mes" ? "Mes anterior" : "Semana anterior"} onClick={() => go(-1)} className={`p-1.5 rounded-md border ${c.panelBorder} ${c.textDim} ${c.rowHover}`}><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => setCursor(hoy)} className={btnOutline(c)}>Hoy</button>
          <button type="button" aria-label={modo === "mes" ? "Mes siguiente" : "Semana siguiente"} onClick={() => go(1)} className={`p-1.5 rounded-md border ${c.panelBorder} ${c.textDim} ${c.rowHover}`}><ChevronRight className="w-4 h-4" /></button>
        </div>
        <h3 className={`text-sm font-semibold ${c.text}`} aria-live="polite">{periodoLabel}</h3>
        <div role="group" aria-label="Vista" className={`flex rounded-md border overflow-hidden ${c.panelBorder}`}>
          {[["mes", "Mes"], ["semana", "Semana"]].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={modo === id} onClick={() => setModo(id)} className={`px-3 py-1.5 text-xs font-medium ${modo === id ? "bg-blue-600 text-white" : `${c.panel} ${c.textDim}`}`}>{label}</button>
          ))}
        </div>
        <span className={`ml-auto text-xs flex items-center gap-1.5 ${c.textFaint}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${crm.live ? "bg-emerald-500" : "bg-slate-400"}`} />{crm.live ? "En vivo" : "Sin conexión en vivo (se actualiza cada 2 min)"}{crm.saving ? " · guardando…" : ""}
        </span>
      </div>

      {/* Filtros y acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFiltrosOpen((v) => !v)} aria-expanded={filtrosOpen} aria-controls="crm-filtros" className={`md:hidden ${btnOutline(c)} flex items-center gap-1`}>
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />Filtros y capas{nFiltros > 0 ? ` (${nFiltros})` : ""}
        </button>
        <div id="crm-filtros" className={`${filtrosOpen ? "contents" : "hidden"} md:contents`}>
        <Filter className={`hidden md:block w-3.5 h-3.5 ${c.textFaint}`} aria-hidden="true" />
        <MultiSelect c={c} label="Responsable" options={respOpts} value={filtros.responsables} onChange={(v) => setFiltros({ ...filtros, responsables: v })} />
        <select aria-label="Filtrar por estado" className={`${inputCls(c, "w-auto")}`} value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
          <option value="todos">Todos los estados</option>{estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select aria-label="Filtrar por mailing" className={`${inputCls(c, "w-auto max-w-[12rem]")}`} value={filtros.titulo} onChange={(e) => setFiltros({ ...filtros, titulo: e.target.value })}>
          <option value="todos">Todos los mailings</option>{titulos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select aria-label="Región (clima y feriados regionales)" className={`${inputCls(c, "w-auto max-w-[14rem]")}`} value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="todas">Todas las regiones</option>{crm.regiones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <div className="relative">
          <Search className={`w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 ${c.textFaint}`} aria-hidden="true" />
          <input aria-label="Buscar en mailings" className={`${inputCls(c, "pl-7 w-44")}`} placeholder="Buscar…" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} />
        </div>
        {hayFiltros && <button type="button" onClick={() => setFiltros(FILTROS_VACIOS)} className="text-xs text-blue-500">Limpiar filtros</button>}
        </div>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setLegendOpen((v) => !v)} aria-expanded={legendOpen} className={`${btnOutline(c)} flex items-center gap-1`}><HelpCircle className="w-3.5 h-3.5" />Leyenda</button>
          <button type="button" onClick={() => setIoOpen(true)} className={`${btnOutline(c)} flex items-center gap-1`}><Download className="w-3.5 h-3.5" />Importar / exportar</button>
          <button type="button" onClick={() => setSettingsTab("catalogos")} className={`${btnOutline(c)} flex items-center gap-1`}><Settings className="w-3.5 h-3.5" />Configuración</button>
          <button type="button" onClick={() => setMailing({ fecha: cursor >= desde && cursor <= hasta ? cursor : desde })} className={`${btnPrimary} flex items-center gap-1`}><Plus className="w-3.5 h-3.5" />Nuevo mailing</button>
        </span>
      </div>

      {/* Capas */}
      <div className={`${filtrosOpen ? "flex" : "hidden"} md:flex flex-wrap items-center gap-1.5`} role="group" aria-label="Capas del calendario">
        <span className={`text-xs ${c.textFaint}`}>Capas:</span>
        {CAPAS.map((l) => {
          const Icon = l.icon;
          return (
            <button key={l.id} type="button" aria-pressed={layers[l.id]} onClick={() => toggleLayer(l.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${layers[l.id] ? "bg-blue-600/10 border-blue-500 text-blue-500" : `${c.panelBorder} ${c.textFaint}`}`}>
              <Icon className="w-3 h-3" />{l.label}
            </button>
          );
        })}
        <span className={`text-xs ml-2 ${c.textFaint}`}>Región: <b className={c.textDim}>{regionLabel}</b></span>
      </div>

      {/* Indicadores */}
      <div className={`rounded-lg border px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1 ${c.panel} ${c.panelBorder}`}>
        <span className={c.textFaint}>{modo === "mes" ? "Mes" : "Semana"}{hayFiltros ? " (con filtros)" : ""}:</span>
        <span className={c.textDim}>Planificados <b className={c.text}>{kpi.planificados}</b></span>
        <span className={c.textDim}>Enviados <b className="text-emerald-500">{kpi.enviados}</b>{kpi.cumplimiento !== null ? ` (${kpi.cumplimiento} %)` : ""}</span>
        <span className={c.textDim}>Pendientes <b className="text-amber-500">{kpi.pendientes}</b></span>
        {kpi.cancelados > 0 && <span className={c.textDim}>Cancelados <b className={c.text}>{kpi.cancelados}</b></span>}
        {kpi.vencidosPendientes > 0 && <span className="text-red-500" title="Mailings con fecha pasada que siguen Pendientes: ¿se enviaron y falta marcarlos?">Pasados sin marcar enviado <b>{kpi.vencidosPendientes}</b></span>}
        <span className={c.textDim} title="Días con más de un mailing">Días con varios <b className={c.text}>{kpi.diasConVarios}</b></span>
        <span className={c.textDim}>En alta oportunidad <b className={c.text}>{kpi.enAlta}</b></span>
        {(kpi.enFeriado > 0 || kpi.enFinDeSemana > 0) && <span className="text-amber-500">En feriado o fin de semana <b>{kpi.enFeriado + kpi.enFinDeSemana}</b></span>}
        {altasSinMailing.length > 0 && <span className="text-amber-500" title={altasSinMailing.map(fmtDM).join(", ")}>Días de alta oportunidad sin mailing <b>{altasSinMailing.length}</b></span>}
        {layers.clima && lluviaAlta.length > 0 && <span className={c.textDim} title={lluviaAlta.map(fmtDM).join(", ")}>Días con lluvia ≥ {crm.settings.sugerencia.umbral} % <b className={c.text}>{lluviaAlta.length}</b></span>}
      </div>

      {carga.length > 0 && (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${c.textDim}`}>
          <span className={c.textFaint}>Carga por responsable:</span>
          {carga.map((r) => (
            <button key={r.responsable?.id || "sin"} type="button" onClick={() => setFiltros({ ...filtros, responsables: [r.responsable?.id || "sin"] })} title={`${r.total} planificados, ${r.enviados} enviados. Clic para filtrar.`} className="flex items-center gap-1">
              <RespDot resp={r.responsable} /><b className={c.text}>{r.total}</b><span className={c.textFaint}>({r.enviados} env.)</span>
            </button>
          ))}
        </div>
      )}

      {layers.clima && (
        <p className={`text-xs ${c.textFaint}`}>
          {crm.clima.length === 0 ? "Clima: aún no hay pronóstico cargado, por eso no se muestran probabilidades de lluvia." : diasConClima === 0 ? `Clima: no hay pronóstico para ${regionLabel} en este período (la fuente solo entrega unos pocos días hacia adelante).` : `Clima: ${diasConClima} día(s) con pronóstico en este período para ${regionLabel}.`}
          {ultimaClima ? ` Última ejecución automática: ${new Date(ultimaClima.fin || ultimaClima.inicio).toLocaleString("es-CL")}, ${ESTADO_EJEC[ultimaClima.estado] || ultimaClima.estado}${ultimaClima.estado === "error" || ultimaClima.estado === "parcial" ? " (detalle en Configuración → Clima)" : ""}.` : " Todavía no se ha ejecutado ninguna actualización automática."}
          {crm.clima.length > 0 && ` ${creditoClima(crm.clima.map((r) => r.fuente))}`}
        </p>
      )}

      {legendOpen && <Legend crm={crm} ctx={ctx} />}

      {/* Calendario */}
      {modo === "mes" ? (
        <>
          <div className="hidden md:block"><MonthGrid year={y} month={m} ctx={ctx} /></div>
          <div className="md:hidden"><Agenda days={diasPeriodo} ctx={ctx} /></div>
        </>
      ) : (
        <>
          <div className="hidden lg:block"><WeekGrid monday={monday} ctx={ctx} /></div>
          <div className="lg:hidden"><Agenda days={diasPeriodo} ctx={ctx} /></div>
        </>
      )}

      {crm.mailings.length === 0 && (
        <p className={`text-xs text-center py-2 ${c.textFaint}`}>Todavía no hay mailings programados. Usa “Nuevo mailing” o importa un CSV para empezar.</p>
      )}

      {/* Paneles y ventanas */}
      {dayOpen && !mailing && !weekOpen && (
        <DayPanel crm={crm} ctx={ctx} fecha={dayOpen} onClose={() => setDayOpen(null)} onOpenMailing={(id) => { setMailing({ id }); }} onNewMailing={ctx.onNewMailing} onOpenWeek={ctx.onOpenWeek} />
      )}
      {mailing && (
        <MailingModal key={mailing.id || `nuevo-${mailing.fecha}`} crm={crm} ctx={ctx} mailingId={mailing.id} defaultFecha={mailing.fecha} me={me} nameOf={nameOf}
          onClose={() => setMailing(null)} onDone={(msg) => { setMailing(null); if (msg) showToast(msg, "ok"); }} />
      )}
      {weekOpen && (
        <WeekComments crm={crm} ctx={ctx} monday={weekOpen.monday} focusId={weekOpen.focusId} me={me} nameOf={nameOf} showToast={showToast}
          onChangeWeek={(mon) => setWeekOpen({ monday: mon })} onClose={() => setWeekOpen(null)} />
      )}
      {settingsTab && <SettingsModal crm={crm} ctx={ctx} users={users} initialTab={settingsTab} onClose={() => setSettingsTab(null)} />}
      {ioOpen && <ImportExportModal crm={crm} ctx={ctx} cursor={cursor} onClose={() => setIoOpen(false)} showToast={showToast} />}
    </div>
  );
}
