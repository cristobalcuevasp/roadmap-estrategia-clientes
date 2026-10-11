-- =============================================================================
-- Roadmap Estrategia de Clientes — esquema inicial
--   * 4 miembros fijos (team_members) enlazados a cuentas de Supabase Auth
--   * tareas, comentarios, historial y notificaciones
--   * RLS: solo usuarios autenticados que estén enlazados a un miembro
--   * triggers: historial, notificaciones, tareas recurrentes, control de registro
--   * Realtime: cambios visibles al instante para todo el equipo
-- =============================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function private.today_cl() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Santiago')::date
$$;

create or replace function private.next_deadline(p_freq text, p_base date) returns date
language plpgsql immutable set search_path = '' as $$
declare d date;
begin
  case p_freq
    when 'Diaria' then return p_base + 1;
    when 'Días hábiles' then
      d := p_base + 1;
      while extract(isodow from d) in (6, 7) loop d := d + 1; end loop;
      return d;
    when 'Quincenal' then return p_base + 14;
    when 'Mensual' then return p_base + 30;
    else return p_base + 7;
  end case;
end $$;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table public.team_members (
  id          text primary key,
  user_id     uuid unique references auth.users (id) on delete set null,
  email       text check (email is null or length(btrim(email)) > 0),
  name        text not null check (length(btrim(name)) > 0),
  role        text not null default '',
  initials    text not null default '?',
  color       text not null default 'slate',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create unique index team_members_email_key on public.team_members (lower(email)) where email is not null;

-- Funciones de pertenencia (usadas por las políticas RLS)
create or replace function private.current_member_id() returns text
language sql stable security definer set search_path = '' as $$
  select id from public.team_members where user_id = (select auth.uid()) limit 1
$$;

create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members where user_id = (select auth.uid()))
$$;

revoke all on function private.current_member_id() from public;
revoke all on function private.is_member() from public;
grant execute on function private.current_member_id() to authenticated;
grant execute on function private.is_member() to authenticated;

create sequence public.task_seq start 141;

create table public.tasks (
  id                   text primary key default ('EST-' || nextval('public.task_seq')),
  title                text not null check (length(btrim(title)) > 0),
  description          text not null default '',
  assignee             text references public.team_members (id) on delete set null,
  additional_assignees text[] not null default '{}',
  requester            text references public.team_members (id) on delete set null,
  start_date           date,
  deadline             date,
  status               text not null default 'Backlog'
                         check (status in ('Backlog','Por hacer','En curso','En revisión','Bloqueada','Terminada','Cancelada')),
  priority             text not null default 'P2' check (priority in ('P0','P1','P2','P3')),
  type                 text not null default 'Operacional'
                         check (type in ('Rompelínea','Diaria','Proyecto','Operacional','Seguimiento','Mejora','Incidente','Reunión','Análisis')),
  category             text not null default '',
  impact               text not null default 'Medio' check (impact in ('Alto','Medio','Bajo')),
  effort               text not null default 'Medio' check (effort in ('Alto','Medio','Bajo')),
  progress             int  not null default 0 check (progress between 0 and 100),
  project              text not null default '',
  dependencies         text[] not null default '{}',
  blockers             text not null default '',
  expected_result      text not null default '',
  links                text not null default '',
  recurring_enabled    boolean not null default false,
  recurring_frequency  text not null default 'Semanal'
                         check (recurring_frequency in ('Diaria','Días hábiles','Semanal','Quincenal','Mensual','Personalizada')),
  objective            text not null default '',
  expected_impact      text not null default '',
  success_indicator    text not null default '',
  next_milestone       text not null default '',
  completed_at         date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           text references public.team_members (id) on delete set null
);
create index tasks_assignee_idx   on public.tasks (assignee);
create index tasks_requester_idx  on public.tasks (requester);
create index tasks_updated_by_idx on public.tasks (updated_by);
create index tasks_status_idx     on public.tasks (status);
create index tasks_deadline_idx   on public.tasks (deadline);

create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    text not null references public.tasks (id) on delete cascade,
  author     text references public.team_members (id) on delete set null default private.current_member_id(),
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);
create index task_comments_task_idx   on public.task_comments (task_id, created_at);
create index task_comments_author_idx on public.task_comments (author);

