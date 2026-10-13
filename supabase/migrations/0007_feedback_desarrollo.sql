-- =============================================================================
-- 0007: módulo FEEDBACK & DESARROLLO (fichas, roles, objetivos, minutas, compromisos)
--
-- Regla de acceso (se cumple en la base de datos, no solo en la pantalla):
--   * LÍDER (tabla fb_lideres, enlazada a una cuenta mediante team_members.user_id): ve y modifica todo.
--   * INTEGRANTE: solo ve SU ficha (la fila de fb_personas enlazada a su cuenta) y lo que cuelga de ella,
--     en solo lectura. Nunca ve las notas privadas del líder, los borradores de minutas, la auditoría ni
--     las fichas de otras personas.
--   * El correo del líder NO se escribe aquí: se identifica por el miembro del equipo (team_members.id).
--
-- Garantías de historial:
--   * Una minuta publicada no se sobrescribe: cada edición crea una versión nueva (fb_minuta_versiones).
--   * Los compromisos solo cambian de estado, avance o fecha mediante fb_revisar_compromiso(), que
--     guarda cada revisión como un evento fechado (fb_compromiso_revisiones, solo lectura para todos).
--   * Cada alta, cambio o baja queda en fb_auditoria (autor y fecha), visible solo para el líder.
--   * No hay borrado de personas, minutas publicadas, objetivos ni compromisos (se cierran o archivan).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table public.fb_lideres (
  member_id  text primary key references public.team_members (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.fb_personas (
  id                  uuid primary key default gen_random_uuid(),
  member_id           text unique references public.team_members (id) on delete set null,
  nombre              text not null check (length(btrim(nombre)) between 1 and 120),
  cargo               text not null default '' check (length(cargo) <= 120),
  area                text not null default '' check (length(area) <= 120),
  fecha_incorporacion date,
  lider_member_id     text references public.team_members (id) on delete set null,
  estado              text not null default 'activo' check (estado in ('activo', 'ausente', 'inactivo')),
  color               text not null default 'slate' check (color in ('blue','pink','amber','emerald','violet','cyan','orange','slate')),
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text
);
create index fb_personas_lider_idx on public.fb_personas (lider_member_id);

create table public.fb_roles (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null check (length(btrim(nombre)) between 1 and 80),
  descripcion       text not null default '' check (length(descripcion) <= 5000),
  responsabilidades text not null default '' check (length(responsabilidades) <= 5000),
  expectativas      text not null default '' check (length(expectativas) <= 5000),
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz not null default now(),
  updated_by        text
);
create unique index fb_roles_nombre_key on public.fb_roles (lower(btrim(nombre)));

create table public.fb_persona_roles (
  id                uuid primary key default gen_random_uuid(),
  persona_id        uuid not null references public.fb_personas (id) on delete cascade,
  rol_id            uuid not null references public.fb_roles (id) on delete restrict,
  fecha_asignacion  date not null default private.today_cl(),
  fecha_termino     date,
  estado            text not null default 'activo' check (estado in ('activo', 'historico')),
  responsabilidades text check (responsabilidades is null or length(responsabilidades) <= 5000),  -- null = usa las del rol
  expectativas      text check (expectativas is null or length(expectativas) <= 5000),            -- null = usa las del rol
  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz not null default now(),
  updated_by        text
);
create index fb_persona_roles_persona_idx on public.fb_persona_roles (persona_id);
create index fb_persona_roles_rol_idx on public.fb_persona_roles (rol_id);
create unique index fb_persona_roles_activo_key on public.fb_persona_roles (persona_id, rol_id) where estado = 'activo';

create table public.fb_objetivos (
  id                uuid primary key default gen_random_uuid(),
  persona_id        uuid not null references public.fb_personas (id) on delete cascade,
  titulo            text not null check (length(btrim(titulo)) between 1 and 200),
  descripcion       text not null default '' check (length(descripcion) <= 10000),
  resultado_esperado text not null default '' check (length(resultado_esperado) <= 10000),
  prioridad         text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  fecha_objetivo    date,
  estado            text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'en_riesgo', 'cumplido', 'cancelado')),
  avance            smallint not null default 0 check (avance between 0 and 100),
  criterios_exito   text not null default '' check (length(criterios_exito) <= 10000),
  observaciones     text not null default '' check (length(observaciones) <= 10000),
  categoria         text not null default '' check (length(categoria) <= 60),
  fecha_cierre      date,
  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz not null default now(),
  updated_by        text
);
create index fb_objetivos_persona_idx on public.fb_objetivos (persona_id, estado);

create table public.fb_objetivo_roles (
  objetivo_id uuid not null references public.fb_objetivos (id) on delete cascade,
  rol_id      uuid not null references public.fb_roles (id) on delete cascade,
  primary key (objetivo_id, rol_id)
);
create index fb_objetivo_roles_rol_idx on public.fb_objetivo_roles (rol_id);

