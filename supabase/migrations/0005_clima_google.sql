-- =============================================================================
-- 0005: proveedor de clima alternativo (Google Maps Platform Weather API)
--
-- La Edge Function `crm-clima` ahora admite dos proveedores (secreto CLIMA_PROVEEDOR):
--   • openweather (por defecto): una consulta por día.
--   • google: cada ~12 horas, porque los términos de Google permiten guardar el pronóstico
--     diario como máximo 24 horas.
--
-- Para cumplir esa regla aunque una corrida falle:
--   1) la función borra el pronóstico de Google anterior apenas guarda el nuevo, y
--   2) esta migración agrega una limpieza por hora que borra todo pronóstico de Google
--      con más de 23 horas (red de seguridad), y una tercera corrida diaria.
--
-- Con OpenWeather la limpieza no hace nada (solo toca filas cuya fuente empieza con "Google").
-- =============================================================================

create or replace function private.crm_clima_purgar_google()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_borradas integer;
begin
  delete from public.crm_clima_pronostico
  where fuente like 'Google%' and obtenido_en < now() - interval '23 hours';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end $$;
revoke all on function private.crm_clima_purgar_google() from public, anon, authenticated;

-- Cada hora, al minuto 5.
select cron.schedule('crm-clima-purga', '5 * * * *', $$select private.crm_clima_purgar_google()$$);

-- Tercera corrida diaria (21:30 UTC). Con OpenWeather la función la omite sola ("ya se actualizó hoy");
-- con Google completa el ritmo de ~12 horas junto con la de las 09:30 UTC.
select cron.schedule('crm-clima-3', '30 21 * * *', $$select private.crm_clima_disparar()$$);