create table public.task_history (
  id         uuid primary key default gen_random_uuid(),
  task_id    text not null references public.tasks (id) on delete cascade,
  actor      text references public.team_members (id) on delete set null,
  field      text not null,
  from_value text,
  to_value   text,
  created_at timestamptz not null default now()
);
create index task_history_task_idx  on public.task_history (task_id, created_at);
create index task_history_actor_idx on public.task_history (actor);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('assigned','priority','mention','blocked','p0','rompelinea')),
  task_id    text references public.tasks (id) on delete cascade,
  task_title text not null default '',
  actor      text references public.team_members (id) on delete set null,
  target     text references public.team_members (id) on delete cascade,  -- null = todo el equipo
  message    text not null,
  created_at timestamptz not null default now()
);
create index notifications_created_idx on public.notifications (created_at desc);
create index notifications_task_idx    on public.notifications (task_id);
create index notifications_actor_idx   on public.notifications (actor);
create index notifications_target_idx  on public.notifications (target);

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  member_id       text not null references public.team_members (id) on delete cascade default private.current_member_id(),
  read_at         timestamptz not null default now(),
  primary key (notification_id, member_id)
);
create index notification_reads_member_idx on public.notification_reads (member_id);

-- -----------------------------------------------------------------------------
-- Triggers sobre tareas
-- -----------------------------------------------------------------------------
-- Sellos de edición, fecha de término y avance al terminar
create or replace function private.tasks_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_member text;
begin
  -- Actualizaciones internas (p. ej. limpieza de dependencias) no cambian el sello
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    return new;
  end if;

  new.title := btrim(new.title);

  if new.status = 'Terminada' then
    if tg_op = 'INSERT' then
      new.completed_at := coalesce(new.completed_at, private.today_cl());
      new.progress := 100;
    elsif old.status is distinct from 'Terminada' then
      new.completed_at := private.today_cl();
      new.progress := 100;
    end if;
  else
    new.completed_at := null;
  end if;

  v_member := private.current_member_id();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.updated_at := now();
    new.updated_by := coalesce(v_member, old.updated_by);
  else
    new.updated_by := coalesce(v_member, new.updated_by);
  end if;
  return new;
end $$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- Historial de cambios
create or replace function private.tasks_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_actor text;
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('app.system_insert', true), '') = 'on' then
      v_actor := null;
    else
      v_actor := private.current_member_id();
    end if;
    insert into public.task_history (task_id, actor, field, from_value, to_value)
    values (new.id, v_actor, 'creation', null,
            coalesce(nullif(current_setting('app.creation_note', true), ''), 'Tarea creada'));
    return null;
  end if;

  v_actor := private.current_member_id();
  if new.title is distinct from old.title then
    insert into public.task_history (task_id, actor, field, from_value, to_value) values (new.id, v_actor, 'title', old.title, new.title);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.task_history (task_id, actor, field, from_value, to_value) values (new.id, v_actor, 'priority', old.priority, new.priority);
  end if;
  if new.status is distinct from old.status then
    insert into public.task_history (task_id, actor, field, from_value, to_value) values (new.id, v_actor, 'status', old.status, new.status);
  end if;
  if new.assignee is distinct from old.assignee then
    insert into public.task_history (task_id, actor, field, from_value, to_value) values (new.id, v_actor, 'assignee', old.assignee, new.assignee);
  end if;
  if new.deadline is distinct from old.deadline then
    insert into public.task_history (task_id, actor, field, from_value, to_value) values (new.id, v_actor, 'deadline', old.deadline::text, new.deadline::text);
  end if;
  if new.progress is distinct from old.progress
     and not (new.status = 'Terminada' and old.status is distinct from 'Terminada') then
    insert into public.task_history (task_id, actor, field, from_value, to_value) values (new.id, v_actor, 'progress', old.progress::text, new.progress::text);
  end if;
  if new.type is distinct from old.type then
    insert into public.task_history (task_id, actor, field, from_value, to_value) values (new.id, v_actor, 'type', old.type, new.type);
  end if;
  return null;
