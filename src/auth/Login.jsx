import { useState } from "react";
import { Zap } from "lucide-react";
import { supabase } from "../lib/supabase";
import { tokens } from "../lib/theme";

export function humanizeAuthError(err) {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.";
  if (m.includes("database error saving new user") || m.includes("signup_not_allowed")) {
    return "Este correo no está autorizado. Pide a alguien del equipo que lo agregue en «Editar equipo» y vuelve a intentarlo.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya existe una cuenta con este correo. Inicia sesión.";
  if (m.includes("password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("rate limit")) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (m.includes("failed to fetch")) return "Sin conexión con el servidor. Revisa tu internet.";
  return err?.message || "No se pudo completar la acción.";
}

export function Login({ dark }) {
  const c = tokens(dark);
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const inputCls = `w-full border rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 ${c.input}`;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setInfo("");
    try {
      const creds = { email: email.trim(), password };
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword(creds);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp(creds);
        if (err) throw err;
        if (!data.session) setInfo("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
      }
    } catch (err) {
      setError(humanizeAuthError(err));
    }
    setBusy(false);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${c.app}`}>
      <div className={`w-full max-w-sm rounded-lg border shadow-xl p-6 ${c.panel} ${c.panelBorder}`}>
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0"><Zap className="w-4 h-4" /></span>
          <div>
            <h1 className={`text-base font-semibold leading-tight ${dark ? "text-white" : "text-slate-900"}`}>Estrategia CX</h1>
            <p className={`text-xs ${c.textFaint}`}>Roadmap · Estrategia de Clientes</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="email" className={`block text-xs font-medium mb-1 ${c.textDim}`}>Correo</label>
            <input id="email" type="email" autoComplete="email" required autoFocus className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.cl" />
          </div>
          <div>
            <label htmlFor="password" className={`block text-xs font-medium mb-1 ${c.textDim}`}>Contraseña</label>
            <input id="password" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>

          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          {info && <p className="text-xs text-emerald-500">{info}</p>}

          <button type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md transition-colors">
            {busy ? "Un momento…" : mode === "signin" ? "Entrar" : "Crear mi cuenta"}
          </button>
        </form>

        <p className={`text-xs mt-4 text-center ${c.textFaint}`}>
          {mode === "signin" ? "¿Primera vez aquí?" : "¿Ya tienes cuenta?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }} className={dark ? "text-blue-400" : "text-blue-600"}>
            {mode === "signin" ? "Crea tu cuenta" : "Inicia sesión"}
          </button>
        </p>
        {mode === "signup" && (
          <p className={`text-xs mt-2 text-center ${c.textFaint}`}>Solo pueden crear cuenta los correos agregados al equipo.</p>
        )}
      </div>
    </div>
  );
}