create table public.fb_sesiones (
  id                      uuid primary key default gen_random_uuid(),
  persona_id              uuid not null references public.fb_personas (id) on delete cascade,
  fecha_hora              timestamptz not null default now(),
  tipo                    text not null default '1a1' check (tipo in ('1a1', 'positivo', 'mejora', 'seguimiento', 'desarrollo', 'evaluacion')),
  modalidad               text not null default 'presencial' check (modalidad in ('presencial', 'virtual')),
  participantes           text not null default '' check (length(participantes) <= 1000),
  estado                  text not null default 'borrador' check (estado in ('borrador', 'publicada')),
  agenda                  text not null default '' check (length(agenda) <= 20000),
  temas                   text not null default '' check (length(temas) <= 20000),
  fortalezas              text not null default '' check (length(fortalezas) <= 20000),
  logros                  text not null default '' check (length(logros) <= 20000),
  oportunidades           text not null default '' check (length(oportunidades) <= 20000),
  comentarios_lider       text not null default '' check (length(comentarios_lider) <= 20000),
  comentarios_colaborador text not null default '' check (length(comentarios_colaborador) <= 20000),
  acuerdos                text not null default '' check (length(acuerdos) <= 20000),
  proximos_pasos          text not null default '' check (length(proximos_pasos) <= 20000),
  temas_pendientes        text not null default '' check (length(temas_pendientes) <= 20000),
  proxima_revision        date,
  minuta                  jsonb not null default '{}'::jsonb check (jsonb_typeof(minuta) = 'object'),
  compromisos_borrador    jsonb not null default '[]'::jsonb check (jsonb_typeof(compromisos_borrador) = 'array'),
  contexto                jsonb not null default '{}'::jsonb check (jsonb_typeof(contexto) = 'object'),
  version                 int not null default 0,
  publicada_en            timestamptz,
  publicada_por           text,
  created_at              timestamptz not null default now(),
  created_by              text,
  updated_at              timestamptz not null default now(),
  updated_by              text
);
create index fb_sesiones_persona_idx on public.fb_sesiones (persona_id, fecha_hora desc);
create index fb_sesiones_estado_idx on public.fb_sesiones (estado);

create table public.fb_minuta_versiones (
  id         uuid primary key default gen_random_uuid(),
  sesion_id  uuid not null references public.fb_sesiones (id) on delete cascade,
  version    int not null,
  motivo     text not null default '',
  contenido  jsonb not null,
  autor      text,
  created_at timestamptz not null default now(),
  unique (sesion_id, version)
);

create table public.fb_compromisos (
  id                         uuid primary key default gen_random_uuid(),
  persona_id                 uuid not null references public.fb_personas (id) on delete cascade,
  sesion_id                  uuid references public.fb_sesiones (id) on delete set null,
  objetivo_id                uuid references public.fb_objetivos (id) on delete set null,
  descripcion                text not null check (length(btrim(descripcion)) between 1 and 2000),
  categoria                  text not null default '' check (length(categoria) <= 60),
  prioridad                  text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  estado                     text not null default 'pendiente' check (estado in ('pendiente', 'en_progreso', 'bloqueado', 'cumplido', 'cancelado')),
  avance                     smallint not null default 0 check (avance between 0 and 100),
  fecha_vencimiento          date not null,
  fecha_vencimiento_original date not null,
  fecha_ultima_revision      date,
  fecha_proxima_revision     date,
  evidencias                 text not null default '' check (length(evidencias) <= 5000),
  resultado_final            text not null default '' check (length(resultado_final) <= 5000),
  fecha_cumplimiento         date,
  reprogramaciones           int not null default 0,
  created_at                 timestamptz not null default now(),
  created_by                 text,
  updated_at                 timestamptz not null default now(),
  updated_by                 text
);
create index fb_compromisos_persona_idx on public.fb_compromisos (persona_id, estado);
create index fb_compromisos_sesion_idx on public.fb_compromisos (sesion_id);
create index fb_compromisos_objetivo_idx on public.fb_compromisos (objetivo_id);
create index fb_compromisos_venc_idx on public.fb_compromisos (fecha_vencimiento);

create table public.fb_compromiso_revisiones (
  id                    uuid primary key default gen_random_uuid(),
  compromiso_id         uuid not null references public.fb_compromisos (id) on delete cascade,
  persona_id            uuid not null references public.fb_personas (id) on delete cascade,
  fecha                 date not null default private.today_cl(),
  avance_texto          text not null default '' check (length(avance_texto) <= 5000),
  avance_anterior       smallint,
  avance_pct            smallint not null check (avance_pct between 0 and 100),
  estado_anterior       text not null,
  estado_nuevo          text not null,
  obstaculos            text not null default '' check (length(obstaculos) <= 5000),
  evidencias            text not null default '' check (length(evidencias) <= 5000),
  comentarios_lider     text not null default '' check (length(comentarios_lider) <= 5000),
  comentarios_integrante text not null default '' check (length(comentarios_integrante) <= 5000),
  acciones_correctivas  text not null default '' check (length(acciones_correctivas) <= 5000),
  vencimiento_anterior  date not null,
  vencimiento_nuevo     date not null,
  resultado             text not null default '' check (length(resultado) <= 5000),
  autor                 text,
  created_at            timestamptz not null default now()
);
create index fb_revisiones_compromiso_idx on public.fb_compromiso_revisiones (compromiso_id, created_at);
create index fb_revisiones_persona_idx on public.fb_compromiso_revisiones (persona_id);

create table public.fb_seguimientos (
  id               uuid primary key default gen_random_uuid(),
  persona_id       uuid not null references public.fb_personas (id) on delete cascade,
  fecha            date not null,
  hora             time,
  motivo           text not null default '' check (length(motivo) <= 1000),
  estado           text not null default 'programado' check (estado in ('programado', 'realizado', 'cancelado')),
  sesion_id        uuid references public.fb_sesiones (id) on delete set null,
  origen_sesion_id uuid references public.fb_sesiones (id) on delete set null,
  created_at       timestamptz not null default now(),
  created_by       text,
  updated_at       timestamptz not null default now(),
  updated_by       text
);
create index fb_seguimientos_persona_idx on public.fb_seguimientos (persona_id, fecha);
create index fb_seguimientos_sesion_idx on public.fb_seguimientos (sesion_id);
create index fb_seguimientos_origen_idx on public.fb_seguimientos (origen_sesion_id);

