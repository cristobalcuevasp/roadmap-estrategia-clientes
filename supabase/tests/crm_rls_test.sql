-- Prueba de base de datos del módulo CRM. Se ejecuta DENTRO de una transacción que siempre se revierte
-- (termina con una excepción a propósito), así que no deja datos. Pegar en el SQL editor de Supabase
-- o ejecutar con execute_sql. Lee el informe en el mensaje de error: cada línea empieza con OK o FALLA.
do $test$
declare
  rep text := '';
  u_cuevas uuid; u_cordoba uuid;
  v_tit uuid; v_pend uuid; v_env uuid; v_canc uuid; v_ccu uuid; v_cco uuid; v_einstein uuid;
  m uuid; c uuid; n int; n0 int; t text; d date; r record; failed boolean; v_hoy text; v_secreto text;
begin
  select user_id into u_cuevas from public.team_members where id = 'cristobal_cuevas';
  select user_id into u_cordoba from public.team_members where id = 'cristobal_cordoba';
  select id into v_pend from public.crm_catalogo where lista='estado' and nombre='Pendiente';
  select id into v_env  from public.crm_catalogo where lista='estado' and nombre='Enviado';
  select id into v_canc from public.crm_catalogo where lista='estado' and nombre='Cancelado';
  select id into v_ccu from public.crm_responsables where member_id='cristobal_cuevas';
  select id into v_cco from public.crm_responsables where member_id='cristobal_cordoba';
  select id into v_einstein from public.crm_catalogo where lista='einstein' and nombre='Einstein Open';

  v_hoy := private.today_cl()::text;
  select count(*) into n0 from public.crm_historial;

  -- 1) Carga inicial
  select count(*) into n from public.crm_regiones;           rep := rep || E'\n' || case when n=16 then 'OK ' else 'FALLA ' end || 'regiones=' || n;
  select count(*) into n from public.crm_comunas;            rep := rep || E'\n' || case when n=68 then 'OK ' else 'FALLA ' end || 'comunas=' || n;
  select sum(tiendas_abiertas) into n from public.crm_comunas; rep := rep || E'\n' || case when n=130 then 'OK ' else 'FALLA ' end || 'tiendas abiertas=' || n;
  select count(*) into n from public.crm_feriados where ambito='nacional'; rep := rep || E'\n' || case when n=33 then 'OK ' else 'FALLA ' end || 'feriados nacionales (2026 y 2027)=' || n;
  select count(*) into n from public.crm_feriados where ambito='regional'; rep := rep || E'\n' || case when n=2 then 'OK ' else 'FALLA ' end || 'feriados regionales=' || n;
  select count(*) into n from public.crm_reglas_oportunidad;  rep := rep || E'\n' || case when n=6 then 'OK ' else 'FALLA ' end || 'reglas=' || n;
  select count(*) into n from public.crm_responsables;        rep := rep || E'\n' || case when n=4 then 'OK ' else 'FALLA ' end || 'responsables=' || n;
  select count(*) into n from public.crm_comunas where lat not between -56 and -17;  rep := rep || E'\n' || case when n=0 then 'OK ' else 'FALLA ' end || 'coordenadas fuera de Chile=' || n;

  -- 2) Como Cristobal Cuevas (usuario autenticado)
  perform set_config('request.jwt.claims', json_build_object('sub', u_cuevas, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_cuevas::text, true);
  set local role authenticated;

  insert into public.crm_catalogo (lista, nombre) values ('titulo', '  Prueba título  ') returning id into v_tit;
  select nombre into t from public.crm_catalogo where id = v_tit;
  rep := rep || E'\n' || case when t = 'Prueba título' then 'OK ' else 'FALLA ' end || 'título guardado sin espacios sobrantes';

  begin
    insert into public.crm_catalogo (lista, nombre) values ('titulo', 'PRUEBA TÍTULO');
    rep := rep || E'\nFALLA título duplicado aceptado';
  exception when unique_violation then rep := rep || E'\nOK título duplicado rechazado (sin distinguir mayúsculas)'; end;
  -- (la comparación es por minúsculas; el acento sí distingue)

  insert into public.crm_mailings (fecha, hora, titulo_id, responsable_id, einstein_id, estado_id, segmento)
  values ('2026-10-15', '10:00', v_tit, v_ccu, v_einstein, v_pend, 'Clientes activos') returning id into m;
  select created_by into t from public.crm_mailings where id = m;
  rep := rep || E'\n' || case when t = 'cristobal_cuevas' then 'OK ' else 'FALLA ' end || 'mailing creado con autor ' || coalesce(t,'null');

  update public.crm_mailings set estado_id = v_env where id = m;
  select enviado_en::text into t from public.crm_mailings where id = m;
  rep := rep || E'\n' || case when t = v_hoy then 'OK ' else 'FALLA ' end || 'enviado_en se completa al pasar a Enviado=' || coalesce(t,'null');
  select estado_cambiado_por into t from public.crm_mailings where id = m;
  rep := rep || E'\n' || case when t = 'cristobal_cuevas' then 'OK ' else 'FALLA ' end || 'estado cambiado por ' || coalesce(t,'null');

  update public.crm_mailings set fecha = '2026-10-16' where id = m;
  update public.crm_mailings set estado_id = v_canc where id = m;

  reset role;
  select count(*) into n from public.crm_historial where entidad='mailing' and entidad_id = m::text;
  rep := rep || E'\n' || case when n = 5 then 'OK ' else 'FALLA ' end || 'historial del mailing (creación, estado, fecha de envío, fecha, estado)=' || n;
  select count(*) into n from public.crm_historial;
  rep := rep || E'\n' || case when n - n0 = 6 then 'OK ' else 'FALLA ' end || 'filas nuevas en el historial (5 del mailing + 1 del título nuevo)=' || (n - n0);
  select desde || ' -> ' || hasta into t from public.crm_historial where entidad='mailing' and entidad_id = m::text and campo='estado_id' order by created_at, id limit 1;
  rep := rep || E'\n' || case when t = 'Pendiente -> Enviado' then 'OK ' else 'FALLA ' end || 'historial con nombres legibles: ' || coalesce(t,'null');
  select actor into t from public.crm_historial where entidad='mailing' and entidad_id = m::text and campo='fecha' limit 1;
  rep := rep || E'\n' || case when t = 'cristobal_cuevas' then 'OK ' else 'FALLA ' end || 'historial guarda el autor: ' || coalesce(t,'null');

  -- 3) Validaciones de integridad
  perform set_config('request.jwt.claims', json_build_object('sub', u_cuevas, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.crm_mailings (fecha, titulo_id, estado_id) values ('2026-10-20', v_pend, v_pend);
    rep := rep || E'\nFALLA un estado se aceptó como título';
  exception when others then
    rep := rep || E'\n' || case when sqlerrm like 'crm_lista_invalida%' then 'OK ' else 'FALLA ' end || 'catálogo equivocado rechazado: ' || left(sqlerrm, 60);
  end;
  begin
    delete from public.crm_mailings where id = m;
    rep := rep || E'\nFALLA se pudo borrar un mailing';
  exception when insufficient_privilege then rep := rep || E'\nOK los mailings no se pueden borrar (solo cancelar)'; end;

  -- 4) Comentario semanal con aviso
  insert into public.crm_comentarios_semana (semana, cuerpo, responsable_id) values ('2026-10-12', ' Revisar segmentos de la semana ', v_cco) returning id into c;
  begin
    insert into public.crm_comentarios_semana (semana, cuerpo) values ('2026-10-13', 'martes');
    rep := rep || E'\nFALLA semana que no empieza en lunes aceptada';
  exception when check_violation then rep := rep || E'\nOK semana que no empieza en lunes rechazada'; end;
  reset role;
  select correo_responsable into t from public.crm_comentarios_semana where id = c;
  rep := rep || E'\n' || case when t is not null and t = (select email from public.crm_responsables where id = v_cco) then 'OK ' else 'FALLA ' end || 'el correo del responsable se copia al comentario';
  select count(*) into n from public.notifications where type='crm_comment' and target='cristobal_cordoba' and link = 'crm/comentario/' || c::text;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 'aviso en la app para el responsable=' || n;

  -- 5) Como Cristóbal Cordoba: ve el aviso, no puede editar el texto ajeno, sí puede resolverlo
  perform set_config('request.jwt.claims', json_build_object('sub', u_cordoba, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_cordoba::text, true);
  set local role authenticated;
  select count(*) into n from public.notifications where type='crm_comment';
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 'el destinatario ve el aviso (RLS)=' || n;
  begin
    update public.crm_comentarios_semana set cuerpo = 'cambiado por otro' where id = c;
    rep := rep || E'\nFALLA otra persona editó el texto';
  exception when insufficient_privilege then rep := rep || E'\nOK solo el autor edita el texto'; end;
  update public.crm_comentarios_semana set estado = 'Resuelto' where id = c;
  reset role;
  select resuelto_por into t from public.crm_comentarios_semana where id = c;
  rep := rep || E'\n' || case when t = 'cristobal_cordoba' then 'OK ' else 'FALLA ' end || 'resuelto por ' || coalesce(t,'null');

  perform set_config('request.jwt.claims', json_build_object('sub', u_cuevas, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_cuevas::text, true);
  set local role authenticated;
  select count(*) into n from public.notifications where type='crm_comment';
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'el autor no ve su propio aviso=' || n;
  reset role;

  -- 6) Sin sesión no se ve nada
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    select count(*) into n from public.crm_mailings;
    rep := rep || E'\nFALLA el visitante anónimo puede leer mailings';
  exception when insufficient_privilege then rep := rep || E'\nOK visitante anónimo sin acceso a mailings'; end;
  begin
    select count(*) into n from public.crm_clima_vigente;
    rep := rep || E'\nFALLA el visitante anónimo puede leer clima';
  exception when insufficient_privilege then rep := rep || E'\nOK visitante anónimo sin acceso al clima'; end;
  reset role;

  -- 7) Un usuario autenticado que NO es del equipo
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  set local role authenticated;
  select count(*) into n from public.crm_mailings;
  rep := rep || E'\n' || case when n = 1 then 'FALLA ' else 'OK ' end || 'persona ajena al equipo ve mailings=' || n;
  select count(*) into n from public.crm_feriados;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'persona ajena al equipo ve feriados=' || n;
  reset role;

  -- 8) Clima automático (migración 0004)
  select count(*) into n from cron.job where jobname in ('crm-clima-1','crm-clima-2') and active;
  rep := rep || E'\n' || case when n = 2 then 'OK ' else 'FALLA ' end || 'trabajos programados del clima=' || n;
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'crm_clima_cron_secret';
  rep := rep || E'\n' || case when length(coalesce(v_secreto,'')) >= 32 then 'OK ' else 'FALLA ' end || 'el secreto interno existe en Vault (largo suficiente)';
  rep := rep || E'\n' || case when public.crm_clima_verificar_secreto(v_secreto) and not public.crm_clima_verificar_secreto('x') and not public.crm_clima_verificar_secreto('') and not public.crm_clima_verificar_secreto(null) then 'OK ' else 'FALLA ' end || 'verificación del secreto: acepta el correcto y rechaza vacío/nulo/incorrecto';
  rep := rep || E'\n' || case when has_function_privilege('service_role', 'public.crm_clima_verificar_secreto(text)', 'execute') and not has_function_privilege('anon', 'public.crm_clima_verificar_secreto(text)', 'execute') and not has_function_privilege('authenticated', 'public.crm_clima_verificar_secreto(text)', 'execute') then 'OK ' else 'FALLA ' end || 'solo service_role puede ejecutar la verificación del secreto';
  rep := rep || E'\n' || case when not has_function_privilege('anon', 'private.crm_clima_disparar()', 'execute') and not has_function_privilege('authenticated', 'private.crm_clima_disparar()', 'execute') then 'OK ' else 'FALLA ' end || 'anon y authenticated no pueden disparar la actualización';
  perform set_config('request.jwt.claims', json_build_object('sub', u_cuevas, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_cuevas::text, true);
  set local role authenticated;
  begin
    insert into public.crm_clima_pronostico (comuna_id, fecha, obtenido_el, prob_precip, fuente) select id, '2026-10-20', '2026-10-13', 50, 'prueba' from public.crm_comunas limit 1;
    rep := rep || E'\nFALLA una persona del equipo pudo escribir clima';
  exception when insufficient_privilege then rep := rep || E'\nOK el equipo no puede escribir datos de clima (solo la función)'; end;
  begin
    perform public.crm_clima_verificar_secreto('x');
    rep := rep || E'\nFALLA authenticated pudo llamar a la verificación';
  exception when insufficient_privilege then rep := rep || E'\nOK authenticated no puede llamar a la verificación'; end;
  reset role;

  raise exception E'INFORME DE PRUEBAS (se revierte todo):%', rep;
end
$test$;
