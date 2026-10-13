import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useFbCtx } from "./ctx";
import { inputCls, btnPrimary, MultiSelect } from "../crm/crmUi";
import { Card, Empty } from "./FbParts";
import { ListaCompromisos, TarjetaCompromiso, ordenarCompromisos } from "./FbCompromisoParts";
import { estadoEfectivo } from "../../lib/fb/logic";
import { ESTADOS_COMPROMISO, PRIORIDADES } from "../../lib/fb/constants";
import { swatchCls } from "../crm/crmUi";

/** Compromisos de todo el equipo: lista o tablero Kanban agrupado por estado, con filtros. */
export function FbCompromisos() {
  const { fb, c, hoy, openNuevoCompromiso } = useFbCtx();
  const [vista, setVista] = useState("kanban");
  const [q, setQ] = useState("");
  const [f, setF] = useState({ personas: [], estados: [], prioridades: [], categorias: [] });
  const [cerrados, setCerrados] = useState(false);

  const cats = [...new Set(fb.compromisos.map((x) => x.categoria).filter(Boolean))].sort();
  const lista = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return fb.compromisos.filter((x) => {
      if (f.personas.length && !f.personas.includes(x.persona_id)) return false;
      if (f.estados.length && !f.estados.includes(estadoEfectivo(x, hoy))) return false;
      if (f.prioridades.length && !f.prioridades.includes(x.prioridad)) return false;
      if (f.categorias.length && !f.categorias.includes(x.categoria)) return false;
      if (needle && !`${x.descripcion} ${fb.personasPorId.get(x.persona_id)?.nombre || ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [fb.compromisos, fb.personasPorId, f, q, hoy]);

  const abiertos = ordenarCompromisos(lista.filter((x) => x.estado !== "cumplido" && x.estado !== "cancelado"), hoy);
  const cerradosLista = lista.filter((x) => x.estado === "cumplido" || x.estado === "cancelado").sort((a, b) => String(b.fecha_cumplimiento || b.updated_at).localeCompare(String(a.fecha_cumplimiento || a.updated_at)));
  const porEstado = (id) => ordenarCompromisos(lista.filter((x) => estadoEfectivo(x, hoy) === id), hoy);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${c.textFaint}`} />
          <input aria-label="Buscar compromiso" className={inputCls(c, "w-56 pl-8")} placeholder="Buscar compromiso o persona" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <MultiSelect label="Integrante" options={fb.personas.map((p) => ({ id: p.id, label: p.nombre }))} value={f.personas} onChange={(v) => setF((x) => ({ ...x, personas: v }))} c={c} />
        <MultiSelect label="Estado" options={ESTADOS_COMPROMISO.map((e) => ({ id: e.id, label: e.label }))} value={f.estados} onChange={(v) => setF((x) => ({ ...x, estados: v }))} c={c} />
        <MultiSelect label="Prioridad" options={PRIORIDADES.map((e) => ({ id: e.id, label: e.label }))} value={f.prioridades} onChange={(v) => setF((x) => ({ ...x, prioridades: v }))} c={c} />
        {cats.length > 0 && <MultiSelect label="Categoría" options={cats.map((x) => ({ id: x, label: x }))} value={f.categorias} onChange={(v) => setF((x) => ({ ...x, categorias: v }))} c={c} />}
        <div role="group" aria-label="Vista" className={`flex rounded-md border overflow-hidden ${c.panelBorder}`}>
          {[["kanban", "Tablero"], ["lista", "Lista"]].map(([k, l]) => <button key={k} onClick={() => setVista(k)} aria-pressed={vista === k} className={`px-3 py-1.5 text-xs ${vista === k ? "bg-blue-600 text-white" : `${c.textDim} ${c.rowHover}`}`}>{l}</button>)}
        </div>
        <button onClick={() => openNuevoCompromiso()} className={`${btnPrimary} ml-auto flex items-center gap-1.5`}><Plus className="w-3.5 h-3.5" />Registrar compromiso</button>
      </div>

      {fb.compromisos.length === 0 ? (
        <Card c={c}><Empty c={c} title="Aún no hay compromisos" text="Nacen de las minutas de feedback (quedan vinculados a la reunión) o se registran directamente." action={<button onClick={() => openNuevoCompromiso()} className={btnPrimary}>Registrar compromiso</button>} /></Card>
      ) : lista.length === 0 ? (
        <Card c={c}><Empty c={c} title="Ningún compromiso coincide con los filtros" /></Card>
      ) : vista === "kanban" ? (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {ESTADOS_COMPROMISO.map((e) => {
              const items = porEstado(e.id);
              return (
                <section key={e.id} aria-label={e.label} className={`w-64 shrink-0 rounded-lg p-2 ${c.column}`}>
                  <h3 className={`flex items-center gap-2 text-xs font-semibold mb-2 px-1 ${c.text}`}><span className={`w-2 h-2 rounded-full ${swatchCls(e.color)}`} />{e.label}<span className={`font-mono font-normal ${c.textFaint}`}>{items.length}</span></h3>
                  <div className="space-y-2 min-h-[3rem]">{items.length === 0 ? <p className={`text-xs px-1 ${c.textFaint}`}>Nada aquí</p> : items.slice(0, 30).map((x) => <TarjetaCompromiso key={x.id} comp={x} />)}{items.length > 30 && <p className={`text-xs px-1 ${c.textFaint}`}>y {items.length - 30} más: usa la vista Lista</p>}</div>
                </section>
              );
            })}
          </div>
          <p className={`text-xs ${c.textFaint}`}>El estado se cambia al revisar el compromiso (queda el historial), no arrastrando tarjetas. «Vencido» se calcula solo por fecha.</p>
        </>
      ) : (
        <div className="space-y-3">
          <div><h3 className={`text-xs font-semibold mb-1.5 ${c.textDim}`}>Abiertos ({abiertos.length})</h3><ListaCompromisos compromisos={abiertos} mostrarPersona vacio={<p className={`text-xs ${c.textFaint}`}>No hay compromisos abiertos con estos filtros.</p>} /></div>
          {cerradosLista.length > 0 && <div><button onClick={() => setCerrados((v) => !v)} className={`text-xs font-semibold mb-1.5 ${c.textDim} hover:underline`}>{cerrados ? "Ocultar" : "Ver"} cerrados ({cerradosLista.length})</button>{cerrados && <ListaCompromisos compromisos={cerradosLista} mostrarPersona />}</div>}
        </div>
      )}
    </div>
  );
}
