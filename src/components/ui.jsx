import { useState, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useTheme } from "../lib/theme";
import { fmtDate, getRisk } from "../lib/dates";
import { useTeam } from "../lib/team";
import { statusCls, PRIORITY_LABEL, PRIORITY_DOT, prioCls, TYPE_META, riskCls, RISK_ICON, projectCls } from "../lib/constants";

export function Avatar({ userId, size = "sm" }) {
  const { userById: findUser } = useTeam();
  const u = findUser(userId);
  const dims = size === "lg" ? "w-9 h-9 text-xs" : size === "md" ? "w-7 h-7 text-xs" : "w-6 h-6 text-xs";
  if (!u) return <div className={`${dims} rounded-full bg-slate-500 text-white flex items-center justify-center font-semibold shrink-0 opacity-50`}>?</div>;
  return <div title={u.name} className={`${dims} rounded-full ${u.color} text-white flex items-center justify-center font-semibold shrink-0`}>{u.initials}</div>;
}

export function PriorityDot({ id }) {
  return <span title={PRIORITY_LABEL[id]} className={`inline-block w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[id] || PRIORITY_DOT.P2}`} />;
}
export function PriorityBadge({ id }) {
  const { dark } = useTheme();
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${prioCls(id, dark)}`}>
      <PriorityDot id={id} />{id}
    </span>
  );
}
export function StatusBadge({ status }) {
  const { dark } = useTheme();
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${statusCls(status, dark)}`}>{status}</span>;
}
export function RiskBadge({ task }) {
  const { dark } = useTheme();
  const r = getRisk(task);
  if (!r) return null;
  const Icon = RISK_ICON[r];
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${riskCls(r, dark)}`}><Icon className="w-3 h-3" />{r}</span>;
}
export function TypeSquare({ type, size = "sm" }) {
  const meta = TYPE_META[type] || TYPE_META["Operacional"];
  const Icon = meta.icon;
  const dims = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <span title={type} className={`inline-flex items-center justify-center rounded ${dims} ${meta.color} text-white shrink-0`}>
      <Icon className="w-2.5 h-2.5" />
    </span>
  );
}
export function ProjectPill({ name }) {
  const { dark } = useTheme();
  if (!name) return null;
  return <span style={{ maxWidth: 140 }} className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium uppercase tracking-wide truncate ${projectCls(name, dark)}`}>{name}</span>;
}
export function ProgressBar({ value }) {
  const { dark } = useTheme();
  return (
    <div className={`w-full h-1 rounded-full overflow-hidden ${dark ? "bg-slate-700" : "bg-slate-100"}`}>
      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${value || 0}%` }} />
    </div>
  );
}
export function EmptyState({ label }) {
  const { dark } = useTheme();
  return <div className={`text-center py-6 text-xs rounded-lg border border-dashed ${dark ? "text-slate-600 border-slate-800" : "text-slate-400 border-slate-200"}`}>{label}</div>;
}
export function SectionTitle({ icon: Icon, children, count }) {
  const { dark } = useTheme();
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {Icon && <Icon className={`w-3.5 h-3.5 ${dark ? "text-slate-500" : "text-slate-400"}`} />}
      <h3 className={`text-xs font-semibold tracking-wide uppercase ${dark ? "text-slate-400" : "text-slate-600"}`}>{children}</h3>
      {count !== undefined && <span className={`text-xs font-mono ${dark ? "text-slate-600" : "text-slate-400"}`}>{count}</span>}
    </div>
  );
}
export function KpiStrip({ items }) {
  const { dark } = useTheme();
  return (
    <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs px-3 py-2 rounded-lg border ${dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className={dark ? "text-slate-700" : "text-slate-300"}>·</span>}
          <span className={dark ? "text-slate-500" : "text-slate-500"}>{it.label}</span>
          <span className={`font-mono font-semibold ${it.tone || (dark ? "text-slate-200" : "text-slate-800")}`}>{it.value}</span>
        </span>
      ))}
    </div>
  );
}
export function useHoverCard() {
  const [pos, setPos] = useState(null);
  const timer = useRef(null);
  const onEnter = (e) => {
    const x = e.clientX, y = e.clientY;
    timer.current = setTimeout(() => setPos({ x, y }), 350);
  };
  const onMove = (e) => setPos((p) => (p ? { x: e.clientX, y: e.clientY } : p));
  const onLeave = () => { clearTimeout(timer.current); setPos(null); };
  return { pos, onEnter, onMove, onLeave };
}
export function HoverDescription({ pos, task }) {
  const { dark } = useTheme();
  if (!pos) return null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const left = Math.min(pos.x + 14, vw - 260);
  return (
    <div style={{ position: "fixed", left, top: pos.y + 16 }} className={`z-50 w-60 rounded-md border p-2.5 shadow-lg pointer-events-none ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
      <p className={`text-xs font-semibold mb-1 line-clamp-2 ${dark ? "text-slate-100" : "text-slate-800"}`}>{task.title}</p>
      <p className={`text-xs leading-relaxed line-clamp-5 ${dark ? "text-slate-400" : "text-slate-500"}`}>{task.description || "Sin descripción."}</p>
    </div>
  );
}
export function TaskRow({ task, onClick }) {
  const { dark } = useTheme();
  const hover = useHoverCard();
  return (
    <>
      <button onClick={onClick} onMouseEnter={hover.onEnter} onMouseMove={hover.onMove} onMouseLeave={hover.onLeave}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors border ${dark ? "bg-slate-900 border-slate-800 hover:bg-slate-800" : "bg-white border-slate-100 hover:bg-slate-50"}`}>
        <TypeSquare type={task.type} />
        <PriorityBadge id={task.priority} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>{task.title}</p>
          <p className={`text-xs font-mono truncate ${dark ? "text-slate-600" : "text-slate-400"}`}>{task.id}{task.project ? " · " + task.project : ""}</p>
        </div>
        <Avatar userId={task.assignee} />
        <StatusBadge status={task.status} />
        <span className={`text-xs w-14 text-right shrink-0 ${dark ? "text-slate-500" : "text-slate-500"}`}>{fmtDate(task.deadline)}</span>
        <RiskBadge task={task} />
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${dark ? "text-slate-700" : "text-slate-300"}`} />
      </button>
      <HoverDescription pos={hover.pos} task={task} />
    </>
  );
}
