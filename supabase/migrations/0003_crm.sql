-- =============================================================================
-- PROGRAMACIÓN CRM — tablas nuevas (solo agrega; no modifica datos del roadmap)
--   * catálogos editables, responsables, mailings, comentarios por semana
--   * feriados, reglas de días de pago, pronóstico del clima por comuna
--   * historial de cambios y avisos dentro de la app
--   * RLS: solo integrantes del equipo (private.is_member) — mismas reglas que el roadmap
--   * cambio menor en tablas existentes: `notifications` admite 2 tipos nuevos y una columna `link`
-- Depende de 0001_schema.sql (private.is_member, private.current_member_id, private.today_cl,
-- private.push_notification).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Avisos de Programación CRM dentro del centro de notificaciones existente
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('assigned','priority','mention','blocked','p0','rompelinea','crm_comment','crm_reminder'));
alter table public.notifications add column if not exists link text;

-- -----------------------------------------------------------------------------
-- Regiones y comunas (de la maestra de tiendas, solo conteos y ubicación)
-- -----------------------------------------------------------------------------
create table public.crm_regiones (
  id      text primary key,
  nombre  text not null,
  orden   int  not null
);

create table public.crm_comunas (
  id                bigint generated always as identity primary key,
  region_id         text not null references public.crm_regiones (id),
  nombre            text not null,
  tiendas_abiertas  int  not null default 0 check (tiendas_abiertas >= 0),
  tiendas_total     int  not null default 0 check (tiendas_total >= 0),
  lat               numeric(8,5) not null check (lat between -56 and -17),
  lon               numeric(8,5) not null check (lon between -110 and -66),
  geo_fuente        text not null default 'Coordenada aproximada del centro de la comuna; sin validar contra una fuente oficial',
  unique (region_id, nombre)
);
create index crm_comunas_region_idx on public.crm_comunas (region_id);

-- -----------------------------------------------------------------------------
-- Catálogos editables (títulos, Einstein, configuración, estados, marcas, canales)
-- -----------------------------------------------------------------------------
create table public.crm_catalogo (
  id          uuid primary key default gen_random_uuid(),
  lista       text not null check (lista in ('titulo','einstein','configuracion','estado','marca','canal')),
  nombre      text not null check (length(btrim(nombre)) > 0),
  definicion  text not null default '',
  color       text not null default 'slate',
  semantica   text check (semantica in ('pendiente','enviado','cancelado','otro')),
  orden       int  not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text references public.team_members (id) on delete set null default private.current_member_id(),
  updated_at  timestamptz not null default now(),
  updated_by  text references public.team_members (id) on delete set null,
  check (lista = 'estado' or semantica is null),
  check (lista <> 'estado' or semantica is not null)
);
create unique index crm_catalogo_nombre_key on public.crm_catalogo (lista, lower(btrim(nombre)));
create index crm_catalogo_created_by_idx on public.crm_catalogo (created_by);
create index crm_catalogo_updated_by_idx on public.crm_catalogo (updated_by);

create table public.crm_responsables (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(btrim(nombre)) > 0),
  iniciales   text not null check (length(btrim(iniciales)) between 1 and 4),
  email       text check (email is null or length(btrim(email)) > 0),
  color       text not null default 'slate',
  member_id   text unique references public.team_members (id) on delete set null,
  orden       int  not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text references public.team_members (id) on delete set null default private.current_member_id(),
  updated_at  timestamptz not null default now(),
  updated_by  text references public.team_members (id) on delete set null
);
create unique index crm_responsables_iniciales_key on public.crm_responsables (lower(btrim(iniciales))) where activo;
create index crm_responsables_created_by_idx on public.crm_responsables (created_by);
create index crm_responsables_updated_by_idx on public.crm_responsables (updated_by);

-- -----------------------------------------------------------------------------
-- Mailings
-- -----------------------------------------------------------------------------
create table public.crm_mailings (
  id                  uuid primary key default gen_random_uuid(),
  fecha               date not null,
  hora                time,
  titulo_id           uuid not null references public.crm_catalogo (id) on delete restrict,
  responsable_id      uuid references public.crm_responsables (id) on delete set null,
  einstein_id         uuid references public.crm_catalogo (id) on delete set null,
  configuracion_id    uuid references public.crm_catalogo (id) on delete set null,
  estado_id           uuid not null references public.crm_catalogo (id) on delete restrict,
  segmento            text not null default '',
  marca_id            uuid references public.crm_catalogo (id) on delete set null,
  objetivo            text not null default '',
  canal_id            uuid references public.crm_catalogo (id) on delete set null,
  observaciones       text not null default '',
  enviado_en          date,
  id_externo          text not null default '',
  duplicado_de        uuid references public.crm_mailings (id) on delete set null,
  estado_cambiado_por text references public.team_members (id) on delete set null,
  estado_cambiado_en  timestamptz,
  created_at          timestamptz not null default now(),
  created_by          text references public.team_members (id) on delete set null default private.current_member_id(),
  updated_at          timestamptz not null default now(),
  updated_by          text references public.team_members (id) on delete set null
);
create index crm_mailings_fecha_idx          on public.crm_mailings (fecha);
create index crm_mailings_titulo_idx         on public.crm_mailings (titulo_id);
create index crm_mailings_responsable_idx    on public.crm_mailings (responsable_id);
create index crm_mailings_estado_idx         on public.crm_mailings (estado_id);
create index crm_mailings_einstein_idx       on public.crm_mailings (einstein_id);
create index crm_mailings_configuracion_idx  on public.crm_mailings (configuracion_id);
create index crm_mailings_marca_idx          on public.crm_mailings (marca_id);
create index crm_mailings_canal_idx          on public.crm_mailings (canal_id);
create index crm_mailings_duplicado_idx      on public.crm_mailings (duplicado_de);
create index crm_mailings_estado_por_idx     on public.crm_mailings (estado_cambiado_por);
create index crm_mailings_created_by_idx     on public.crm_mailings (created_by);
create index crm_mailings_updated_by_idx     on public.crm_mailings (updated_by);

