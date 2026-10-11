import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingScreen } from "../components/LoadingScreen";
import { Login } from "./Login";

/* Muestra el login si no hay sesión; si la hay, entrega la sesión y la función de cerrar sesión. */
export function AuthGate({ dark, children }) {
  const [session, setSession] = useState(undefined); // undefined = verificando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <LoadingScreen dark={dark} label="Verificando sesión…" />;
  if (!session) return <Login dark={dark} />;
  return children(session, () => supabase.auth.signOut());
}
