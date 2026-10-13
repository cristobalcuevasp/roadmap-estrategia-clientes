import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Lock } from "lucide-react";
import { tokens } from "../../lib/theme";
import { useFb } from "../../lib/useFb";
import { FbCtx } from "./ctx";
import { LoadingBlock, ErrorBlock, Confirm } from "./FbParts";
import { btnPrimary } from "../crm/crmUi";
import { FbDashboard } from "./FbDashboard";
import { FbEquipo } from "./FbEquipo";
import { FbCompromisos } from "./FbCompromisos";
import { FbAgenda } from "./FbAgenda";
import { FbConfig } from "./FbConfig";
import { FbFicha } from "./FbFicha";
import { FbFeedbackForm } from "./FbFeedbackForm";
import { FbMinuta } from "./FbMinuta";
import { FbPreparar } from "./FbPreparar";
import { CompromisoPanel, RevisarModal, CompromisoForm } from "./FbCompromisoParts";
import { SeguimientoModal, PersonaForm, ObjetivoForm, RolForm, AsignarRolForm } from "./FbForms";

const PAGINAS_LIDER = [
  { id: "panel", label: "Panel del equipo" },
  { id: "equipo", label: "Equipo" },
  { id: "compromisos", label: "Compromisos" },
  { id: "agenda", label: "Agenda" },
  { id: "config", label: "Configuración" },
];

/**
 * Módulo Feedback & Desarrollo. El líder ve el panel del equipo y todas las fichas; cada integrante ve únicamente
 * su propia ficha (la base de datos lo impone; esta pantalla solo adapta lo que muestra).
 */
