import { LayoutDashboard, LayoutGrid, ListChecks, Zap, CalendarRange, CalendarDays, Users, User, ChevronsLeft, ChevronsRight, Sun, Moon } from "lucide-react";
import { tokens } from "../lib/theme";
import { Avatar } from "./ui";

export const NAV = [
  { id: "kanban", label: "Board", icon: LayoutGrid, group: "TRABAJO" },
  { id: "all", label: "Lista", icon: ListChecks, group: "TRABAJO" },
  { id: "mine", label: "Mis tareas", icon: User, group: "TRABAJO" },
  { id: "roadmap", label: "Roadmap", icon: CalendarRange, group: "TRABAJO" },
  { id: "breakers", label: "Rompelíneas", icon: Zap, group: "GESTIÓN" },
  { id: "weekly", label: "Weekly Review", icon: Users, group: "GESTIÓN" },
  { id: "dashboard", label: "Reportes", icon: LayoutDashboard, group: "GESTIÓN" },
  { id: "crm", label: "Programación CRM", icon: CalendarDays, group: "CRM" },
];
export const GROUPS = ["TRABAJO", "GESTIÓN", "CRM"];

export function Sidebar({ view, setView, kpis, mobileOpen, setMobileOpen, collapsed, setCollapsed, currentUser, dark, setDark }) {
  const c = tokens(dark);
  const width = collapsed ? "w-14" : "w-56";
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed lg:static z-30 h-full ${width} ${c.panel} border-r ${c.panelBorder} flex flex-col shrink-0 transition-all duration-150 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`h-12 flex items-center gap-2 px-3 border-b ${c.panelBorder} shrink-0`}>
          <button onClick={() => setView("kanban")} className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0"><Zap className="w-3 h-3" /></span>
            {!collapsed && <span className={`font-semibold text-sm truncate ${dark ? "text-white" : "text-slate-900"}`}>Estrategia CX</span>}
          </button>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className={`ml-auto hidden lg:flex ${c.textFaint} hover:${dark ? "text-slate-200" : "text-slate-700"}`} title="Colapsar menú">
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {collapsed && (
            <button onClick={() => setCollapsed(false)} className={`w-full flex items-center justify-center py-2 mb-1 rounded-md ${c.navIdle}`} title="Expandir menú">
              <ChevronsRight className="w-4 h-4" />
            </button>
          )}
          {GROUPS.map((g) => (
            <div key={g} className="mb-2">
              {!collapsed && <p className={`text-xs font-semibold tracking-wider uppercase px-2 py-1 ${c.groupLabel}`}>{g}</p>}
              {NAV.filter((n) => n.group === g).map((n) => {
                const Icon = n.icon;
                const active = view === n.id;
                let badge = null;
                if (n.id === "breakers") badge = kpis.breakersActive.length;
                if (n.id === "mine") badge = kpis.myOpen;
                return (
                  <button key={n.id} title={n.label} onClick={() => { setView(n.id); setMobileOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors mb-0.5 ${active ? c.navActive : c.navIdle} ${collapsed ? "justify-center" : ""}`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="flex-1 text-left truncate">{n.label}</span>}
                    {!collapsed && !!badge && <span className={`text-xs font-mono px-1.5 rounded-full ${dark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={`p-2 border-t ${c.panelBorder} space-y-1`}>
          <button onClick={() => setDark(!dark)} title={dark ? "Modo claro" : "Modo oscuro"} className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs font-medium ${c.navIdle} ${collapsed ? "justify-center" : ""}`}>
            {dark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!collapsed && <span>{dark ? "Modo claro" : "Modo oscuro"}</span>}
          </button>
          {!collapsed && (
            <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${dark ? "text-slate-500" : "text-slate-400"}`}>
              <Avatar userId={currentUser.id} />
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${dark ? "text-slate-300" : "text-slate-600"}`}>{currentUser.name}</p>
                <p className="text-xs truncate">{currentUser.role}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
