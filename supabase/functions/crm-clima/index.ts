// Edge Function crm-clima: actualiza el pronóstico de lluvia por comuna (OpenWeather One Call).
//
// Quién la llama: pg_cron, dos veces al día, mediante private.crm_clima_disparar() (migración 0004).
// Seguridad: la función se despliega sin verificación de JWT y exige el encabezado x-cron-secret,
// que se valida contra un secreto guardado en Vault (rpc crm_clima_verificar_secreto). La clave de
// OpenWeather vive solo como secreto de la función (OPENWEATHER_API_KEY); nunca se escribe en el
// repositorio, ni en la base de datos, ni en los registros.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ErrorClima, FUENTE, errorPorEstado, estadoCorrida, filasDesdeRespuesta, hoySantiago, limpiar, urlOneCall,
  type FilaClima,
} from "./openweather.ts";

const CONCURRENCIA = 6;
const TIMEOUT_MS = 12_000;
const EN_CURSO_VIGENTE_MIN = 10;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function consultar(comuna: { id: number; lat: number; lon: number }, clave: string, hoy: string): Promise<FilaClima[]> {
  let ultimo: ErrorClima | null = null;
  for (let intento = 0; intento < 2; intento++) {
    if (intento > 0) await dormir(1500);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      let resp: Response;
      try {
        resp = await fetch(urlOneCall(Number(comuna.lat), Number(comuna.lon), clave), { signal: ctl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) {
        const e = errorPorEstado(resp.status);
        if (e.fatal) throw e;
        ultimo = e;
        continue;
      }
      return filasDesdeRespuesta(await resp.json(), comuna.id, hoy);
    } catch (e) {
      if (e instanceof ErrorClima) {
        if (e.fatal) throw e;
        ultimo = e;
        if (!e.status) break; // respuesta mal formada: reintentar no ayuda
      } else {
        ultimo = new ErrorClima("No se pudo consultar OpenWeather: " + limpiar((e as Error)?.message, clave));
      }
    }
  }
  throw ultimo ?? new ErrorClima("Error desconocido al consultar OpenWeather.");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Falta configuración interna de Supabase" }, 500);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Autenticación por secreto compartido (antes de gastar una sola consulta a OpenWeather).
  const secreto = req.headers.get("x-cron-secret") ?? "";
  const { data: autorizado, error: errAuth } = await db.rpc("crm_clima_verificar_secreto", { p_secreto: secreto });
  if (errAuth || autorizado !== true) return json({ error: "No autorizado" }, 401);

  let force = false;
  try { force = (await req.json())?.force === true; } catch { /* sin cuerpo */ }

  const hoy = hoySantiago();
  const clave = Deno.env.get("OPENWEATHER_API_KEY") ?? "";

  const registrar = (fila: Record<string, unknown>) => db.from("crm_clima_ejecuciones").insert(fila).select("id").single();

  if (!clave) {
    await registrar({
      estado: "error", fin: new Date().toISOString(), fuente: FUENTE,
      detalle: "Falta el secreto OPENWEATHER_API_KEY. Cárgalo en Supabase → Edge Functions → Secrets.",
    });
    return json({ error: "Falta el secreto OPENWEATHER_API_KEY" }, 500);
  }

  // 2) Evitar corridas duplicadas y repetir el trabajo si hoy ya salió bien.
  const hace = new Date(Date.now() - EN_CURSO_VIGENTE_MIN * 60_000).toISOString();
  await db.from("crm_clima_ejecuciones").update({ estado: "error", fin: new Date().toISOString(), detalle: "Corrida interrumpida (no terminó)." })
    .eq("estado", "en_curso").lt("inicio", hace);
  const { data: enCurso } = await db.from("crm_clima_ejecuciones").select("id").eq("estado", "en_curso").limit(1);
  if (enCurso && enCurso.length > 0) return json({ omitida: true, motivo: "Ya hay una actualización en curso" }, 409);
  if (!force) {
    const { data: ultimas } = await db.from("crm_clima_ejecuciones").select("fin").eq("estado", "ok").order("fin", { ascending: false }).limit(1);
    const fin = ultimas?.[0]?.fin;
    if (fin && hoySantiago(new Date(fin)) === hoy) return json({ omitida: true, motivo: "Hoy ya se actualizó correctamente" });
  }

  const { data: corrida, error: errCorrida } = await registrar({ estado: "en_curso", fuente: FUENTE });
  if (errCorrida || !corrida) return json({ error: "No se pudo registrar la ejecución" }, 500);

  const terminar = async (estado: string, ok: number, error: number, detalle: string) => {
    await db.from("crm_clima_ejecuciones").update({ estado, fin: new Date().toISOString(), comunas_ok: ok, comunas_error: error, detalle: limpiar(detalle, clave).slice(0, 1000) }).eq("id", corrida.id);
  };

  try {
    // 3) Comunas con tiendas abiertas: son las únicas que pesan en el promedio regional.
    const { data: comunas, error: errComunas } = await db.from("crm_comunas").select("id, nombre, lat, lon").gt("tiendas_abiertas", 0).order("id");
    if (errComunas || !comunas || comunas.length === 0) {
      await terminar("error", 0, 0, "No se pudieron leer las comunas con tiendas abiertas.");
      return json({ error: "Sin comunas" }, 500);
    }

    const filas: FilaClima[] = [];
    const fallos: string[] = [];
    let ok = 0;
    const corte: { error: ErrorClima | null } = { error: null };

    // La primera comuna va sola: si la clave no sirve, se corta de inmediato sin gastar el resto.
    const [primera, ...resto] = comunas;
    try { filas.push(...await consultar(primera, clave, hoy)); ok++; }
    catch (e) {
      if (e instanceof ErrorClima && e.fatal) corte.error = e; else fallos.push(`${primera.nombre}: ${limpiar((e as Error).message, clave)}`);
    }

    if (!corte.error) {
      let i = 0;
      const worker = async () => {
        while (!corte.error && i < resto.length) {
          const c = resto[i++];
          try { filas.push(...await consultar(c, clave, hoy)); ok++; }
          catch (e) {
            if (e instanceof ErrorClima && e.fatal) { corte.error = e; return; }
            fallos.push(`${c.nombre}: ${limpiar((e as Error).message, clave)}`);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCIA }, worker));
    }

    if (corte.error) {
      await terminar("error", ok, comunas.length - ok, corte.error.message);
      return json({ error: corte.error.message }, 502);
    }

    // 4) Guardar (reemplaza lo de hoy si se repite la corrida).
    for (let k = 0; k < filas.length; k += 500) {
      const { error } = await db.from("crm_clima_pronostico").upsert(filas.slice(k, k + 500), { onConflict: "comuna_id,fecha,obtenido_el" });
      if (error) {
        await terminar("error", 0, comunas.length, "No se pudo guardar el pronóstico: " + error.message);
        return json({ error: "No se pudo guardar el pronóstico" }, 500);
      }
    }

    const errores = comunas.length - ok;
    const estado = estadoCorrida(ok, errores);
    await terminar(estado, ok, errores, fallos.slice(0, 5).join(" | "));
    return json({ estado, comunas_ok: ok, comunas_error: errores, filas: filas.length, fecha: hoy });
  } catch (e) {
    await terminar("error", 0, 0, "Error inesperado: " + limpiar((e as Error)?.message, clave));
    return json({ error: "Error inesperado" }, 500);
  }
});
