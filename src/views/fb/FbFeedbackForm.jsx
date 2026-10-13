import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Lock, Wand2, Printer, Send, Save, ChevronRight, ChevronLeft, AlertTriangle, ClipboardList } from "lucide-react";
import { useFbCtx } from "./ctx";
import { Field, inputCls, btnPrimary, btnGhost, btnOutline } from "../crm/crmUi";
import { Card, Chip, Empty, Rich, RichEditor, Tabs, Confirm, FieldError, PersonaSelect, PersonaAvatar } from "./FbParts";
import { buildMinuta, validarSesion, prepararReunion, fmtFecha } from "../../lib/fb/logic";
import { TIPOS_SESION, MODALIDADES, PRIORIDADES, CATEGORIAS_SUGERIDAS, SECCIONES_MINUTA } from "../../lib/fb/constants";
import { santiagoLocalToISO, isoToSantiagoLocal, ahoraSantiagoLocal, fechaCL, fmtFechaHora } from "../../lib/fb/datetime";
import { isBlank } from "../../lib/fb/richtext";
import { minutaHtml, printHtml } from "../../lib/fb/print";

/* Campos de texto del registro de la conversación, en el orden de la especificación. */
export const CAMPOS_REGISTRO = [
  { k: "agenda", label: "Agenda de la conversación", rows: 5, hint: "Los puntos que quieres tratar. Si vienes de «Preparar feedback», ya viene sugerida y puedes editarla." },
  { k: "temas", label: "Temas tratados", rows: 4 },
  { k: "fortalezas", label: "Fortalezas identificadas", rows: 3 },
  { k: "logros", label: "Logros destacados", rows: 3 },
  { k: "oportunidades", label: "Oportunidades de mejora", rows: 3 },
  { k: "comentarios_lider", label: "Comentarios del líder", rows: 3 },
  { k: "comentarios_colaborador", label: "Comentarios del colaborador", rows: 3 },
  { k: "acuerdos", label: "Acuerdos alcanzados", rows: 3 },
  { k: "proximos_pasos", label: "Próximos pasos", rows: 3 },
  { k: "temas_pendientes", label: "Temas pendientes para la próxima reunión", rows: 3 },
];

const minutaVacia = () => Object.fromEntries(SECCIONES_MINUTA.map((s) => [s.id, ""]));
const textosVacios = () => Object.fromEntries(CAMPOS_REGISTRO.map((x) => [x.k, ""]));
let seq = 0;
const nuevaKey = () => `c${Date.now().toString(36)}${seq++}`;

function desdeSesion(s) {
  return {
    persona_id: s.persona_id,
    fecha_local: isoToSantiagoLocal(s.fecha_hora),
    tipo: s.tipo,
    modalidad: s.modalidad,
    participantes: s.participantes || "",
    ...Object.fromEntries(CAMPOS_REGISTRO.map(({ k }) => [k, s[k] || ""])),
    proxima_revision: s.proxima_revision || "",
    minuta: { ...minutaVacia(), ...(s.minuta || {}) },
    compromisos: (s.compromisos_borrador || []).map((x) => ({
      _key: nuevaKey(), persona_id: x.persona_id || s.persona_id, descripcion: x.descripcion || "", fecha_vencimiento: x.fecha_vencimiento || "",
      prioridad: x.prioridad || "media", categoria: x.categoria || "", objetivo_id: x.objetivo_id || "",
    })),
  };
}

const nuevaReunion = (personaId, agenda) => ({
  persona_id: personaId || "", fecha_local: ahoraSantiagoLocal(), tipo: "1a1", modalidad: "presencial", participantes: "",
  ...textosVacios(), agenda: agenda || "", proxima_revision: "", minuta: minutaVacia(), compromisos: [],
});

/** Firma del contenido del registro (sin la minuta): sirve para avisar si la minuta quedó desactualizada. */
const firmaRegistro = (d) => JSON.stringify([d.persona_id, d.fecha_local, d.tipo, d.modalidad, d.participantes, ...CAMPOS_REGISTRO.map((x) => d[x.k]), d.proxima_revision,
  d.compromisos.map((x) => [x.persona_id, x.descripcion, x.fecha_vencimiento, x.prioridad])]);
const firmaTotal = (d) => JSON.stringify(d);