create table public.fb_notas_privadas (
  id         uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.fb_personas (id) on delete cascade,
  sesion_id  uuid references public.fb_sesiones (id) on delete set null,
  cuerpo     text not null check (length(btrim(cuerpo)) between 1 and 20000),
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index fb_notas_persona_idx on public.fb_notas_privadas (persona_id, created_at desc);
create index fb_notas_sesion_idx on public.fb_notas_privadas (sesion_id);

create table public.fb_config (
  clave      text primary key,
  valor      jsonb not null,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table public.fb_auditoria (
  id         bigint generated always as identity primary key,
  tabla      text not null,
  registro   text not null default '',
  persona_id uuid,
  accion     text not null,
  actor      text,
  resumen    text not null default '',
  cambios    jsonb,
  created_at timestamptz not null default now()
);
create index fb_auditoria_persona_idx on public.fb_auditoria (persona_id, created_at desc);
create index fb_auditoria_fecha_idx on public.fb_auditoria (created_at desc);

-- -----------------------------------------------------------------------------
-- Funciones de acceso (las usan las políticas RLS)
-- -----------------------------------------------------------------------------
create or replace function private.fb_es_lider() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fb_lideres l
    join public.team_members t on t.id = l.member_id
    where t.user_id = (select auth.uid())
  )
$$;

create or replace function private.fb_es_mi_persona(p_persona uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fb_personas p
    where p.id = p_persona and p.member_id is not null and p.member_id = (select private.current_member_id())
  )
$$;

create or replace function private.fb_es_mi_objetivo(p_objetivo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fb_objetivos o
    join public.fb_personas p on p.id = o.persona_id
    where o.id = p_objetivo and p.member_id is not null and p.member_id = (select private.current_member_id())
  )
$$;

create or replace function private.fb_rol_visible(p_rol uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fb_persona_roles pr
    join public.fb_personas p on p.id = pr.persona_id
    where pr.rol_id = p_rol and p.member_id is not null and p.member_id = (select private.current_member_id())
  )
$$;

create or replace function private.fb_sesion_visible(p_sesion uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fb_sesiones s
    join public.fb_personas p on p.id = s.persona_id
    where s.id = p_sesion and s.estado = 'publicada' and p.member_id is not null and p.member_id = (select private.current_member_id())
  )
$$;

-- -----------------------------------------------------------------------------
-- Triggers de sellos, validaciones y auditoría
-- -----------------------------------------------------------------------------
create or replace function private.fb_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_member text := private.current_member_id();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(v_member, new.created_by);
    new.updated_by := coalesce(v_member, new.updated_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(v_member, old.updated_by);
  end if;
  return new;
end $$;

create or replace function private.fb_trim_nombre() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.nombre := btrim(new.nombre);
  return new;
end $$;

create or replace function private.fb_persona_roles_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'historico' then
    new.fecha_termino := coalesce(new.fecha_termino, private.today_cl());
  else
    new.fecha_termino := null;
  end if;
  if new.fecha_termino is not null and new.fecha_termino < new.fecha_asignacion then
    raise exception 'fb_fecha_invalida: la fecha de término no puede ser anterior a la de asignación';
  end if;
  return new;
end $$;

create or replace function private.fb_objetivos_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.titulo := btrim(new.titulo);
  if new.estado = 'cumplido' then
    new.avance := 100;
    new.fecha_cierre := case when tg_op = 'UPDATE' and old.estado = 'cumplido' then coalesce(old.fecha_cierre, private.today_cl()) else private.today_cl() end;
  elsif new.estado = 'cancelado' then
    new.fecha_cierre := case when tg_op = 'UPDATE' and old.estado = 'cancelado' then coalesce(old.fecha_cierre, private.today_cl()) else private.today_cl() end;
  else
    new.fecha_cierre := null;
  end if;
  return new;
end $$;

create or replace function private.fb_sesiones_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_dia date := (new.fecha_hora at time zone 'America/Santiago')::date;
begin
  if new.proxima_revision is not null and new.proxima_revision < v_dia then
    raise exception 'fb_fecha_invalida: la próxima revisión no puede ser anterior a la fecha de la reunión';
  end if;
  return new;
end $$;

create or replace function private.fb_compromisos_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.descripcion := btrim(new.descripcion);
  if tg_op = 'INSERT' then
    new.fecha_vencimiento_original := new.fecha_vencimiento;
    if new.sesion_id is null and new.fecha_vencimiento < private.today_cl() then
      raise exception 'fb_fecha_invalida: la fecha de vencimiento no puede ser anterior a hoy';
    end if;
  end if;
  return new;
end $$;

-- Auditoría genérica: una fila por alta, baja o cambio, con autor y campos modificados.
--   tg_argv[0] = columna que contiene el id de la persona ('' si no aplica); tg_argv[1] = 'sin_valores' para no copiar contenido sensible.
create or replace function private.fb_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_col text := coalesce(tg_argv[0], '');
  v_sin boolean := coalesce(tg_argv[1], '') = 'sin_valores';
  v_actor text := private.current_member_id();
  o jsonb; n jsonb; b jsonb; k text; ch jsonb := '{}'::jsonb; v_pid uuid;
begin
  if tg_op = 'DELETE' then o := to_jsonb(old); b := o;
  else
    n := to_jsonb(new); b := n;
    if tg_op = 'UPDATE' then o := to_jsonb(old); end if;
  end if;
  if v_col <> '' then v_pid := nullif(b->>v_col, '')::uuid; end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      continue when k in ('updated_at', 'updated_by', 'created_at', 'created_by');
      if (n->k) is distinct from (o->k) then
        ch := ch || jsonb_build_object(k, case when v_sin then to_jsonb('cambió'::text) else jsonb_build_array(left((o->k)::text, 300), left((n->k)::text, 300)) end);
      end if;
    end loop;
    if ch = '{}'::jsonb then return null; end if;
  end if;
  insert into public.fb_auditoria (tabla, registro, persona_id, accion, actor, resumen, cambios)
  values (
    tg_table_name,
    coalesce(b->>'id', b->>'clave', b->>'objetivo_id', ''),
    v_pid,
    lower(tg_op),
    v_actor,
    case when v_sin then '' else left(coalesce(b->>'nombre', b->>'titulo', b->>'descripcion', b->>'tipo', b->>'clave', ''), 120) end,
    nullif(ch, '{}'::jsonb)
  );
  return null;
end $$;

create trigger fb_touch before insert or update on public.fb_personas for each row execute function private.fb_touch();
create trigger fb_touch before insert or update on public.fb_roles for each row execute function private.fb_touch();
create trigger fb_touch before insert or update on public.fb_persona_roles for each row execute function private.fb_touch();
create trigger fb_touch before insert or update on public.fb_objetivos for each row execute function private.fb_touch();
create trigger fb_touch before insert or update on public.fb_sesiones for each row execute function private.fb_touch();
create trigger fb_touch before insert or update on public.fb_compromisos for each row execute function private.fb_touch();
create trigger fb_touch before insert or update on public.fb_seguimientos for each row execute function private.fb_touch();
create trigger fb_touch before insert or update on public.fb_notas_privadas for each row execute function private.fb_touch();
create trigger fb_touch before insert or update on public.fb_config for each row execute function private.fb_touch();

create trigger fb_trim before insert or update on public.fb_personas for each row execute function private.fb_trim_nombre();
create trigger fb_trim before insert or update on public.fb_roles for each row execute function private.fb_trim_nombre();
create trigger fb_persona_roles_before before insert or update on public.fb_persona_roles for each row execute function private.fb_persona_roles_before();
create trigger fb_objetivos_before before insert or update on public.fb_objetivos for each row execute function private.fb_objetivos_before();
create trigger fb_sesiones_before before insert or update on public.fb_sesiones for each row execute function private.fb_sesiones_before();
create trigger fb_compromisos_before before insert or update on public.fb_compromisos for each row execute function private.fb_compromisos_before();

create trigger fb_audit after insert or update or delete on public.fb_personas for each row execute function private.fb_audit('id');
create trigger fb_audit after insert or update or delete on public.fb_roles for each row execute function private.fb_audit('');
create trigger fb_audit after insert or update or delete on public.fb_persona_roles for each row execute function private.fb_audit('persona_id');
create trigger fb_audit after insert or update or delete on public.fb_objetivos for each row execute function private.fb_audit('persona_id');
create trigger fb_audit after insert or update or delete on public.fb_sesiones for each row execute function private.fb_audit('persona_id');
create trigger fb_audit after insert or update or delete on public.fb_compromisos for each row execute function private.fb_audit('persona_id');
create trigger fb_audit after insert or update or delete on public.fb_seguimientos for each row execute function private.fb_audit('persona_id');
create trigger fb_audit after insert or update or delete on public.fb_notas_privadas for each row execute function private.fb_audit('persona_id', 'sin_valores');
create trigger fb_audit after insert or update or delete on public.fb_config for each row execute function private.fb_audit('');

-- -----------------------------------------------------------------------------
-- Operaciones con historial (solo el líder; todas validan en la base de datos)
-- -----------------------------------------------------------------------------

-- Contenido completo de una minuta, para guardarlo como versión
create or replace function private.fb_snapshot(s public.fb_sesiones) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tipo', s.tipo, 'modalidad', s.modalidad, 'fecha_hora', s.fecha_hora, 'participantes', s.participantes,
    'agenda', s.agenda, 'temas', s.temas, 'fortalezas', s.fortalezas, 'logros', s.logros, 'oportunidades', s.oportunidades,
    'comentarios_lider', s.comentarios_lider, 'comentarios_colaborador', s.comentarios_colaborador, 'acuerdos', s.acuerdos,
    'proximos_pasos', s.proximos_pasos, 'temas_pendientes', s.temas_pendientes, 'proxima_revision', s.proxima_revision,
    'minuta', s.minuta, 'contexto', s.contexto,
    'compromisos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'descripcion', c.descripcion, 'persona_id', c.persona_id,
        'fecha_vencimiento', c.fecha_vencimiento_original, 'prioridad', c.prioridad, 'categoria', c.categoria
      ) order by c.created_at, c.id)
      from public.fb_compromisos c where c.sesion_id = s.id
    ), '[]'::jsonb)
  )
