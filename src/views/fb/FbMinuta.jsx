import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, Pencil, History, Lock, Eye, GitCompare } from "lucide-react";
import { useFbCtx } from "./ctx";
import { Field, inputCls, btnPrimary, btnGhost, btnOutline } from "../crm/crmUi";
import { Card, Chip, Empty, Rich, RichEditor, Tabs, Confirm, FieldError, PersonaAvatar, LoadingBlock } from "./FbParts";
import { ListaCompromisos, ordenarCompromisos } from "./FbCompromisoParts";
import { CAMPOS_REGISTRO } from "./FbFeedbackForm";
import { diffVersiones, fmtFecha } from "../../lib/fb/logic";
import { TIPOS_SESION, MODALIDADES, SECCIONES_MINUTA, tipoLabel, modalidadLabel, estadoObjetivoMeta } from "../../lib/fb/constants";
import { santiagoLocalToISO, isoToSantiagoLocal, fmtFechaHora } from "../../lib/fb/datetime";
import { isBlank, toPlain } from "../../lib/fb/richtext";
import { minutaHtml, printHtml } from "../../lib/fb/print";

const TEXTOS = CAMPOS_REGISTRO.map((x) => x.k);

/** Estado inicial del editor a partir de la reunión publicada. */
const editorDesde = (s) => ({
  fecha_local: isoToSantiagoLocal(s.fecha_hora), tipo: s.tipo, modalidad: s.modalidad, participantes: s.participantes || "",
  ...Object.fromEntries(TEXTOS.map((k) => [k, s[k] || ""])),
  minuta: Object.fromEntries(SECCIONES_MINUTA.map((x) => [x.id, s.minuta?.[x.id] || ""])),
  motivo: "",
});

/** Cambios entre la reunión y lo editado: sirve para el resumen previo y para enviar solo lo que cambió. */
function cambiosDe(s, e) {
  const out = {};
  const iso = santiagoLocalToISO(e.fecha_local);
  if (e.fecha_local !== isoToSantiagoLocal(s.fecha_hora) && iso) out.fecha_hora = iso;
  for (const k of ["tipo", "modalidad", "participantes", ...TEXTOS]) if ((e[k] ?? "") !== (s[k] ?? "")) out[k] = e[k];
  if (SECCIONES_MINUTA.some((x) => (e.minuta[x.id] ?? "") !== (s.minuta?.[x.id] ?? ""))) out.minuta = e.minuta;
  return out;
}

const snap = (s) => ({ ...s, minuta: s.minuta || {} });

