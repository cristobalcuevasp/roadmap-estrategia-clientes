import { Check, Ban, AlertTriangle, CloudRain, Flag, CircleDollarSign, MessageSquare } from "lucide-react";
import { stripeCls } from "./crmUi";
import { BANDAS, bandIndex, horizonKind, HORIZON_LABEL } from "../../lib/crm/weather";
import { explain, NIVEL_LABEL } from "../../lib/crm/opportunity";
import { semanticaDe } from "../../lib/crm/analysis";

/** Chip de un mailing dentro del calendario. Se puede arrastrar a otro día (con mouse). */
export function MailingChip({ m, ctx, wide = false }) {
  const { catById, respById, conflicts, dark, onOpenMailing, dragId, setDragId } = ctx;
  const estado = catById.get(m.estado_id);
  const sem = semanticaDe(m, catById);
  const titulo = catById.get(m.titulo_id)?.nombre || "(sin título)";
  const resp = m.responsable_id ? respById.get(m.responsable_id) : null;
  const conf = conflicts.get(m.id);
  const base = dark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-white hover:bg-slate-50 text-slate-800 shadow-sm";
  const tone = sem === "cancelado" ? "opacity-60" : "";
  const label = `${titulo}, ${estado?.nombre || "sin estado"}${resp ? `, responsable ${resp.nombre}` : ", sin responsable"}${m.hora ? `, ${m.hora.slice(0, 5)}` : ""}${conf ? ", posible conflicto" : ""}`;
  return (
    <button type="button" draggable
      aria-label={label}
      title={`${titulo}\n${estado?.nombre || "Sin estado"}${resp ? ` · ${resp.nombre}` : ""}${m.segmento ? `\nSegmento: ${m.segmento}` : ""}${conf ? `\n⚠ ${conf.map((x) => x.texto).join("\n⚠ ")}` : ""}`}
      onClick={(e) => { e.stopPropagation(); onOpenMailing(m.id); }}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", m.id); e.dataTransfer.effectAllowed = "move"; setTimeout(() => setDragId(m.id), 0); /* diferido: cambiar el DOM dentro de dragstart cancela el arrastre en Chrome */ }}
      onDragEnd={() => setDragId(null)}
      className={`w-full text-left flex items-center gap-1 rounded border-l-[3px] pl-1 pr-1 py-0.5 text-xs cursor-grab active:cursor-grabbing ${stripeCls(estado?.color)} ${base} ${tone} ${dragId === m.id ? "opacity-40" : ""}`}>
      <span className={`shrink-0 font-semibold ${dark ? "text-slate-400" : "text-slate-500"}`}>{resp ? resp.iniciales : "?"}</span>
      <span className={`truncate flex-1 ${sem === "cancelado" ? "line-through" : ""}`}>{wide && m.hora ? `${m.hora.slice(0, 5)} · ` : ""}{titulo}</span>
      {sem === "enviado" && <Check className="w-3 h-3 shrink-0 text-emerald-500" aria-hidden="true" />}
      {sem === "cancelado" && <Ban className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />}
      {conf && <AlertTriangle className="w-3 h-3 shrink-0 text-amber-500" aria-hidden="true" />}
    </button>
  );
}

/** Marca de día de pago (solo si hay alta o media). El texto de la regla va en el tooltip y en el panel del día. */
export function PayMark({ info, dark, showLabel = false }) {
  if (!info || info.nivel === "normal") return null;
  const alta = info.nivel === "alta";
  const cls = alta ? (dark ? "text-emerald-400 bg-emerald-500/[.15]" : "text-emerald-700 bg-emerald-500/[.15]") : (dark ? "text-amber-400 bg-amber-500/[.15]" : "text-amber-700 bg-amber-500/[.15]");
  return (
    <span title={explain(info)} aria-label={`${NIVEL_LABEL[info.nivel]} por día de pago`} className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] leading-none font-semibold ${cls}`}>
      <CircleDollarSign className="w-3 h-3" aria-hidden="true" />{alta ? "Alta" : "Media"}{showLabel && info.manual ? " (manual)" : ""}
    </span>
  );
}

export function HolidayLine({ list, dark }) {
  if (!list || list.length === 0) return null;
  return (
    <div className="space-y-px">
      {list.map((f) => (
        <p key={f.id} title={`${f.nombre}${f.ambito === "regional" ? ` (regional${f.alcance ? `: ${f.alcance}` : ""})` : " (nacional)"}${f.verificado ? "" : " · por confirmar"}`}
          className={`flex items-center gap-1 text-[10px] leading-tight truncate ${f.ambito === "regional" ? (dark ? "text-fuchsia-300" : "text-fuchsia-700") : (dark ? "text-rose-300" : "text-rose-700")}`}>
          <Flag className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /><span className="truncate">{f.nombre}{f.verificado ? "" : " (por confirmar)"}</span>
        </p>
      ))}
    </div>
  );
}

/** Probabilidad de lluvia regional del día, con su escala roja. `clima` = resultado de regionDay (o null). */
export function WeatherTag({ clima, ctx, fecha }) {
  if (!clima) return null;
  const { cortes, hoy, diasPronostico, dark } = ctx;
  const b = BANDAS[bandIndex(clima.prob, cortes)];
  const kind = horizonKind(fecha, hoy, diasPronostico);
  const cob = clima.parcial ? ` · cobertura parcial: ${clima.comunasConDato} de ${clima.comunasTotal} comunas (${clima.tiendasConDato} de ${clima.tiendasTotal} tiendas)` : "";
  return (
    <span title={`${HORIZON_LABEL[kind]}: ${clima.prob} % de probabilidad de lluvia (${b.label.toLowerCase()})${cob}`}
      className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] leading-none font-semibold ${b.chip[dark ? 1 : 0]} ${kind === "tendencia" ? "border border-dashed border-current" : ""}`}>
      <CloudRain className="w-3 h-3" aria-hidden="true" />{clima.prob}%{clima.parcial ? "*" : ""}
    </span>
  );
}

export function CommentMark({ count, pendientes, onClick, dark }) {
  if (!count) return null;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} title={`${count} comentario(s) esta semana${pendientes ? `, ${pendientes} sin resolver` : ""}`}
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold rounded px-1 py-px ${pendientes ? (dark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700") : (dark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600")}`}>
      <MessageSquare className="w-3 h-3" aria-hidden="true" />{count}
    </button>
  );
}

