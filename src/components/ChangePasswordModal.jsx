import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useTheme, tokens } from "../lib/theme";
import { humanizeAuthError } from "../auth/Login";

export function ChangePasswordModal({ onClose, onDone }) {
  const { dark } = useTheme();
  const c = tokens(dark);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputCls = `w-full border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 ${c.input}`;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(humanizeAuthError(err)); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className={`w-full max-w-sm rounded-lg border shadow-2xl ${c.panel} ${c.panelBorder}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${c.panelBorder}`}>
          <h3 className={`text-sm font-semibold ${dark ? "text-slate-100" : "text-slate-800"}`}>Cambiar contraseña</h3>
          <button type="button" onClick={onClose} className={c.textFaint}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input type="password" autoComplete="new-password" autoFocus className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña" />
          <input type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la nueva contraseña" />
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        </div>
        <div className={`p-3 border-t flex items-center justify-end gap-2 ${c.panelBorder}`}>
          <button type="button" onClick={onClose} className={`px-3 py-1.5 text-xs font-medium rounded-md ${c.textFaint} ${dark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>Cancelar</button>
          <button type="submit" disabled={busy} className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