$$;

-- Estado de la persona al momento de publicar (para que la minuta no cambie si luego cambian roles u objetivos)
create or replace function private.fb_contexto(p_persona uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nombre', p.nombre, 'cargo', p.cargo, 'area', p.area,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', r.nombre, 'descripcion', r.descripcion,
        'responsabilidades', coalesce(pr.responsabilidades, r.responsabilidades),
        'expectativas', coalesce(pr.expectativas, r.expectativas),
        'fecha_asignacion', pr.fecha_asignacion
      ) order by r.nombre)
      from public.fb_persona_roles pr join public.fb_roles r on r.id = pr.rol_id
      where pr.persona_id = p.id and pr.estado = 'activo'
    ), '[]'::jsonb),
    'objetivos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'titulo', o.titulo, 'estado', o.estado, 'avance', o.avance, 'fecha_objetivo', o.fecha_objetivo, 'prioridad', o.prioridad
      ) order by o.fecha_objetivo nulls last, o.titulo)
      from public.fb_objetivos o
      where o.persona_id = p.id and o.estado in ('pendiente', 'en_curso', 'en_riesgo')
    ), '[]'::jsonb)
  )
  from public.fb_personas p where p.id = p_persona
$$;

-- Publica una minuta: congela contenido y contexto, crea los compromisos vinculados, agenda la próxima revisión
-- y guarda la versión 1. Todo en una sola transacción.
create or replace function public.fb_publicar_sesion(p_sesion uuid)
returns public.fb_sesiones
language plpgsql security definer set search_path = '' as $$
declare
  s public.fb_sesiones;
  e jsonb;
  v_actor text := private.current_member_id();
  v_dia date;
  v_desc text; v_pers uuid; v_venc date; v_prio text; v_obj uuid;
