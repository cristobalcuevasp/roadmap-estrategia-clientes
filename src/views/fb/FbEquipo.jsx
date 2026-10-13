import { useMemo, useState } from "react";
import { Plus, Search, ArrowUp, ArrowDown } from "lucide-react";
import { useFbCtx } from "./ctx";
import { inputCls, btnPrimary, btnOutline } from "../crm/crmUi";
import { Card, Empty, PersonaAvatar, Chip } from "./FbParts";
import { filaComparativa, textoMetas, textoCompromisos, fmtFecha } from "../../lib/fb/logic";
import { estadoPersonaMeta } from "../../lib/fb/constants";

const nulos = (a, b, dir, cmp) => { if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; return cmp(a, b) * dir; };
const COLS = [
  { k: "nombre", label: "Integrante", get: (r) => r.persona.nombre.toLowerCase(), cmp: (a, b) => a.localeCompare(b) },
  { k: "roles", label: "Roles", get: (r) => r.roles.join(", ").toLowerCase() || null, cmp: (a, b) => a.localeCompare(b) },
  { k: "ultimo", label: "Último feedback", get: (r) => r.ultimoFeedback, cmp: (a, b) => a.localeCompare(b) },
  { k: "metas", label: "Metas", get: (r) => (r.objetivos.total ? r.objetivos.cumplido / r.objetivos.total : null), cmp: (a, b) => a - b },
  { k: "compromisos", label: "Compromisos", get: (r) => r.compromisos.vencido * 1000 + r.compromisos.abiertos, cmp: (a, b) => a - b },
  { k: "cumplimiento", label: "Cumplimiento", get: (r) => r.cumplimiento.pct, cmp: (a, b) => a - b },
  { k: "proxima", label: "Próxima revisión", get: (r) => r.proxima, cmp: (a, b) => a.localeCompare(b) },
];

/** Directorio de integrantes con tabla comparativa: se puede buscar, filtrar, ordenar y abrir cada ficha. */
export function FbEquipo() {
  const { fb, c, dark, hoy, go, openPersona } = useFbCtx();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("activo");
  const [sort, setSort] = useState({ k: "nombre", dir: 1 });

  const filas = useMemo(() => fb.personas.map((p) => filaComparativa(p, fb.data, hoy, fb.cfg, fb.rolesPorId)), [fb.personas, fb.data, hoy, fb.cfg, fb.rolesPorId]);
  const vista = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const col = COLS.find((x) => x.k === sort.k);
    return filas
      .filter((r) => (estado === "todos" || r.persona.estado === estado) && (!needle || [r.persona.nombre, r.persona.cargo, r.persona.area, ...r.roles].join(" ").toLowerCase().includes(needle)))
      .sort((a, b) => nulos(col.get(a), col.get(b), sort.dir, col.cmp) || a.persona.nombre.localeCompare(b.persona.nombre));
  }, [filas, q, estado, sort]);
  const ordenar = (k) => setSort((s) => (s.k === k ? { k, dir: -s.dir } : { k, dir: 1 }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${c.textFaint}`} />
          <input aria-label="Buscar integrante" className={inputCls(c, "w-64 pl-8")} placeholder="Buscar por nombre, cargo, área o rol" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Estado" className={inputCls(c, "w-40")} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="activo">Activos</option><option value="ausente">Ausentes</option><option value="inactivo">Inactivos</option><option value="todos">Todos</option>
        </select>
        <span className={`text-xs ${c.textFaint}`}>{vista.length} de {fb.personas.length}</span>
        <button onClick={() => openPersona()} className={`${btnPrimary} ml-auto flex items-center gap-1.5`}><Plus className="w-3.5 h-3.5" />Nuevo integrante</button>
      </div>

      <Card c={c} pad={false}>
        {vista.length === 0 ? (
          <Empty c={c} title={fb.personas.length ? "Nadie coincide con la búsqueda" : "Aún no hay integrantes"} text={fb.personas.length ? "Prueba con otro nombre o cambia el estado." : "Crea la ficha de la primera persona para empezar."}
            action={!fb.personas.length ? <button onClick={() => openPersona()} className={btnPrimary}>Nuevo integrante</button> : null} />
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full min-w-[60rem] text-xs">
              <thead>
                <tr className={`border-b ${c.panelBorder} ${c.textDim}`}>
                  {COLS.map((col) => (
                    <th key={col.k} scope="col" aria-sort={sort.k === col.k ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className="text-left font-medium px-3 py-2">
                      <button type="button" onClick={() => ordenar(col.k)} className="inline-flex items-center gap-1 hover:underline">{col.label}{sort.k === col.k && (sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</button>
                    </th>
                  ))}
                  <th className="px-3 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {vista.map((r) => {
                  const p = r.persona;
                  const sin = r.diasSinFeedback != null && r.diasSinFeedback > fb.cfg.dias_sin_feedback;
                  return (
                    <tr key={p.id} className={`border-b last:border-b-0 ${c.panelBorder} ${c.rowHover}`}>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => go({ name: "ficha", personaId: p.id, tab: "resumen" })} className="flex items-center gap-2 text-left">
                          <PersonaAvatar persona={p} size="sm" />
                          <span><span className={`block font-medium ${c.text}`}>{p.nombre}</span><span className={c.textFaint}>{[p.cargo, p.area].filter(Boolean).join(" · ") || "Sin cargo"}</span></span>
                          {p.estado !== "activo" && <Chip color={estadoPersonaMeta(p.estado).color} dark={dark}>{estadoPersonaMeta(p.estado).label}</Chip>}
                        </button>
                      </td>
                      <td className={`px-3 py-2 ${c.text}`}>{r.roles.length ? r.roles.join(", ") : <span className={c.textFaint}>Sin roles</span>}</td>
                      <td className={`px-3 py-2 ${sin ? "text-amber-500" : c.text}`}>{r.ultimoFeedback ? <>{fmtFecha(r.ultimoFeedback)}<span className={`block ${sin ? "" : c.textFaint}`}>hace {r.diasSinFeedback} día{r.diasSinFeedback === 1 ? "" : "s"}</span></> : <span className={c.textFaint}>Sin feedback</span>}</td>
                      <td className={`px-3 py-2 ${r.objetivos.atrasados ? "text-amber-500" : c.text}`}>{textoMetas(r.objetivos)}</td>
                      <td className={`px-3 py-2 ${r.compromisos.vencido ? "text-red-500" : c.text}`}>{textoCompromisos(r.compromisos)}</td>
                      <td className={`px-3 py-2 ${c.text}`}>{r.cumplimiento.pct == null ? <span className={c.textFaint}>—</span> : `${r.cumplimiento.pct}%`}</td>
                      <td className={`px-3 py-2 ${c.text}`}>{r.proxima ? fmtFecha(r.proxima) : <span className={c.textFaint}>Sin agendar</span>}</td>
                      <td className="px-3 py-2"><div className="flex gap-1.5 justify-end">
                        <button onClick={() => go({ name: "ficha", personaId: p.id, tab: "resumen" })} className={btnOutline(c)}>Ver ficha</button>
                        <button onClick={() => go({ name: "feedback", personaId: p.id })} className={btnOutline(c)}>Feedback</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className={`text-xs ${c.textFaint}`}>«Metas» muestra el detalle por estado de cada objetivo (no un promedio, porque los objetivos no son comparables entre sí). El cumplimiento es cumplidos ÷ (cumplidos + vencidos) de los compromisos de la persona; sirve para dónde apoyar, no para clasificar.</p>
    </div>
  );
}
