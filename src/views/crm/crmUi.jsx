import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { COLOR_CLASS } from "../../lib/team";

/* Colores de los catálogos (estados, etc.). Clases completas para que Tailwind las incluya en el build. */
export const CAT_COLORS = ["slate", "amber", "emerald", "blue", "violet", "pink", "cyan", "orange", "red"];
const BADGE = {
  slate: ["bg-slate-200 text-slate-700", "bg-slate-700 text-slate-200"],
  amber: ["bg-amber-100 text-amber-800", "bg-amber-500/20 text-amber-300"],
  emerald: ["bg-emerald-100 text-emerald-800", "bg-emerald-500/20 text-emerald-300"],
  blue: ["bg-blue-100 text-blue-800", "bg-blue-500/20 text-blue-300"],
  violet: ["bg-violet-100 text-violet-800", "bg-violet-500/20 text-violet-300"],
  pink: ["bg-pink-100 text-pink-800", "bg-pink-500/20 text-pink-300"],
  cyan: ["bg-cyan-100 text-cyan-800", "bg-cyan-500/20 text-cyan-300"],
  orange: ["bg-orange-100 text-orange-800", "bg-orange-500/20 text-orange-300"],
  red: ["bg-red-100 text-red-800", "bg-red-500/20 text-red-300"],
};
const STRIPE = {
  slate: "border-l-slate-400", amber: "border-l-amber-500", emerald: "border-l-emerald-500", blue: "border-l-blue-500", violet: "border-l-violet-500",
  pink: "border-l-pink-500", cyan: "border-l-cyan-500", orange: "border-l-orange-500", red: "border-l-red-500",
};
const SWATCH = {
  slate: "bg-slate-400", amber: "bg-amber-500", emerald: "bg-emerald-500", blue: "bg-blue-500", violet: "bg-violet-500",
  pink: "bg-pink-500", cyan: "bg-cyan-500", orange: "bg-orange-500", red: "bg-red-500",
};
export const badgeCls = (color, dark) => (BADGE[color] || BADGE.slate)[dark ? 1 : 0];
export const stripeCls = (color) => STRIPE[color] || STRIPE.slate;
export const swatchCls = (color) => SWATCH[color] || SWATCH.slate;

export function EstadoBadge({ estado, dark }) {
  if (!estado) return <span className="text-xs text-slate-400">Sin estado</span>;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${badgeCls(estado.color, dark)}`}>{estado.nombre}</span>;
}

/** Círculo con iniciales del responsable (las iniciales vienen del catálogo editable). */
export function RespDot({ resp, size = "sm" }) {
  const dims = size === "md" ? "w-6 h-6 text-xs" : "w-5 h-5 text-[10px] leading-none";
  if (!resp) return <span title="Sin responsable" className={`${dims} rounded-full bg-slate-400/40 text-slate-500 flex items-center justify-center font-semibold shrink-0`}>?</span>;
  return <span title={resp.nombre} className={`${dims} rounded-full ${COLOR_CLASS[resp.color] || COLOR_CLASS.slate} text-white flex items-center justify-center font-semibold shrink-0`}>{resp.iniciales}</span>;
}

/** Panel lateral deslizante (misma estética que el panel de tareas). */
export function SidePanel({ title, subtitle, onClose, children, footer, width = "max-w-lg", c }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} h-full shadow-2xl overflow-y-auto flex flex-col ${c.panel}`}>
        <div className={`flex items-start justify-between px-4 py-3 border-b shrink-0 ${c.panelBorder}`}>
          <div className="min-w-0">
            {subtitle && <p className={`text-xs ${c.textFaint}`}>{subtitle}</p>}
            <h3 className={`text-sm font-semibold ${c.dark ? "text-slate-100" : "text-slate-800"}`}>{title}</h3>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className={`${c.textFaint} p-1 -m-1`}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 p-4 space-y-3">{children}</div>
        {footer && <div className={`p-3 border-t shrink-0 ${c.panelBorder} ${c.panel}`}>{footer}</div>}
      </div>
    </div>
  );
}

/** Ventana centrada. */
export function CenterModal({ title, onClose, children, footer, width = "max-w-2xl", c }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} max-h-[90vh] flex flex-col rounded-xl shadow-2xl border ${c.panel} ${c.panelBorder}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${c.panelBorder}`}>
          <h3 className={`text-sm font-semibold ${c.dark ? "text-slate-100" : "text-slate-800"}`}>{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" className={c.textFaint}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className={`p-3 border-t shrink-0 ${c.panelBorder}`}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, full, hint, c }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className={`block text-xs font-medium mb-1 ${c.textDim}`}>{label}</label>
      {children}
      {hint && <p className={`text-xs mt-1 ${c.textFaint}`}>{hint}</p>}
    </div>
  );
}

/* Campo de formulario. Por defecto ocupa todo el ancho; si `extra` fija un ancho (w-*) o flex-1, se omite w-full
   para que no choque con él (en Tailwind gana la regla que aparece después en la hoja de estilos, no la del atributo class). */
export const inputCls = (c, extra = "") => `${/(^|\s)(w-|flex-1)/.test(extra) ? "" : "w-full "}border rounded-md px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 ${c.input} ${extra}`.trim();
export const btnPrimary = "px-3 py-1.5 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
export const btnGhost = (c) => `px-3 py-1.5 text-xs font-medium rounded-md ${c.textDim} ${c.dark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`;
export const btnOutline = (c) => `px-2.5 py-1.5 text-xs font-medium rounded-md border ${c.panelBorder} ${c.textDim} ${c.dark ? "hover:bg-slate-800" : "hover:bg-slate-50"}`;

/** Menú desplegable simple con casillas (para filtros de varios valores). */
export function MultiSelect({ label, options, value, onChange, c, icon: Icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const text = value.length === 0 ? label : value.length === 1 ? options.find((o) => o.id === value[0])?.label || label : `${label} (${value.length})`;
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border ${value.length ? "border-blue-500 text-blue-500" : `${c.panelBorder} ${c.textDim}`} ${c.panel}`}>
        {Icon && <Icon className="w-3.5 h-3.5" />}<span className="truncate max-w-[10rem]">{text}</span>
      </button>
      {open && (
        <div className={`absolute z-30 mt-1 min-w-[12rem] max-h-64 overflow-y-auto rounded-md border shadow-lg p-1 ${c.panel} ${c.panelBorder}`}>
          {options.map((o) => (
            <label key={o.id} className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer ${c.text} ${c.rowHover}`}>
              <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
              {o.node || o.label}
            </label>
          ))}
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="w-full text-left px-2 py-1.5 text-xs text-blue-500">Quitar filtro</button>}
        </div>
      )}
    </div>
  );
}