begin
  if not private.fb_es_lider() then raise exception 'fb_sin_permiso: solo el líder puede publicar minutas' using errcode = '42501'; end if;
  select * into s from public.fb_sesiones where id = p_sesion for update;
  if not found then raise exception 'fb_no_existe: la reunión no existe'; end if;
  if s.estado <> 'borrador' then raise exception 'fb_ya_publicada: la minuta ya fue publicada'; end if;
  if btrim(coalesce(s.minuta->>'resumen', '')) = '' then raise exception 'fb_minuta_vacia: la minuta necesita al menos el resumen de la conversación'; end if;
  v_dia := (s.fecha_hora at time zone 'America/Santiago')::date;

  for e in select value from jsonb_array_elements(s.compromisos_borrador) loop
    v_desc := btrim(coalesce(e->>'descripcion', ''));
    if v_desc = '' then raise exception 'fb_compromiso_invalido: hay un compromiso sin descripción'; end if;
    v_pers := coalesce(nullif(e->>'persona_id', '')::uuid, s.persona_id);
    if not exists (select 1 from public.fb_personas where id = v_pers) then raise exception 'fb_compromiso_invalido: el responsable de un compromiso no existe'; end if;
    v_venc := nullif(e->>'fecha_vencimiento', '')::date;
    if v_venc is null then raise exception 'fb_compromiso_invalido: el compromiso "%" no tiene fecha de vencimiento', left(v_desc, 40); end if;
    if v_venc < v_dia then raise exception 'fb_compromiso_invalido: el compromiso "%" vence antes de la reunión', left(v_desc, 40); end if;
    v_prio := coalesce(nullif(e->>'prioridad', ''), 'media');
    if v_prio not in ('alta', 'media', 'baja') then raise exception 'fb_compromiso_invalido: prioridad no válida'; end if;
    v_obj := nullif(e->>'objetivo_id', '')::uuid;
    if v_obj is not null and not exists (select 1 from public.fb_objetivos where id = v_obj) then v_obj := null; end if;
    insert into public.fb_compromisos (persona_id, sesion_id, objetivo_id, descripcion, categoria, prioridad, fecha_vencimiento, fecha_vencimiento_original)
    values (v_pers, s.id, v_obj, v_desc, left(coalesce(e->>'categoria', ''), 60), v_prio, v_venc, v_venc);
  end loop;

  update public.fb_sesiones
     set estado = 'publicada', version = 1, publicada_en = now(), publicada_por = v_actor, contexto = private.fb_contexto(s.persona_id)
   where id = s.id
   returning * into s;

  insert into public.fb_minuta_versiones (sesion_id, version, motivo, contenido, autor)
  values (s.id, 1, 'Publicación', private.fb_snapshot(s), v_actor);

  update public.fb_seguimientos
     set estado = 'realizado', sesion_id = s.id
   where persona_id = s.persona_id and estado = 'programado' and fecha <= v_dia;

  if s.proxima_revision is not null then
    insert into public.fb_seguimientos (persona_id, fecha, motivo, origen_sesion_id)
    values (s.persona_id, s.proxima_revision, 'Próxima revisión acordada en la minuta del ' || to_char(v_dia, 'DD/MM/YYYY'), s.id);
  end if;
  return s;
end $$;

-- Edita una minuta ya publicada: guarda una versión nueva (con motivo) y conserva las anteriores.
create or replace function public.fb_editar_sesion_publicada(p_sesion uuid, p_cambios jsonb, p_motivo text)
returns public.fb_sesiones
language plpgsql security definer set search_path = '' as $$
declare
  s public.fb_sesiones;
  v_actor text := private.current_member_id();
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not private.fb_es_lider() then raise exception 'fb_sin_permiso: solo el líder puede editar minutas' using errcode = '42501'; end if;
  select * into s from public.fb_sesiones where id = p_sesion for update;
  if not found then raise exception 'fb_no_existe: la reunión no existe'; end if;
  if s.estado <> 'publicada' then raise exception 'fb_no_publicada: la minuta aún es un borrador; edítala directamente'; end if;
  if length(v_motivo) < 3 then raise exception 'fb_motivo_requerido: indica el motivo de la edición'; end if;

  update public.fb_sesiones set
    tipo = coalesce(nullif(p_cambios->>'tipo', ''), tipo),
    modalidad = coalesce(nullif(p_cambios->>'modalidad', ''), modalidad),
    fecha_hora = coalesce(nullif(p_cambios->>'fecha_hora', '')::timestamptz, fecha_hora),
    participantes = case when p_cambios ? 'participantes' then coalesce(p_cambios->>'participantes', '') else participantes end,
    agenda = case when p_cambios ? 'agenda' then coalesce(p_cambios->>'agenda', '') else agenda end,
    temas = case when p_cambios ? 'temas' then coalesce(p_cambios->>'temas', '') else temas end,
    fortalezas = case when p_cambios ? 'fortalezas' then coalesce(p_cambios->>'fortalezas', '') else fortalezas end,
    logros = case when p_cambios ? 'logros' then coalesce(p_cambios->>'logros', '') else logros end,
    oportunidades = case when p_cambios ? 'oportunidades' then coalesce(p_cambios->>'oportunidades', '') else oportunidades end,
    comentarios_lider = case when p_cambios ? 'comentarios_lider' then coalesce(p_cambios->>'comentarios_lider', '') else comentarios_lider end,
    comentarios_colaborador = case when p_cambios ? 'comentarios_colaborador' then coalesce(p_cambios->>'comentarios_colaborador', '') else comentarios_colaborador end,
    acuerdos = case when p_cambios ? 'acuerdos' then coalesce(p_cambios->>'acuerdos', '') else acuerdos end,
    proximos_pasos = case when p_cambios ? 'proximos_pasos' then coalesce(p_cambios->>'proximos_pasos', '') else proximos_pasos end,
    temas_pendientes = case when p_cambios ? 'temas_pendientes' then coalesce(p_cambios->>'temas_pendientes', '') else temas_pendientes end,
    minuta = case when jsonb_typeof(p_cambios->'minuta') = 'object' then p_cambios->'minuta' else minuta end,
    version = version + 1
  where id = p_sesion
  returning * into s;

  if btrim(coalesce(s.minuta->>'resumen', '')) = '' then raise exception 'fb_minuta_vacia: la minuta necesita al menos el resumen de la conversación'; end if;

  insert into public.fb_minuta_versiones (sesion_id, version, motivo, contenido, autor)
  values (s.id, s.version, v_motivo, private.fb_snapshot(s), v_actor);
  return s;
