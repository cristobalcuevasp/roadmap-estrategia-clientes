-- Prueba de base de datos del módulo FEEDBACK & DESARROLLO (permisos, minutas con versiones, compromisos con revisiones).
-- Se ejecuta DENTRO de una transacción que siempre se revierte (termina con una excepción a propósito), así que no
-- deja datos. Pegar en el SQL editor de Supabase, ejecutar con execute_sql o con psql sobre una base local con las
-- migraciones 0001 y 0007. Lee el informe en el mensaje de error: cada línea empieza con OK o FALLA.
--
-- Requisitos: el miembro "cristobal_cuevas" es el líder y tiene cuenta; "cristobal_cordoba" es un integrante con cuenta.
do $test$
declare
  rep text := '';
  u_lider uuid; u_integ uuid;
  v_pl uuid; v_pc uuid; v_nueva uuid;
  v_rol uuid; v_rol2 uuid; v_asig uuid; v_obj uuid; v_s uuid; v_s2 uuid; v_s3 uuid; v_c uuid; v_c2 uuid; v_nota uuid;
  n int; n0 int; t text; j jsonb; r record; d date; hoy date := private.today_cl();
begin
  select user_id into u_lider from public.team_members where id = 'cristobal_cuevas';
  select user_id into u_integ from public.team_members where id = 'cristobal_cordoba';
  select id into v_pl from public.fb_personas where member_id = 'cristobal_cuevas';
  select id into v_pc from public.fb_personas where member_id = 'cristobal_cordoba';
  select count(*) into n0 from public.fb_personas;

  -- 0) Datos iniciales
  rep := rep || E'\n' || case when (select count(*) from public.fb_lideres) = 1 and (select member_id from public.fb_lideres) = 'cristobal_cuevas' then 'OK ' else 'FALLA ' end || 'un solo líder (miembro cristobal_cuevas)';
  rep := rep || E'\n' || case when v_pl is not null and v_pc is not null then 'OK ' else 'FALLA ' end || 'fichas iniciales del líder y del integrante de prueba';
  select count(*) into n from public.fb_personas where lider_member_id is distinct from 'cristobal_cuevas' and member_id <> 'cristobal_cuevas';
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'líder responsable inicial de las demás fichas=' || n;

  -- ===================== COMO LÍDER =====================
  perform set_config('request.jwt.claims', json_build_object('sub', u_lider, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_lider::text, true);
  set local role authenticated;

  j := public.fb_mi_acceso();
  rep := rep || E'\n' || case when (j->>'es_lider')::boolean and (j->>'persona_id')::uuid = v_pl then 'OK ' else 'FALLA ' end || 'fb_mi_acceso del líder: ' || j::text;
  select count(*) into n from public.fb_personas;
  rep := rep || E'\n' || case when n = n0 then 'OK ' else 'FALLA ' end || 'el líder ve todas las fichas=' || n;

  insert into public.fb_personas (nombre, cargo, area, lider_member_id, color) values ('  Persona de prueba  ', 'Analista', 'CRM', 'cristobal_cuevas', 'violet') returning id into v_nueva;
  select nombre into t from public.fb_personas where id = v_nueva;
  rep := rep || E'\n' || case when t = 'Persona de prueba' then 'OK ' else 'FALLA ' end || 'ficha nueva sin espacios sobrantes';
  begin
    insert into public.fb_personas (nombre, color) values ('Mala', 'rojo-inexistente');
    rep := rep || E'\nFALLA color inválido aceptado';
  exception when check_violation then rep := rep || E'\nOK color inválido rechazado'; end;
  begin
    insert into public.fb_personas (nombre) values ('   ');
    rep := rep || E'\nFALLA nombre vacío aceptado';
  exception when check_violation then rep := rep || E'\nOK nombre vacío rechazado'; end;

  -- Roles
  insert into public.fb_roles (nombre, descripcion, responsabilidades, expectativas) values ('Rol de prueba', 'Desc', 'Resp del rol', 'Exp del rol') returning id into v_rol;
  insert into public.fb_roles (nombre) values ('Otro rol sin asignar') returning id into v_rol2;
  begin
    insert into public.fb_roles (nombre) values ('ROL DE PRUEBA');
    rep := rep || E'\nFALLA rol duplicado aceptado';
  exception when unique_violation then rep := rep || E'\nOK rol duplicado rechazado (sin distinguir mayúsculas)'; end;
  insert into public.fb_persona_roles (persona_id, rol_id, expectativas) values (v_pc, v_rol, 'Expectativa específica') returning id into v_asig;
  begin
    insert into public.fb_persona_roles (persona_id, rol_id) values (v_pc, v_rol);
    rep := rep || E'\nFALLA el mismo rol activo se asignó dos veces';
  exception when unique_violation then rep := rep || E'\nOK mismo rol activo dos veces rechazado'; end;

  -- Objetivos
  insert into public.fb_objetivos (persona_id, titulo, prioridad, fecha_objetivo, estado, avance, categoria) values (v_pc, 'Objetivo de prueba', 'alta', hoy + 30, 'en_curso', 20, 'Desarrollo') returning id into v_obj;
  insert into public.fb_objetivo_roles (objetivo_id, rol_id) values (v_obj, v_rol);
  update public.fb_objetivos set estado = 'cumplido' where id = v_obj;
  select avance::text || '|' || coalesce(fecha_cierre::text, 'null') into t from public.fb_objetivos where id = v_obj;
  rep := rep || E'\n' || case when t = '100|' || hoy::text then 'OK ' else 'FALLA ' end || 'objetivo cumplido: avance 100 y fecha de cierre=' || t;
  update public.fb_objetivos set estado = 'en_curso', avance = 60 where id = v_obj;
  select coalesce(fecha_cierre::text, 'null') into t from public.fb_objetivos where id = v_obj;
  rep := rep || E'\n' || case when t = 'null' then 'OK ' else 'FALLA ' end || 'al reabrir el objetivo se borra la fecha de cierre';

  -- Compromiso directo: fecha pasada rechazada; estado/avance solo por revisión
  begin
    insert into public.fb_compromisos (persona_id, descripcion, fecha_vencimiento) values (v_pc, 'Vencido de origen', hoy - 1);
    rep := rep || E'\nFALLA compromiso con vencimiento pasado aceptado';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_fecha_invalida%' then 'OK ' else 'FALLA ' end || 'compromiso con vencimiento pasado rechazado: ' || left(sqlerrm, 50); end;
  insert into public.fb_compromisos (persona_id, descripcion, categoria, prioridad, fecha_vencimiento, objetivo_id) values (v_pc, '  Compromiso directo  ', 'Calidad', 'baja', hoy + 5, v_obj) returning id into v_c2;
  select descripcion || '|' || estado || '|' || avance || '|' || fecha_vencimiento_original::text into t from public.fb_compromisos where id = v_c2;
  rep := rep || E'\n' || case when t = 'Compromiso directo|pendiente|0|' || (hoy + 5)::text then 'OK ' else 'FALLA ' end || 'compromiso directo: ' || t;
  begin
    update public.fb_compromisos set estado = 'cumplido' where id = v_c2;
    rep := rep || E'\nFALLA el estado se cambió sin pasar por una revisión';
  exception when insufficient_privilege then rep := rep || E'\nOK el estado no se puede cambiar sin una revisión (permiso por columna)'; end;
  begin
    update public.fb_compromisos set fecha_vencimiento = hoy + 60 where id = v_c2;
    rep := rep || E'\nFALLA la fecha de vencimiento se cambió sin revisión';
  exception when insufficient_privilege then rep := rep || E'\nOK la fecha de vencimiento no se puede cambiar sin una revisión'; end;

  -- Seguimiento previo (se marcará como realizado al publicar)
  insert into public.fb_seguimientos (persona_id, fecha, motivo) values (v_pc, hoy, 'Seguimiento previo');

  -- Minuta: borrador con compromisos
  begin
    insert into public.fb_sesiones (persona_id, fecha_hora, minuta, proxima_revision) values (v_pc, now(), '{}'::jsonb, hoy - 3);
    rep := rep || E'\nFALLA próxima revisión anterior a la reunión aceptada';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_fecha_invalida%' then 'OK ' else 'FALLA ' end || 'próxima revisión anterior a la reunión rechazada'; end;

  insert into public.fb_sesiones (persona_id, fecha_hora, tipo, modalidad, temas, fortalezas, acuerdos, proxima_revision, minuta, compromisos_borrador)
  values (v_pc, now(), 'seguimiento', 'virtual', 'Tema A', 'Fortaleza A', 'Acuerdo A', hoy + 14,
          jsonb_build_object('resumen', 'Resumen de prueba', 'positivos', 'Positivo'),
          jsonb_build_array(
            jsonb_build_object('descripcion', 'Entregar informe', 'fecha_vencimiento', (hoy + 7)::text, 'prioridad', 'alta', 'categoria', 'Desarrollo'),
            jsonb_build_object('descripcion', 'Revisar proceso', 'fecha_vencimiento', (hoy + 10)::text, 'objetivo_id', v_obj::text)))
  returning id into v_s;
  select estado || '|' || version into t from public.fb_sesiones where id = v_s;
  rep := rep || E'\n' || case when t = 'borrador|0' then 'OK ' else 'FALLA ' end || 'sesión nueva queda en borrador (' || t || ')';
  insert into public.fb_notas_privadas (persona_id, sesion_id, cuerpo) values (v_pc, v_s, 'Nota privada del líder: texto confidencial') returning id into v_nota;

  -- Publicación con datos inválidos (se revierte todo lo creado dentro del bloque)
  begin
    insert into public.fb_sesiones (persona_id, fecha_hora, minuta, compromisos_borrador)
    values (v_pc, now(), '{"resumen":"x"}'::jsonb, jsonb_build_array(jsonb_build_object('descripcion', 'Sin fecha'))) returning id into v_s3;
    perform public.fb_publicar_sesion(v_s3);
    rep := rep || E'\nFALLA se publicó una minuta con un compromiso sin fecha';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_compromiso_invalido%' then 'OK ' else 'FALLA ' end || 'compromiso sin fecha rechazado al publicar'; end;
  begin
    insert into public.fb_sesiones (persona_id, fecha_hora, minuta) values (v_pc, now(), '{}'::jsonb) returning id into v_s3;
    perform public.fb_publicar_sesion(v_s3);
    rep := rep || E'\nFALLA se publicó una minuta sin resumen';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_minuta_vacia%' then 'OK ' else 'FALLA ' end || 'minuta sin resumen rechazada al publicar'; end;

  -- Borrador adicional (para comprobar que el integrante no lo ve)
  insert into public.fb_sesiones (persona_id, fecha_hora, minuta) values (v_pc, now(), '{"resumen":"Borrador reservado"}'::jsonb) returning id into v_s3;

  -- Publicar
  perform public.fb_publicar_sesion(v_s);
  select estado || '|' || version || '|' || (publicada_por) || '|' || (contexto->'roles'->0->>'nombre') || '|' || (contexto->'roles'->0->>'expectativas') into t from public.fb_sesiones where id = v_s;
  rep := rep || E'\n' || case when t = 'publicada|1|cristobal_cuevas|Rol de prueba|Expectativa específica' then 'OK ' else 'FALLA ' end || 'publicación y foto del contexto (rol y expectativa específica): ' || t;
  select count(*) into n from public.fb_compromisos where sesion_id = v_s;
  rep := rep || E'\n' || case when n = 2 then 'OK ' else 'FALLA ' end || 'compromisos creados y vinculados a la minuta=' || n;
  select count(*) into n from public.fb_compromisos where sesion_id = v_s and fecha_vencimiento = fecha_vencimiento_original and estado = 'pendiente';
  rep := rep || E'\n' || case when n = 2 then 'OK ' else 'FALLA ' end || 'compromisos nuevos pendientes con vencimiento original=' || n;
  select count(*) into n from public.fb_minuta_versiones where sesion_id = v_s and version = 1;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 'versión 1 de la minuta guardada';
  select count(*) into n from public.fb_seguimientos where persona_id = v_pc and estado = 'realizado' and sesion_id = v_s and motivo = 'Seguimiento previo';
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 'el seguimiento previo pasó a realizado=' || n;
  select count(*) into n from public.fb_seguimientos where persona_id = v_pc and estado = 'programado' and fecha = hoy + 14 and origen_sesion_id = v_s;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 'próxima revisión agendada como seguimiento=' || n;
  begin
    perform public.fb_publicar_sesion(v_s);
    rep := rep || E'\nFALLA se publicó dos veces';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_ya_publicada%' then 'OK ' else 'FALLA ' end || 'no se puede publicar dos veces'; end;

  -- Una minuta publicada no se edita ni borra directamente
  update public.fb_sesiones set temas = 'Cambio directo' where id = v_s;
  get diagnostics n = row_count;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'edición directa de una minuta publicada bloqueada (filas=' || n || ')';
  delete from public.fb_sesiones where id = v_s;
  get diagnostics n = row_count;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'borrado directo de una minuta publicada bloqueado (filas=' || n || ')';
  begin
    update public.fb_sesiones set estado = 'publicada' where id = v_s3;
    rep := rep || E'\nFALLA un borrador se publicó sin pasar por la publicación';
  exception when insufficient_privilege then rep := rep || E'\nOK no se puede publicar escribiendo el estado directamente'; end;

  -- Edición con versiones
  begin
    perform public.fb_editar_sesion_publicada(v_s, '{"temas":"Tema corregido"}'::jsonb, '');
    rep := rep || E'\nFALLA edición sin motivo aceptada';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_motivo_requerido%' then 'OK ' else 'FALLA ' end || 'edición sin motivo rechazada'; end;
  perform public.fb_editar_sesion_publicada(v_s, '{"temas":"Tema corregido","minuta":{"resumen":"Resumen corregido"}}'::jsonb, 'Corrección de redacción');
  select version::text || '|' || temas || '|' || (minuta->>'resumen') into t from public.fb_sesiones where id = v_s;
  rep := rep || E'\n' || case when t = '2|Tema corregido|Resumen corregido' then 'OK ' else 'FALLA ' end || 'minuta editada como versión 2: ' || t;
  select (contenido->'minuta'->>'resumen') into t from public.fb_minuta_versiones where sesion_id = v_s and version = 1;
  rep := rep || E'\n' || case when t = 'Resumen de prueba' then 'OK ' else 'FALLA ' end || 'la versión 1 conserva el texto original: ' || coalesce(t, 'null');
  select count(*) into n from public.fb_minuta_versiones where sesion_id = v_s and motivo = 'Corrección de redacción' and autor = 'cristobal_cuevas';
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 'la versión 2 guarda motivo y autor';
  select jsonb_array_length(contenido->'compromisos') into n from public.fb_minuta_versiones where sesion_id = v_s and version = 1;
  rep := rep || E'\n' || case when n = 2 then 'OK ' else 'FALLA ' end || 'la versión incluye los compromisos vinculados=' || n;

  -- Revisión de compromisos
  select id into v_c from public.fb_compromisos where sesion_id = v_s and descripcion = 'Entregar informe';
  perform public.fb_revisar_compromiso(v_c, jsonb_build_object('estado_nuevo', 'en_progreso', 'avance_pct', 40, 'avance_texto', 'Primer borrador listo', 'comentarios_lider', 'Va bien'));
  select estado || '|' || avance || '|' || reprogramaciones || '|' || fecha_ultima_revision::text into t from public.fb_compromisos where id = v_c;
  rep := rep || E'\n' || case when t = 'en_progreso|40|0|' || hoy::text then 'OK ' else 'FALLA ' end || 'revisión actualiza estado y avance: ' || t;
  begin
    perform public.fb_revisar_compromiso(v_c, jsonb_build_object('vencimiento_nuevo', (hoy + 20)::text));
    rep := rep || E'\nFALLA reprogramación sin motivo aceptada';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_motivo_requerido%' then 'OK ' else 'FALLA ' end || 'reprogramación sin motivo rechazada'; end;
  begin
    perform public.fb_revisar_compromiso(v_c, jsonb_build_object('vencimiento_nuevo', (hoy - 2)::text, 'obstaculos', 'x'));
    rep := rep || E'\nFALLA reprogramación a fecha pasada aceptada';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_fecha_invalida%' then 'OK ' else 'FALLA ' end || 'reprogramación a una fecha pasada rechazada'; end;
  perform public.fb_revisar_compromiso(v_c, jsonb_build_object('vencimiento_nuevo', (hoy + 20)::text, 'obstaculos', 'Dependencia de datos', 'acciones_correctivas', 'Pedir extracción'));
  perform public.fb_revisar_compromiso(v_c, jsonb_build_object('estado_nuevo', 'bloqueado', 'obstaculos', 'Sin acceso'));
  select estado || '|' || reprogramaciones || '|' || fecha_vencimiento::text || '|' || fecha_vencimiento_original::text into t from public.fb_compromisos where id = v_c;
  rep := rep || E'\n' || case when t = 'bloqueado|1|' || (hoy + 20)::text || '|' || (hoy + 7)::text then 'OK ' else 'FALLA ' end || 'reprogramación cuenta 1 y conserva la fecha original: ' || t;
  begin
    perform public.fb_revisar_compromiso(v_c, jsonb_build_object('estado_nuevo', 'vencido'));
    rep := rep || E'\nFALLA se aceptó el estado vencido escrito a mano';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_estado_invalido%' then 'OK ' else 'FALLA ' end || 'el estado vencido no se escribe a mano (se calcula por fecha)'; end;
  begin
    perform public.fb_revisar_compromiso(v_c, jsonb_build_object('estado_nuevo', 'cumplido'));
    rep := rep || E'\nFALLA se cerró un compromiso sin resultado';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_resultado_requerido%' then 'OK ' else 'FALLA ' end || 'cierre sin resultado rechazado'; end;
  begin
    perform public.fb_revisar_compromiso(v_c, jsonb_build_object('avance_pct', 150));
    rep := rep || E'\nFALLA avance 150 aceptado';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'fb_avance_invalido%' then 'OK ' else 'FALLA ' end || 'avance fuera de 0-100 rechazado'; end;
  perform public.fb_revisar_compromiso(v_c, jsonb_build_object('estado_nuevo', 'cumplido', 'resultado', 'Informe entregado y aprobado', 'evidencias', 'Enlace al informe'));
  select estado || '|' || avance || '|' || coalesce(fecha_cumplimiento::text, 'null') || '|' || resultado_final into t from public.fb_compromisos where id = v_c;
  rep := rep || E'\n' || case when t = 'cumplido|100|' || hoy::text || '|Informe entregado y aprobado' then 'OK ' else 'FALLA ' end || 'cierre registra fecha real y resultado: ' || t;
  select count(*) into n from public.fb_compromiso_revisiones where compromiso_id = v_c;
  rep := rep || E'\n' || case when n = 4 then 'OK ' else 'FALLA ' end || 'las 4 revisiones válidas quedan en el historial (las rechazadas no)=' || n;
  begin
    update public.fb_compromiso_revisiones set resultado = 'alterado' where compromiso_id = v_c;
    rep := rep || E'\nFALLA una revisión se pudo modificar';
  exception when insufficient_privilege then rep := rep || E'\nOK las revisiones no se pueden modificar'; end;
  begin
    delete from public.fb_compromisos where id = v_c;
    rep := rep || E'\nFALLA un compromiso se pudo borrar';
  exception when insufficient_privilege then rep := rep || E'\nOK los compromisos no se pueden borrar'; end;
  begin
    delete from public.fb_personas where id = v_nueva;
    rep := rep || E'\nFALLA una ficha se pudo borrar';
  exception when insufficient_privilege then rep := rep || E'\nOK las fichas no se pueden borrar'; end;

  -- Auditoría
  reset role;
  select count(*) into n from public.fb_auditoria where tabla = 'fb_compromisos' and persona_id = v_pc and actor = 'cristobal_cuevas';
  rep := rep || E'\n' || case when n >= 3 then 'OK ' else 'FALLA ' end || 'auditoría de compromisos con autor=' || n;
  select count(*) into n from public.fb_auditoria where tabla = 'fb_notas_privadas' and resumen = '' and (cambios is null);
  rep := rep || E'\n' || case when n >= 1 then 'OK ' else 'FALLA ' end || 'auditoría de notas privadas sin copiar el contenido=' || n;
  select count(*) into n from public.fb_auditoria where cambios::text like '%confidencial%' or resumen like '%confidencial%';
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'el texto de la nota privada no aparece en la auditoría=' || n;
  select count(*) into n from public.fb_auditoria where tabla = 'fb_personas' and accion = 'insert' and persona_id = v_nueva;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 'auditoría de la ficha nueva=' || n;

  -- ===================== COMO INTEGRANTE =====================
  perform set_config('request.jwt.claims', json_build_object('sub', u_integ, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_integ::text, true);
  set local role authenticated;

  j := public.fb_mi_acceso();
  rep := rep || E'\n' || case when not (j->>'es_lider')::boolean and (j->>'persona_id')::uuid = v_pc then 'OK ' else 'FALLA ' end || 'fb_mi_acceso del integrante: ' || j::text;
  select count(*) into n from public.fb_personas;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 'el integrante ve solo su ficha=' || n;
  select count(*) into n from public.fb_personas where id <> v_pc;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'no ve la ficha de nadie más=' || n;
  select count(*) into n from public.fb_notas_privadas;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'no ve las notas privadas=' || n;
  select count(*) into n from public.fb_auditoria;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'no ve la auditoría=' || n;
  select count(*) into n from public.fb_config;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'no ve la configuración del líder=' || n;
  select count(*) into n from public.fb_lideres;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'no ve quién es el líder=' || n;
  select count(*) into n from public.fb_sesiones;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 've solo la minuta publicada, no los borradores=' || n;
  select count(*) into n from public.fb_sesiones where estado <> 'publicada';
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'ningún borrador visible=' || n;
  select count(*) into n from public.fb_minuta_versiones;
  rep := rep || E'\n' || case when n = 2 then 'OK ' else 'FALLA ' end || 've las 2 versiones de su minuta publicada=' || n;
  select count(*) into n from public.fb_compromisos;
  rep := rep || E'\n' || case when n = 3 then 'OK ' else 'FALLA ' end || 've sus 3 compromisos=' || n;
  select count(*) into n from public.fb_compromiso_revisiones;
  rep := rep || E'\n' || case when n = 4 then 'OK ' else 'FALLA ' end || 've las revisiones de sus compromisos=' || n;
  select count(*) into n from public.fb_objetivos;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 've su objetivo=' || n;
  select count(*) into n from public.fb_objetivo_roles;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 've el vínculo de su objetivo con el rol=' || n;
  select count(*) into n from public.fb_persona_roles;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 've su asignación de rol=' || n;
  select count(*) into n from public.fb_roles;
  rep := rep || E'\n' || case when n = 1 then 'OK ' else 'FALLA ' end || 've solo el rol que tiene asignado, no el catálogo completo=' || n;
  select count(*) into n from public.fb_seguimientos;
  rep := rep || E'\n' || case when n = 2 then 'OK ' else 'FALLA ' end || 've sus seguimientos=' || n;

  -- Lo que no puede hacer
  begin
    insert into public.fb_personas (nombre) values ('Intrusa');
    rep := rep || E'\nFALLA el integrante creó una ficha';
  exception when others then rep := rep || E'\nOK el integrante no puede crear fichas'; end;
  update public.fb_personas set cargo = 'Gerente' where id = v_pc;
  get diagnostics n = row_count;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'el integrante no puede editar su ficha (filas=' || n || ')';
  update public.fb_objetivos set estado = 'cumplido' where persona_id = v_pc;
  get diagnostics n = row_count;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'el integrante no puede cambiar sus objetivos (filas=' || n || ')';
  begin
    insert into public.fb_compromisos (persona_id, descripcion, fecha_vencimiento) values (v_pc, 'Auto-asignado', hoy + 3);
    rep := rep || E'\nFALLA el integrante creó un compromiso';
  exception when others then rep := rep || E'\nOK el integrante no puede crear compromisos'; end;
  begin
    perform public.fb_publicar_sesion(v_s3);
    rep := rep || E'\nFALLA el integrante publicó una minuta';
  exception when others then rep := rep || E'\n' || case when sqlstate = '42501' then 'OK ' else 'FALLA ' end || 'el integrante no puede publicar minutas'; end;
  begin
    perform public.fb_revisar_compromiso(v_c2, '{"estado_nuevo":"cumplido","resultado":"x"}'::jsonb);
    rep := rep || E'\nFALLA el integrante revisó un compromiso';
  exception when others then rep := rep || E'\n' || case when sqlstate = '42501' then 'OK ' else 'FALLA ' end || 'el integrante no puede revisar compromisos'; end;
  begin
    perform public.fb_editar_sesion_publicada(v_s, '{"temas":"x"}'::jsonb, 'prueba');
    rep := rep || E'\nFALLA el integrante editó una minuta';
  exception when others then rep := rep || E'\n' || case when sqlstate = '42501' then 'OK ' else 'FALLA ' end || 'el integrante no puede editar minutas'; end;
  begin
    insert into public.fb_notas_privadas (persona_id, cuerpo) values (v_pc, 'nota');
    rep := rep || E'\nFALLA el integrante escribió una nota privada';
  exception when others then rep := rep || E'\nOK el integrante no puede escribir notas privadas'; end;
  begin
    insert into public.fb_lideres (member_id) values ('cristobal_cordoba');
    rep := rep || E'\nFALLA el integrante se hizo líder';
  exception when others then rep := rep || E'\nOK el integrante no puede nombrarse líder'; end;
  begin
    update public.team_members set user_id = u_integ where id = 'cristobal_cuevas';
    rep := rep || E'\nFALLA el integrante pudo reasignar la cuenta del líder';
  exception when others then rep := rep || E'\nOK el integrante no puede reasignar la cuenta de un miembro'; end;

  -- ===================== CUENTA SIN FICHA, ANÓNIMO =====================
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  set local role authenticated;
  select count(*) into n from public.fb_personas;
  rep := rep || E'\n' || case when n = 0 then 'OK ' else 'FALLA ' end || 'una cuenta desconocida no ve fichas=' || n;
  j := public.fb_mi_acceso();
  rep := rep || E'\n' || case when not (j->>'es_lider')::boolean and (j->>'persona_id') is null then 'OK ' else 'FALLA ' end || 'una cuenta desconocida no es líder ni tiene ficha';

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    select count(*) into n from public.fb_personas;
    rep := rep || E'\nFALLA anónimo pudo consultar fichas';
  exception when insufficient_privilege then rep := rep || E'\nOK anónimo sin acceso a las fichas'; end;
  begin
    perform public.fb_mi_acceso();
    rep := rep || E'\nFALLA anónimo pudo llamar a fb_mi_acceso';
  exception when insufficient_privilege then rep := rep || E'\nOK anónimo no puede llamar a fb_mi_acceso'; end;

  reset role;
  raise exception E'INFORME FEEDBACK Y DESARROLLO (esta excepción revierte la prueba):%\n\nFALLAS: %', rep, (length(rep) - length(replace(rep, 'FALLA', ''))) / 5;
end
$test$;
