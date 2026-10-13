-- =============================================================================
-- 0004: actualización automática del clima (módulo PROGRAMACIÓN CRM)
--
-- pg_cron dispara dos veces al día la Edge Function `crm-clima`, que consulta
-- OpenWeather y escribe en crm_clima_pronostico. Si el primer intento del día sale
-- bien, el segundo no hace nada (la función lo detecta y responde "omitida").
--
-- Secretos: el secreto compartido entre pg_cron y la función se genera DENTRO de
-- Postgres y vive en Vault; nunca aparece en este archivo. La clave de OpenWeather
-- (OPENWEATHER_API_KEY) NO se guarda aquí ni en la base: se carga como secreto de la
-- Edge Function en el panel de Supabase.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Secreto compartido (se crea una sola vez; si ya existe no se toca)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'crm_clima_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'crm_clima_cron_secret',
      'Secreto compartido entre pg_cron y la Edge Function crm-clima'
    );
  end if;
end $$;

-- La Edge Function (con service_role) pregunta aquí si el secreto que recibió es el correcto.
create or replace function public.crm_clima_verificar_secreto(p_secreto text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_secreto, '') <> '' and exists (
    select 1 from vault.decrypted_secrets
    where name = 'crm_clima_cron_secret' and decrypted_secret = p_secreto
  )
$$;
revoke all on function public.crm_clima_verificar_secreto(text) from public, anon, authenticated;
grant execute on function public.crm_clima_verificar_secreto(text) to service_role;

-- Llamada HTTP asíncrona a la Edge Function, con el secreto leído de Vault en el momento.
create or replace function private.crm_clima_disparar()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_secreto text;
  v_id bigint;
begin
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'crm_clima_cron_secret';
  if v_secreto is null then
    raise exception 'Falta el secreto crm_clima_cron_secret en Vault';
  end if;
  select net.http_post(
    url := 'https://lcahshmjefleteauhmkx.supabase.co/functions/v1/crm-clima',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secreto),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_id;
  return v_id;
end $$;
revoke all on function private.crm_clima_disparar() from public, anon, authenticated;

-- 09:30 y 12:30 UTC = entre 05:30 y 09:30 hora de Santiago según el horario de verano de Chile.
select cron.schedule('crm-clima-1', '30 9 * * *',  $$select private.crm_clima_disparar()$$);
select cron.schedule('crm-clima-2', '30 12 * * *', $$select private.crm_clima_disparar()$$);
