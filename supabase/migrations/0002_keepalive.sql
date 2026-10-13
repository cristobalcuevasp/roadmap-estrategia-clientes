-- Latido: función de solo lectura que devuelve la hora del servidor.
-- La usa el workflow .github/workflows/keepalive.yml (2 veces por semana) para que
-- el proyecto de Supabase no se pause por inactividad en el plan gratuito.
-- No lee ni escribe ninguna tabla.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
