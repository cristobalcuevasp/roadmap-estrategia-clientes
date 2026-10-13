import { useEffect, useMemo, useRef, useState } from "react";
import { Wand2, MessageSquarePlus, CalendarPlus, Lock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useFbCtx } from "./ctx";
import { Field, btnPrimary, btnOutline } from "../crm/crmUi";
import { Card, Chip, Empty, Rich, RichEditor, PersonaAvatar, PersonaSelect } from "./FbParts";
import { ListaCompromisos, ordenarCompromisos } from "./FbCompromisoParts";
import { prepararReunion, fmtFecha } from "../../lib/fb/logic";
import { estadoObjetivoMeta } from "../../lib/fb/constants";
import { excerpt } from "../../lib/fb/richtext";

/**
 * Preparar feedback: lo que hay que tener presente antes de la reunión (último feedback, compromisos abiertos y vencidos, avances,
 * objetivos que requieren atención, temas pendientes) y una agenda editable que se lleva al formulario de feedback.
 * Todo se calcula con los registros del módulo; no usa inteligencia artificial.
 */
export function FbPreparar({ personaId }) {
  const { fb, c, dark, hoy, esLider, go, setDirty, openSeguimiento } = useFbCtx();
  const [pid, setPid] = useState(personaId || "");
  const persona = fb.personasPorId.get(pid);
  const prep = useMemo(() => (persona ? prepararReunion(persona, fb.data, hoy, fb.cfg) : null), [persona, fb.data, hoy, fb.cfg]);
  const [agenda, setAgenda] = useState("");
  const base = useRef("");

  // Al elegir a la persona se arma la agenda sugerida; después es del líder
  useEffect(() => {
    const a = prep ? prep.agenda : "";
    setAgenda(a);
    base.current = a;
    // solo cuando cambia la persona (los datos pueden refrescarse sin pisar lo que se está escribiendo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);
  useEffect(() => { setDirty(!!persona && agenda !== base.current); }, [agenda, persona, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  if (!esLider) return <Card c={c}><Empty c={c} icon={Lock} title="Esta sección es de tu líder" text="Aquí se prepara la conversación; tú ves el resultado en las minutas de tu ficha." /></Card>;

  const personas = fb.personas.filter((p) => p.estado !== "inactivo" || p.id === pid);
  const agregarPregunta = (q) => setAgenda((a) => `${a.trimEnd()}${/\*\*Preguntas para conversar\*\*/.test(a) ? "" : "\n\n**Preguntas para conversar**"}\n- ${q}`.trimStart());
  const regenerar = () => { setAgenda(prep.agenda); };

  return (
    <div className="space-y-3">
      <Card c={c} title="Preparar feedback">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-72"><Field label="¿Con quién es la reunión?" c={c}><PersonaSelect id="prep-persona" personas={personas} value={pid} onChange={setPid} c={c} /></Field></div>
          {persona && (
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <button onClick={() => openSeguimiento(persona.id)} className={`${btnOutline(c)} flex items-center gap-1`}><CalendarPlus className="w-3.5 h-3.5" />Agendar seguimiento</button>
              <button onClick={() => { setDirty(false); go({ name: "feedback", personaId: persona.id, agenda }); }} className={`${btnPrimary} flex items-center gap-1`}><MessageSquarePlus className="w-3.5 h-3.5" />Iniciar feedback con esta agenda</button>
            </div>
          )}
        </div>
      </Card>

      {!persona && <Card c={c}><Empty c={c} title="Elige a una persona" text="Verás su último feedback, los compromisos abiertos, lo que se cumplió desde la última reunión y una agenda sugerida para conversar." /></Card>}

      {persona && prep && (
        <div className="grid lg:grid-cols-5 gap-3 items-start">
          <div className="lg:col-span-3 space-y-3">
            <div className={`rounded-lg border p-3 flex items-center gap-3 ${c.panel} ${c.panelBorder}`}>
              <PersonaAvatar persona={persona} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${c.text}`}>{persona.nombre}</p>
                <p className={`text-xs ${c.textDim}`}>{prep.ultima ? `Última reunión publicada: ${fmtFecha(prep.fechaUltima)}` : "Todavía no hay reuniones publicadas"}</p>
              </div>
              <button type="button" onClick={() => go({ name: "ficha", personaId: persona.id })} className="text-xs text-blue-500 shrink-0">Ver ficha</button>
            </div>

            {prep.alertas.length > 0 && (
              <Card c={c} title="Lo que requiere atención">
                <ul className="space-y-1">{prep.alertas.slice(0, 8).map((a, i) => (
                  <li key={i} className={`flex items-start gap-2 text-xs ${c.text}`}><AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${a.severidad === "alta" ? "text-red-500" : "text-amber-500"}`} />{a.texto}</li>
                ))}</ul>
              </Card>
            )}

            <Card c={c} title={`Compromisos abiertos (${prep.abiertos.length})`} pad={false}>
              {prep.abiertos.length === 0
                ? <Empty c={c} icon={CheckCircle2} title="Sin compromisos abiertos" text="No hay nada pendiente de reuniones anteriores." />
                : <div className="p-3"><ListaCompromisos compromisos={ordenarCompromisos(prep.abiertos, hoy)} /></div>}
            </Card>

            <Card c={c} title={`Cumplido desde la última reunión (${prep.cumplidosDesde.length})`}>
              {prep.cumplidosDesde.length === 0
                ? <p className={`text-xs ${c.textFaint}`}>Todavía no se han cerrado compromisos desde la última reunión.</p>
                : <ul className="space-y-1">{prep.cumplidosDesde.map((x) => <li key={x.id} className={`text-xs flex items-start gap-2 ${c.text}`}><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" /><span>{x.descripcion}<span className={`block ${c.textFaint}`}>Cumplido el {fmtFecha(x.fecha_cumplimiento)}</span></span></li>)}</ul>}
            </Card>

            <Card c={c} title={`Objetivos que requieren atención (${prep.objetivosAtencion.length})`}>
              {prep.objetivosAtencion.length === 0
                ? <p className={`text-xs ${c.textFaint}`}>Los objetivos activos están al día.</p>
                : <ul className="space-y-1.5">{prep.objetivosAtencion.map((o) => <li key={o.id} className={`text-xs ${c.text}`}>{o.titulo} <Chip color={estadoObjetivoMeta(o.estado).color} dark={dark}>{estadoObjetivoMeta(o.estado).label}</Chip> <span className={c.textFaint}>· {o.avance}%{o.fecha_objetivo ? ` · ${fmtFecha(o.fecha_objetivo)}` : ""}</span></li>)}</ul>}
            </Card>

            {(prep.logrosRecientes.length > 0 || prep.temasPendientes.length > 0) && (
              <div className="grid md:grid-cols-2 gap-3">
                <Card c={c} title="Logros recientes">
                  {prep.logrosRecientes.length === 0 ? <p className={`text-xs ${c.textFaint}`}>Sin logros registrados.</p> : <ul className="space-y-2">{prep.logrosRecientes.map((l) => <li key={l.sesionId} className="text-xs"><p className={c.textFaint}>{fmtFecha(l.fecha)}</p><p className={c.text}>{excerpt(l.texto, 220)}</p></li>)}</ul>}
                </Card>
                <Card c={c} title="Temas pendientes">
                  {prep.temasPendientes.length === 0 ? <p className={`text-xs ${c.textFaint}`}>Sin temas pendientes.</p> : <ul className="space-y-2">{prep.temasPendientes.map((l) => <li key={l.sesionId} className="text-xs"><p className={c.textFaint}>De la reunión del {fmtFecha(l.fecha)}</p><div className={c.text}><Rich text={l.texto} c={c} /></div></li>)}</ul>}
                </Card>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-3 lg:sticky lg:top-3">
            <Card c={c} title="Agenda de conversación" right={<button type="button" onClick={regenerar} className="text-xs text-blue-500 flex items-center gap-1"><Wand2 className="w-3 h-3" />Regenerar</button>}>
              <p className={`text-xs mb-2 ${c.textDim}`}>Es una propuesta armada con los registros de la ficha. Edítala libremente; al iniciar el feedback se lleva al formulario y queda guardada en el borrador.</p>
              <RichEditor id="prep-agenda" value={agenda} onChange={setAgenda} rows={12} c={c} ariaLabel="Agenda de conversación" />
            </Card>
            <Card c={c} title="Preguntas sugeridas">
              <ul className="space-y-1.5">{prep.preguntas.map((q, i) => (
                <li key={i} className={`text-xs flex items-start gap-2 ${c.text}`}>
                  <span className="flex-1">{q}</span>
                  <button type="button" onClick={() => agregarPregunta(q)} className="text-blue-500 shrink-0" aria-label={`Agregar a la agenda: ${q}`}>Agregar</button>
                </li>
              ))}</ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