/** Vista de una minuta: leerla, imprimirla, ver sus versiones y (el líder) editarla dejando el motivo. */
export function FbMinuta({ sesionId }) {
  const { fb, c, dark, hoy, esLider, go, nameOf, setDirty, showToast } = useFbCtx();
  const s = fb.sesiones.find((x) => x.id === sesionId);
  const persona = s ? fb.personasPorId.get(s.persona_id) : null;
  const [tab, setTab] = useState("minuta");
  const [versiones, setVersiones] = useState(null); // null = cargando
  const [errVersiones, setErrVersiones] = useState("");
  const [editor, setEditor] = useState(null);
  const [errs, setErrs] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const version = s?.version;
  const publicada = s?.estado === "publicada";
  useEffect(() => {
    let vivo = true;
    if (!sesionId || !publicada) { setVersiones([]); return undefined; }
    setErrVersiones("");
    fb.loadVersiones(sesionId).then((rows) => { if (vivo) setVersiones(rows); }).catch((e) => { console.error(e); if (vivo) { setVersiones([]); setErrVersiones("No se pudo cargar el historial de versiones."); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionId, publicada, version]);

  const cambios = useMemo(() => (s && editor ? cambiosDe(s, editor) : {}), [s, editor]);
  const hayCambios = Object.keys(cambios).length > 0;
  useEffect(() => { setDirty(!!editor && hayCambios); }, [editor, hayCambios, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const vinculados = useMemo(() => (s ? fb.compromisos.filter((x) => x.sesion_id === s.id) : []), [fb.compromisos, s]);

  const imprimir = useCallback((contenido, ver) => {
    try {
      printHtml(minutaHtml({ sesion: { ...s, ...(contenido || {}), estado: "publicada" }, nombrePersona: persona?.nombre || "—", compromisos: vinculados, version: ver ?? s.version, hoy, publicadaPor: nameOf(s.publicada_por) || "" }));
    } catch (e) { console.error(e); showToast("No se pudo abrir la impresión. Revisa que el navegador permita ventanas de impresión."); }
  }, [s, persona, vinculados, hoy, nameOf, showToast]);

  if (!s || !persona) {
    return <Card c={c}><Empty c={c} title="Esta minuta no está disponible" text="Pudo ser eliminada o no tienes acceso a ella." action={<button onClick={() => go({ name: esLider ? "panel" : "ficha", personaId: fb.access?.persona_id }, { reset: true })} className={btnPrimary}>Ir al inicio</button>} /></Card>;
  }

  if (!publicada) {
    return (
      <Card c={c}><Empty c={c} icon={Pencil} title="Esta reunión sigue en borrador" text="La minuta se puede leer, imprimir y comparar una vez publicada."
        action={esLider ? <button onClick={() => go({ name: "feedback", personaId: s.persona_id, sesionId: s.id }, { replace: true })} className={btnPrimary}>Continuar editando</button> : null} /></Card>
    );
  }

  const abrirEditor = () => { setErrs({}); setEditor(editorDesde(s)); setTab("minuta"); };
  const upd = (patch) => setEditor((x) => ({ ...x, ...patch }));
  const guardarEdicion = async () => {
    const e = {};
    const iso = santiagoLocalToISO(editor.fecha_local);
    if (!iso) e.fecha_hora = "Indica fecha y hora válidas.";
    if (isBlank(editor.minuta.resumen)) e.resumen = "La minuta necesita al menos el resumen de la conversación.";
    if (editor.motivo.trim().length < 3) e.motivo = "Indica el motivo de la edición (mínimo 3 caracteres).";
    if (!hayCambios) e.motivo = e.motivo || "No hay cambios para guardar.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const out = await fb.editarPublicada(s.id, cambios, editor.motivo.trim());
      if (out) { setEditor(null); setDirty(false); showToast(`Minuta actualizada · versión ${out.version}`, "ok"); }
    } finally { setGuardando(false); }
  };

  const listaVersiones = (versiones || []).slice().sort((a, b) => b.version - a.version);
  const tabs = [
    { id: "minuta", label: "Minuta" },
    { id: "registro", label: "Registro de la conversación" },
    { id: "versiones", label: "Versiones", badge: listaVersiones.length || undefined },
  ];

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border p-3 flex flex-wrap items-center gap-3 ${c.panel} ${c.panelBorder}`}>
        <PersonaAvatar persona={persona} size="lg" />
        <div className="flex-1 min-w-[14rem]">
          <p className={`text-xs ${c.textFaint}`}>Minuta de reunión</p>
          <h3 className={`text-base font-semibold ${c.dark ? "text-slate-100" : "text-slate-800"}`}>{persona.nombre} · {fmtFechaHora(s.fecha_hora)}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <Chip color="blue" dark={dark}>{tipoLabel(s.tipo)}</Chip>
            <Chip color="slate" dark={dark}>{modalidadLabel(s.modalidad)}</Chip>
            <Chip color="emerald" dark={dark}>Publicada · versión {s.version}</Chip>
          </div>
          <p className={`text-xs mt-1 ${c.textDim}`}>
            {s.publicada_por ? `Publicada por ${nameOf(s.publicada_por) || "—"} el ${fmtFechaHora(s.publicada_en)}` : `Publicada el ${fmtFechaHora(s.publicada_en)}`}
            {s.participantes ? ` · Participantes: ${s.participantes}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => imprimir()} className={`${btnOutline(c)} flex items-center gap-1`}><Printer className="w-3.5 h-3.5" />Imprimir / PDF</button>
          <button onClick={() => go({ name: "ficha", personaId: persona.id, tab: "historial" })} className={btnOutline(c)}>Ver ficha</button>
          {esLider && !editor && <button onClick={abrirEditor} className={`${btnPrimary} flex items-center gap-1`}><Pencil className="w-3.5 h-3.5" />Editar minuta</button>}
        </div>
      </div>

      {!esLider && <p className={`flex items-center gap-1 text-xs ${c.textDim}`}><Lock className="w-3 h-3" />Esta minuta es de solo lectura. Si algo no está bien, conversa con tu líder para que la corrija; cada corrección queda registrada.</p>}

      {editor ? (
        <div className="space-y-3">
          <Card c={c} title="Editar minuta publicada" right={<span className={`text-xs ${c.textDim}`}>Se guardará como la versión {s.version + 1}</span>}>
            <p className={`text-xs mb-3 ${c.textDim}`}>La versión anterior se conserva. Los compromisos vinculados no cambian al editar la minuta: se gestionan con «Revisar compromiso».</p>
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <Field label="Fecha y hora (hora de Chile)" c={c}><input type="datetime-local" value={editor.fecha_local} onChange={(e) => upd({ fecha_local: e.target.value })} className={inputCls(c)} /><FieldError msg={errs.fecha_hora} /></Field>
              <Field label="Participantes" c={c}><input value={editor.participantes} maxLength={1000} onChange={(e) => upd({ participantes: e.target.value })} className={inputCls(c)} /></Field>
              <Field label="Tipo de reunión" c={c}><select value={editor.tipo} onChange={(e) => upd({ tipo: e.target.value })} className={inputCls(c)}>{TIPOS_SESION.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
              <Field label="Modalidad" c={c}><select value={editor.modalidad} onChange={(e) => upd({ modalidad: e.target.value })} className={inputCls(c)}>{MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
            </div>
            <div className="space-y-4">
              {SECCIONES_MINUTA.map((x) => (
                <Field key={x.id} label={x.titulo} c={c}>
                  <RichEditor id={`ed-min-${x.id}`} value={editor.minuta[x.id]} onChange={(v) => upd({ minuta: { ...editor.minuta, [x.id]: v } })} rows={x.id === "resumen" ? 6 : 3} c={c} ariaLabel={x.titulo} />
                  {x.id === "resumen" && <FieldError msg={errs.resumen} />}
                </Field>
              ))}
            </div>
          </Card>
          <Card c={c} title="Registro de la conversación (opcional)">
            <div className="space-y-4">
              {CAMPOS_REGISTRO.map((x) => (
                <Field key={x.k} label={x.label} c={c}><RichEditor id={`ed-${x.k}`} value={editor[x.k]} onChange={(v) => upd({ [x.k]: v })} rows={x.rows} c={c} ariaLabel={x.label} /></Field>
              ))}
            </div>
          </Card>
          <Card c={c} title="Motivo del cambio">
            <Field label="¿Por qué editas esta minuta? *" c={c} hint="Queda registrado en el historial de versiones junto con tu nombre y la fecha.">
              <input value={editor.motivo} maxLength={300} onChange={(e) => upd({ motivo: e.target.value })} className={inputCls(c)} aria-label="Motivo de la edición" placeholder="Por ejemplo: corregir la fecha acordada" />
              <FieldError msg={errs.motivo} />
            </Field>
            <p className={`text-xs mt-2 ${c.textDim}`}>{hayCambios ? `Cambia: ${diffVersiones(snap(s), { ...snap(s), ...cambios, fecha_hora: cambios.fecha_hora || s.fecha_hora }).map((x) => x.label).join(", ")}.` : "Todavía no hay cambios."}</p>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => (hayCambios ? setConfirm("cancelar") : setEditor(null))} className={btnGhost(c)}>Cancelar</button>
              <button type="button" onClick={guardarEdicion} disabled={guardando || fb.saving || !hayCambios} className={btnPrimary}>{guardando ? "Guardando…" : "Guardar como nueva versión"}</button>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <Tabs tabs={tabs} value={tab} onChange={setTab} c={c} />
          {tab === "minuta" && (
            <div className="space-y-3">
              <Card c={c} title="Minuta">
                <div className="space-y-4">
                  {SECCIONES_MINUTA.map((x) => (
                    <div key={x.id}><h4 className={`text-xs font-semibold mb-1 ${c.dark ? "text-slate-200" : "text-slate-700"}`}>{x.titulo}</h4><div className={c.text}><Rich text={s.minuta?.[x.id]} empty="Sin contenido." c={c} /></div></div>
                  ))}
                </div>
              </Card>
              <Card c={c} title="Compromisos vinculados a esta reunión" pad={false}>
                {vinculados.length === 0
                  ? <Empty c={c} title="Esta reunión no generó compromisos" />
                  : <div className="p-3"><ListaCompromisos compromisos={ordenarCompromisos(vinculados, hoy)} mostrarPersona /></div>}
              </Card>
              {s.proxima_revision && <p className={`text-xs ${c.textDim}`}>Próxima revisión acordada: <strong>{fmtFecha(s.proxima_revision)}</strong></p>}
              {((s.contexto?.roles || []).length > 0 || (s.contexto?.objetivos || []).length > 0) && (
                <Card c={c} title="Contexto al momento de la reunión">
                  <p className={`text-xs mb-2 ${c.textFaint}`}>Foto de los roles y objetivos vigentes cuando se publicó la minuta; no cambia aunque después se actualicen.</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><h4 className={`text-xs font-semibold mb-1 ${c.textDim}`}>Roles</h4>
                      {(s.contexto?.roles || []).length ? <ul className="space-y-2">{s.contexto.roles.map((r, i) => <li key={i}><p className={`text-xs font-medium ${c.text}`}>{r.nombre}</p>{!isBlank(r.expectativas) && <div className={c.textDim}><Rich text={r.expectativas} c={c} /></div>}</li>)}</ul> : <p className={`text-xs ${c.textFaint}`}>Sin roles.</p>}</div>
                    <div><h4 className={`text-xs font-semibold mb-1 ${c.textDim}`}>Objetivos activos</h4>
                      {(s.contexto?.objetivos || []).length ? <ul className="space-y-1.5">{s.contexto.objetivos.map((o, i) => <li key={i} className={`text-xs ${c.text}`}>{o.titulo} <span className={c.textFaint}>· {estadoObjetivoMeta(o.estado).label} · {o.avance ?? 0}%{o.fecha_objetivo ? ` · ${fmtFecha(o.fecha_objetivo)}` : ""}</span></li>)}</ul> : <p className={`text-xs ${c.textFaint}`}>Sin objetivos.</p>}</div>
                  </div>
                </Card>
              )}
            </div>
          )}
          {tab === "registro" && <RegistroConversacion s={s} />}
          {tab === "versiones" && <Versiones s={s} versiones={listaVersiones} cargando={versiones === null} error={errVersiones} onImprimir={imprimir} nameOf={nameOf} />}
        </>
      )}

      {confirm === "cancelar" && (
        <Confirm title="Descartar los cambios" c={c} danger confirmLabel="Descartar cambios" cancelLabel="Seguir editando" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); setEditor(null); setDirty(false); }}>
          <p>Lo que editaste en esta minuta no se guardará.</p>
        </Confirm>
      )}
    </div>
  );
}

