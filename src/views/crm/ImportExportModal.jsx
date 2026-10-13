import { useMemo, useState } from "react";
import { Download, Upload, AlertTriangle, Check } from "lucide-react";
import { mailingsToCSV, previewImport, COLUMNAS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "../../lib/crm/csv";
import { fmtMonth, parts, fmtDMY } from "../../lib/crm/calendar";
import { CenterModal, btnPrimary, btnGhost, btnOutline } from "./crmUi";

function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ImportExportModal({ crm, ctx, cursor, onClose, showToast }) {
  const { c, dark } = ctx;
  const [tab, setTab] = useState("exportar");
  const [alcance, setAlcance] = useState("mes");
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [incluirDup, setIncluirDup] = useState(false);
  const [busy, setBusy] = useState(false);
  const { y, m } = parts(cursor);

  const names = useMemo(() => ({
    catalogo: (id) => (id ? ctx.catById.get(id)?.nombre || "" : ""),
    responsable: (id) => (id ? ctx.respById.get(id)?.nombre || "" : ""),
  }), [ctx.catById, ctx.respById]);

  const exportar = () => {
    const rows = alcance === "todo" ? crm.mailings : crm.mailings.filter((x) => parts(x.fecha).y === y && parts(x.fecha).m === m);
    download(alcance === "todo" ? "programacion-crm-completa.csv" : `programacion-crm-${y}-${String(m).padStart(2, "0")}.csv`, mailingsToCSV(rows, names));
    showToast(`Se exportaron ${rows.length} mailings.`, "ok");
  };
  const plantilla = () => download("plantilla-programacion-crm.csv", "﻿" + COLUMNAS.map((x) => x.label).join(";") + "\r\n");

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name); setIncluirDup(false);
    if (f.size > MAX_IMPORT_BYTES) { setPreview({ errorGeneral: "El archivo supera los 2 MB. Divídelo en partes.", filas: [] }); return; }
    const text = await f.text();
    setPreview(previewImport(text, { catalogo: crm.catalogo, responsables: crm.responsables, existentes: crm.mailings }));
  };

  const filas = preview?.filas || [];
  const aImportar = filas.filter((f) => f.ok && (!f.duplicada || incluirDup));
  const conError = filas.filter((f) => !f.ok);
  const dups = filas.filter((f) => f.ok && f.duplicada);
  const nuevos = [...new Set(aImportar.filter((f) => f.tituloNuevo).map((f) => f.tituloNuevo))];

  const importar = async () => {
    setBusy(true);
    try {
      const res = await crm.importMailings(aImportar);
      if (res) { showToast(`Importación lista: ${res.creados} mailings creados${res.titulosNuevos ? ` y ${res.titulosNuevos} título(s) nuevo(s) en el catálogo` : ""}.`, "ok"); onClose(); }
    } finally { setBusy(false); }
  };

  return (
    <CenterModal c={c} title="Importar y exportar mailings" onClose={onClose} width="max-w-3xl"
      footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btnGhost(c)}>Cerrar</button>
        {tab === "exportar" ? <button type="button" onClick={exportar} className={`${btnPrimary} flex items-center gap-1`}><Download className="w-3.5 h-3.5" />Descargar CSV</button>
          : <button type="button" disabled={busy || aImportar.length === 0} onClick={importar} className={`${btnPrimary} flex items-center gap-1`}><Upload className="w-3.5 h-3.5" />Importar {aImportar.length || ""} fila(s)</button>}</div>}>
      <div role="tablist" className="flex gap-1 mb-3 -mt-1">
        {[["exportar", "Exportar"], ["importar", "Importar"]].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === id ? c.navActive : c.navIdle}`}>{label}</button>
        ))}
      </div>

      {tab === "exportar" && (
        <div className="space-y-3 text-xs">
          <p className={c.textDim}>Se descarga un archivo CSV (separador “;”, UTF-8) que abre bien en Excel. Incluye fecha, hora, título, responsable, Einstein, configuración, estado, segmento, marca, objetivo, canal, observaciones, fecha de envío e ID externo. Los textos que empiezan con = + - @ se marcan con un apóstrofe para que Excel no los ejecute como fórmula.</p>
          <div className="space-y-1.5">
            <label className={`flex items-center gap-2 ${c.text}`}><input type="radio" checked={alcance === "mes"} onChange={() => setAlcance("mes")} />Solo el mes que estás viendo ({fmtMonth(y, m)})</label>
            <label className={`flex items-center gap-2 ${c.text}`}><input type="radio" checked={alcance === "todo"} onChange={() => setAlcance("todo")} />Todos los mailings ({crm.mailings.length})</label>
          </div>
        </div>
      )}

      {tab === "importar" && (
        <div className="space-y-3 text-xs">
          <p className={c.textDim}>Sube un CSV con encabezados. Obligatorias: <b>Fecha</b> (DD/MM/AAAA) y <b>Título</b>. Las demás columnas son opcionales y deben coincidir con los catálogos (estado, responsable, Einstein, configuración, marca, canal). Si falta el estado, queda Pendiente. Los títulos que no existan se crean en el catálogo. Antes de guardar verás una vista previa; no se escribe nada hasta que confirmes. Máximo {MAX_IMPORT_ROWS} filas y 2 MB.</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="file" accept=".csv,.txt,text/csv" onChange={onFile} aria-label="Archivo CSV" className={`text-xs ${c.textDim}`} />
            <button type="button" onClick={plantilla} className={`${btnOutline(c)} flex items-center gap-1`}><Download className="w-3.5 h-3.5" />Plantilla vacía</button>
          </div>

          {preview?.errorGeneral && <p className="text-red-500 flex items-start gap-1" role="alert"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{preview.errorGeneral}</p>}

          {preview && !preview.errorGeneral && (
            <div className="space-y-2">
              <p className={c.text}><b>{fileName}</b>: {filas.length} filas leídas (separador “{preview.delimiter === "\t" ? "tab" : preview.delimiter}”). Columnas reconocidas: {preview.columnas.join(", ")}.</p>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-1 rounded ${dark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-800"}`}><Check className="inline w-3 h-3 mr-1" />{filas.filter((f) => f.ok && !f.duplicada).length} listas</span>
                {dups.length > 0 && <span className={`px-2 py-1 rounded ${dark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-800"}`}>{dups.length} repetidas</span>}
                {conError.length > 0 && <span className={`px-2 py-1 rounded ${dark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-800"}`}>{conError.length} con errores (se omiten)</span>}
                {nuevos.length > 0 && <span className={`px-2 py-1 rounded ${dark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-800"}`}>{nuevos.length} título(s) nuevo(s)</span>}
              </div>
              {dups.length > 0 && <label className={`flex items-center gap-2 ${c.textDim}`}><input type="checkbox" checked={incluirDup} onChange={(e) => setIncluirDup(e.target.checked)} />Importar también las repetidas</label>}
              <div className={`max-h-64 overflow-y-auto rounded-md border ${c.panelBorder}`}>
                <table className="w-full">
                  <thead className={`sticky top-0 ${c.panel}`}><tr className={`text-left ${c.textFaint}`}><th className="p-1.5 font-medium w-12">Línea</th><th className="p-1.5 font-medium w-24">Fecha</th><th className="p-1.5 font-medium">Resultado</th></tr></thead>
                  <tbody>
                    {filas.slice(0, 200).map((f) => (
                      <tr key={f.linea} className={`border-t ${c.borderSubtle} align-top`}>
                        <td className={`p-1.5 font-mono ${c.textFaint}`}>{f.linea}</td>
                        <td className={`p-1.5 ${c.textDim}`}>{f.data.fecha ? fmtDMY(f.data.fecha) : "—"}</td>
                        <td className="p-1.5">
                          {f.errores.map((er, i) => <p key={i} className="text-red-500">✕ {er}</p>)}
                          {f.avisos.map((av, i) => <p key={i} className="text-amber-500">• {av}</p>)}
                          {f.ok && f.avisos.length === 0 && <p className="text-emerald-500">Lista para importar</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filas.length > 200 && <p className={`p-1.5 ${c.textFaint}`}>Se muestran las primeras 200 filas; se procesan todas.</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </CenterModal>
  );
}