end $$;

create trigger tasks_history
  after insert or update on public.tasks
  for each row execute function private.tasks_history();

-- Notificaciones por cambios en tareas
create or replace function private.push_notification(
  p_type text, p_task_id text, p_title text, p_actor text, p_target text, p_message text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (type, task_id, task_title, actor, target, message)
  values (p_type, p_task_id, p_title, p_actor, p_target, p_message)
$$;

create or replace function private.tasks_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_actor text; v_name text;
begin
  if coalesce(current_setting('app.system_insert', true), '') = 'on' then return null; end if;
  v_actor := private.current_member_id();
  if v_actor is null then return null; end if;
  select name into v_name from public.team_members where id = v_actor;

  if tg_op = 'INSERT' then
    if new.assignee is not null and new.assignee <> v_actor then
      perform private.push_notification('assigned', new.id, new.title, v_actor, new.assignee, v_name || ' te asignó "' || new.title || '"');
    end if;
    if new.priority = 'P0' then
      perform private.push_notification('p0', new.id, new.title, v_actor, null, 'Nueva P0: "' || new.title || '"');
    end if;
    if new.type = 'Rompelínea' then
      perform private.push_notification('rompelinea', new.id, new.title, v_actor, null, 'Nueva Rompelínea: "' || new.title || '"');
    end if;
    return null;
  end if;

  if new.assignee is distinct from old.assignee and new.assignee is not null and new.assignee <> v_actor then
    perform private.push_notification('assigned', new.id, new.title, v_actor, new.assignee, v_name || ' te asignó "' || new.title || '"');
  end if;
  if new.priority is distinct from old.priority then
    if new.priority = 'P0' then
      perform private.push_notification('p0', new.id, new.title, v_actor, null, 'Nueva P0: "' || new.title || '"');
    elsif new.assignee is not null and new.assignee <> v_actor then
      perform private.push_notification('priority', new.id, new.title, v_actor, new.assignee, v_name || ' cambió la prioridad de "' || new.title || '" a ' || new.priority);
    end if;
  end if;
  if new.status = 'Bloqueada' and old.status is distinct from 'Bloqueada' and new.assignee is not null and new.assignee <> v_actor then
    perform private.push_notification('blocked', new.id, new.title, v_actor, new.assignee, '"' || new.title || '" quedó bloqueada');
  end if;
  if new.type = 'Rompelínea' and old.type is distinct from 'Rompelínea' then
    perform private.push_notification('rompelinea', new.id, new.title, v_actor, null, 'Nueva Rompelínea: "' || new.title || '"');
  end if;
  return null;
end $$;

create trigger tasks_notify
  after insert or update on public.tasks
  for each row execute function private.tasks_notify();

-- Tareas recurrentes: al terminar una, se genera la siguiente instancia
create or replace function private.tasks_recurring() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'Terminada' and old.status is distinct from 'Terminada' and new.recurring_enabled then
    perform set_config('app.system_insert', 'on', true);
    perform set_config('app.creation_note', 'Instancia recurrente generada desde ' || new.id, true);
    insert into public.tasks (
      title, description, assignee, additional_assignees, requester, start_date, deadline, status, priority, type,
      category, impact, effort, progress, project, dependencies, blockers, expected_result, links,
      recurring_enabled, recurring_frequency, objective, expected_impact, success_indicator, next_milestone, updated_by
    ) values (
      new.title, new.description, new.assignee, new.additional_assignees, new.requester,
      private.today_cl(), private.next_deadline(new.recurring_frequency, coalesce(new.deadline, private.today_cl())),
      'Por hacer', new.priority, new.type,
      new.category, new.impact, new.effort, 0, new.project, new.dependencies, new.blockers, new.expected_result, new.links,
      true, new.recurring_frequency, new.objective, new.expected_impact, new.success_indicator, new.next_milestone, null
    );
    perform set_config('app.system_insert', '', true);
    perform set_config('app.creation_note', '', true);
  end if;
  return null;
end $$;

create trigger tasks_recurring
  after update on public.tasks
  for each row execute function private.tasks_recurring();

-- Al borrar una tarea, se limpia de las dependencias de las demás
create or replace function private.tasks_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tasks set dependencies = array_remove(dependencies, old.id) where old.id = any (dependencies);
  return null;
end $$;

create trigger tasks_after_delete
  after delete on public.tasks
  for each row execute function private.tasks_after_delete();

-- Menciones en comentarios (@nombre)
create or replace function private.comments_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_title text; v_name text; m record;
begin
  select title into v_title from public.tasks where id = new.task_id;
  select name into v_name from public.team_members where id = new.author;
  for m in select id, name from public.team_members where id <> coalesce(new.author, '') loop
    if position('@' || lower(split_part(m.name, ' ', 1)) in lower(new.body)) > 0 then
      perform private.push_notification('mention', new.task_id, coalesce(v_title, ''), new.author, m.id,
        coalesce(v_name, 'Alguien') || ' te mencionó en "' || coalesce(v_title, '') || '"');
    end if;
  end loop;
  return null;
end $$;

create trigger task_comments_notify
  after insert on public.task_comments
  for each row execute function private.comments_notify();

-- -----------------------------------------------------------------------------
-- Control de registro: solo correos del equipo
--   1) si el correo está registrado en team_members -> se enlaza a ese miembro
--   2) si aún nadie se ha registrado -> la primera cuenta pasa a ser Cristobal Cuevas
--   3) en cualquier otro caso el registro se rechaza
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_rows int;
begin
  update public.team_members set user_id = new.id
   where user_id is null and email is not null and lower(email) = lower(new.email);
  get diagnostics v_rows = row_count;
  if v_rows > 0 then return new; end if;

  update public.team_members set user_id = new.id, email = new.email
   where id = 'cristobal_cuevas' and user_id is null
     and not exists (select 1 from public.team_members where user_id is not null);
  get diagnostics v_rows = row_count;
  if v_rows > 0 then return new; end if;

  raise exception 'signup_not_allowed: este correo no está autorizado para el equipo' using errcode = 'P0001';
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------
revoke all on public.team_members, public.tasks, public.task_comments, public.task_history,
              public.notifications, public.notification_reads from anon, authenticated;
