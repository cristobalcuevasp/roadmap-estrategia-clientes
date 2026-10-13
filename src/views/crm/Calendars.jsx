import { useState } from "react";
import { Plus } from "lucide-react";
import { DIAS_CORTOS, DIAS_LARGOS, monthGrid, weekDays, isoWeek, parts, weekdayIdx, fmtLong, fmtDM, isoOf, daysInMonth } from "../../lib/crm/calendar";
import { BANDAS, bandIndex } from "../../lib/crm/weather";
import { MailingChip, PayMark, HolidayLine, WeatherTag, CommentMark } from "./CalendarParts";

const MAX_CHIPS = 3;

function useDrop(ctx, iso) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e) => { if (Array.from(e.dataTransfer.types || []).includes("text/plain")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); } },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        e.preventDefault(); setOver(false);
        const id = e.dataTransfer.getData("text/plain") || ctx.dragId;
        ctx.setDragId(null);
        if (id) ctx.onDropMailing(id, iso);
      },
    },
  };
}

function dayAria(iso, ctx, list, clima, pago, feriados) {
  const bits = [fmtLong(iso)];
  if (ctx.layers.mailings) bits.push(list.length ? `${list.length} mailing(s)` : "sin mailings");
  if (ctx.layers.feriados && feriados?.length) bits.push(`feriado: ${feriados.map((f) => f.nombre).join(", ")}`);
  if (ctx.layers.pago && pago && pago.nivel !== "normal") bits.push(`día de pago, oportunidad ${pago.nivel}`);
  if (ctx.layers.clima && clima) bits.push(`probabilidad de lluvia ${clima.prob} por ciento`);
  return bits.join(", ");
}

function DayCell({ iso, ctx, inMonth = true, tall = false }) {
  const { dark, hoy, layers, byDate } = ctx;
  const drop = useDrop(ctx, iso);
  const list = layers.mailings ? byDate.get(iso) || [] : [];
  const feriados = layers.feriados ? ctx.feriadosPorFecha.get(iso) : null;
  const pago = layers.pago ? ctx.oportunidad(iso) : null;
  const clima = layers.clima ? ctx.climaDe(iso) : null;
  const band = clima ? BANDAS[bandIndex(clima.prob, ctx.cortes)] : null;
  const weekend = weekdayIdx(iso) >= 5;
  const isToday = iso === hoy;
  const shown = tall ? list : list.slice(0, MAX_CHIPS);
  const extra = list.length - shown.length;
  const bg = band && band.tint ? band.tint : weekend ? (dark ? "bg-slate-900/60" : "bg-slate-50") : "";
  const { d } = parts(iso);

  return (
    <div role="gridcell" tabIndex={0} aria-label={dayAria(iso, ctx, list, clima, pago, feriados)}
      onClick={() => ctx.onOpenDay(iso)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ctx.onOpenDay(iso); } }}
      {...drop.props}
      className={`group relative flex flex-col gap-0.5 p-1 border-t border-l ${ctx.c.border} ${bg} ${inMonth ? "" : "opacity-50"} ${tall ? "min-h-[16rem]" : "min-h-[6.75rem]"} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${drop.over ? "ring-2 ring-inset ring-blue-500" : ""}`}>
      <div className="flex items-start justify-between gap-1">
        <span className={`text-xs font-semibold leading-none ${isToday ? `bg-blue-600 text-white rounded-full h-5 flex items-center justify-center ${tall ? "px-1.5" : "w-5"}` : ctx.c.textDim}`}>{tall ? `${DIAS_CORTOS[weekdayIdx(iso)]} ${d}` : d}</span>
        <span className="flex flex-wrap justify-end gap-0.5">
          <PayMark info={pago} dark={dark} />
          <WeatherTag clima={clima} ctx={ctx} fecha={iso} />
        </span>
      </div>
      <HolidayLine list={feriados} dark={dark} />
      <div className="flex flex-col gap-0.5 min-w-0">
        {shown.map((m) => <MailingChip key={m.id} m={m} ctx={ctx} wide={tall} />)}
        {extra > 0 && <button type="button" onClick={(e) => { e.stopPropagation(); ctx.onOpenDay(iso); }} className="text-left text-[10px] font-medium text-blue-500 px-1">+{extra} más</button>}
      </div>
      <button type="button" aria-label={`Nuevo mailing el ${fmtLong(iso)}`} title="Nuevo mailing en este día"
        onClick={(e) => { e.stopPropagation(); ctx.onNewMailing(iso); }}
        className={`absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center bg-blue-600 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 ${tall ? "" : ""}`}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function WeekLabel({ monday, ctx }) {
  const cm = ctx.comentariosSemana(monday);
  return (
    <div className={`border-t ${ctx.c.border} flex flex-col items-center gap-1 pt-1.5`}>
      <button type="button" onClick={() => ctx.onOpenWeek(monday)} title={`Semana ${isoWeek(monday)}: abrir comentarios`} aria-label={`Comentarios de la semana ${isoWeek(monday)}`}
        className={`text-[10px] font-semibold rounded px-1 py-0.5 ${ctx.c.textFaint} ${ctx.c.rowHover}`}>S{isoWeek(monday)}</button>
      {ctx.layers.comentarios && <CommentMark count={cm.count} pendientes={cm.pendientes} onClick={() => ctx.onOpenWeek(monday)} dark={ctx.dark} />}
    </div>
  );
}