end $$;

-- Revisión de un compromiso: registra el evento y actualiza estado, avance y fechas en una sola operación.
create or replace function public.fb_revisar_compromiso(p_id uuid, p jsonb)
returns public.fb_compromisos
language plpgsql security definer set search_path = '' as $$
declare
  c public.fb_compromisos;
  v_actor text := private.current_member_id();
  v_hoy date := private.today_cl();
  v_estado text; v_pct int; v_venc date; v_cumpl date; v_prox date;
  v_reprog boolean; v_cierra boolean;
  v_resultado text := btrim(coalesce(p->>'resultado', ''));
begin
  if not private.fb_es_lider() then raise exception 'fb_sin_permiso: solo el líder puede revisar compromisos' using errcode = '42501'; end if;
  select * into c from public.fb_compromisos where id = p_id for update;
  if not found then raise exception 'fb_no_existe: el compromiso no existe'; end if;

  v_estado := coalesce(nullif(p->>'estado_nuevo', ''), c.estado);
  if v_estado not in ('pendiente', 'en_progreso', 'bloqueado', 'cumplido', 'cancelado') then
    raise exception 'fb_estado_invalido: estado no válido (el estado "vencido" se calcula solo por fecha)';
  end if;
  v_pct := coalesce(nullif(p->>'avance_pct', '')::int, c.avance);
  if v_pct < 0 or v_pct > 100 then raise exception 'fb_avance_invalido: el avance debe estar entre 0 y 100'; end if;
  v_cierra := v_estado in ('cumplido', 'cancelado');
  if v_estado = 'cumplido' then v_pct := 100; end if;
  if v_cierra and v_resultado = '' then
    raise exception 'fb_resultado_requerido: para cerrar el compromiso registra su resultado';
  end if;

  v_venc := coalesce(nullif(p->>'vencimiento_nuevo', '')::date, c.fecha_vencimiento);
  v_reprog := v_venc is distinct from c.fecha_vencimiento;
  if v_reprog then
    if v_cierra then raise exception 'fb_fecha_invalida: no se puede reprogramar un compromiso que se está cerrando'; end if;
    if v_venc < v_hoy then raise exception 'fb_fecha_invalida: la nueva fecha comprometida no puede ser anterior a hoy'; end if;
    if btrim(coalesce(p->>'obstaculos', '') || coalesce(p->>'acciones_correctivas', '') || coalesce(p->>'comentarios_lider', '')) = '' then
      raise exception 'fb_motivo_requerido: al reprogramar indica el obstáculo, la acción correctiva o un comentario';
    end if;
  end if;

  v_cumpl := case when v_estado = 'cumplido' then coalesce(nullif(p->>'fecha_cumplimiento', '')::date, v_hoy) else null end;
  if v_cumpl is not null and v_cumpl > v_hoy then raise exception 'fb_fecha_invalida: la fecha de cumplimiento no puede estar en el futuro'; end if;

  v_prox := case when v_cierra then null when p ? 'proxima_revision' then nullif(p->>'proxima_revision', '')::date else c.fecha_proxima_revision end;
  if v_prox is not null and v_prox < v_hoy and v_prox is distinct from c.fecha_proxima_revision then
    raise exception 'fb_fecha_invalida: la próxima revisión no puede ser anterior a hoy';
  end if;

  insert into public.fb_compromiso_revisiones (
    compromiso_id, persona_id, fecha, avance_texto, avance_anterior, avance_pct, estado_anterior, estado_nuevo,
    obstaculos, evidencias, comentarios_lider, comentarios_integrante, acciones_correctivas,
    vencimiento_anterior, vencimiento_nuevo, resultado, autor
  ) values (
    c.id, c.persona_id, v_hoy, btrim(coalesce(p->>'avance_texto', '')), c.avance, v_pct, c.estado, v_estado,
    btrim(coalesce(p->>'obstaculos', '')), btrim(coalesce(p->>'evidencias', '')), btrim(coalesce(p->>'comentarios_lider', '')),
    btrim(coalesce(p->>'comentarios_integrante', '')), btrim(coalesce(p->>'acciones_correctivas', '')),
    c.fecha_vencimiento, v_venc, v_resultado, v_actor
  );

  update public.fb_compromisos set
    estado = v_estado, avance = v_pct, fecha_vencimiento = v_venc,
    reprogramaciones = reprogramaciones + case when v_reprog then 1 else 0 end,
    fecha_ultima_revision = v_hoy, fecha_proxima_revision = v_prox,
    resultado_final = case when v_cierra then v_resultado else '' end,
    fecha_cumplimiento = v_cumpl
  where id = c.id
  returning * into c;
  return c;
end $$;

-- Qué puede hacer quien está conectado (la pantalla lo usa para decidir qué mostrar; la seguridad real son las políticas)
create or replace function public.fb_mi_acceso()
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'es_lider', (select private.fb_es_lider()),
    'member_id', (select private.current_member_id()),
    'persona_id', (select p.id from public.fb_personas p where p.member_id is not null and p.member_id = (select private.current_member_id()) limit 1)
  )
$$;

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------
revoke all on public.fb_lideres, public.fb_personas, public.fb_roles, public.fb_persona_roles, public.fb_objetivos,
              public.fb_objetivo_roles, public.fb_sesiones, public.fb_minuta_versiones, public.fb_compromisos,
              public.fb_compromiso_revisiones, public.fb_seguimientos, public.fb_notas_privadas, public.fb_config,
              public.fb_auditoria from anon, authenticated;