function RegistroConversacion({ s }) {
  const { c } = useFbCtx();
  const llenos = CAMPOS_REGISTRO.filter((x) => !isBlank(s[x.k]));
  return (
    <Card c={c} title="Registro de la conversación">
      {llenos.length === 0 ? <Empty c={c} title="Sin registro adicional" text="Esta reunión solo tiene la minuta." /> : (
        <div className="space-y-4">{llenos.map((x) => <div key={x.k}><h4 className={`text-xs font-semibold mb-1 ${c.textDim}`}>{x.label}</h4><div className={c.text}><Rich text={s[x.k]} c={c} /></div></div>)}</div>
      )}
    </Card>
  );
}

function Versiones({ s, versiones, cargando, error, onImprimir, nameOf }) {
  const { c, dark } = useFbCtx();
  const [abierta, setAbierta] = useState(null); // { version, modo: "ver" | "cambios" }
  if (cargando) return <LoadingBlock c={c} text="Cargando versiones…" />;
  if (error) return <Card c={c}><p role="alert" className="text-xs text-red-500">{error}</p></Card>;
  if (versiones.length === 0) return <Card c={c}><Empty c={c} icon={History} title="Sin versiones registradas" /></Card>;
  const anterior = (v) => versiones.find((x) => x.version === v.version - 1);
  return (
    <Card c={c} title="Historial de versiones" pad={false}>
      <ol>
        {versiones.map((v) => {
          const ab = abierta?.version === v.version ? abierta.modo : null;
          const prev = anterior(v);
          const dif = ab === "cambios" && prev ? diffVersiones(prev.contenido, v.contenido) : [];
          return (
            <li key={v.id} className={`px-3 py-3 border-b last:border-b-0 ${c.panelBorder}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip color={v.version === s.version ? "emerald" : "slate"} dark={dark}>Versión {v.version}{v.version === s.version ? " · vigente" : ""}</Chip>
                <span className={`text-xs ${c.textDim}`}>{fmtFechaHora(v.created_at)} · {nameOf(v.autor) || "—"}</span>
                <span className="flex-1" />
                <button type="button" onClick={() => setAbierta(ab === "ver" ? null : { version: v.version, modo: "ver" })} className="text-xs text-blue-500 flex items-center gap-1"><Eye className="w-3 h-3" />{ab === "ver" ? "Ocultar" : "Ver"}</button>
                {prev && <button type="button" onClick={() => setAbierta(ab === "cambios" ? null : { version: v.version, modo: "cambios" })} className="text-xs text-blue-500 flex items-center gap-1"><GitCompare className="w-3 h-3" />{ab === "cambios" ? "Ocultar cambios" : "Ver cambios"}</button>}
                <button type="button" onClick={() => onImprimir(v.contenido, v.version)} className="text-xs text-blue-500 flex items-center gap-1"><Printer className="w-3 h-3" />Imprimir</button>
              </div>
              <p className={`text-xs mt-1 ${c.text}`}>Motivo: {v.motivo || "—"}</p>
              {ab === "ver" && (
                <div className={`mt-2 rounded-md border p-3 space-y-3 ${c.panelBorder}`}>
                  {SECCIONES_MINUTA.map((x) => <div key={x.id}><h4 className={`text-xs font-semibold mb-0.5 ${c.textDim}`}>{x.titulo}</h4><div className={c.text}><Rich text={v.contenido?.minuta?.[x.id]} empty="Sin contenido." c={c} /></div></div>)}
                </div>
              )}
              {ab === "cambios" && (
                <div className="mt-2 space-y-2">
                  {dif.length === 0 ? <p className={`text-xs ${c.textFaint}`}>No hay diferencias de contenido respecto de la versión anterior.</p> : dif.map((x) => (
                    <div key={x.campo} className={`rounded-md border p-2 ${c.panelBorder}`}>
                      <p className={`text-xs font-semibold mb-1 ${c.textDim}`}>{x.label}</p>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className={`rounded p-2 text-xs ${dark ? "bg-red-500/10" : "bg-red-50"}`}><p className="text-[10px] uppercase tracking-wide text-red-500 mb-0.5">Antes</p><p className={`whitespace-pre-wrap break-words ${c.text}`}>{toPlain(x.antes) || "—"}</p></div>
                        <div className={`rounded p-2 text-xs ${dark ? "bg-emerald-500/10" : "bg-emerald-50"}`}><p className="text-[10px] uppercase tracking-wide text-emerald-500 mb-0.5">Después</p><p className={`whitespace-pre-wrap break-words ${c.text}`}>{toPlain(x.despues) || "—"}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