-- -----------------------------------------------------------------------------
-- Comentarios por semana (lunes a domingo) y registro de correos
-- -----------------------------------------------------------------------------
create table public.crm_comentarios_semana (
  id                 uuid primary key default gen_random_uuid(),
  semana             date not null check (extract(isodow from semana) = 1),
  cuerpo             text not null check (length(btrim(cuerpo)) > 0),
  autor              text references public.team_members (id) on delete set null default private.current_member_id(),
  responsable_id     uuid references public.crm_responsables (id) on delete set null,
  correo_responsable text,
  estado             text not null default 'Pendiente' check (estado in ('Pendiente','En seguimiento','Resuelto')),
  avisar             boolean not null default true,
  resuelto_por       text references public.team_members (id) on delete set null,
  resuelto_en        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         text references public.team_members (id) on delete set null
);
create index crm_comentarios_semana_idx       on public.crm_comentarios_semana (semana);
create index crm_comentarios_autor_idx        on public.crm_comentarios_semana (autor);
create index crm_comentarios_responsable_idx  on public.crm_comentarios_semana (responsable_id);
create index crm_comentarios_resuelto_por_idx on public.crm_comentarios_semana (resuelto_por);
create index crm_comentarios_updated_by_idx   on public.crm_comentarios_semana (updated_by);

-- Un correo por comentario, destinatario y tipo: la llave única evita envíos duplicados.
-- Lo escribe solo la función de correo (clave de servicio); el equipo solo lo lee.
create table public.crm_correos (
  id           uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references public.crm_comentarios_semana (id) on delete cascade,
  destinatario text not null,
  tipo         text not null default 'asignacion' check (tipo in ('asignacion','recordatorio')),
  estado       text not null default 'pendiente' check (estado in ('pendiente','enviado','fallido','omitido')),
  detalle      text not null default '',
  proveedor_id text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (comentario_id, destinatario, tipo)
);

-- -----------------------------------------------------------------------------
-- Feriados, reglas de oportunidad (días de pago) y ajustes manuales
-- -----------------------------------------------------------------------------
create table public.crm_feriados (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,
  nombre        text not null check (length(btrim(nombre)) > 0),
  ambito        text not null check (ambito in ('nacional','regional')),
  region_id     text references public.crm_regiones (id),
  alcance       text not null default '',
  irrenunciable boolean not null default false,
  fuente        text not null default '',
  verificado    boolean not null default false,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    text references public.team_members (id) on delete set null default private.current_member_id(),
  updated_at    timestamptz not null default now(),
  updated_by    text references public.team_members (id) on delete set null,
  check (ambito = 'nacional' or region_id is not null)
);
create unique index crm_feriados_unico on public.crm_feriados (fecha, lower(btrim(nombre)), coalesce(region_id, ''));
create index crm_feriados_region_idx     on public.crm_feriados (region_id);
create index crm_feriados_created_by_idx on public.crm_feriados (created_by);
create index crm_feriados_updated_by_idx on public.crm_feriados (updated_by);

create table public.crm_reglas_oportunidad (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (length(btrim(nombre)) > 0),
  nivel         text not null check (nivel in ('alta','media')),
  tipo          text not null check (tipo in ('ultimo_habil','primeros_habiles','previos_ultimo_habil','habiles_rango','dias_del_mes','fin_de_semana_tras_pago')),
  params        jsonb not null default '{}'::jsonb,
  justificacion text not null default '',
  activo        boolean not null default true,
  orden         int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text references public.team_members (id) on delete set null
);
create index crm_reglas_updated_by_idx on public.crm_reglas_oportunidad (updated_by);

create table public.crm_oportunidad_manual (
  fecha       date primary key,
  nivel       text not null check (nivel in ('alta','media','normal')),
  motivo      text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text references public.team_members (id) on delete set null
);
create index crm_oportunidad_manual_updated_by_idx on public.crm_oportunidad_manual (updated_by);

create table public.crm_config (
  clave       text primary key,
  valor       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text references public.team_members (id) on delete set null
);
create index crm_config_updated_by_idx on public.crm_config (updated_by);

-- -----------------------------------------------------------------------------
-- Clima: pronóstico por comuna (con historial) y registro de cada corrida
-- -----------------------------------------------------------------------------
create table public.crm_clima_pronostico (
  comuna_id    bigint not null references public.crm_comunas (id) on delete cascade,
  fecha        date   not null,
  obtenido_el  date   not null,
  prob_precip  smallint check (prob_precip between 0 and 100),
  mm           numeric(6,1) check (mm >= 0),
  tmin         numeric(4,1),
  tmax         numeric(4,1),
  fuente       text not null,
  obtenido_en  timestamptz not null default now(),
  primary key (comuna_id, fecha, obtenido_el)
);
create index crm_clima_fecha_idx on public.crm_clima_pronostico (fecha);

