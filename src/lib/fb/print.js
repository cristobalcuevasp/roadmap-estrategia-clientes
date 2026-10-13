/* Impresión y PDF de minutas. Se arma un documento HTML propio (todo el texto escapado) y se imprime desde un marco
   oculto: el navegador ofrece "Guardar como PDF". Solo incluye contenido compartido: nunca las notas privadas. */
import { escapeHtml, toHtml, isBlank } from "./richtext";
import { SECCIONES_MINUTA, tipoLabel, modalidadLabel, prioridadMeta, estadoCompromisoMeta } from "./constants";
import { fmtFechaHora } from "./datetime";
import { fmtDMY } from "../crm/calendar";
import { estadoEfectivo } from "./logic";

const CSS = `
  *{box-sizing:border-box} body{font:12px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1e293b;margin:0;padding:24px 28px}
  h1{font-size:18px;margin:0 0 2px} h2{font-size:13px;margin:16px 0 4px;padding-bottom:3px;border-bottom:1px solid #cbd5e1;color:#0f172a}
  h4{font-size:12px;margin:8px 0 2px} p{margin:0 0 6px} ul,ol{margin:0 0 6px;padding-left:20px}
  .meta{color:#475569;margin:0 0 4px} .tag{display:inline-block;border:1px solid #94a3b8;border-radius:4px;padding:0 6px;font-size:11px;margin-right:4px}
  table{width:100%;border-collapse:collapse;margin:4px 0} th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top;font-size:11px} th{background:#f1f5f9}
  .vacio{color:#94a3b8;font-style:italic} .pie{margin-top:20px;font-size:10px;color:#64748b;border-top:1px solid #cbd5e1;padding-top:6px}
  @media print{body{padding:0} h2{break-after:avoid} table,tr{break-inside:avoid}}
`;

const seccion = (titulo, texto) => `<h2>${escapeHtml(titulo)}</h2>${isBlank(texto) ? '<p class="vacio">Sin contenido.</p>' : toHtml(texto)}`;

/**
 * Documento HTML de una minuta. `sesion` es la reunión (o el contenido de una versión), `compromisos` los vinculados.
 * `nombrePersona` y `hoy` se reciben ya resueltos para que la función sea pura.
 */
export function minutaHtml({ sesion, nombrePersona, compromisos = [], version, hoy, publicadaPor, incluirRegistro = true }) {
  const m = sesion.minuta || {};
  const ctx = sesion.contexto || {};
  const roles = (ctx.roles || []).map((r) => `<tr><td>${escapeHtml(r.nombre)}</td><td>${toHtml(r.expectativas || "") || ""}</td></tr>`).join("");
  const objs = (ctx.objetivos || []).map((o) => `<tr><td>${escapeHtml(o.titulo)}</td><td>${escapeHtml(o.estado)}</td><td>${escapeHtml(String(o.avance ?? 0))}%</td><td>${o.fecha_objetivo ? escapeHtml(fmtDMY(o.fecha_objetivo)) : "—"}</td></tr>`).join("");
  const comps = compromisos.map((c) => `<tr><td>${escapeHtml(c.descripcion)}</td><td>${escapeHtml(fmtDMY(c.fecha_vencimiento_original || c.fecha_vencimiento))}</td><td>${escapeHtml(prioridadMeta(c.prioridad).label)}</td><td>${escapeHtml(estadoCompromisoMeta(estadoEfectivo(c, hoy)).label)}</td></tr>`).join("");
  const registro = [["Agenda", sesion.agenda], ["Temas tratados", sesion.temas], ["Fortalezas identificadas", sesion.fortalezas], ["Logros destacados", sesion.logros], ["Oportunidades de mejora", sesion.oportunidades],
    ["Comentarios del líder", sesion.comentarios_lider], ["Comentarios del colaborador", sesion.comentarios_colaborador], ["Acuerdos alcanzados", sesion.acuerdos], ["Próximos pasos", sesion.proximos_pasos], ["Temas pendientes", sesion.temas_pendientes]]
    .filter(([, t]) => !isBlank(t)).map(([t, x]) => `<h4>${escapeHtml(t)}</h4>${toHtml(x)}`).join("");
  const estado = sesion.estado === "publicada" ? `Publicada${version ? ` · versión ${version}` : ""}` : "Borrador (aún no publicada)";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Minuta · ${escapeHtml(nombrePersona)} · ${escapeHtml(fmtFechaHora(sesion.fecha_hora))}</title><style>${CSS}</style></head><body>
<h1>Minuta de reunión</h1>
<p class="meta"><strong>${escapeHtml(nombrePersona)}</strong> · ${escapeHtml(fmtFechaHora(sesion.fecha_hora))} · ${escapeHtml(tipoLabel(sesion.tipo))} · ${escapeHtml(modalidadLabel(sesion.modalidad))}</p>
<p class="meta"><span class="tag">${escapeHtml(estado)}</span>${sesion.participantes ? ` Participantes: ${escapeHtml(sesion.participantes)}` : ""}${publicadaPor ? ` · Publicada por ${escapeHtml(publicadaPor)}` : ""}</p>
${SECCIONES_MINUTA.map((s) => seccion(s.titulo, m[s.id])).join("")}
${comps ? `<h2>Compromisos vinculados (estado a la fecha de impresión)</h2><table><tr><th>Compromiso</th><th>Fecha original</th><th>Prioridad</th><th>Estado</th></tr>${comps}</table>` : ""}
${roles || objs ? `<h2>Contexto al momento de la reunión</h2>${roles ? `<table><tr><th>Rol</th><th>Expectativas</th></tr>${roles}</table>` : ""}${objs ? `<table><tr><th>Objetivo</th><th>Estado</th><th>Avance</th><th>Fecha objetivo</th></tr>${objs}</table>` : ""}` : ""}
${incluirRegistro && registro ? `<h2>Registro de la conversación</h2>${registro}` : ""}
<p class="pie">Documento confidencial de uso interno. Impreso el ${escapeHtml(fmtDMY(hoy))}. No incluye las notas privadas del líder.</p>
</body></html>`;
}

/** Abre el diálogo de impresión (o "Guardar como PDF") con el documento dado, usando un marco oculto. */
export function printHtml(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", "Impresión de minuta");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  const remove = () => { try { frame.remove(); } catch (e) { /* ya no está */ } };
  setTimeout(() => {
    try {
      frame.contentWindow.onafterprint = remove;
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (e) { remove(); throw e; }
    setTimeout(remove, 60000);
  }, 250);
}
