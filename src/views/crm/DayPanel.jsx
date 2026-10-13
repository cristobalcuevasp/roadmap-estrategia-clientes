import { useEffect, useMemo, useState } from "react";
import { Flag, CircleDollarSign, CloudRain, Plus, MessageSquare, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { fmtLong, mondayOf, fmtDMY, isoWeek } from "../../lib/crm/calendar";
import { communeDetail, BANDAS, bandIndex, bandRangeLabel, horizonKind, HORIZON_LABEL, rainSuggestion, creditoClima } from "../../lib/crm/weather";
import { NIVEL_LABEL } from "../../lib/crm/opportunity";
import { SidePanel, Field, inputCls, btnPrimary, btnGhost, EstadoBadge, RespDot } from "./crmUi";

function Section({ icon: Icon, title, children, c }) {
  return (
    <section>
      <h4 className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 mb-1.5 ${c.textDim}`}><Icon className="w-3.5 h-3.5" />{title}</h4>
      {children}
    </section>
  );
}

function ManualOverride({ crm, fecha, info, c, dark }) {
  const [nivel, setNivel] = useState(info?.manual?.nivel || "auto");
  const [motivo, setMotivo] = useState(info?.manual?.motivo || "");
  useEffect(() => { setNivel(info?.manual?.nivel || "auto"); setMotivo(info?.manual?.motivo || ""); }, [fecha, info?.manual?.nivel, info?.manual?.motivo]);
  const dirty = nivel !== (info?.manual?.nivel || "auto") || (nivel !== "auto" && motivo !== (info?.manual?.motivo || ""));
  return (
    <div className={`mt-2 rounded-md border p-2 space-y-1.5 ${c.panelBorder} ${dark ? "bg-slate-800/50" : "bg-slate-50"}`}>
      <p className={`text-xs font-medium ${c.textDim}`}>Ajuste manual de este día</p>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Nivel manual" className={inputCls(c)} value={nivel} onChange={(e) => setNivel(e.target.value)}>
          <option value="auto">Automático (según reglas)</option>
          <option value="alta">Forzar alta oportunidad</option>
          <option value="media">Forzar oportunidad media</option>
          <option value="normal">Forzar oportunidad normal</option>
        </select>
        <input aria-label="Motivo del ajuste" disabled={nivel === "auto"} className={inputCls(c)} placeholder="Motivo (ej: pago adelantado)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      {dirty && <div className="flex justify-end"><button type="button" onClick={() => crm.setManual(fecha, nivel === "auto" ? null : nivel, motivo)} className={btnPrimary}>Guardar ajuste</button></div>}
    </div>
  );
}

export function DayPanel({ crm, ctx, fecha, onClose, onOpenMailing, onNewMailing, onOpenWeek }) {
  const { c, dark } = ctx;
  const [verTodas, setVerTodas] = useState(false);
  const list = ctx.byDate.get(fecha) || [];
  const ocultos = (ctx.allByDate.get(fecha) || []).length - list.length;
  const feriados = ctx.feriadosPorFecha.get(fecha) || [];
  const pago = ctx.oportunidad(fecha);
  const clima = ctx.climaDe(fecha);
  const kind = horizonKind(fecha, ctx.hoy, ctx.diasPronostico);
  const detalle = useMemo(() => (clima ? communeDetail(crm.comunas, crm.climaIndex, ctx.region, fecha) : []), [clima, crm.comunas, crm.climaIndex, ctx.region, fecha]);
  const sug = clima ? rainSuggestion(clima, crm.settings.sugerencia) : null;
  const monday = mondayOf(fecha);
  const cm = ctx.comentariosSemana(monday);
  const estados = crm.lista("estado", { soloActivos: true });

  return (
    <SidePanel c={c} onClose={onClose} subtitle={`Semana ${isoWeek(fecha)}`} title={fmtLong(fecha)}
      footer={<div className="flex justify-between gap-2"><button type="button" onClick={() => onOpenWeek(monday)} className={`${btnGhost(c)} flex items-center gap-1`}><MessageSquare className="w-3.5 h-3.5" />Comentarios de la semana{cm.count ? ` (${cm.count})` : ""}</button><button type="button" onClick={() => onNewMailing(fecha)} className={`${btnPrimary} flex items-center gap-1`}><Plus className="w-3.5 h-3.5" />Nuevo mailing</button></div>}>
      <Section icon={Plus} title={`Mailings (${list.length})`} c={c}>
        {ocultos > 0 && <p className="text-xs text-amber-500 mb-1">{ocultos} mailing(s) de este día no se muestran por los filtros activos.</p>}
        {list.length === 0 ? <p className={`text-xs ${c.textFaint}`}>No hay mailings {ocultos > 0 ? "visibles" : "programados"} este día.</p> : (
          <ul className="space-y-1.5">
            {list.map((m) => {
              const conf = ctx.conflicts.get(m.id);
              return (
                <li key={m.id} className={`rounded-md border p-2 ${c.panelBorder} ${c.card}`}>
                  <div className="flex items-start gap-2">
                    <RespDot resp={m.responsable_id ? ctx.respById.get(m.responsable_id) : null} />
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => onOpenMailing(m.id)} className={`text-xs font-semibold text-left hover:underline ${c.text}`}>{m.hora ? `${m.hora.slice(0, 5)} · ` : ""}{ctx.catById.get(m.titulo_id)?.nombre || "(sin título)"}</button>
                      {m.segmento && <p className={`text-xs truncate ${c.textFaint}`}>{m.segmento}</p>}
                      {conf && <p className="text-xs text-amber-500 flex items-start gap-1 mt-0.5"><AlertTriangle className="w-3 h-3 shrink-0 mt-px" />{conf.map((x) => x.texto).join(" · ")}</p>}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <EstadoBadge estado={ctx.catById.get(m.estado_id)} dark={dark} />
                      <select aria-label="Cambiar estado" className={`text-xs border rounded px-1 py-0.5 ${c.input}`} value={m.estado_id} onChange={(e) => crm.setEstado(m.id, e.target.value)}>
                        {estados.concat(estados.some((s) => s.id === m.estado_id) ? [] : [ctx.catById.get(m.estado_id)].filter(Boolean)).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section icon={Flag} title="Feriados" c={c}>
        {feriados.length === 0 ? <p className={`text-xs ${c.textFaint}`}>No es feriado{ctx.region === "todas" ? "" : ` en ${ctx.regionLabel}`}.</p> : (
          <ul className="space-y-1">
            {feriados.map((f) => (
              <li key={f.id} className={`text-xs ${c.textDim}`}>
                <span className="font-medium">{f.nombre}</span> · {f.ambito === "nacional" ? "nacional" : `regional${f.alcance ? ` (${f.alcance})` : ""}`}{f.irrenunciable ? " · irrenunciable" : ""}
                <span className={f.verificado ? "text-emerald-500" : "text-amber-500"}> · {f.verificado ? "confirmado" : "por confirmar"}</span>
                {f.fuente && <span className={c.textFaint}> · fuente: {f.fuente}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={CircleDollarSign} title="Día de pago" c={c}>
        <p className={`text-xs font-medium ${pago.nivel === "alta" ? "text-emerald-500" : pago.nivel === "media" ? "text-amber-500" : c.textDim}`}>
          {NIVEL_LABEL[pago.nivel]}{pago.manual ? " (ajuste manual)" : ""}
        </p>
        {pago.manual && <p className={`text-xs ${c.textDim}`}>Motivo del ajuste: {pago.manual.motivo || "sin motivo escrito"}. Las reglas darían: {NIVEL_LABEL[pago.calculado]}.</p>}
        {pago.razones.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {pago.razones.map((r) => (
              <li key={r.reglaId} className={`text-xs ${c.textDim}`}>
                <span className="font-medium">{r.nombre}</span> ({NIVEL_LABEL[r.nivel].toLowerCase()}) · {r.detalle}
                {r.justificacion && <span className={`block ${c.textFaint}`}>Supuesto: {r.justificacion}</span>}
              </li>
            ))}
          </ul>
        ) : !pago.manual && <p className={`text-xs ${c.textFaint}`}>Ninguna regla de día de pago aplica a esta fecha.</p>}
        <p className={`text-xs mt-1 ${c.textFaint}`}>Las reglas son supuestos editables en Configuración, no resultados medidos.</p>
        <ManualOverride crm={crm} fecha={fecha} info={pago} c={c} dark={dark} />
      </Section>

      <Section icon={CloudRain} title={`Clima · ${ctx.regionLabel}`} c={c}>
        {!clima ? (
          <p className={`text-xs ${c.textFaint}`}>
            Sin pronóstico cargado para esta fecha{kind === "tendencia" ? " (está más allá del horizonte de la fuente)" : ""}.
            {crm.ultimaEjecucion ? ` Última ejecución automática: ${new Date(crm.ultimaEjecucion.fin || crm.ultimaEjecucion.inicio).toLocaleString("es-CL")}, ${{ ok: "completa", parcial: "parcial", error: "con error", en_curso: "en curso" }[crm.ultimaEjecucion.estado] || crm.ultimaEjecucion.estado}.` : " Todavía no se ha ejecutado ninguna actualización automática."}
          </p>
        ) : (
          <>
            <p className={`text-xs ${c.textDim}`}>
              <span className="font-semibold text-sm">{clima.prob} %</span> de probabilidad de lluvia · {BANDAS[bandIndex(clima.prob, ctx.cortes)].label.toLowerCase()} ({bandRangeLabel(bandIndex(clima.prob, ctx.cortes), ctx.cortes)})
            </p>
            <p className={`text-xs ${c.textFaint}`}>
              {HORIZON_LABEL[kind]}. Promedio ponderado por tiendas abiertas: {clima.comunasConDato} de {clima.comunasTotal} comunas con dato ({clima.tiendasConDato} de {clima.tiendasTotal} tiendas).
              {clima.fuente ? ` Fuente: ${clima.fuente}.` : ""} {clima.obtenidoEl ? `Obtenido el ${fmtDMY(clima.obtenidoEl)}.` : ""} {creditoClima([clima.fuente])}
            </p>
            {sug && (
              <div className={`mt-1.5 rounded-md border p-2 text-xs ${dark ? "bg-blue-500/10 border-blue-800 text-blue-200" : "bg-blue-50 border-blue-200 text-blue-900"}`}>
                <p className="font-semibold">{sug.texto}</p>
                <p>{sug.detalle}</p>
                <p className="italic">{sug.etiqueta}. El sistema no programa ni envía nada por el clima.</p>
              </div>
            )}
            <button type="button" onClick={() => setVerTodas((v) => !v)} className="mt-1.5 text-xs text-blue-500 flex items-center gap-1">{verTodas ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}Detalle por comuna</button>
            {verTodas && (
              <table className={`mt-1 w-full text-xs ${c.textDim}`}>
                <thead><tr className={`text-left ${c.textFaint}`}><th className="font-medium py-0.5">Comuna</th><th className="font-medium text-right">Tiendas</th><th className="font-medium text-right">Lluvia</th><th className="font-medium text-right">mm</th></tr></thead>
                <tbody>
                  {detalle.map((d) => (
                    <tr key={d.comuna.id} className={`border-t ${c.borderSubtle}`}>
                      <td className="py-0.5">{d.comuna.nombre}</td><td className="text-right">{d.comuna.tiendas_abiertas}</td>
                      <td className="text-right">{d.prob === null ? "sin dato" : `${d.prob} %`}</td><td className="text-right">{d.mm === null || d.mm === undefined ? "—" : d.mm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Section>
    </SidePanel>
  );
}
