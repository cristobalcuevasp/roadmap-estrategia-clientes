-- =============================================================================
-- 0006: el clima se actualiza UNA sola vez al día
--
-- Decisión del equipo: una única llamada diaria a la Edge Function `crm-clima`
-- (09:30 UTC = entre 05:30 y 06:30 hora de Santiago, antes de que parta la jornada).
-- Reemplaza las tres llamadas de las migraciones 0004 y 0005 (crm-clima-1, -2 y -3).
--
-- La limpieza horaria de pronósticos de Google (crm-clima-purga, migración 0005) se mantiene:
-- con Google el pronóstico se borra antes de cumplir 24 horas, así que cada mañana hay una
-- ventana corta (aprox. 25 minutos, antes de la actualización) sin pronóstico. Con OpenWeather
-- no hay ventana: el último pronóstico se conserva hasta que llega el nuevo.
-- =============================================================================

select cron.unschedule(jobid) from cron.job where jobname in ('crm-clima-1', 'crm-clima-2', 'crm-clima-3');

select cron.schedule('crm-clima', '30 9 * * *', $$select private.crm_clima_disparar()$$);
