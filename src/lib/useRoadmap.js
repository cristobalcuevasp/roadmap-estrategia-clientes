import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { todayISO } from "./dates";
import { computeInitials } from "./team";
import { memberFromRow, taskFromRow, taskToRow, historyFromRow, notificationFromRow } from "./mappers";

/* Inserta o reemplaza una fila por id, ignorando versiones más antiguas que la que ya tenemos. */
function upsertRow(rows, row, key = "id") {
  const i = rows.findIndex((r) => r[key] === row[key]);
  if (i === -1) return [...rows, row];
  if (rows[i].updated_at && row.updated_at && rows[i].updated_at > row.updated_at) return rows;
  const next = rows.slice();
  next[i] = row;
  return next;
}

function friendlyError(e) {
  const msg = (e && (e.message || e.details)) || "";
  if (/duplicate key|team_members_email_key/i.test(msg)) return "Ese correo ya está asignado a otra persona del equipo.";
  if (/row-level security|permission denied/i.test(msg)) return "No tienes permiso para hacer este cambio.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  return msg || "Error inesperado.";
}

/**
 * Estado compartido del roadmap: carga inicial + Realtime + acciones con guardado optimista.
 * `session` es la sesión de Supabase Auth del usuario conectado.
 */
export function useRoadmap(session) {
  const [memberRows, setMemberRows] = useState([]);
  const [taskRows, setTaskRows] = useState([]);
  const [commentRows, setCommentRows] = useState([]);
  const [notifRows, setNotifRows] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set());
  const [phase, setPhase] = useState("loading"); // loading | ready | noaccess | error
  const [loadError, setLoadError] = useState("");
  const [live, setLive] = useState(false);
  const [saving, setSaving] = useState(0);
  const [syncedAt, setSyncedAt] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const userId = session?.user?.id;

  const showToast = useCallback((message, tone = "error") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  /* ---------------- carga completa ---------------- */
  const loadAll = useCallback(async () => {
    const [m, t, c, n, r] = await Promise.all([
      supabase.from("team_members").select("*").order("sort_order"),
      supabase.from("tasks").select("*").order("created_at"),
      supabase.from("task_comments").select("*").order("created_at"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("notification_reads").select("notification_id"),
    ]);
    const failed = [m, t, c, n, r].find((x) => x.error);
    if (failed) throw failed.error;
    setMemberRows(m.data);
    if (m.data.length === 0) { setPhase("noaccess"); return; }
    setTaskRows(t.data);
    setCommentRows(c.data);
    setNotifRows(n.data);
    setReadIds(new Set(r.data.map((x) => x.notification_id)));
    setSyncedAt(new Date());
    setPhase("ready");
  }, []);

  const refresh = useCallback(() => {
    loadAll().catch((e) => { console.error("Error al sincronizar", e); setLoadError(friendlyError(e)); setPhase((p) => (p === "ready" ? p : "error")); });
  }, [loadAll]);

  /* ---------------- tiempo real ---------------- */
  useEffect(() => {
    if (!userId) return undefined;
    setPhase("loading");
    refresh();

    const touch = () => setSyncedAt(new Date());
    const channel = supabase
      .channel(`roadmap-live-${Math.random().toString(36).slice(2, 8)}`) // nombre único: evita choques al remontar (React StrictMode)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (p) => {
        setTaskRows((rows) => (p.eventType === "DELETE" ? rows.filter((x) => x.id !== p.old.id) : upsertRow(rows, p.new)));
        touch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, (p) => {
        setCommentRows((rows) => (p.eventType === "DELETE" ? rows.filter((x) => x.id !== p.old.id) : upsertRow(rows, p.new)));
        touch();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "team_members" }, (p) => {
        setMemberRows((rows) => rows.map((x) => (x.id === p.new.id ? { ...x, ...p.new } : x)));
        touch();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => {
        setNotifRows((rows) => upsertRow(rows, p.new));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notification_reads" }, (p) => {
        setReadIds((s) => new Set(s).add(p.new.notification_id));
      })
      .subscribe((status) => {
        const ok = status === "SUBSCRIBED";
        setLive(ok);
        if (ok) refresh(); // cubre cualquier cambio ocurrido mientras estuvimos desconectados
      });

    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 120000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  /* ---------------- datos derivados ---------------- */
  const users = useMemo(() => memberRows.map(memberFromRow), [memberRows]);
  const me = useMemo(() => users.find((u) => u.userId === userId) || null, [users, userId]);
  const nameOf = useCallback((id) => users.find((u) => u.id === id)?.name || "", [users]);

  const tasks = useMemo(() => {
    const byTask = {};
    commentRows.forEach((c) => (byTask[c.task_id] ||= []).push(c));
    return taskRows.map((r) => taskFromRow(r, byTask[r.id] || [], (id) => nameOf(id) || "Alguien"));
  }, [taskRows, commentRows, nameOf]);

  const notifications = useMemo(
    () => (me ? notifRows.map((n) => notificationFromRow(n, me.id, readIds, nameOf)) : []),
    [notifRows, readIds, me, nameOf]
  );

  /* ---------------- acciones ---------------- */
  const run = useCallback(async (fn, failMsg) => {
    setSaving((n) => n + 1);
    try {
      return await fn();
    } catch (e) {
      console.error(failMsg, e);
      showToast(`${failMsg}: ${friendlyError(e)}`);
      refresh();
      return undefined;
    } finally {
      setSaving((n) => n - 1);
    }
  }, [refresh, showToast]);

  const createTask = useCallback((draft) => run(async () => {
    const { data, error } = await supabase.from("tasks").insert(taskToRow(draft)).select().single();
    if (error) throw error;
    setTaskRows((rows) => upsertRow(rows, data));
    setSyncedAt(new Date());
    return data.id;
  }, "No se pudo crear la tarea"), [run]);

  const updateTask = useCallback((id, patch) => run(async () => {
    const row = taskToRow(patch);
    if (Object.keys(row).length === 0) return;
    const optimistic = { ...row };
    if (row.status === "Terminada") { optimistic.progress = 100; optimistic.completed_at = todayISO(); }
    else if (row.status) optimistic.completed_at = null;
    setTaskRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...optimistic } : r)));
    const { data, error } = await supabase.from("tasks").update(row).eq("id", id).select().single();
    if (error) throw error;
    setTaskRows((rows) => rows.map((r) => (r.id === id ? data : r)));
    setSyncedAt(new Date());
  }, "No se pudo guardar el cambio"), [run]);

  const deleteTask = useCallback((id) => run(async () => {
    setTaskRows((rows) => rows.filter((r) => r.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    setSyncedAt(new Date());
  }, "No se pudo eliminar la tarea"), [run]);

  const addComment = useCallback((taskId, text) => run(async () => {
    const { data, error } = await supabase.from("task_comments").insert({ task_id: taskId, body: text.trim() }).select().single();
    if (error) throw error;
    setCommentRows((rows) => upsertRow(rows, data));
  }, "No se pudo enviar el comentario"), [run]);

  const saveTeam = useCallback((nextUsers) => run(async () => {
    const changed = nextUsers.filter((u) => {
      const old = users.find((x) => x.id === u.id);
      return !old || old.name !== u.name || old.role !== u.role || (old.email || "") !== (u.email || "");
    });
    for (const u of changed) {
      const name = u.name.trim();
      const { data, error } = await supabase
        .from("team_members")
        .update({ name, role: (u.role || "").trim(), initials: computeInitials(name), email: (u.email || "").trim() || null })
        .eq("id", u.id).select().single();
      if (error) throw error;
      setMemberRows((rows) => rows.map((x) => (x.id === u.id ? data : x)));
    }
    return true;
  }, "No se pudo guardar el equipo"), [run, users]);

  const markRead = useCallback((id) => {
    if (readIds.has(id)) return;
    setReadIds((s) => new Set(s).add(id));
    supabase.from("notification_reads").upsert({ notification_id: id }, { onConflict: "notification_id,member_id", ignoreDuplicates: true })
      .then(({ error }) => { if (error) console.error("No se pudo marcar como leída", error); });
  }, [readIds]);

  const markAllRead = useCallback(() => {
    const unread = notifications.filter((n) => n.readBy.length === 0).map((n) => n.id);
    if (!unread.length) return;
    setReadIds((s) => new Set([...s, ...unread]));
    supabase.from("notification_reads").upsert(unread.map((id) => ({ notification_id: id })), { onConflict: "notification_id,member_id", ignoreDuplicates: true })
      .then(({ error }) => { if (error) console.error("No se pudo marcar como leídas", error); });
  }, [notifications]);

  return {
    phase, loadError, me, users, nameOf, tasks, notifications, live, saving: saving > 0, syncedAt,
    toast, dismissToast: () => setToast(null), showToast, refresh,
    createTask, updateTask, deleteTask, addComment, saveTeam, markRead, markAllRead,
  };
}

/* Historial de una tarea: se consulta al abrirla y se vuelve a consultar cuando la tarea cambia. */
export function useTaskHistory(taskId, stamp, nameOf) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!taskId) { setRows([]); return undefined; }
    let alive = true;
    supabase.from("task_history").select("*").eq("task_id", taskId).order("created_at")
      .then(({ data }) => { if (alive && data) setRows(data); });
    return () => { alive = false; };
  }, [taskId, stamp]);
  return useMemo(() => rows.map((h) => historyFromRow(h, nameOf)), [rows, nameOf]);
}