revoke all on sequence public.task_seq from anon, authenticated;

grant select on public.team_members to authenticated;
grant update (name, role, initials, color, email) on public.team_members to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert on public.task_comments to authenticated;
grant select on public.task_history to authenticated;
grant select on public.notifications to authenticated;
grant select, insert on public.notification_reads to authenticated;
grant usage on sequence public.task_seq to authenticated;

alter table public.team_members       enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_comments      enable row level security;
alter table public.task_history       enable row level security;
alter table public.notifications      enable row level security;
alter table public.notification_reads enable row level security;

create policy team_members_select on public.team_members for select to authenticated
  using ((select private.is_member()));
create policy team_members_update on public.team_members for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

create policy tasks_select on public.tasks for select to authenticated using ((select private.is_member()));
create policy tasks_insert on public.tasks for insert to authenticated with check ((select private.is_member()));
create policy tasks_update on public.tasks for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy tasks_delete on public.tasks for delete to authenticated using ((select private.is_member()));

create policy task_comments_select on public.task_comments for select to authenticated
  using ((select private.is_member()));
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check ((select private.is_member()) and author = (select private.current_member_id()));

create policy task_history_select on public.task_history for select to authenticated
  using ((select private.is_member()));

create policy notifications_select on public.notifications for select to authenticated
  using (
    (select private.is_member())
    and (target is null or target = (select private.current_member_id()))
    and actor is distinct from (select private.current_member_id())
  );

create policy notification_reads_select on public.notification_reads for select to authenticated
  using (member_id = (select private.current_member_id()));
create policy notification_reads_insert on public.notification_reads for insert to authenticated
  with check (member_id = (select private.current_member_id()));

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.team_members, public.tasks, public.task_comments, public.task_history,
  public.notifications, public.notification_reads;

-- -----------------------------------------------------------------------------
-- Endurecer funciones internas: solo las de pertenencia son invocables por usuarios
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_member_id() to authenticated;
grant execute on function private.is_member() to authenticated;