const PASO_DE_ERROR = (k) => (k === "persona_id" || k === "fecha_hora" ? "registro" : k === "resumen" ? "minuta" : "compromisos");

/**
 * Formulario de nuevo feedback / continuación de un borrador. Solo el líder lo usa.
 * Tres pasos: registro de la conversación, compromisos y seguimiento, y minuta (generada, editable) con publicación.
 */
export function FbFeedbackForm({ personaId, sesionId, agenda }) {
  const { fb, c, dark, hoy, esLider, go, back, setDirty, nameOf, users, showToast } = useFbCtx();
  const guardada = sesionId ? fb.sesiones.find((s) => s.id === sesionId) : null;

  const [d, setD] = useState(() => {
    if (guardada) return desdeSesion(guardada);
    const nueva = nuevaReunion(personaId, agenda);
    const p = personaId ? fb.personasPorId.get(personaId) : null;
    const yo = fb.access?.member_id ? nameOf(fb.access.member_id) : "";
    return p ? { ...nueva, participantes: [yo, p.nombre].filter(Boolean).join(", ") } : nueva;
  });
  const [sid, setSid] = useState(guardada?.id || null);
  const [paso, setPaso] = useState("registro");
  const [errs, setErrs] = useState({});
  const [nota, setNota] = useState("");
  const [guardadoEn, setGuardadoEn] = useState(guardada ? new Date(guardada.updated_at) : null);
  const [confirm, setConfirm] = useState(null); // "publicar" | "eliminar" | "regenerar"
  const [ocupado, setOcupado] = useState(false);
  const baseFirma = useRef(null);
  const baseMinuta = useRef(guardada && !isBlank(guardada.minuta?.resumen) ? firmaRegistro(desdeSesion(guardada)) : null);
  if (baseFirma.current === null) baseFirma.current = firmaTotal(d && !guardada ? { ...d, agenda: "" } : desdeSesion(guardada));

  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const persona = fb.personasPorId.get(d.persona_id);
  const iso = santiagoLocalToISO(d.fecha_local);
  const fechaReunion = iso ? fechaCL(iso) : hoy;

  // Cambios sin guardar → el módulo avisa antes de salir
  const firmaActual = useMemo(() => firmaTotal(d), [d]);
  useEffect(() => { setDirty(firmaActual !== baseFirma.current || !isBlank(nota)); }, [firmaActual, nota, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  // Al elegir persona por primera vez se sugieren los participantes
  const elegirPersona = (id) => {
    const p = fb.personasPorId.get(id);
    const yo = fb.access?.member_id ? nameOf(fb.access.member_id) : "";
    set({ persona_id: id, participantes: isBlank(d.participantes) && p ? [yo, p.nombre].filter(Boolean).join(", ") : d.participantes, compromisos: d.compromisos.map((x) => (x.persona_id === d.persona_id || !x.persona_id ? { ...x, persona_id: id } : x)) });
  };

  const personasElegibles = useMemo(() => fb.personas.filter((p) => p.estado !== "inactivo" || p.id === d.persona_id), [fb.personas, d.persona_id]);
  const ctxPersona = useMemo(() => (persona ? prepararReunion(persona, fb.data, hoy, fb.cfg) : null), [persona, fb.data, hoy, fb.cfg]);
  const notasDeEstaReunion = useMemo(() => (sid ? fb.notas.filter((n) => n.sesion_id === sid) : []), [fb.notas, sid]);
  const objetivosDe = (pid) => fb.objetivos.filter((o) => o.persona_id === pid && ["pendiente", "en_curso", "en_riesgo"].includes(o.estado));

  /* ------------------------------ compromisos del borrador ------------------------------ */
  const addCompromiso = () => set({ compromisos: [...d.compromisos, { _key: nuevaKey(), persona_id: d.persona_id, descripcion: "", fecha_vencimiento: "", prioridad: "media", categoria: "", objetivo_id: "" }] });
  const upCompromiso = (key, patch) => set({ compromisos: d.compromisos.map((x) => (x._key === key ? { ...x, ...patch } : x)) });
  const delCompromiso = (key) => set({ compromisos: d.compromisos.filter((x) => x._key !== key) });

  /* ----------------------------------- minuta ----------------------------------- */
  const generar = () => {
    const m = buildMinuta({
      persona, fechaHora: iso || new Date().toISOString(), tipo: d.tipo, modalidad: d.modalidad, participantes: d.participantes, temas: d.temas, fortalezas: d.fortalezas,
      logros: d.logros, oportunidades: d.oportunidades, comentariosLider: d.comentarios_lider, comentariosColaborador: d.comentarios_colaborador, acuerdos: d.acuerdos,
      proximosPasos: d.proximos_pasos, temasPendientes: d.temas_pendientes, proximaRevision: d.proxima_revision || null, compromisos: d.compromisos,
      nombrePorPersona: (id) => fb.personasPorId.get(id)?.nombre || "",
    });
    set({ minuta: m });
    baseMinuta.current = firmaRegistro(d);
    setErrs((e) => { const { resumen, ...resto } = e; return resto; });
  };
  const minutaConTexto = SECCIONES_MINUTA.some((s) => !isBlank(d.minuta[s.id]));
  const pedirGenerar = () => (minutaConTexto ? setConfirm("regenerar") : generar());
  const minutaDesactualizada = baseMinuta.current !== null && minutaConTexto && baseMinuta.current !== firmaRegistro(d);

  const irA = (id) => {
    if (id === "minuta" && !minutaConTexto && persona) generar(); // primera vez: se arma sola para que la revises
    setPaso(id);
    window.scrollTo?.(0, 0);
  };

  /* ----------------------------------- guardado ----------------------------------- */
  const sesionParaValidar = () => ({
    persona_id: d.persona_id, fecha_hora: iso, proxima_revision: d.proxima_revision || null, minuta: d.minuta,
    compromisos_borrador: d.compromisos,
  });
  const validar = (publicar) => {
    const e = validarSesion(sesionParaValidar(), { hoy, publicar });
    if (publicar) return e;
    // un borrador puede estar incompleto: solo se exige la persona, la fecha y que la próxima revisión tenga sentido
    return Object.fromEntries(Object.entries(e).filter(([k]) => k === "persona_id" || k === "fecha_hora" || k === "proxima_revision"));
  };
  const fila = () => ({
    persona_id: d.persona_id, fecha_hora: iso, tipo: d.tipo, modalidad: d.modalidad, participantes: d.participantes.trim(),
    ...Object.fromEntries(CAMPOS_REGISTRO.map(({ k }) => [k, d[k]])),
    proxima_revision: d.proxima_revision || null,
    minuta: d.minuta,
    compromisos_borrador: d.compromisos.map((x) => ({
      persona_id: x.persona_id || d.persona_id, descripcion: x.descripcion.trim(), fecha_vencimiento: x.fecha_vencimiento || null, prioridad: x.prioridad,
      categoria: x.categoria.trim(), objetivo_id: x.objetivo_id || null,
    })),
  });

  /** Valida y guarda el borrador (y la nota privada si la hay). Devuelve la fila guardada o null. */
  const guardar = async ({ publicar = false } = {}) => {
    const e = validar(publicar);
    setErrs(e);
    const primero = Object.keys(e)[0];
    if (primero) {
      setPaso(PASO_DE_ERROR(primero));
      showToast(`Revisa el formulario: ${e[primero]}`);
      return null;
    }
    const out = await fb.saveSesion(sid, fila());
    if (!out) return null;
    setSid(out.id);
    baseFirma.current = firmaTotal(d);
    setGuardadoEn(new Date());
    let notaPendiente = !isBlank(nota);
    if (notaPendiente) {
      const n = await fb.addNota({ persona_id: out.persona_id, sesion_id: out.id, cuerpo: nota });
      if (n) { setNota(""); notaPendiente = false; }
    }
    setDirty(notaPendiente);
    return out;
  };

  const guardarBorrador = async () => {
    setOcupado(true);
    try {
      const out = await guardar();
      if (out) showToast("Borrador guardado", "ok");
    } finally { setOcupado(false); }
  };

  const publicar = async () => {
    setConfirm(null);
    setOcupado(true);
    try {
      const out = await guardar({ publicar: true });
      if (!out) return;
      const pub = await fb.publicarSesion(out.id);
      if (!pub) return; // el aviso de error ya se mostró; el borrador queda guardado
      showToast("Minuta publicada", "ok");
      setDirty(false);
      go({ name: "minuta", sesionId: out.id }, { replace: true });
    } finally { setOcupado(false); }
  };

  const eliminar = async () => {
    setConfirm(null);
    if (!sid) { setDirty(false); back(); return; }
    setOcupado(true);
    try {
      const ok = await fb.deleteBorrador(sid);
      if (ok) { setDirty(false); showToast("Borrador eliminado", "ok"); back(); }
    } finally { setOcupado(false); }
  };

  const imprimir = () => {
    try {
      printHtml(minutaHtml({
        sesion: { ...fila(), estado: "borrador", fecha_hora: iso || new Date().toISOString() }, nombrePersona: persona?.nombre || "—", hoy,
        compromisos: fila().compromisos_borrador.map((x) => ({ ...x, estado: "pendiente", fecha_vencimiento_original: x.fecha_vencimiento })),
      }));
    } catch (e) { console.error(e); showToast("No se pudo abrir la impresión. Revisa que el navegador permita ventanas de impresión."); }
  };

  /* ------------------------------------ guardas ------------------------------------ */
  if (!esLider) return <Card c={c}><Empty c={c} icon={Lock} title="Solo tu líder registra feedback" text="Aquí verás las minutas que se publiquen en tu ficha." /></Card>;
  if (sesionId && !guardada) return <Card c={c}><Empty c={c} title="Esta reunión ya no existe" text="Pudo ser eliminada desde otro dispositivo." action={<button onClick={back} className={btnPrimary}>Volver</button>} /></Card>;
  if (guardada?.estado === "publicada" && !ocupado) {
    return <Card c={c}><Empty c={c} title="Esta minuta ya fue publicada" text="Una minuta publicada se edita desde su vista, dejando el motivo del cambio; así queda el historial de versiones."
      action={<button onClick={() => go({ name: "minuta", sesionId: guardada.id }, { replace: true })} className={btnPrimary}>Abrir la minuta</button>} /></Card>;
  }

  const cuentaVinculada = !!(persona?.member_id && users.find((u) => u.id === persona.member_id)?.userId);
  const nCompr = d.compromisos.filter((x) => !isBlank(x.descripcion)).length;
  const pasos = [
    { id: "registro", label: "1. Registro de la conversación" },
    { id: "compromisos", label: "2. Compromisos y seguimiento", badge: d.compromisos.length || undefined },
    { id: "minuta", label: "3. Minuta y publicación" },
  ];
  const idx = pasos.findIndex((p) => p.id === paso);

  return (
    <div className="space-y-3 pb-16">
      <div className="flex flex-wrap items-center gap-2">
        {persona && <PersonaAvatar persona={persona} size="sm" />}
        <h3 className={`text-sm font-semibold ${c.dark ? "text-slate-100" : "text-slate-800"}`}>{sid ? "Borrador de feedback" : "Nuevo feedback"}{persona ? ` · ${persona.nombre}` : ""}</h3>
        <Chip color="amber" dark={dark}>Borrador</Chip>
        <span className={`text-xs ${c.textFaint}`}>{guardadoEn ? `Guardado ${fmtFechaHora(guardadoEn.toISOString()).split(" ")[1]}` : "Aún sin guardar"}</span>
      </div>

      <Tabs tabs={pasos} value={paso} onChange={irA} c={c} />

      {paso === "registro" && (
        <div className="space-y-3">
          <Card c={c} title="Datos de la reunión">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Persona *" c={c}>
                <PersonaSelect id="fb-persona" personas={personasElegibles} value={d.persona_id} onChange={elegirPersona} c={c} disabled={!!sid} />
                <FieldError msg={errs.persona_id} />
                {sid && <p className={`text-xs mt-1 ${c.textFaint}`}>La persona no se cambia una vez guardado el borrador.</p>}
              </Field>
              <Field label="Fecha y hora * (hora de Chile)" c={c}>
                <input id="fb-fecha" type="datetime-local" value={d.fecha_local} onChange={(e) => set({ fecha_local: e.target.value })} className={inputCls(c)} />
                <FieldError msg={errs.fecha_hora} />
              </Field>
              <Field label="Tipo de reunión" c={c}>
                <select value={d.tipo} onChange={(e) => set({ tipo: e.target.value })} className={inputCls(c)}>{TIPOS_SESION.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              </Field>
              <Field label="Modalidad" c={c}>
                <select value={d.modalidad} onChange={(e) => set({ modalidad: e.target.value })} className={inputCls(c)}>{MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
              </Field>
              <Field label="Participantes" full c={c}>
                <input value={d.participantes} onChange={(e) => set({ participantes: e.target.value })} maxLength={1000} className={inputCls(c)} placeholder="Por ejemplo: tú y la persona" />
              </Field>
            </div>
          </Card>

          {ctxPersona && persona && (
            <Card c={c} title={`Para tener a mano · ${persona.nombre}`} right={<button type="button" onClick={() => go({ name: "preparar", personaId: persona.id })} className="text-xs text-blue-500 flex items-center gap-1"><ClipboardList className="w-3 h-3" />Preparar la reunión</button>}>
              <div className={`grid sm:grid-cols-3 gap-3 text-xs ${c.textDim}`}>
                <div><p className="font-medium mb-0.5">Última reunión</p><p>{ctxPersona.fechaUltima ? fmtFecha(ctxPersona.fechaUltima) : "Sin reuniones publicadas"}</p></div>
                <div><p className="font-medium mb-0.5">Compromisos abiertos</p><p>{ctxPersona.abiertos.length}{ctxPersona.vencidos.length ? ` (${ctxPersona.vencidos.length} vencido${ctxPersona.vencidos.length === 1 ? "" : "s"})` : ""}</p></div>
                <div><p className="font-medium mb-0.5">Objetivos que piden atención</p><p>{ctxPersona.objetivosAtencion.length}</p></div>
              </div>
            </Card>
          )}

          <Card c={c} title="Registro de la conversación">
            <div className="space-y-4">
              {CAMPOS_REGISTRO.map((x) => (
                <Field key={x.k} label={x.label} hint={x.hint} c={c}>
                  <RichEditor id={`fb-${x.k}`} value={d[x.k]} onChange={(v) => set({ [x.k]: v })} rows={x.rows} c={c} ariaLabel={x.label} />
                </Field>
              ))}
            </div>
          </Card>

          <Card c={c} title="Nota privada (solo tú)" right={<span className={`flex items-center gap-1 text-xs ${c.textDim}`}><Lock className="w-3 h-3" />Nunca aparece en la minuta ni la ve la persona</span>}>
            {notasDeEstaReunion.length > 0 && (
              <ul className="mb-2 space-y-1">{notasDeEstaReunion.map((n) => <li key={n.id} className={`text-xs rounded border px-2 py-1.5 ${c.panelBorder} ${c.textDim}`}><Rich text={n.cuerpo} c={c} /></li>)}</ul>
            )}
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={20000} aria-label="Nota privada" placeholder="Impresiones, dudas o ideas que quieras guardar solo para ti. Se guarda junto con el borrador."
              className={inputCls(c, "resize-y")} />
            <p className={`text-xs mt-1 ${c.textFaint}`}>Las notas ya guardadas se editan y borran en la pestaña «Notas privadas» de la ficha.</p>
          </Card>
        </div>
      )}

      {paso === "compromisos" && (
        <div className="space-y-3">
          <Card c={c} title="Compromisos adquiridos" right={<button type="button" onClick={addCompromiso} className={`${btnOutline(c)} flex items-center gap-1`}><Plus className="w-3.5 h-3.5" />Agregar compromiso</button>}>
            {d.compromisos.length === 0 ? (
              <Empty c={c} title="Sin compromisos en esta reunión" text="Si se acordó algo concreto, regístralo con responsable y fecha: al publicar la minuta queda vinculado a ella y se le hace seguimiento." action={<button type="button" onClick={addCompromiso} className={btnPrimary}>Agregar el primero</button>} />
            ) : (
              <ul className="space-y-3">
                {d.compromisos.map((x, i) => {
                  const objs = objetivosDe(x.persona_id);
                  return (
                    <li key={x._key} className={`rounded-md border p-3 space-y-2 ${c.panelBorder}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-xs font-semibold mt-1.5 ${c.textFaint}`}>{i + 1}.</span>
                        <textarea value={x.descripcion} onChange={(e) => upCompromiso(x._key, { descripcion: e.target.value })} rows={2} maxLength={2000} aria-label={`Descripción del compromiso ${i + 1}`} placeholder="¿Qué se compromete a hacer?" className={inputCls(c, "resize-y flex-1")} />
                        <button type="button" onClick={() => delCompromiso(x._key)} aria-label={`Quitar compromiso ${i + 1}`} className={`p-1.5 rounded ${c.textFaint} hover:text-red-500`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 pl-5">
                        <Field label="Responsable" c={c}><PersonaSelect personas={fb.personas.filter((p) => p.estado !== "inactivo" || p.id === x.persona_id)} value={x.persona_id} onChange={(v) => upCompromiso(x._key, { persona_id: v, objetivo_id: "" })} c={c} /></Field>
                        <Field label="Vence el *" c={c}><input type="date" value={x.fecha_vencimiento} min={fechaReunion} onChange={(e) => upCompromiso(x._key, { fecha_vencimiento: e.target.value })} className={inputCls(c)} aria-label={`Fecha de vencimiento del compromiso ${i + 1}`} /></Field>
                        <Field label="Prioridad" c={c}><select value={x.prioridad} onChange={(e) => upCompromiso(x._key, { prioridad: e.target.value })} className={inputCls(c)}>{PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
                        <Field label="Categoría" c={c}><input list="fb-categorias" value={x.categoria} maxLength={60} onChange={(e) => upCompromiso(x._key, { categoria: e.target.value })} className={inputCls(c)} placeholder="Opcional" /></Field>
                        {objs.length > 0 && (
                          <Field label="Objetivo relacionado" c={c}>
                            <select value={x.objetivo_id} onChange={(e) => upCompromiso(x._key, { objetivo_id: e.target.value })} className={inputCls(c)}>
                              <option value="">Ninguno</option>{objs.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                            </select>
                          </Field>
                        )}
                      </div>
                      <FieldError msg={errs[`compromiso_${i}`]} />
                    </li>
                  );
                })}
              </ul>
            )}
            <datalist id="fb-categorias">{CATEGORIAS_SUGERIDAS.map((x) => <option key={x} value={x} />)}</datalist>
          </Card>

          <Card c={c} title="Seguimiento">
            <Field label="Próxima revisión" hint="Al publicar, esta fecha queda agendada como seguimiento en la ficha y en la agenda del equipo." c={c}>
              <input type="date" value={d.proxima_revision} min={fechaReunion} onChange={(e) => set({ proxima_revision: e.target.value })} className={inputCls(c, "max-w-[12rem]")} />
              <FieldError msg={errs.proxima_revision} />
            </Field>
          </Card>
        </div>
      )}

      {paso === "minuta" && (
        <div className="space-y-3">
          <Card c={c} title="Minuta de la reunión" right={<button type="button" onClick={pedirGenerar} className={`${btnOutline(c)} flex items-center gap-1`}><Wand2 className="w-3.5 h-3.5" />Regenerar desde el registro</button>}>
            <p className={`text-xs mb-3 ${c.textDim}`}>La minuta se arma con lo que escribiste, ordenado en siete secciones. Es una propuesta: revísala y edítala antes de publicarla. No agrega información nueva.</p>
            {minutaDesactualizada && (
              <div role="status" className={`flex items-start gap-2 text-xs rounded-md border px-2.5 py-2 mb-3 ${c.dark ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />Cambiaste el registro o los compromisos después de generar la minuta. Si quieres reflejarlo, usa «Regenerar desde el registro» (reemplaza el texto actual).
              </div>
            )}
            <div className="space-y-4">
              {SECCIONES_MINUTA.map((s) => (
                <Field key={s.id} label={s.titulo} c={c}>
                  <RichEditor id={`fb-min-${s.id}`} value={d.minuta[s.id]} onChange={(v) => set({ minuta: { ...d.minuta, [s.id]: v } })} rows={s.id === "resumen" ? 6 : 3} c={c} ariaLabel={s.titulo} />
                  {s.id === "resumen" && <FieldError msg={errs.resumen} />}
                </Field>
              ))}
            </div>
          </Card>

          <Card c={c} title="Al publicar">
            <ul className={`text-xs space-y-1 list-disc pl-5 ${c.textDim}`}>
              <li>La minuta queda guardada como versión 1; después solo se edita dejando el motivo y se conserva el historial de versiones.</li>
              <li>{nCompr ? `Se crean ${nCompr} compromiso${nCompr === 1 ? "" : "s"} vinculado${nCompr === 1 ? "" : "s"} a esta reunión.` : "No se crean compromisos (no agregaste ninguno)."}</li>
              <li>{d.proxima_revision ? `Se agenda un seguimiento para el ${fmtFecha(d.proxima_revision)}.` : "No se agenda seguimiento (no indicaste próxima revisión)."}</li>
              <li>{persona ? (cuentaVinculada ? `${persona.nombre} podrá ver la minuta en su ficha. Tus notas privadas no se comparten.` : `${persona.nombre} todavía no tiene una cuenta vinculada en la aplicación: por ahora solo tú verás la minuta.`) : "Elige a la persona en el paso 1."}</li>
            </ul>
          </Card>
        </div>
      )}

      <div className={`fixed bottom-0 left-0 right-0 z-30 border-t px-3 py-2 ${c.panel} ${c.panelBorder}`}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setConfirm("eliminar")} disabled={ocupado} className={`${btnGhost(c)} flex items-center gap-1 text-red-500`}>
            <Trash2 className="w-3.5 h-3.5" />{sid ? "Eliminar borrador" : "Descartar"}
          </button>
          <span className="flex-1" />
          {idx > 0 && <button type="button" onClick={() => irA(pasos[idx - 1].id)} className={`${btnOutline(c)} flex items-center gap-1`}><ChevronLeft className="w-3.5 h-3.5" />Anterior</button>}
          <button type="button" onClick={guardarBorrador} disabled={ocupado || fb.saving} className={`${btnOutline(c)} flex items-center gap-1`}><Save className="w-3.5 h-3.5" />Guardar borrador</button>
          {paso === "minuta" && <button type="button" onClick={imprimir} disabled={!persona} className={`${btnOutline(c)} flex items-center gap-1`}><Printer className="w-3.5 h-3.5" />Vista para imprimir</button>}
          {idx < pasos.length - 1
            ? <button type="button" onClick={() => irA(pasos[idx + 1].id)} className={`${btnPrimary} flex items-center gap-1`}>Siguiente<ChevronRight className="w-3.5 h-3.5" /></button>
            : <button type="button" onClick={() => { const e = validar(true); setErrs(e); const k = Object.keys(e)[0]; if (k) { setPaso(PASO_DE_ERROR(k)); showToast(`Revisa el formulario: ${e[k]}`); } else setConfirm("publicar"); }} disabled={ocupado || fb.saving} className={`${btnPrimary} flex items-center gap-1`}><Send className="w-3.5 h-3.5" />Publicar minuta</button>}
        </div>
      </div>

      {confirm === "publicar" && (
        <Confirm title="Publicar la minuta" c={c} confirmLabel="Publicar" busy={ocupado} onCancel={() => setConfirm(null)} onConfirm={publicar}>
          <p>Vas a publicar la minuta de <strong>{persona?.nombre}</strong> del {fmtFechaHora(iso)}.</p>
          <p>{nCompr ? `Se crearán ${nCompr} compromiso${nCompr === 1 ? "" : "s"} vinculado${nCompr === 1 ? "" : "s"}. ` : ""}Después de publicar, los cambios quedan registrados como versiones con su motivo.</p>
        </Confirm>
      )}
      {confirm === "regenerar" && (
        <Confirm title="Regenerar la minuta" c={c} confirmLabel="Reemplazar el texto" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); generar(); }}>
          <p>Se reemplazará el texto actual de las siete secciones por uno nuevo armado desde el registro. Las ediciones que hiciste a mano en la minuta se perderán.</p>
        </Confirm>
      )}
      {confirm === "eliminar" && (
        <Confirm title={sid ? "Eliminar el borrador" : "Descartar el formulario"} c={c} danger confirmLabel={sid ? "Eliminar borrador" : "Descartar"} busy={ocupado} onCancel={() => setConfirm(null)} onConfirm={eliminar}>
          <p>{sid ? "El borrador se elimina de forma definitiva. Las notas privadas que guardaste con él se conservan en la ficha." : "Se perderá lo que escribiste en este formulario."}</p>
        </Confirm>
      )}
    </div>
  );
}
