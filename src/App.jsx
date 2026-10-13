import { useState, useEffect, useMemo, useCallback } from "react";
import { ThemeCtx, tokens } from "./lib/theme";
import { TeamCtx } from "./lib/team";
import { getRisk, daysUntil, weekRange, inRange } from "./lib/dates";
import { isConfigured } from "./lib/supabase";
import { useRoadmap, useTaskHistory } from "./lib/useRoadmap";
import { useFbAccess } from "./lib/useFb";
import { AuthGate } from "./auth/AuthGate";
import { NoAccessScreen, LoadErrorScreen, MissingConfigScreen } from "./auth/StatusScreens";
import { LoadingScreen } from "./components/LoadingScreen";
import { Sidebar, NAV } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { TaskModal } from "./components/TaskModal";
import { CommandPalette } from "./components/CommandPalette";
import { TeamEditModal } from "./components/TeamEditModal";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { Toast } from "./components/Toast";
import { KanbanView } from "./views/KanbanView";
import { AllTasksView } from "./views/AllTasksView";
import { MyTasksView } from "./views/MyTasksView";
import { BreakersView } from "./views/BreakersView";
import { WeeklyReview } from "./views/WeeklyReview";
import { RoadmapView } from "./views/RoadmapView";
import { Dashboard } from "./views/Dashboard";
import { CrmView } from "./views/crm/CrmView";
import { FbView } from "./views/fb/FbView";

const defaultFilters = { assignees: [], priority: "all", status: "all", type: "all", project: "all", onlyOverdue: false, onlyBlocked: false, onlyUnassigned: false };

/* Preferencias personales (tema, menú) guardadas solo en este navegador */
const PREFS_KEY = "roadmap-prefs";
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); } catch (e) { return {}; }
}
function savePrefs(partial) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...partial })); } catch (e) { /* almacenamiento no disponible */ }
}

