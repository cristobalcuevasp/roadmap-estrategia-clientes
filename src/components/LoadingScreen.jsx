export function LoadingScreen({ dark, label = "Cargando roadmap del equipo…" }) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${dark ? "bg-slate-950" : "bg-slate-50"}`}>
      <div className="flex flex-col items-center gap-2.5">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
      </div>
    </div>
  );
}
