import { X } from "lucide-react";

export function Toast({ toast, onClose }) {
  if (!toast) return null;
  const error = toast.tone === "error";
  return (
    <div role="status" className={`fixed bottom-4 right-4 z-50 max-w-sm flex items-start gap-2 rounded-md px-3 py-2.5 text-xs shadow-lg text-white ${error ? "bg-red-600" : "bg-emerald-600"}`}>
      <p className="flex-1">{toast.message}</p>
      <button onClick={onClose} className="shrink-0 opacity-80 hover:opacity-100" aria-label="Cerrar"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}
