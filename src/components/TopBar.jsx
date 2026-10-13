import { useState, useEffect, useRef } from "react";
import { Search, Plus, ChevronRight, Menu, Bell, Pencil, KeyRound, LogOut } from "lucide-react";
import { useTheme, tokens } from "../lib/theme";
import { fmtDateTime } from "../lib/dates";
import { NOTIF_META } from "../lib/constants";
import { Avatar } from "./ui";

/* Cierra un menú desplegable al hacer clic fuera de él */
function useOutsideClose(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ref, open, close]);
}

export function NotificationBell({ notifications, currentUser, onMarkRead, onMarkAllRead, openTask, onOpenLink }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useOutsideClose(wrapRef, open, () => setOpen(false));
  const mine = notifications.filter((n) => n.actorId !== currentUser.id && (n.targetUserId === currentUser.id || n.targetUserId === null)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const unread = mine.filter((n) => !n.readBy.includes(currentUser.id));
  return (
    <div className="relative" ref={wrapRef}>
      <button onClick={() => setOpen((v) => !v)} className={`relative p-1.5 rounded-md ${dark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>
        <Bell className={`w-4 h-4 ${c.textDim}`} />
        {unread.length > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>
      {open && (
        <div className={`absolute right-0 mt-1 w-72 rounded-md border shadow-lg overflow-hidden z-40 ${c.panel} ${c.panelBorder}`}>
          <div className={`flex items-center justify-between px-3 py-2 border-b ${c.borderSubtle}`}>
            <p className={`text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>Notificaciones</p>
            {unread.length > 0 && <button onClick={onMarkAllRead} className={`text-xs ${dark ? "text-blue-400" : "text-blue-600"}`}>Marcar todas como leídas</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {mine.length === 0 && <p className={`text-xs px-3 py-4 text-center ${c.textFaint}`}>Sin notificaciones.</p>}
            {mine.slice(0, 25).map((n) => {
              const meta = NOTIF_META[n.type] || NOTIF_META.assigned;
              const Icon = meta.icon;
              const isUnread = !n.readBy.includes(currentUser.id);
              return (
                <button key={n.id} onClick={() => { onMarkRead(n.id); setOpen(false); if (n.link && onOpenLink) onOpenLink(n.link); else openTask(n.taskId); }} className={`w-full flex items-start gap-2 px-3 py-2 text-left ${c.rowHover} ${isUnread ? (dark ? "bg-blue-500 bg-opacity-10" : "bg-blue-50") : ""}`}>
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${dark ? "text-slate-300" : "text-slate-700"}`}>{n.message}</p>
                    <p className={`text-xs ${c.textFaint}`}>{fmtDateTime(n.date)}</p>
                  </div>
                  {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar({ viewLabel, onNew, live, saving, onRefresh, setMobileOpen, currentUser, onPalette, notifications, onMarkRead, onMarkAllRead, openTask, onOpenLink, onEditTeam, onChangePassword, onSignOut }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useOutsideClose(menuRef, menuOpen, () => setMenuOpen(false));
  const itemCls = `w-full flex items-center gap-2 px-3 py-2 text-xs text-left ${c.rowHover} ${dark ? "text-slate-300" : "text-slate-700"}`;
  return (
    <header className={`h-12 shrink-0 ${c.panel} border-b ${c.panelBorder} flex items-center gap-2 px-3`}>
      <button className="lg:hidden text-slate-400" onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5" /></button>
      <p className={`hidden md:block text-xs shrink-0 ${c.textFaint}`}>Estrategia de Clientes <ChevronRight className="w-3 h-3 inline" /> <span className={`font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>{viewLabel}</span></p>

      <div className="flex-1" />

      <button onClick={onPalette} className={`hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs ${c.input} ${c.textFaint}`}>
        <Search className="w-3.5 h-3.5" /><span>Buscar…</span>
        <span className={`ml-2 text-xs px-1 py-0.5 rounded border font-mono ${c.kbd}`}>⌘K</span>
      </button>

      <div className={`hidden md:flex items-center gap-1 text-xs ${c.textFaint}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${saving ? "bg-amber-400 animate-pulse" : live ? "bg-emerald-500" : "bg-amber-400"}`} />
        <button onClick={onRefresh} title="Sincronizar ahora">{saving ? "Guardando…" : live ? "En vivo" : "Reconectando…"}</button>
      </div>

      <NotificationBell notifications={notifications} currentUser={currentUser} onMarkRead={onMarkRead} onMarkAllRead={onMarkAllRead} openTask={openTask} onOpenLink={onOpenLink} />

      <button onClick={onNew} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors shrink-0">
        <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Nueva tarea</span>
      </button>

      <div className="relative" ref={menuRef}>
        <button onClick={() => setMenuOpen((v) => !v)} title={currentUser.name}>
          <Avatar userId={currentUser.id} size="md" />
        </button>
        {menuOpen && (
          <div className={`absolute right-0 mt-1 w-60 rounded-md border shadow-lg overflow-hidden z-40 ${c.panel} ${c.panelBorder}`}>
            <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${c.borderSubtle}`}>
              <Avatar userId={currentUser.id} />
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${dark ? "text-slate-200" : "text-slate-700"}`}>{currentUser.name}</p>
                <p className={`text-xs truncate ${c.textFaint}`}>{currentUser.email || currentUser.role}</p>
              </div>
            </div>
            <button onClick={() => { setMenuOpen(false); onEditTeam(); }} className={itemCls}><Pencil className="w-3.5 h-3.5" />Editar equipo</button>
            <button onClick={() => { setMenuOpen(false); onChangePassword(); }} className={itemCls}><KeyRound className="w-3.5 h-3.5" />Cambiar contraseña</button>
            <button onClick={() => { setMenuOpen(false); onSignOut(); }} className={`${itemCls} border-t ${c.borderSubtle}`}><LogOut className="w-3.5 h-3.5" />Cerrar sesión</button>
          </div>
        )}
      </div>
    </header>
  );
}