export function MonthGrid({ year, month, ctx }) {
  const weeks = monthGrid(year, month);
  return (
    <div role="grid" aria-label="Calendario mensual" className={`rounded-lg border overflow-hidden ${ctx.c.border} ${ctx.c.panel}`}>
      <div className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))]" role="row">
        <div className={`px-1 py-1.5 text-[10px] font-semibold uppercase ${ctx.c.textFaint}`} role="columnheader">Sem.</div>
        {DIAS_CORTOS.map((d, i) => <div key={d} role="columnheader" className={`px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${i >= 5 ? ctx.c.textFaint : ctx.c.textDim}`}>{d}</div>)}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))]" role="row">
          <WeekLabel monday={week[0]} ctx={ctx} />
          {week.map((iso) => <DayCell key={iso} iso={iso} ctx={ctx} inMonth={parts(iso).m === month} />)}
        </div>
      ))}
    </div>
  );
}

export function WeekGrid({ monday, ctx }) {
  const days = weekDays(monday);
  return (
    <div role="grid" aria-label="Calendario semanal" className={`rounded-lg border overflow-hidden ${ctx.c.border} ${ctx.c.panel}`}>
      <div className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))]" role="row">
        <WeekLabel monday={monday} ctx={ctx} />
        {days.map((iso) => <DayCell key={iso} iso={iso} ctx={ctx} tall />)}
      </div>
    </div>
  );
}

/** Vista de lista para pantallas angostas (teléfono): un bloque por día. */
export function Agenda({ days, ctx, month }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const rows = days.map((iso) => {
    const list = ctx.layers.mailings ? ctx.byDate.get(iso) || [] : [];
    const feriados = ctx.layers.feriados ? ctx.feriadosPorFecha.get(iso) : null;
    const pago = ctx.layers.pago ? ctx.oportunidad(iso) : null;
    const clima = ctx.layers.clima ? ctx.climaDe(iso) : null;
    const content = list.length > 0 || (feriados && feriados.length > 0) || iso === ctx.hoy;
    return { iso, list, feriados, pago, clima, content };
  });
  const visible = showEmpty ? rows : rows.filter((r) => r.content);
  return (
    <div className="space-y-1.5" aria-label="Agenda">
      {visible.length === 0 && <p className={`text-xs text-center py-6 ${ctx.c.textFaint}`}>No hay mailings ni feriados en este período con los filtros actuales.</p>}
      {visible.map(({ iso, list, feriados, pago, clima }) => {
        const band = clima ? BANDAS[bandIndex(clima.prob, ctx.cortes)] : null;
        const isToday = iso === ctx.hoy;
        return (
          <div key={iso} className={`rounded-lg border p-2 ${ctx.c.panel} ${ctx.c.border} ${band && band.tint ? band.tint : ""} ${isToday ? "ring-1 ring-blue-500" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => ctx.onOpenDay(iso)} className={`text-xs font-semibold text-left ${isToday ? "text-blue-500" : ctx.c.text}`}>
                {DIAS_LARGOS[weekdayIdx(iso)]} {fmtDM(iso)}{isToday ? " · hoy" : ""}
              </button>
              <span className="flex flex-wrap items-center gap-1">
                <PayMark info={pago} dark={ctx.dark} />
                <WeatherTag clima={clima} ctx={ctx} fecha={iso} />
                <button type="button" aria-label={`Nuevo mailing el ${fmtLong(iso)}`} onClick={() => ctx.onNewMailing(iso)} className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
              </span>
            </div>
            <HolidayLine list={feriados} dark={ctx.dark} />
            <div className="mt-1 space-y-1">{list.map((m) => <MailingChip key={m.id} m={m} ctx={ctx} wide />)}</div>
          </div>
        );
      })}
      <button type="button" onClick={() => setShowEmpty((v) => !v)} className="w-full text-xs text-blue-500 py-2">{showEmpty ? "Ocultar días sin actividad" : "Mostrar también los días sin actividad"}</button>
    </div>
  );
}

/** Todos los días ISO de un mes. */
export function daysOfMonth(year, month) {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => isoOf(year, month, i + 1));
}