function RoadmapApp({ session, signOut, dark, toggleDark }) {
  const rm = useRoadmap(session);
  const { phase, me, users, tasks, notifications } = rm;
  const fbAccess = useFbAccess(session.user.id); // qué puede ver esta cuenta en Feedback & Desarrollo
  const hiddenViews = useMemo(() => (fbAccess.visible ? [] : ["fb"]), [fbAccess.visible]);

  const [view, setView] = useState("kanban");
  const [filters, setFilters] = useState(defaultFilters);
  const [modalTaskId, setModalTaskId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsedState] = useState(() => !!loadPrefs().collapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [teamEditOpen, setTeamEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [crmLink, setCrmLink] = useState(null); // destino pendiente dentro de Programación CRM (semana o comentario)

  const setCollapsed = (v) => { setCollapsedState(v); savePrefs({ collapsed: v }); };

  const liveModalTask = modalTaskId ? tasks.find((t) => t.id === modalTaskId) : null;
  const history = useTaskHistory(liveModalTask?.id, liveModalTask?.updatedAt, rm.nameOf);

  // Si otra persona elimina la tarea que tengo abierta, cierro el panel
  useEffect(() => {
    if (phase === "ready" && modalTaskId && !liveModalTask) setModalTaskId(null);
  }, [phase, modalTaskId, liveModalTask]);

  const openTask = useCallback((id) => { setModalTaskId(id); setCreatingNew(false); }, []);
  const openNew = useCallback(() => { setCreatingNew(true); setModalTaskId(null); }, []);
  const closeModal = useCallback(() => { setModalTaskId(null); setCreatingNew(false); }, []);
  /* Enlaces del módulo CRM: "crm/comentario/<id>" (campana) y "#/crm/semana/AAAA-MM-DD" o "#/crm/comentario/<id>" (barra de direcciones) */
  const openCrmLink = useCallback((link) => {
    const m = /^\/?crm\/(semana|comentario)\/([\w-]+)$/.exec(String(link || "").replace(/^#/, ""));
    if (!m) return false;
    setCrmLink(m[1] === "semana" ? { tipo: "semana", fecha: m[2] } : { tipo: "comentario", id: m[2] });
    setView("crm");
    setMobileOpen(false);
    return true;
  }, []);
  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash.startsWith("#/crm/") && openCrmLink(window.location.hash)) {
        try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) { /* sin historial: el enlace queda en la barra */ }
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [openCrmLink]);
  const goFiltered = (partial) => { setFilters({ ...defaultFilters, ...partial }); setView("all"); };

  const saveTask = (payload) => {
    if (creatingNew) rm.createTask(payload);
    else if (liveModalTask && Object.keys(payload).length > 0) rm.updateTask(liveModalTask.id, payload);
    closeModal();
  };
  const deleteTask = (id) => { rm.deleteTask(id); closeModal(); };
  const changeStatus = (taskId, status) => {
    const t = tasks.find((x) => x.id === taskId);
    if (t && t.status !== status) rm.updateTask(taskId, { status });
  };
  const saveTeam = async (nextUsers) => {
    const ok = await rm.saveTeam(nextUsers);
    if (ok) setTeamEditOpen(false);
  };

  // Atajos de teclado
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((p) => !p); return; }
      if (typing) return;
      if (e.key === "c" && view !== "crm" && view !== "fb" && !modalTaskId && !creatingNew && !teamEditOpen && !passwordOpen) openNew();
      if (e.key === "/") { e.preventDefault(); document.getElementById("global-search")?.focus(); }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, modalTaskId, creatingNew, teamEditOpen, passwordOpen, openNew]);

  const matchesFilters = useCallback((t) => {
    if (filters.assignees.length && !filters.assignees.includes(t.assignee) && !filters.assignees.some((a) => (t.additionalAssignees || []).includes(a))) return false;
    if (filters.priority !== "all" && t.priority !== filters.priority) return false;
    if (filters.status !== "all" && t.status !== filters.status) return false;
    if (filters.type !== "all" && t.type !== filters.type) return false;
    if (filters.project !== "all" && (t.project || "") !== filters.project) return false;
    if (filters.onlyOverdue && getRisk(t) !== "Vencida") return false;
    if (filters.onlyBlocked && t.status !== "Bloqueada") return false;
    if (filters.onlyUnassigned && t.assignee) return false;
    return true;
  }, [filters]);

  const visibleTasks = useMemo(() => tasks.filter(matchesFilters), [tasks, matchesFilters]);
  const projects = useMemo(() => [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort(), [tasks]);

  const kpis = useMemo(() => {
    const active = tasks.filter((t) => t.status !== "Terminada" && t.status !== "Cancelada");
    const done = tasks.filter((t) => t.status === "Terminada");
    const overdue = active.filter((t) => getRisk(t) === "Vencida");
    const blocked = active.filter((t) => t.status === "Bloqueada");
    const p0 = active.filter((t) => t.priority === "P0");
    const p1 = active.filter((t) => t.priority === "P1");
    const breakersActive = active.filter((t) => t.type === "Rompelínea");
    const upcoming = active.filter((t) => { const d = daysUntil(t.deadline); return d !== null && d >= 0 && d <= 3; });
    const unassigned = active.filter((t) => !t.assignee);
    const [wStart, wEnd] = weekRange(0);
    const createdThisWeek = tasks.filter((t) => inRange(t.createdAt.slice(0, 10), [wStart, wEnd]));
    const avgProgress = active.length ? Math.round(active.reduce((s, t) => s + (t.progress || 0), 0) / active.length) : 0;
    const myOpen = active.filter((t) => me && t.assignee === me.id).length;
    return { active, done, overdue, blocked, p0, p1, breakersActive, upcoming, unassigned, createdThisWeek, avgProgress, myOpen };
  }, [tasks, me]);

  const teamCtx = useMemo(() => ({ users, userById: (id) => users.find((u) => u.id === id) }), [users]);

  if (phase === "loading") return <LoadingScreen dark={dark} />;
  if (phase === "noaccess") return <NoAccessScreen dark={dark} email={session.user.email} onRetry={rm.refresh} onSignOut={signOut} />;
  if (phase === "error") return <LoadErrorScreen dark={dark} message={rm.loadError} onRetry={rm.refresh} onSignOut={signOut} />;

  const c = tokens(dark);
  const viewLabel = NAV.find((n) => n.id === view)?.label || "";

  return (
    <TeamCtx.Provider value={teamCtx}>
      <div className={`flex h-screen overflow-hidden ${c.app}`} style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <Sidebar view={view} setView={setView} kpis={kpis} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} collapsed={collapsed} setCollapsed={setCollapsed} currentUser={me} dark={dark} setDark={toggleDark} hidden={hiddenViews} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar viewLabel={viewLabel} onNew={openNew} live={rm.live} saving={rm.saving} onRefresh={rm.refresh} setMobileOpen={setMobileOpen} currentUser={me}
            onPalette={() => setPaletteOpen(true)} notifications={notifications} onMarkRead={rm.markRead} onMarkAllRead={rm.markAllRead} openTask={openTask} onOpenLink={openCrmLink}
            onEditTeam={() => setTeamEditOpen(true)} onChangePassword={() => setPasswordOpen(true)} onSignOut={signOut} />
          <main className="flex-1 overflow-y-auto p-3 lg:p-4">
            {view === "kanban" && <KanbanView tasks={visibleTasks} filters={filters} setFilters={setFilters} projects={projects} openTask={openTask} onDrop={changeStatus} />}
            {view === "all" && <AllTasksView tasks={visibleTasks} filters={filters} setFilters={setFilters} projects={projects} openTask={openTask} />}
            {view === "mine" && <MyTasksView tasks={tasks} currentUser={me} openTask={openTask} />}
            {view === "breakers" && <BreakersView tasks={tasks} openTask={openTask} />}
            {view === "weekly" && <WeeklyReview tasks={tasks} openTask={openTask} />}
            {view === "roadmap" && <RoadmapView tasks={tasks} openTask={openTask} />}
            {view === "dashboard" && <Dashboard tasks={tasks} kpis={kpis} openTask={openTask} goFiltered={goFiltered} />}
            {view === "fb" && fbAccess.visible && <FbView session={session} access={fbAccess.access} users={users} nameOf={rm.nameOf} showToast={rm.showToast} dark={dark} />}
            {view === "crm" && <CrmView session={session} me={me} users={users} nameOf={rm.nameOf} showToast={rm.showToast} dark={dark} deepLink={crmLink} clearDeepLink={() => setCrmLink(null)} />}
          </main>
        </div>

        {(liveModalTask || creatingNew) && (
          <TaskModal key={creatingNew ? "new" : liveModalTask.id} liveTask={creatingNew ? null : liveModalTask} history={history} isNew={creatingNew} currentUser={me} allTasks={tasks}
            onClose={closeModal} onSave={saveTask} onDelete={deleteTask} onAddComment={rm.addComment} />
        )}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} tasks={tasks} setView={setView} openTask={openTask} openNew={openNew} dark={dark} setDark={toggleDark} hidden={hiddenViews} />
        {teamEditOpen && <TeamEditModal users={users} onClose={() => setTeamEditOpen(false)} onSave={saveTeam} />}
        {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} onDone={() => { setPasswordOpen(false); rm.showToast("Contraseña actualizada.", "ok"); }} />}
        <Toast toast={rm.toast} onClose={rm.dismissToast} />
      </div>
    </TeamCtx.Provider>
  );
}

export default function App() {
  const [dark, setDark] = useState(() => loadPrefs().dark ?? true);
  const toggleDark = () => setDark((d) => { savePrefs({ dark: !d }); return !d; });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  if (!isConfigured) return <MissingConfigScreen dark={dark} />;

  return (
    <ThemeCtx.Provider value={{ dark }}>
      <AuthGate dark={dark}>
        {(session, signOut) => <RoadmapApp key={session.user.id} session={session} signOut={signOut} dark={dark} toggleDark={toggleDark} />}
      </AuthGate>
    </ThemeCtx.Provider>
  );
}