create view public.crm_clima_vigente with (security_invoker = true) as
  select distinct on (comuna_id, fecha) comuna_id, fecha, obtenido_el, prob_precip, mm, tmin, tmax, fuente, obtenido_en
  from public.crm_clima_pronostico
  order by comuna_id, fecha, obtenido_el desc;

create table public.crm_clima_ejecuciones (
  id          uuid primary key default gen_random_uuid(),
  inicio      timestamptz not null default now(),
  fin         timestamptz,
  estado      text not null default 'en_curso' check (estado in ('en_curso','ok','parcial','error')),
  fuente      text not null default '',
  comunas_ok  int not null default 0,
  comunas_error int not null default 0,
  detalle     text not null default ''
);
create index crm_clima_ejecuciones_inicio_idx on public.crm_clima_ejecuciones (inicio desc);

-- -----------------------------------------------------------------------------
-- Historial de cambios (mailings, comentarios, catálogos, reglas, feriados)
-- -----------------------------------------------------------------------------
create table public.crm_historial (
  id          uuid primary key default gen_random_uuid(),
  entidad     text not null check (entidad in ('mailing','comentario','catalogo','responsable','feriado','regla','manual','config')),
  entidad_id  text not null,
  campo       text not null,
  desde       text,
  hasta       text,
  actor       text references public.team_members (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index crm_historial_entidad_idx on public.crm_historial (entidad, entidad_id, created_at);
create index crm_historial_actor_idx   on public.crm_historial (actor);

-- =============================================================================
-- Funciones internas
-- =============================================================================
create or replace function private.crm_check_lista(p_id uuid, p_lista text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_id is not null and not exists (select 1 from public.crm_catalogo where id = p_id and lista = p_lista) then
    raise exception 'crm_lista_invalida: el valor elegido no pertenece al catálogo "%"', p_lista using errcode = 'P0001';
  end if;
end $$;

create or replace function private.crm_valor(p_campo text, p_valor text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_valor is null then null
    when p_campo in ('titulo_id','einstein_id','configuracion_id','estado_id','marca_id','canal_id')
      then coalesce((select nombre from public.crm_catalogo where id = p_valor::uuid), p_valor)
    when p_campo = 'responsable_id'
      then coalesce((select nombre from public.crm_responsables where id = p_valor::uuid), p_valor)
    else p_valor
  end
$$;

create or replace function private.crm_resumen(p_ent text, p jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select case p_ent
    when 'mailing'     then coalesce((select nombre from public.crm_catalogo where id = (p->>'titulo_id')::uuid), 'Mailing') || ' · ' || (p->>'fecha')
    when 'comentario'  then 'Comentario de la semana del ' || (p->>'semana')
    when 'feriado'     then (p->>'nombre') || ' · ' || (p->>'fecha')
    when 'manual'      then (p->>'fecha') || ': ' || (p->>'nivel')
    when 'regla'       then coalesce(p->>'nombre', 'Regla')
    when 'catalogo'    then (p->>'lista') || ': ' || (p->>'nombre')
    when 'responsable' then p->>'nombre'
    else p_ent
  end
$$;

-- Historial genérico: una fila por campo que cambió, con los nombres ya resueltos
create or replace function private.crm_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ent   text := tg_argv[0];
  v_pk    text := tg_argv[1];
  v_actor text := private.current_member_id();
  o jsonb; n jsonb; k text;
begin
  if coalesce(current_setting('app.crm_seed', true), '') = 'on' then return null; end if;
  if tg_op = 'DELETE' then
    o := to_jsonb(old);
    insert into public.crm_historial (entidad, entidad_id, campo, desde, hasta, actor)
    values (v_ent, o->>v_pk, 'eliminado', private.crm_resumen(v_ent, o), null, v_actor);
    return null;
  end if;
  n := to_jsonb(new);
  if tg_op = 'INSERT' then
    insert into public.crm_historial (entidad, entidad_id, campo, desde, hasta, actor)
    values (v_ent, n->>v_pk, 'creacion', null, private.crm_resumen(v_ent, n), v_actor);
    return null;
  end if;
  o := to_jsonb(old);
  for k in select jsonb_object_keys(n) loop
    continue when k in ('updated_at','updated_by','created_at','created_by','estado_cambiado_por','estado_cambiado_en','correo_responsable','resuelto_por','resuelto_en');
    if (n->k) is distinct from (o->k) then
      insert into public.crm_historial (entidad, entidad_id, campo, desde, hasta, actor)
      values (v_ent, n->>v_pk, k, private.crm_valor(k, o->>k), private.crm_valor(k, n->>k), v_actor);
    end if;
  end loop;
  return null;
end $$;

-- Sellos de edición (quién y cuándo)
create or replace function private.crm_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_member text := private.current_member_id();
begin
  if tg_op = 'INSERT' then
    new.updated_by := coalesce(v_member, new.updated_by);
  else
    new.created_at := old.created_at;
    new.updated_at := now();
    new.updated_by := coalesce(v_member, old.updated_by);
  end if;
  return new;
end $$;

create or replace function private.crm_trim_nombre() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.nombre := btrim(new.nombre);
  return new;
end $$;

-- Mailings: validación de catálogos, estado y sellos
create or replace function private.crm_mailings_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_member text := private.current_member_id(); v_sem text;
begin
  new.segmento      := btrim(coalesce(new.segmento, ''));
  new.objetivo      := btrim(coalesce(new.objetivo, ''));
  new.observaciones := btrim(coalesce(new.observaciones, ''));
  new.id_externo    := btrim(coalesce(new.id_externo, ''));

  perform private.crm_check_lista(new.titulo_id, 'titulo');
  perform private.crm_check_lista(new.einstein_id, 'einstein');
  perform private.crm_check_lista(new.configuracion_id, 'configuracion');
  perform private.crm_check_lista(new.estado_id, 'estado');
  perform private.crm_check_lista(new.marca_id, 'marca');
  perform private.crm_check_lista(new.canal_id, 'canal');

  if tg_op = 'INSERT' then
    new.created_by := coalesce(v_member, new.created_by);
    new.updated_by := coalesce(v_member, new.updated_by);
    new.estado_cambiado_por := v_member;
    new.estado_cambiado_en := now();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(v_member, old.updated_by);
    if new.estado_id is distinct from old.estado_id then
      new.estado_cambiado_por := v_member;
      new.estado_cambiado_en := now();
    else
      new.estado_cambiado_por := old.estado_cambiado_por;
      new.estado_cambiado_en := old.estado_cambiado_en;
    end if;
  end if;

  select semantica into v_sem from public.crm_catalogo where id = new.estado_id;
  if v_sem = 'enviado' and new.enviado_en is null then
    new.enviado_en := private.today_cl();
  end if;
  return new;
end $$;

-- Comentarios: correo del responsable, permisos de edición y cierre
create or replace function private.crm_comentarios_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_member text := private.current_member_id();
begin
  new.cuerpo := btrim(new.cuerpo);
  if new.responsable_id is not null then
    select email into new.correo_responsable from public.crm_responsables where id = new.responsable_id;
  else
    new.correo_responsable := null;
  end if;

  if tg_op = 'INSERT' then
    new.updated_by := coalesce(v_member, new.updated_by);
    if new.estado = 'Resuelto' then new.resuelto_por := v_member; new.resuelto_en := now(); end if;
    return new;
  end if;

  -- Solo quien escribió el comentario puede cambiar su texto, semana o responsable;
  -- cualquier integrante puede cambiar el seguimiento.
  if (new.cuerpo is distinct from old.cuerpo or new.semana is distinct from old.semana
      or new.responsable_id is distinct from old.responsable_id or new.autor is distinct from old.autor)
     and old.autor is distinct from v_member then
    raise exception 'crm_sin_permiso: solo quien escribió el comentario puede editar su contenido' using errcode = '42501';
  end if;
  new.autor := old.autor;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.updated_by := coalesce(v_member, old.updated_by);
  if new.estado = 'Resuelto' and old.estado is distinct from 'Resuelto' then
    new.resuelto_por := v_member; new.resuelto_en := now();
  elsif new.estado <> 'Resuelto' then
    new.resuelto_por := null; new.resuelto_en := null;
  else
    new.resuelto_por := old.resuelto_por; new.resuelto_en := old.resuelto_en;
  end if;
  return new;
end $$;

-- Aviso dentro de la app cuando se asigna un comentario a una persona con cuenta
create or replace function private.crm_comentarios_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_member text; v_actor text := private.current_member_id(); v_name text; v_semana text;
begin
  if new.responsable_id is null or not new.avisar then return null; end if;
  if tg_op = 'UPDATE' and new.responsable_id is not distinct from old.responsable_id then return null; end if;
  select member_id into v_member from public.crm_responsables where id = new.responsable_id;
  if v_member is null or v_member = v_actor then return null; end if;
  select name into v_name from public.team_members where id = coalesce(v_actor, new.autor);
  v_semana := to_char(new.semana, 'DD/MM/YYYY');
  insert into public.notifications (type, task_id, task_title, actor, target, message, link)
  values ('crm_comment', null, 'Semana del ' || v_semana, v_actor, v_member,
          coalesce(v_name, 'Alguien') || ' te asignó un comentario de la semana del ' || v_semana,
          'crm/comentario/' || new.id::text);
  return null;
end $$;

create or replace function private.crm_clima_ultima() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select max(fin) from public.crm_clima_ejecuciones where estado in ('ok','parcial')
$$;

-- =============================================================================
-- Triggers
-- =============================================================================
create trigger crm_catalogo_trim   before insert or update on public.crm_catalogo    for each row execute function private.crm_trim_nombre();
create trigger crm_responsables_trim before insert or update on public.crm_responsables for each row execute function private.crm_trim_nombre();
create trigger crm_touch           before insert or update on public.crm_catalogo    for each row execute function private.crm_touch();
create trigger crm_touch           before insert or update on public.crm_responsables for each row execute function private.crm_touch();
create trigger crm_touch           before insert or update on public.crm_feriados     for each row execute function private.crm_touch();
create trigger crm_touch           before insert or update on public.crm_reglas_oportunidad for each row execute function private.crm_touch();
create trigger crm_touch           before insert or update on public.crm_oportunidad_manual for each row execute function private.crm_touch();
create trigger crm_touch           before insert or update on public.crm_config       for each row execute function private.crm_touch();

create trigger crm_mailings_before before insert or update on public.crm_mailings for each row execute function private.crm_mailings_before();
create trigger crm_comentarios_before before insert or update on public.crm_comentarios_semana for each row execute function private.crm_comentarios_before();

create trigger crm_log after insert or update on public.crm_mailings              for each row execute function private.crm_log('mailing', 'id');
create trigger crm_log after insert or update on public.crm_comentarios_semana    for each row execute function private.crm_log('comentario', 'id');
create trigger crm_log after insert or update or delete on public.crm_catalogo    for each row execute function private.crm_log('catalogo', 'id');
create trigger crm_log after insert or update on public.crm_responsables          for each row execute function private.crm_log('responsable', 'id');
create trigger crm_log after insert or update or delete on public.crm_feriados    for each row execute function private.crm_log('feriado', 'id');
create trigger crm_log after insert or update or delete on public.crm_reglas_oportunidad for each row execute function private.crm_log('regla', 'id');
create trigger crm_log after insert or update or delete on public.crm_oportunidad_manual for each row execute function private.crm_log('manual', 'fecha');
create trigger crm_log after insert or update on public.crm_config                for each row execute function private.crm_log('config', 'clave');

create trigger crm_comentarios_notify after insert or update on public.crm_comentarios_semana
  for each row execute function private.crm_comentarios_notify();

-- =============================================================================
-- Permisos y RLS (mismas reglas que el roadmap: solo integrantes del equipo)
-- =============================================================================
revoke all on public.crm_regiones, public.crm_comunas, public.crm_catalogo, public.crm_responsables,
              public.crm_mailings, public.crm_comentarios_semana, public.crm_correos, public.crm_feriados,
              public.crm_reglas_oportunidad, public.crm_oportunidad_manual, public.crm_config,
              public.crm_clima_pronostico, public.crm_clima_vigente, public.crm_clima_ejecuciones,
              public.crm_historial from anon, authenticated;

grant select on public.crm_regiones, public.crm_comunas, public.crm_correos, public.crm_clima_pronostico,
                public.crm_clima_vigente, public.crm_clima_ejecuciones, public.crm_historial to authenticated;
grant update (lat, lon, geo_fuente) on public.crm_comunas to authenticated;
grant select, insert, update on public.crm_catalogo, public.crm_responsables, public.crm_mailings,
                                public.crm_comentarios_semana, public.crm_config to authenticated;
grant select, insert, update, delete on public.crm_feriados, public.crm_reglas_oportunidad,
                                        public.crm_oportunidad_manual to authenticated;

alter table public.crm_regiones            enable row level security;
alter table public.crm_comunas             enable row level security;
alter table public.crm_catalogo            enable row level security;
alter table public.crm_responsables        enable row level security;
alter table public.crm_mailings            enable row level security;
alter table public.crm_comentarios_semana  enable row level security;
alter table public.crm_correos             enable row level security;
alter table public.crm_feriados            enable row level security;
alter table public.crm_reglas_oportunidad  enable row level security;
alter table public.crm_oportunidad_manual  enable row level security;
alter table public.crm_config              enable row level security;
alter table public.crm_clima_pronostico    enable row level security;
alter table public.crm_clima_ejecuciones   enable row level security;
alter table public.crm_historial           enable row level security;

-- Solo lectura para el equipo
create policy crm_regiones_select  on public.crm_regiones  for select to authenticated using ((select private.is_member()));
create policy crm_comunas_select   on public.crm_comunas   for select to authenticated using ((select private.is_member()));
create policy crm_comunas_update   on public.crm_comunas   for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy crm_correos_select   on public.crm_correos   for select to authenticated using ((select private.is_member()));
create policy crm_clima_select     on public.crm_clima_pronostico  for select to authenticated using ((select private.is_member()));
create policy crm_clima_ejec_select on public.crm_clima_ejecuciones for select to authenticated using ((select private.is_member()));
create policy crm_historial_select on public.crm_historial for select to authenticated using ((select private.is_member()));

-- Lectura y escritura para el equipo
create policy crm_catalogo_select on public.crm_catalogo for select to authenticated using ((select private.is_member()));
create policy crm_catalogo_insert on public.crm_catalogo for insert to authenticated with check ((select private.is_member()));
create policy crm_catalogo_update on public.crm_catalogo for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

create policy crm_responsables_select on public.crm_responsables for select to authenticated using ((select private.is_member()));
create policy crm_responsables_insert on public.crm_responsables for insert to authenticated with check ((select private.is_member()));
create policy crm_responsables_update on public.crm_responsables for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

-- Los mailings no se borran: se cancelan (estado con semántica "cancelado")
create policy crm_mailings_select on public.crm_mailings for select to authenticated using ((select private.is_member()));
create policy crm_mailings_insert on public.crm_mailings for insert to authenticated with check ((select private.is_member()));
create policy crm_mailings_update on public.crm_mailings for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

create policy crm_comentarios_select on public.crm_comentarios_semana for select to authenticated using ((select private.is_member()));
create policy crm_comentarios_insert on public.crm_comentarios_semana for insert to authenticated
  with check ((select private.is_member()) and autor = (select private.current_member_id()));
create policy crm_comentarios_update on public.crm_comentarios_semana for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

create policy crm_feriados_select on public.crm_feriados for select to authenticated using ((select private.is_member()));
create policy crm_feriados_insert on public.crm_feriados for insert to authenticated with check ((select private.is_member()));
create policy crm_feriados_update on public.crm_feriados for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy crm_feriados_delete on public.crm_feriados for delete to authenticated using ((select private.is_member()));

create policy crm_reglas_select on public.crm_reglas_oportunidad for select to authenticated using ((select private.is_member()));
create policy crm_reglas_insert on public.crm_reglas_oportunidad for insert to authenticated with check ((select private.is_member()));
create policy crm_reglas_update on public.crm_reglas_oportunidad for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy crm_reglas_delete on public.crm_reglas_oportunidad for delete to authenticated using ((select private.is_member()));

create policy crm_manual_select on public.crm_oportunidad_manual for select to authenticated using ((select private.is_member()));
create policy crm_manual_insert on public.crm_oportunidad_manual for insert to authenticated with check ((select private.is_member()));
create policy crm_manual_update on public.crm_oportunidad_manual for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy crm_manual_delete on public.crm_oportunidad_manual for delete to authenticated using ((select private.is_member()));

create policy crm_config_select on public.crm_config for select to authenticated using ((select private.is_member()));
create policy crm_config_insert on public.crm_config for insert to authenticated with check ((select private.is_member()));
create policy crm_config_update on public.crm_config for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

-- =============================================================================
-- Datos iniciales (no se registran en el historial)
-- =============================================================================
select set_config('app.crm_seed', 'on', true);

insert into public.crm_regiones (id, nombre, orden) values
  ('XV',  'Arica y Parinacota', 1),
  ('I',   'Tarapacá', 2),
  ('II',  'Antofagasta', 3),
  ('III', 'Atacama', 4),
  ('IV',  'Coquimbo', 5),
  ('V',   'Valparaíso', 6),
  ('RM',  'Metropolitana de Santiago', 7),
  ('VI',  'Libertador General Bernardo O''Higgins', 8),
  ('VII', 'Maule', 9),
  ('XVI', 'Ñuble', 10),
  ('VIII','Biobío', 11),
  ('IX',  'La Araucanía', 12),
  ('XIV', 'Los Ríos', 13),
  ('X',   'Los Lagos', 14),
  ('XI',  'Aysén del General Carlos Ibáñez del Campo', 15),
  ('XII', 'Magallanes y de la Antártica Chilena', 16);

-- Comunas con tiendas, de la maestra de tiendas (solo conteos; sin nombres ni teléfonos de personas).
-- Reglas de limpieza: la fila con comuna "Arica y Parinacota" se asignó a Arica (ciudad "Arica"),
-- "Chiloe" a Castro (ciudad "Castro") y "Tome" a Tomé; la fila repetida de la tienda 141 sin región se omitió.
insert into public.crm_comunas (region_id, nombre, tiendas_abiertas, tiendas_total, lat, lon) values
('I', 'Alto Hospicio', 0, 1, -20.27, -70.1),
  ('I', 'Iquique', 2, 2, -20.21, -70.15),
  ('II', 'Antofagasta', 5, 6, -23.65, -70.4),
  ('II', 'Calama', 2, 3, -22.46, -68.93),
  ('III', 'Copiapó', 2, 3, -27.37, -70.33),
  ('III', 'Vallenar', 1, 1, -28.58, -70.76),
  ('IV', 'Coquimbo', 2, 2, -29.95, -71.34),
  ('IV', 'Illapel', 1, 1, -31.63, -71.17),
  ('IV', 'La Serena', 2, 3, -29.91, -71.25),
  ('IV', 'Ovalle', 2, 2, -30.6, -71.2),
  ('IX', 'Angol', 1, 1, -37.8, -72.71),
  ('IX', 'Temuco', 3, 3, -38.74, -72.6),
  ('IX', 'Villarrica', 1, 1, -39.28, -72.23),
  ('RM', 'Buin', 1, 1, -33.73, -70.74),
  ('RM', 'Cerrillos', 1, 1, -33.5, -70.72),
  ('RM', 'Colina', 1, 1, -33.2, -70.67),
  ('RM', 'Estación Central', 2, 2, -33.46, -70.68),
  ('RM', 'Huechuraba', 1, 1, -33.37, -70.64),
  ('RM', 'Independencia', 1, 2, -33.42, -70.66),
  ('RM', 'La Cisterna', 1, 1, -33.53, -70.66),
  ('RM', 'La Florida', 3, 3, -33.52, -70.6),
  ('RM', 'La Reina', 1, 1, -33.45, -70.54),
  ('RM', 'Las Condes', 7, 7, -33.41, -70.57),
  ('RM', 'Maipú', 4, 5, -33.51, -70.76),
  ('RM', 'Melipilla', 1, 1, -33.69, -71.21),
  ('RM', 'Peñalolén', 1, 1, -33.49, -70.53),
  ('RM', 'Providencia', 4, 6, -33.43, -70.61),
  ('RM', 'Puente Alto', 5, 5, -33.61, -70.58),
  ('RM', 'Quilicura', 1, 1, -33.36, -70.73),
  ('RM', 'Recoleta', 1, 1, -33.41, -70.64),
  ('RM', 'San Bernardo', 2, 2, -33.59, -70.7),
  ('RM', 'San Miguel', 1, 1, -33.5, -70.65),
  ('RM', 'Santiago', 10, 13, -33.45, -70.67),
  ('RM', 'Talagante', 1, 1, -33.66, -70.93),
  ('RM', 'Ñuñoa', 3, 4, -33.46, -70.6),
  ('V', 'La Calera', 1, 1, -32.79, -71.19),
  ('V', 'Los Andes', 1, 1, -32.83, -70.6),
  ('V', 'Quillota', 1, 2, -32.88, -71.25),
  ('V', 'Quilpué', 2, 2, -33.05, -71.44),
  ('V', 'San Antonio', 2, 3, -33.59, -71.61),
  ('V', 'San Felipe', 1, 2, -32.75, -70.73),
  ('V', 'Valparaíso', 3, 4, -33.05, -71.62),
  ('V', 'Villa Alemana', 1, 1, -33.04, -71.37),
  ('V', 'Viña del Mar', 2, 2, -33.02, -71.55),
  ('VI', 'Rancagua', 3, 4, -34.17, -70.74),
  ('VI', 'San Fernando', 1, 1, -34.58, -70.99),
  ('VI', 'San Vicente de Tagua Tagua', 1, 1, -34.44, -71.08),
  ('VI', 'Santa Cruz', 1, 1, -34.64, -71.36),
  ('VII', 'Constitución', 1, 1, -35.33, -72.41),
  ('VII', 'Curicó', 1, 3, -34.98, -71.24),
  ('VII', 'Linares', 1, 1, -35.85, -71.6),
  ('VII', 'Talca', 2, 4, -35.43, -71.66),
  ('VIII', 'Concepción', 5, 5, -36.83, -73.05),
  ('VIII', 'Coronel', 2, 2, -37.03, -73.15),
  ('VIII', 'Los Ángeles', 1, 1, -37.47, -72.35),
  ('VIII', 'Talcahuano', 2, 3, -36.72, -73.12),
  ('VIII', 'Tomé', 1, 1, -36.62, -72.96),
  ('X', 'Castro', 1, 1, -42.48, -73.76),
  ('X', 'Lago Ranco', 0, 1, -40.32, -72.5),
  ('X', 'Osorno', 1, 1, -40.57, -73.13),
  ('X', 'Puerto Montt', 2, 2, -41.47, -72.94),
  ('X', 'Puerto Varas', 1, 1, -41.32, -72.99),
  ('XI', 'Coyhaique', 1, 1, -45.57, -72.07),
  ('XII', 'Punta Arenas', 2, 3, -53.16, -70.91),
  ('XIV', 'Valdivia', 3, 3, -39.81, -73.25),
  ('XV', 'Arica', 2, 2, -18.48, -70.31),
  ('XVI', 'Chillán', 3, 3, -36.61, -72.1),
  ('XVI', 'San Carlos', 1, 1, -36.42, -71.96);

-- Estados: "Cancelado" es necesario para cancelar en vez de borrar; el equipo puede agregar más (En preparación, Aprobado…)
insert into public.crm_catalogo (lista, nombre, definicion, color, semantica, orden) values
  ('estado', 'Pendiente', 'Programado, aún no enviado', 'amber', 'pendiente', 1),
  ('estado', 'Enviado', 'Envío realizado', 'emerald', 'enviado', 2),
  ('estado', 'Cancelado', 'No se enviará; se conserva el registro', 'slate', 'cancelado', 3);

-- Einstein: nombres según la especificación. Verificar contra la implementación real de Salesforce Marketing Cloud.
-- Esta lista es solo información de planificación: no ejecuta nada en Salesforce.
insert into public.crm_catalogo (lista, nombre, definicion, color, orden) values
  ('einstein', 'Sin Einstein', '', 'slate', 1),
  ('einstein', 'Einstein Open', 'Por verificar contra la implementación real de Marketing Cloud', 'blue', 2),
  ('einstein', 'Einstein Send Time Optimization', 'Por verificar contra la implementación real de Marketing Cloud', 'violet', 3),
  ('einstein', 'Otro / Personalizado', '', 'slate', 4);

-- Tipo de configuración: la definición operativa la completa el equipo (no se asume su significado técnico)
insert into public.crm_catalogo (lista, nombre, definicion, color, orden) values
  ('configuracion', 'Bajo', '', 'slate', 1),
  ('configuracion', 'Medio', '', 'slate', 2),
  ('configuracion', 'Estricto', '', 'slate', 3);

insert into public.crm_catalogo (lista, nombre, definicion, color, orden) values
  ('canal', 'Email', '', 'slate', 1);

-- Responsables: punto de partida con las 4 personas del roadmap. Iniciales ajustables; se pueden agregar las reales del equipo de marketing.
insert into public.crm_responsables (nombre, iniciales, email, color, member_id, orden)
select name, case id when 'cristobal_cuevas' then 'CCu' when 'cristobal_cordoba' then 'CCo' else initials end,
       email, color, id, sort_order
from public.team_members order by sort_order;

-- Feriados nacionales 2026 y 2027.
-- Cotejados el 13/10/2026 entre api.boostr.cl (tercero) y CNN Chile (2026) / Pauta (2027); no son una fuente oficial.
insert into public.crm_feriados (fecha, nombre, ambito, irrenunciable, fuente, verificado) values
  ('2026-01-01', 'Año Nuevo', 'nacional', true,  'boostr.cl y CNN Chile', true),
  ('2026-04-03', 'Viernes Santo', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-04-04', 'Sábado Santo', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-05-01', 'Día Nacional del Trabajo', 'nacional', true, 'boostr.cl y CNN Chile', true),
  ('2026-05-21', 'Día de las Glorias Navales', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-06-21', 'Día Nacional de los Pueblos Indígenas', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-06-29', 'San Pedro y San Pablo', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-07-16', 'Día de la Virgen del Carmen', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-08-15', 'Asunción de la Virgen', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-09-18', 'Independencia Nacional', 'nacional', true, 'boostr.cl y CNN Chile', true),
  ('2026-09-19', 'Día de las Glorias del Ejército', 'nacional', true, 'boostr.cl y CNN Chile', true),
  ('2026-10-12', 'Encuentro de Dos Mundos', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-10-31', 'Día de las Iglesias Evangélicas y Protestantes', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-11-01', 'Día de Todos los Santos', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-12-08', 'Inmaculada Concepción', 'nacional', false, 'boostr.cl y CNN Chile', true),
  ('2026-12-25', 'Navidad', 'nacional', true, 'boostr.cl y CNN Chile', true),
  ('2027-01-01', 'Año Nuevo', 'nacional', true, 'boostr.cl y Pauta', true),
  ('2027-03-26', 'Viernes Santo', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-03-27', 'Sábado Santo', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-05-01', 'Día Nacional del Trabajo', 'nacional', true, 'boostr.cl y Pauta', true),
  ('2027-05-21', 'Día de las Glorias Navales', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-06-21', 'Día Nacional de los Pueblos Indígenas', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-06-28', 'San Pedro y San Pablo', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-07-16', 'Día de la Virgen del Carmen', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-08-15', 'Asunción de la Virgen', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-09-17', 'Feriado adicional de Fiestas Patrias', 'nacional', false, 'boostr.cl y Pauta (Ley 20.983, según Pauta)', true),
  ('2027-09-18', 'Independencia Nacional', 'nacional', true, 'boostr.cl y Pauta', true),
  ('2027-09-19', 'Día de las Glorias del Ejército', 'nacional', true, 'boostr.cl y Pauta', true),
  ('2027-10-11', 'Encuentro de Dos Mundos', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-10-31', 'Día de las Iglesias Evangélicas y Protestantes', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-11-01', 'Día de Todos los Santos', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-12-08', 'Inmaculada Concepción', 'nacional', false, 'boostr.cl y Pauta', true),
  ('2027-12-25', 'Navidad', 'nacional', true, 'boostr.cl y Pauta', true);

-- Feriados regionales 2026: dos fuentes periodísticas coinciden en la fecha, pero falta cotejar con el texto de la ley.
-- Por eso quedan como "por confirmar" hasta que el equipo los valide. Se pueden editar o agregar más desde la app.
insert into public.crm_feriados (fecha, nombre, ambito, region_id, alcance, fuente, verificado) values
  ('2026-06-07', 'Asalto y Toma del Morro de Arica', 'regional', 'XV', 'Región de Arica y Parinacota', 'CNN Chile y Chilevisión; ley sin cotejar', false),
  ('2026-08-20', 'Natalicio de Bernardo O''Higgins', 'regional', 'XVI', 'Solo las comunas de Chillán y Chillán Viejo', 'CNN Chile y calendariochile.com; ley sin cotejar', false);

-- Reglas iniciales de oportunidad comercial: supuestos explícitos y editables, no hechos.
insert into public.crm_reglas_oportunidad (nombre, nivel, tipo, params, justificacion, activo, orden) values
  ('Último día hábil del mes', 'alta', 'ultimo_habil', '{"n":1}', 'Mayor probabilidad de abono de remuneraciones mensuales', true, 1),
  ('Primeros días hábiles del mes', 'alta', 'primeros_habiles', '{"n":2}', 'Los pagos del mes anterior se gastan en los primeros días hábiles', true, 2),
  ('Días previos al último día hábil', 'media', 'previos_ultimo_habil', '{"n":2}', 'Cercanía al pago; posibles adelantos', true, 3),
  ('Días hábiles 3 a 5 del mes', 'media', 'habiles_rango', '{"desde":3,"hasta":5}', 'Efecto residual del pago mensual', true, 4),
  ('Quincena (días 15 y 16)', 'media', 'dias_del_mes', '{"dias":[15,16]}', 'Posible pago quincenal o anticipo', true, 5),
  ('Fin de semana siguiente a un día de alta oportunidad', 'media', 'fin_de_semana_tras_pago', '{}', 'Hipótesis por calibrar: mayor tráfico comercial tras el pago. Desactivada hasta tener datos', false, 6);

insert into public.crm_config (clave, valor) values
  ('clima_escala', '{"cortes":[20,40,60,80]}'),
  ('clima_pronostico_dias', '{"dias":7}'),
  ('clima_sugerencia', '{"umbral":60,"proporcion":50}');

select set_config('app.crm_seed', '', true);

-- =============================================================================
-- Tiempo real
-- =============================================================================
alter publication supabase_realtime add table
  public.crm_mailings, public.crm_catalogo, public.crm_responsables, public.crm_comentarios_semana,
  public.crm_feriados, public.crm_reglas_oportunidad, public.crm_oportunidad_manual, public.crm_config;

-- =============================================================================
-- Endurecer funciones internas (igual que 0001): solo las de pertenencia son invocables por usuarios
-- =============================================================================
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_member_id() to authenticated;
grant execute on function private.is_member() to authenticated;
