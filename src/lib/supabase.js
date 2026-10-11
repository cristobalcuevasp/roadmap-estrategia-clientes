import { createClient } from "@supabase/supabase-js";

/* La URL y la clave pública (anon / publishable) son seguras de exponer en el navegador:
   el acceso a los datos lo controlan las políticas RLS de la base de datos. */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;