grant select on public.fb_lideres, public.fb_personas, public.fb_roles, public.fb_persona_roles, public.fb_objetivos,
                public.fb_objetivo_roles, public.fb_sesiones, public.fb_minuta_versiones, public.fb_compromisos,
                public.fb_compromiso_revisiones, public.fb_seguimientos, public.fb_notas_privadas, public.fb_config,
                public.fb_auditoria to authenticated;

grant insert (member_id, nombre, cargo, area, fecha_incorporacion, lider_member_id, estado, color) on public.fb_personas to authenticated;
grant update (member_id, nombre, cargo, area, fecha_incorporacion, lider_member_id, estado, color) on public.fb_personas to authenticated;

grant insert (nombre, descripcion, responsabilidades, expectativas, activo) on public.fb_roles to authenticated;
grant update (nombre, descripcion, responsabilidades, expectativas, activo) on public.fb_roles to authenticated;

grant insert (persona_id, rol_id, fecha_asignacion, responsabilidades, expectativas) on public.fb_persona_roles to authenticated;
grant update (fecha_asignacion, fecha_termino, estado, responsabilidades, expectativas) on public.fb_persona_roles to authenticated;

grant insert (persona_id, titulo, descripcion, resultado_esperado, prioridad, fecha_objetivo, estado, avance, criterios_exito, observaciones, categoria) on public.fb_objetivos to authenticated;
grant update (titulo, descripcion, resultado_esperado, prioridad, fecha_objetivo, estado, avance, criterios_exito, observaciones, categoria) on public.fb_objetivos to authenticated;

grant insert, delete on public.fb_objetivo_roles to authenticated;

grant insert (persona_id, fecha_hora, tipo, modalidad, participantes, agenda, temas, fortalezas, logros, oportunidades, comentarios_lider,
              comentarios_colaborador, acuerdos, proximos_pasos, temas_pendientes, proxima_revision, minuta, compromisos_borrador)
  on public.fb_sesiones to authenticated;
grant update (fecha_hora, tipo, modalidad, participantes, agenda, temas, fortalezas, logros, oportunidades, comentarios_lider,
              comentarios_colaborador, acuerdos, proximos_pasos, temas_pendientes, proxima_revision, minuta, compromisos_borrador)
  on public.fb_sesiones to authenticated;
grant delete on public.fb_sesiones to authenticated;

grant insert (persona_id, objetivo_id, descripcion, categoria, prioridad, fecha_vencimiento, fecha_proxima_revision, evidencias) on public.fb_compromisos to authenticated;
grant update (objetivo_id, descripcion, categoria, prioridad, fecha_proxima_revision, evidencias) on public.fb_compromisos to authenticated;

grant insert (persona_id, fecha, hora, motivo) on public.fb_seguimientos to authenticated;
grant update (fecha, hora, motivo, estado) on public.fb_seguimientos to authenticated;

grant insert (persona_id, sesion_id, cuerpo) on public.fb_notas_privadas to authenticated;
grant update (cuerpo) on public.fb_notas_privadas to authenticated;
grant delete on public.fb_notas_privadas to authenticated;

grant insert (clave, valor) on public.fb_config to authenticated;
grant update (valor) on public.fb_config to authenticated;

alter table public.fb_lideres               enable row level security;
alter table public.fb_personas              enable row level security;
alter table public.fb_roles                 enable row level security;
alter table public.fb_persona_roles         enable row level security;
alter table public.fb_objetivos             enable row level security;
alter table public.fb_objetivo_roles        enable row level security;
alter table public.fb_sesiones              enable row level security;
alter table public.fb_minuta_versiones      enable row level security;
alter table public.fb_compromisos           enable row level security;
alter table public.fb_compromiso_revisiones enable row level security;
alter table public.fb_seguimientos          enable row level security;
alter table public.fb_notas_privadas        enable row level security;
alter table public.fb_config                enable row level security;
alter table public.fb_auditoria             enable row level security;

-- Solo el líder
create policy fb_lideres_select on public.fb_lideres for select to authenticated using ((select private.fb_es_lider()));
create policy fb_config_select on public.fb_config for select to authenticated using ((select private.fb_es_lider()));
create policy fb_config_insert on public.fb_config for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_config_update on public.fb_config for update to authenticated
  using ((select private.fb_es_lider())) with check ((select private.fb_es_lider()));
create policy fb_notas_select on public.fb_notas_privadas for select to authenticated using ((select private.fb_es_lider()));
create policy fb_notas_insert on public.fb_notas_privadas for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_notas_update on public.fb_notas_privadas for update to authenticated
  using ((select private.fb_es_lider())) with check ((select private.fb_es_lider()));
create policy fb_notas_delete on public.fb_notas_privadas for delete to authenticated using ((select private.fb_es_lider()));
create policy fb_auditoria_select on public.fb_auditoria for select to authenticated using ((select private.fb_es_lider()));

-- Líder: todo. Integrante: solo lo suyo, en lectura.
create policy fb_personas_select on public.fb_personas for select to authenticated
  using ((select private.fb_es_lider()) or (member_id is not null and member_id = (select private.current_member_id())));
create policy fb_personas_insert on public.fb_personas for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_personas_update on public.fb_personas for update to authenticated
  using ((select private.fb_es_lider())) with check ((select private.fb_es_lider()));

create policy fb_roles_select on public.fb_roles for select to authenticated
  using ((select private.fb_es_lider()) or (select private.fb_rol_visible(id)));
create policy fb_roles_insert on public.fb_roles for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_roles_update on public.fb_roles for update to authenticated
  using ((select private.fb_es_lider())) with check ((select private.fb_es_lider()));

create policy fb_persona_roles_select on public.fb_persona_roles for select to authenticated
  using ((select private.fb_es_lider()) or (select private.fb_es_mi_persona(persona_id)));