export function FbView({ session, access, showToast, dark, users, nameOf }) {
  const c = tokens(dark);
  const fb = useFb({ userId: session.user.id, access, showToast });
  const esLider = !!access?.es_lider;
  const home = useMemo(() => (esLider ? { name: "panel" } : { name: "ficha", personaId: access?.persona_id, tab: "resumen" }), [esLider, access?.persona_id]);
  const [stack, setStack] = useState([home]);
  const page = stack[stack.length - 1];
  const [overlay, setOverlay] = useState(null); // ventanas: compromiso, revisar, nuevoCompromiso, seguimiento, persona, objetivo, rol, asignarRol
  const [pendiente, setPendiente] = useState(null); // navegación en espera de confirmar que se descartan cambios
  const dirtyRef = useRef(false);

  const setDirty = useCallback((v) => { dirtyRef.current = !!v; }, []);
  useEffect(() => {
    const warn = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const doGo = useCallback((p, { replace = false, reset = false } = {}) => {
    dirtyRef.current = false;
    setOverlay(null);
    setStack((s) => (reset ? [p] : replace ? [...s.slice(0, -1), p] : [...s, p]));
    window.scrollTo?.(0, 0);
  }, []);
  /** Navega; si el formulario tiene cambios sin guardar, pide confirmación antes. */
  const go = useCallback((p, opts) => {
    if (dirtyRef.current) setPendiente({ p, opts });
    else doGo(p, opts);
  }, [doGo]);
  const back = useCallback(() => {
    const salir = () => { dirtyRef.current = false; setOverlay(null); setStack((s) => (s.length > 1 ? s.slice(0, -1) : [home])); };
    if (dirtyRef.current) setPendiente({ fn: salir }); else salir();
  }, [home]);

  // Si la ficha que se mira deja de existir (otra persona la desvinculó), vuelvo al inicio
  const personaPagina = page.personaId ? fb.personasPorId.get(page.personaId) : null;
  useEffect(() => {
    if (fb.phase === "ready" && page.name === "ficha" && page.personaId && !personaPagina) setStack([home]);
  }, [fb.phase, page, personaPagina, home]);

  const lideres = useMemo(() => users.map((u) => ({ id: u.id, nombre: u.name })), [users]);
  const ctx = useMemo(() => ({
    fb, c, dark, esLider, go, back, setDirty, hoy: fb.hoy, overlay, setOverlay, page, users, lideres, nameOf, showToast,
    openCompromiso: (id) => setOverlay({ kind: "compromiso", id }),
    openRevisar: (id) => setOverlay({ kind: "revisar", id }),
    openNuevoCompromiso: (personaId, extra = {}) => setOverlay({ kind: "nuevoCompromiso", personaId, ...extra }),
    openEditarCompromiso: (id) => setOverlay({ kind: "nuevoCompromiso", id }),
    openSeguimiento: (personaId, id) => setOverlay({ kind: "seguimiento", personaId, id }),
    openPersona: (id) => setOverlay({ kind: "persona", id }),
    openObjetivo: (personaId, id) => setOverlay({ kind: "objetivo", personaId, id }),
    openRol: (id, nombre) => setOverlay({ kind: "rol", id, nombre }),
    openAsignarRol: (personaId, asigId = null, nombre = "") => setOverlay({ kind: "asignarRol", personaId, asigId, nombre }),
  }), [fb, c, dark, esLider, go, back, setDirty, overlay, page, users, lideres, nameOf, showToast]);

  if (fb.phase === "loading") return <LoadingBlock c={c} text="Cargando Feedback & Desarrollo…" />;
  if (fb.phase === "error") return <ErrorBlock c={c} message={fb.loadError} onRetry={fb.refresh} />;

  const paginaLider = page.name === "feedback" || page.name === "minuta" || page.name === "preparar" || page.name === "ficha" ? "" : page.name;
  const topLevel = esLider && PAGINAS_LIDER.some((p) => p.id === page.name);

  return (
    <FbCtx.Provider value={ctx}>
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {!topLevel && stack.length > 1 && (
            <button onClick={back} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${c.textDim} ${c.rowHover}`}><ChevronLeft className="w-4 h-4" />Volver</button>
          )}
          <h2 className={`text-base font-semibold ${c.dark ? "text-slate-100" : "text-slate-800"}`}>{esLider ? "Feedback & Desarrollo" : "Mi ficha de desarrollo"}</h2>
          {!esLider && <span className={`flex items-center gap-1 text-xs ${c.textDim}`}><Lock className="w-3 h-3" />Esta ficha es personal: solo tú y tu líder pueden verla.</span>}
        </div>

        {esLider && (
          <nav aria-label="Secciones" className={`flex gap-1 overflow-x-auto border-b ${c.panelBorder}`}>
            {PAGINAS_LIDER.map((p) => (
              <button key={p.id} onClick={() => go({ name: p.id }, { reset: true })} aria-current={paginaLider === p.id ? "page" : undefined}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${paginaLider === p.id ? "border-blue-500 text-blue-500" : `border-transparent ${c.textDim}`}`}>{p.label}</button>
            ))}
          </nav>
        )}

        {page.name === "panel" && <FbDashboard />}
        {page.name === "equipo" && <FbEquipo />}
        {page.name === "compromisos" && <FbCompromisos />}
        {page.name === "agenda" && <FbAgenda />}
        {page.name === "config" && <FbConfig />}
        {page.name === "ficha" && personaPagina && <FbFicha key={page.personaId} personaId={page.personaId} tab={page.tab || "resumen"} />}
        {page.name === "feedback" && <FbFeedbackForm key={`${page.personaId || ""}-${page.sesionId || "nueva"}`} personaId={page.personaId} sesionId={page.sesionId} agenda={page.agenda} />}
        {page.name === "minuta" && <FbMinuta key={page.sesionId} sesionId={page.sesionId} />}
        {page.name === "preparar" && <FbPreparar key={page.personaId || "x"} personaId={page.personaId} />}

        {overlay?.kind === "compromiso" && <CompromisoPanel id={overlay.id} />}
        {overlay?.kind === "revisar" && <RevisarModal id={overlay.id} />}
        {overlay?.kind === "nuevoCompromiso" && <CompromisoForm personaId={overlay.personaId} objetivoId={overlay.objetivoId} id={overlay.id} />}
        {overlay?.kind === "seguimiento" && <SeguimientoModal personaId={overlay.personaId} id={overlay.id} />}
        {overlay?.kind === "persona" && <PersonaForm id={overlay.id} />}
        {overlay?.kind === "objetivo" && <ObjetivoForm personaId={overlay.personaId} id={overlay.id} />}
        {overlay?.kind === "rol" && <RolForm id={overlay.id} nombreInicial={overlay.nombre} />}
        {overlay?.kind === "asignarRol" && <AsignarRolForm personaId={overlay.personaId} asigId={overlay.asigId} nombreInicial={overlay.nombre} />}

        {pendiente && (
          <Confirm title="Hay cambios sin guardar" c={c} confirmLabel="Salir sin guardar" cancelLabel="Seguir editando"
            onCancel={() => setPendiente(null)}
            onConfirm={() => { const pd = pendiente; setPendiente(null); if (pd.fn) pd.fn(); else doGo(pd.p, pd.opts); }}>
            <p>Si sales ahora se perderá lo que no hayas guardado. Puedes usar «Guardar borrador» para conservarlo.</p>
          </Confirm>
        )}
      </div>
    </FbCtx.Provider>
  );
}
