// Edge Function crm-clima: actualiza el pronóstico de lluvia por comuna.
//
// Proveedores (secreto CLIMA_PROVEEDOR; por defecto "openweather"):
//   • openweather → OpenWeather One Call 3.0, clave en el secreto OPENWEATHER_API_KEY.
//   • google      → Google Maps Platform Weather API, clave en el secreto GOOGLE_WEATHER_API_KEY.
//                   Por sus términos, el pronóstico se borra a las 24 horas (ver google.ts y la migración 0005).
//
// Quién la llama: pg_cron, UNA vez al día (09:30 UTC), mediante private.crm_clima_disparar() (migraciones 0004 a 0006).
// Una segunda llamada el mismo día (manual) no consulta de nuevo si la primera salió bien, salvo con {"force": true}.
// Seguridad: la función se despliega sin verificación de JWT y exige el encabezado x-cron-secret,
// que se valida contra un secreto guardado en Vault (rpc crm_clima_verificar_secreto). Las claves de los
// proveedores viven solo como secretos de la función; nunca se escriben en el repositorio, ni en la base
// de datos, ni en los registros.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ErrorClima, FUENTE, errorPorEstado, estadoCorrida, filasDesdeRespuesta, hoySantiago, limpiar, urlOneCall,
  type FilaClima,
} from "./openweather.ts";
import { FUENTE_GOOGLE, errorGooglePorEstado, filasDesdeGoogle, urlGoogle } from "./google.ts";

interface Proveedor {
  id: "openweather" | "google";
  fuente: string;
  secreto: string; // nombre del secreto con la clave
  url: (lat: number, lon: number, clave: string) => string;
  errorPorEstado: (status: number) => ErrorClima;
  filas: (payload: any, comunaId: number, hoy: string) => FilaClima[];
  /** true si el proveedor exige borrar el pronóstico a las 24 horas */
  borrarA24h: boolean;
}

const PROVEEDORES: Record<string, Proveedor> = {
  openweather: {
    id: "openweather", fuente: FUENTE, secreto: "OPENWEATHER_API_KEY", borrarA24h: false,
    url: (lat, lon, clave) => urlOneCall(lat, lon, clave),
    errorPorEstado,
    filas: (p, id, hoy) => filasDesdeRespuesta(p, id, hoy),
  },
  google: {
    id: "google", fuente: FUENTE_GOOGLE, secreto: "GOOGLE_WEATHER_API_KEY", borrarA24h: true,
    url: (lat, lon, clave) => urlGoogle(lat, lon, clave),
    errorPorEstado: errorGooglePorEstado,
    filas: (p, id, hoy) => filasDesdeGoogle(p, id, hoy),
  },
};

