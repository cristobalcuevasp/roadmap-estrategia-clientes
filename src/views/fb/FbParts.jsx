import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bold, Eye, Heading2, Inbox, Italic, List, ListOrdered, Maximize2, Minimize2, Pencil, RefreshCw } from "lucide-react";
import { COLOR_CLASS } from "../../lib/team";
import { badgeCls, swatchCls, CenterModal, btnPrimary, btnGhost, inputCls } from "../crm/crmUi";
import { parseBlocks, parseInline, applyFormat } from "../../lib/fb/richtext";
import { estadoCompromisoMeta, prioridadMeta } from "../../lib/fb/constants";
import { iniciales } from "../../lib/fb/logic";

export function PersonaAvatar({ persona, size = "md", title }) {
  const dims = size === "lg" ? "w-12 h-12 text-base" : size === "sm" ? "w-6 h-6 text-[10px]" : "w-9 h-9 text-xs";
  return <span title={title || persona?.nombre} className={`${dims} rounded-full ${COLOR_CLASS[persona?.color] || COLOR_CLASS.slate} text-white flex items-center justify-center font-semibold shrink-0`}>{iniciales(persona?.nombre)}</span>;
}

export function Chip({ color = "slate", dark, children, title }) {
  return <span title={title} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${badgeCls(color, dark)}`}>{children}</span>;
}
export const EstadoCompromiso = ({ estado, dark }) => { const m = estadoCompromisoMeta(estado); return <Chip color={m.color} dark={dark}>{m.label}</Chip>; };
export const PrioridadChip = ({ prioridad, dark }) => { const m = prioridadMeta(prioridad); return <Chip color={m.color} dark={dark} title="Prioridad">{m.label}</Chip>; };

export function Bar({ value, color = "blue", c, label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={`w-full h-1.5 rounded-full overflow-hidden ${c.dark ? "bg-slate-700" : "bg-slate-200"}`}>
      <div className={`h-full rounded-full ${swatchCls(color)}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Card({ title, right, children, c, className = "", pad = true }) {
  return (
    <section className={`rounded-lg border ${c.panel} ${c.panelBorder} ${className}`}>
      {(title || right) && (
        <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${c.panelBorder}`}>
          <h3 className={`text-xs font-semibold uppercase tracking-wide ${c.textDim}`}>{title}</h3>
          {right}
        </div>
      )}
      <div className={pad ? "p-3" : ""}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, tone, onClick, c, hint }) {
  const toneCls = tone === "bad" ? "text-red-500" : tone === "warn" ? "text-amber-500" : tone === "good" ? "text-emerald-500" : c.dark ? "text-slate-100" : "text-slate-800";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} title={hint} className={`text-left rounded-lg border p-3 ${c.panel} ${c.panelBorder} ${onClick ? c.rowHover : ""}`}>
      <p className={`text-xs ${c.textDim}`}>{label}</p>
      <p className={`text-2xl font-semibold mt-0.5 ${toneCls}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${c.textFaint}`}>{sub}</p>}
    </Tag>
  );
}

export function Empty({ icon: Icon = Inbox, title, text, action, c }) {
  return (
    <div className={`flex flex-col items-center text-center py-8 px-4 ${c.textDim}`}>
      <Icon className="w-8 h-8 mb-2 opacity-60" />
      <p className={`text-sm font-medium ${c.text}`}>{title}</p>
      {text && <p className="text-xs mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ c, text = "Cargando…" }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2 py-16 text-xs ${c.textDim}`}>
      <RefreshCw className="w-4 h-4 animate-spin" />{text}
    </div>
  );
}

export function ErrorBlock({ message, onRetry, c }) {
  return (
    <div role="alert" className={`max-w-md mx-auto mt-12 rounded-lg border p-4 text-center ${c.panel} ${c.panelBorder}`}>
      <AlertTriangle className="w-6 h-6 mx-auto text-amber-500 mb-2" />
      <p className={`text-sm font-medium ${c.text}`}>No se pudo cargar Feedback & Desarrollo</p>
      <p className={`text-xs mt-1 ${c.textDim}`}>{message || "Error inesperado."}</p>
      {onRetry && <button onClick={onRetry} className={`${btnPrimary} mt-3`}>Reintentar</button>}
    </div>
  );
}

/** Confirmación para operaciones importantes */
export function Confirm({ title, children, confirmLabel = "Confirmar", cancelLabel = "Cancelar", onConfirm, onCancel, busy, danger, c }) {
  return (
    <CenterModal title={title} onClose={onCancel} width="max-w-md" c={c}
      footer={<div className="flex justify-end gap-2"><button onClick={onCancel} className={btnGhost(c)}>{cancelLabel}</button>
        <button onClick={onConfirm} disabled={busy} className={danger ? "px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50" : btnPrimary}>{busy ? "Procesando…" : confirmLabel}</button></div>}>
      <div className={`text-xs space-y-2 ${c.text}`}>{children}</div>
    </CenterModal>
  );
}

export function Tabs({ tabs, value, onChange, c }) {
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto border-b ${c.panelBorder}`}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${value === t.id ? "border-blue-500 text-blue-500" : `border-transparent ${c.textDim} hover:${c.dark ? "text-slate-200" : "text-slate-700"}`}`}>
          {t.label}{t.badge ? <span className={`ml-1.5 text-[10px] px-1.5 rounded-full ${c.dark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ texto enriquecido ------------------------------ */

function Inline({ text }) {
  return parseInline(text).map((n, i) => (n.t === "b" ? <strong key={i}>{n.v}</strong> : n.t === "i" ? <em key={i}>{n.v}</em> : <span key={i}>{n.v}</span>));
}

/** Muestra texto enriquecido armando elementos de React (nunca interpreta HTML). */
export function Rich({ text, empty = "—", c }) {
  const blocks = parseBlocks(text);
  if (!blocks.length) return <p className={`text-xs ${c?.textFaint || ""}`}>{empty}</p>;
  return (
    <div className="text-xs leading-relaxed space-y-1.5 break-words">
      {blocks.map((b, i) => {
        if (b.type === "ul") return <ul key={i} className="list-disc pl-5 space-y-0.5">{b.items.map((x, j) => <li key={j}><Inline text={x} /></li>)}</ul>;
        if (b.type === "ol") return <ol key={i} className="list-decimal pl-5 space-y-0.5">{b.items.map((x, j) => <li key={j}><Inline text={x} /></li>)}</ol>;
        if (b.type === "h") return <h4 key={i} className="text-xs font-semibold mt-2"><Inline text={b.text} /></h4>;
        return <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Inline text={l} /></span>)}</p>;
      })}
    </div>
  );
}

/** Editor de texto enriquecido con negrita, cursiva, listas, subtítulo, campo expandible y vista previa. */
export function RichEditor({ id, value, onChange, rows = 4, placeholder, c, disabled, ariaLabel }) {
  const ref = useRef(null);
  const [big, setBig] = useState(false);
  const [preview, setPreview] = useState(false);
  const pending = useRef(null);
  useEffect(() => {
    if (pending.current && ref.current) {
      const { start, end } = pending.current;
      pending.current = null;
      ref.current.focus();
      ref.current.setSelectionRange(start, end);
    }
  }, [value]);
  const fmt = (kind) => {
    const el = ref.current;
    if (!el || disabled) return;
    const r = applyFormat(value || "", el.selectionStart, el.selectionEnd, kind);
    pending.current = { start: r.start, end: r.end };
    onChange(r.value);
  };
  const Btn = ({ kind, icon: Icon, label }) => (
    <button type="button" onClick={() => fmt(kind)} disabled={disabled || preview} title={label} aria-label={label} className={`p-1 rounded ${c.textDim} ${c.dark ? "hover:bg-slate-700" : "hover:bg-slate-200"} disabled:opacity-40`}><Icon className="w-3.5 h-3.5" /></button>
  );
  return (
    <div className={`border rounded-md ${c.dark ? "border-slate-700" : "border-slate-300"}`}>
      <div className={`flex items-center gap-0.5 px-1.5 py-1 border-b ${c.dark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
        <Btn kind="bold" icon={Bold} label="Negrita" /><Btn kind="italic" icon={Italic} label="Cursiva" />
        <Btn kind="h" icon={Heading2} label="Subtítulo" /><Btn kind="ul" icon={List} label="Lista con viñetas" /><Btn kind="ol" icon={ListOrdered} label="Lista numerada" />
        <span className="flex-1" />
        <button type="button" onClick={() => setPreview((p) => !p)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${c.textDim} ${c.dark ? "hover:bg-slate-700" : "hover:bg-slate-200"}`}>
          {preview ? <><Pencil className="w-3 h-3" />Editar</> : <><Eye className="w-3 h-3" />Vista previa</>}
        </button>
        <button type="button" onClick={() => setBig((b) => !b)} title={big ? "Contraer" : "Expandir"} aria-label={big ? "Contraer campo" : "Expandir campo"} className={`p-1 rounded ${c.textDim} ${c.dark ? "hover:bg-slate-700" : "hover:bg-slate-200"}`}>{big ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</button>
      </div>
      {preview ? (
        <div className={`p-2.5 ${c.text}`} style={{ minHeight: `${rows * 1.4}rem` }}><Rich text={value} empty="Nada que mostrar todavía." c={c} /></div>
      ) : (
        <textarea id={id} ref={ref} value={value || ""} onChange={(e) => onChange(e.target.value)} rows={big ? rows * 3 : rows} placeholder={placeholder} disabled={disabled} aria-label={ariaLabel}
          className={`w-full px-2.5 py-2 text-xs outline-none resize-y bg-transparent ${c.text} ${c.dark ? "placeholder-slate-500" : "placeholder-slate-400"}`} />
      )}
    </div>
  );
}

/* ---------------------------------- gráficos ---------------------------------- */

/** Columnas verticales (una o varias series). series: [{ nombre, color, valores: [] }], etiquetas: [] */
export function ColumnChart({ etiquetas, series, c, alto = 120, titulo }) {
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  return (
    <div role="img" aria-label={titulo}>
      <div className="flex items-end gap-2" style={{ height: alto }}>
        {etiquetas.map((e, i) => (
          <div key={e + i} className="flex-1 flex items-end justify-center gap-1 h-full min-w-0">
            {series.map((s) => (
              <div key={s.nombre} title={`${s.nombre}: ${s.valores[i]}`} className="flex-1 max-w-[28px] flex flex-col justify-end items-center h-full">
                <span className={`text-[10px] mb-0.5 ${c.textDim}`}>{s.valores[i] || ""}</span>
                <div className={`w-full rounded-t ${swatchCls(s.color)}`} style={{ height: `${(s.valores[i] / max) * 100}%`, minHeight: s.valores[i] ? 3 : 0 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1">{etiquetas.map((e, i) => <span key={e + i} className={`flex-1 text-center text-[10px] truncate ${c.textFaint}`}>{e}</span>)}</div>
      {series.length > 1 && <div className="flex gap-3 mt-1.5 justify-center">{series.map((s) => <span key={s.nombre} className={`flex items-center gap-1 text-[10px] ${c.textDim}`}><span className={`w-2 h-2 rounded-sm ${swatchCls(s.color)}`} />{s.nombre}</span>)}</div>}
    </div>
  );
}

/** Barras horizontales: items [{ label, valor, color, sub }] */
export function HBars({ items, c, total, titulo }) {
  const max = total || Math.max(1, ...items.map((i) => i.valor));
  return (
    <ul role="img" aria-label={titulo} className="space-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-xs">
          <span className={`w-28 shrink-0 truncate ${c.textDim}`} title={i.label}>{i.label}</span>
          <div className={`flex-1 h-2 rounded-full overflow-hidden ${c.dark ? "bg-slate-700" : "bg-slate-200"}`}><div className={`h-full rounded-full ${swatchCls(i.color)}`} style={{ width: `${(i.valor / max) * 100}%` }} /></div>
          <span className={`w-10 text-right font-mono ${c.text}`}>{i.texto ?? i.valor}</span>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- formularios --------------------------------- */

export function PersonaSelect({ personas, value, onChange, c, placeholder = "Elige una persona", disabled, id }) {
  return (
    <select id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls(c)}>
      <option value="">{placeholder}</option>
      {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.estado !== "activo" ? ` (${p.estado})` : ""}</option>)}
    </select>
  );
}

export const FieldError = ({ msg }) => (msg ? <p role="alert" className="text-xs text-red-500 mt-1">{msg}</p> : null);