create policy fb_persona_roles_insert on public.fb_persona_roles for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_persona_roles_update on public.fb_persona_roles for update to authenticated
  using ((select private.fb_es_lider())) with check ((select private.fb_es_lider()));

create policy fb_objetivos_select on public.fb_objetivos for select to authenticated
  using ((select private.fb_es_lider()) or (select private.fb_es_mi_persona(persona_id)));
create policy fb_objetivos_insert on public.fb_objetivos for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_objetivos_update on public.fb_objetivos for update to authenticated
  using ((select private.fb_es_lider())) with check ((select private.fb_es_lider()));

create policy fb_objetivo_roles_select on public.fb_objetivo_roles for select to authenticated
  using ((select private.fb_es_lider()) or (select private.fb_es_mi_objetivo(objetivo_id)));
create policy fb_objetivo_roles_insert on public.fb_objetivo_roles for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_objetivo_roles_delete on public.fb_objetivo_roles for delete to authenticated using ((select private.fb_es_lider()));

-- Minutas: el integrante solo ve las ya publicadas; los borradores son del líder. Una minuta publicada no se edita ni borra por esta vía.
create policy fb_sesiones_select on public.fb_sesiones for select to authenticated
  using ((select private.fb_es_lider()) or (estado = 'publicada' and (select private.fb_es_mi_persona(persona_id))));
create policy fb_sesiones_insert on public.fb_sesiones for insert to authenticated
  with check ((select private.fb_es_lider()) and estado = 'borrador');
create policy fb_sesiones_update on public.fb_sesiones for update to authenticated
  using ((select private.fb_es_lider()) and estado = 'borrador') with check ((select private.fb_es_lider()) and estado = 'borrador');
create policy fb_sesiones_delete on public.fb_sesiones for delete to authenticated
  using ((select private.fb_es_lider()) and estado = 'borrador');

create policy fb_minutas_select on public.fb_minuta_versiones for select to authenticated
  using ((select private.fb_es_lider()) or (select private.fb_sesion_visible(sesion_id)));

create policy fb_compromisos_select on public.fb_compromisos for select to authenticated
  using ((select private.fb_es_lider()) or (select private.fb_es_mi_persona(persona_id)));
create policy fb_compromisos_insert on public.fb_compromisos for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_compromisos_update on public.fb_compromisos for update to authenticated
  using ((select private.fb_es_lider())) with check ((select private.fb_es_lider()));

create policy fb_revisiones_select on public.fb_compromiso_revisiones for select to authenticated
  using ((select private.fb_es_lider()) or (select private.fb_es_mi_persona(persona_id)));

create policy fb_seguimientos_select on public.fb_seguimientos for select to authenticated
  using ((select private.fb_es_lider()) or (select private.fb_es_mi_persona(persona_id)));
create policy fb_seguimientos_insert on public.fb_seguimientos for insert to authenticated with check ((select private.fb_es_lider()));
create policy fb_seguimientos_update on public.fb_seguimientos for update to authenticated
  using ((select private.fb_es_lider())) with check ((select private.fb_es_lider()));

-- -----------------------------------------------------------------------------
-- Tiempo real (las políticas RLS también filtran lo que llega a cada persona)
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.fb_personas, public.fb_roles, public.fb_persona_roles, public.fb_objetivos, public.fb_sesiones,
  public.fb_compromisos, public.fb_compromiso_revisiones, public.fb_seguimientos;

-- -----------------------------------------------------------------------------
-- Datos iniciales
--   * El líder se identifica por el miembro del equipo "cristobal_cuevas" (cuenta enlazada en team_members).
--   * Una ficha por cada miembro actual del equipo; el líder responsable de las demás es ese mismo miembro (editable).
--   * No se cargan roles, objetivos ni feedback: esos datos los registra el líder.
-- -----------------------------------------------------------------------------
insert into public.fb_lideres (member_id)
select id from public.team_members where id = 'cristobal_cuevas'
on conflict do nothing;

insert into public.fb_personas (member_id, nombre, cargo, color, lider_member_id)
select t.id, t.name, t.role,
       case when t.color in ('blue','pink','amber','emerald','violet','cyan','orange','slate') then t.color else 'slate' end,
       case when t.id <> 'cristobal_cuevas' and exists (select 1 from public.team_members x where x.id = 'cristobal_cuevas') then 'cristobal_cuevas' end
from public.team_members t
on conflict (member_id) do nothing;

insert into public.fb_config (clave, valor) values
  ('dias_sin_feedback', '{"dias":30}'),
  ('dias_aviso_vencimiento', '{"dias":7}'),
  ('dias_objetivo_sin_actualizar', '{"dias":30}')
on conflict (clave) do nothing;

-- -----------------------------------------------------------------------------
-- Endurecer funciones internas: solo las que usan las políticas son invocables por usuarios
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_member_id() to authenticated;
grant execute on function private.is_member() to authenticated;
grant execute on function private.today_cl() to authenticated;
grant execute on function private.fb_es_lider() to authenticated;
grant execute on function private.fb_es_mi_persona(uuid) to authenticated;
grant execute on function private.fb_es_mi_objetivo(uuid) to authenticated;
grant execute on function private.fb_rol_visible(uuid) to authenticated;
grant execute on function private.fb_sesion_visible(uuid) to authenticated;

revoke all on function public.fb_publicar_sesion(uuid) from public, anon;
revoke all on function public.fb_editar_sesion_publicada(uuid, jsonb, text) from public, anon;
revoke all on function public.fb_revisar_compromiso(uuid, jsonb) from public, anon;
revoke all on function public.fb_mi_acceso() from public, anon;
grant execute on function public.fb_publicar_sesion(uuid) to authenticated;
grant execute on function public.fb_editar_sesion_publicada(uuid, jsonb, text) to authenticated;
grant execute on function public.fb_revisar_compromiso(uuid, jsonb) to authenticated;
grant execute on function public.fb_mi_acceso() to authenticated;