const CONCURRENCIA = 6;
const TIMEOUT_MS = 12_000;
const EN_CURSO_VIGENTE_MIN = 10;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function consultar(prov: Proveedor, comuna: { id: number; lat: number; lon: number }, clave: string, hoy: string): Promise<FilaClima[]> {
  let ultimo: ErrorClima | null = null;
  for (let intento = 0; intento < 2; intento++) {
    if (intento > 0) await dormir(1500);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      let resp: Response;
      try {
        resp = await fetch(prov.url(Number(comuna.lat), Number(comuna.lon), clave), { signal: ctl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) {
        const e = prov.errorPorEstado(resp.status);
        if (e.fatal) throw e;
        ultimo = e;
        continue;
      }
      return prov.filas(await resp.json(), comuna.id, hoy);
    } catch (e) {
      if (e instanceof ErrorClima) {
        if (e.fatal) throw e;
        ultimo = e;
        if (!e.status) break; // respuesta mal formada: reintentar no ayuda
      } else {
        ultimo = new ErrorClima("No se pudo consultar " + prov.fuente + ": " + limpiar((e as Error)?.message, clave));
      }
    }
  }
  throw ultimo ?? new ErrorClima("Error desconocido al consultar " + prov.fuente + ".");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Falta configuración interna de Supabase" }, 500);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Autenticación por secreto compartido (antes de gastar una sola consulta al proveedor).
  const secreto = req.headers.get("x-cron-secret") ?? "";
  const { data: autorizado, error: errAuth } = await db.rpc("crm_clima_verificar_secreto", { p_secreto: secreto });
  if (errAuth || autorizado !== true) return json({ error: "No autorizado" }, 401);

  let force = false;
  try { force = (await req.json())?.force === true; } catch { /* sin cuerpo */ }

  const proveedorId = (Deno.env.get("CLIMA_PROVEEDOR") ?? "openweather").trim().toLowerCase();
  const prov = PROVEEDORES[proveedorId];
  const registrar = (fila: Record<string, unknown>) => db.from("crm_clima_ejecuciones").insert(fila).select("id").single();
  if (!prov) {
    await registrar({ estado: "error", fin: new Date().toISOString(), fuente: proveedorId.slice(0, 40), detalle: "El secreto CLIMA_PROVEEDOR debe ser «openweather» o «google»." });
    return json({ error: "Proveedor de clima no válido" }, 500);
  }

  const hoy = hoySantiago();
  const clave = Deno.env.get(prov.secreto) ?? "";

  if (!clave) {
    await registrar({
      estado: "error", fin: new Date().toISOString(), fuente: prov.fuente,
      detalle: `Falta el secreto ${prov.secreto}. Cárgalo en Supabase → Edge Functions → Secrets.`,
    });
    return json({ error: `Falta el secreto ${prov.secreto}` }, 500);
  }

  // 2) Evitar corridas duplicadas y repetir el trabajo si hoy ya salió bien (una vez al día).
  const hace = new Date(Date.now() - EN_CURSO_VIGENTE_MIN * 60_000).toISOString();
  await db.from("crm_clima_ejecuciones").update({ estado: "error", fin: new Date().toISOString(), detalle: "Corrida interrumpida (no terminó)." })
    .eq("estado", "en_curso").lt("inicio", hace);
  const { data: enCurso } = await db.from("crm_clima_ejecuciones").select("id").eq("estado", "en_curso").limit(1);
  if (enCurso && enCurso.length > 0) return json({ omitida: true, motivo: "Ya hay una actualización en curso" }, 409);
  if (!force) {
    const { data: ultimas } = await db.from("crm_clima_ejecuciones").select("fin").eq("estado", "ok").eq("fuente", prov.fuente).order("fin", { ascending: false }).limit(1);
    const fin = ultimas?.[0]?.fin;
    // Una sola actualización buena por día calendario (en Santiago), con cualquier proveedor.
    if (fin && hoySantiago(new Date(fin)) === hoy) return json({ omitida: true, motivo: "Ya se actualizó correctamente hoy" });
  }

  const inicioCorrida = new Date().toISOString();
  const { data: corrida, error: errCorrida } = await registrar({ estado: "en_curso", fuente: prov.fuente });
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
    try { filas.push(...await consultar(prov, primera, clave, hoy)); ok++; }
    catch (e) {
      if (e instanceof ErrorClima && e.fatal) corte.error = e; else fallos.push(`${primera.nombre}: ${limpiar((e as Error).message, clave)}`);
    }

    if (!corte.error) {
      let i = 0;
      const worker = async () => {
        while (!corte.error && i < resto.length) {
          const c = resto[i++];
          try { filas.push(...await consultar(prov, c, clave, hoy)); ok++; }
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
    const ahoraIso = new Date().toISOString();
    const filasConHora = filas.map((f) => ({ ...f, obtenido_en: ahoraIso }));
    for (let k = 0; k < filasConHora.length; k += 500) {
      const { error } = await db.from("crm_clima_pronostico").upsert(filasConHora.slice(k, k + 500), { onConflict: "comuna_id,fecha,obtenido_el" });
      if (error) {
        await terminar("error", 0, comunas.length, "No se pudo guardar el pronóstico: " + error.message);
        return json({ error: "No se pudo guardar el pronóstico" }, 500);
      }
    }

    // 5) Proveedores con límite de 24 horas (Google): se borra todo lo guardado antes de esta corrida.
    //    Las comunas que fallaron hoy quedan sin dato en vez de mostrar uno vencido.
    if (prov.borrarA24h) {
      const { error } = await db.from("crm_clima_pronostico").delete().like("fuente", "Google%").lt("obtenido_en", inicioCorrida);
      if (error) fallos.push("No se pudo borrar el pronóstico anterior: " + limpiar(error.message, clave));
    }

    const errores = comunas.length - ok;
    const estado = estadoCorrida(ok, errores);
    await terminar(estado, ok, errores, fallos.slice(0, 5).join(" | "));
    return json({ proveedor: prov.id, estado, comunas_ok: ok, comunas_error: errores, filas: filas.length, fecha: hoy });
  } catch (e) {
    await terminar("error", 0, 0, "Error inesperado: " + limpiar((e as Error)?.message, clave));
    return json({ error: "Error inesperado" }, 500);
  }
});
