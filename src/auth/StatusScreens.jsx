import { tokens } from "../lib/theme";

function Shell({ dark, title, children }) {
  const c = tokens(dark);
  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${c.app}`}>
      <div className={`w-full max-w-md rounded-lg border shadow-xl p-6 ${c.panel} ${c.panelBorder}`}>
        <h1 className={`text-base font-semibold mb-2 ${dark ? "text-white" : "text-slate-900"}`}>{title}</h1>
        <div className={`text-sm space-y-3 ${c.textDim}`}>{children}</div>
      </div>
    </div>
  );
}

const btn = "px-3 py-1.5 text-xs font-medium rounded-md";

export function NoAccessScreen({ dark, email, onRetry, onSignOut }) {
  return (
    <Shell dark={dark} title="Tu cuenta aún no tiene acceso al equipo">
      <p>
        Iniciaste sesión como <strong>{email}</strong>, pero ese correo no está vinculado a ningún integrante del roadmap.
      </p>
      <p>Pide a alguien del equipo que registre tu correo en <em>Editar equipo</em> (menú de tu avatar) y luego pulsa «Reintentar».</p>
      <div className="flex gap-2 pt-1">
        <button onClick={onRetry} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>Reintentar</button>
        <button onClick={onSignOut} className={`${btn} ${dark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"}`}>Cerrar sesión</button>
      </div>
    </Shell>
  );
}

export function LoadErrorScreen({ dark, message, onRetry, onSignOut }) {
  return (
    <Shell dark={dark} title="No pudimos cargar el roadmap">
      <p>{message || "Ocurrió un error al conectar con el servidor."}</p>
      <div className="flex gap-2 pt-1">
        <button onClick={onRetry} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>Reintentar</button>
        <button onClick={onSignOut} className={`${btn} ${dark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"}`}>Cerrar sesión</button>
      </div>
    </Shell>
  );
}

export function MissingConfigScreen({ dark }) {
  return (
    <Shell dark={dark} title="Falta configurar la conexión">
      <p>
        La app no encontró <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>. Defínelas en un archivo
        <code> .env</code> (para desarrollo) o en <code>.env.production</code> (para publicar) y vuelve a compilar.
      </p>
    </Shell>
  );
}
