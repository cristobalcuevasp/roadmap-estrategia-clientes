import { useState } from "react";
import { ArrowUp, ArrowDown, Plus } from "lucide-react";
import { inputCls, btnPrimary, btnOutline, CAT_COLORS, swatchCls, RespDot } from "./crmUi";
import { COLOR_KEYS } from "../../lib/team";

export const LISTAS = [
  { id: "titulo", label: "Títulos de mailing", uno: "título", ordenable: false, color: false, definicion: false },
  { id: "estado", label: "Estados", uno: "estado", ordenable: true, color: true, definicion: false, semantica: true },
  { id: "einstein", label: "Einstein", uno: "opción de Einstein", ordenable: true, color: false, definicion: true },
  { id: "configuracion", label: "Configuración", uno: "configuración", ordenable: true, color: false, definicion: true },
  { id: "marca", label: "Marcas", uno: "marca", ordenable: true, color: false, definicion: false },
  { id: "canal", label: "Canales", uno: "canal", ordenable: true, color: false, definicion: false },
];
const SEMANTICAS = [["pendiente", "Pendiente (aún no sale)"], ["enviado", "Enviado (ya salió)"], ["cancelado", "Cancelado"], ["otro", "Otro"]];

function CatRow({ item, meta, crm, c, first, last, onMove }) {
  const [d, setD] = useState({ nombre: item.nombre, definicion: item.definicion || "", color: item.color, semantica: item.semantica || "otro", activo: item.activo });
  const dirty = d.nombre !== item.nombre || d.definicion !== (item.definicion || "") || d.color !== item.color || (meta.semantica && d.semantica !== item.semantica) || d.activo !== item.activo;
  const save = () => {
    const patch = {};
    if (d.nombre.trim() !== item.nombre) patch.nombre = d.nombre.trim();
    if (d.definicion !== (item.definicion || "")) patch.definicion = d.definicion.trim();
    if (d.color !== item.color) patch.color = d.color;
    if (meta.semantica && d.semantica !== item.semantica) patch.semantica = d.semantica;
    if (d.activo !== item.activo) patch.activo = d.activo;
    crm.updateCatalogItem(item.id, patch);
  };
  return (
    <div className={`flex flex-wrap items-center gap-1.5 py-1.5 border-t ${c.borderSubtle}`}>
      {meta.ordenable && (
        <span className="flex flex-col">
          <button type="button" aria-label="Subir" disabled={first} onClick={() => onMove(item, -1)} className={`${c.textFaint} disabled:opacity-30`}><ArrowUp className="w-3 h-3" /></button>
          <button type="button" aria-label="Bajar" disabled={last} onClick={() => onMove(item, 1)} className={`${c.textFaint} disabled:opacity-30`}><ArrowDown className="w-3 h-3" /></button>
        </span>
      )}
      {meta.color && <span className={`w-3 h-3 rounded-full shrink-0 ${swatchCls(d.color)}`} aria-hidden="true" />}
      <input aria-label="Nombre" className={`${inputCls(c, "flex-1 min-w-[8rem]")}`} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
      {meta.color && (
        <select aria-label="Color" className={`${inputCls(c, "w-24")}`} value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })}>
          {CAT_COLORS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )}
      {meta.semantica && (
        <select aria-label="Qué significa este estado" className={`${inputCls(c, "w-44")}`} value={d.semantica} onChange={(e) => setD({ ...d, semantica: e.target.value })}>
          {SEMANTICAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      )}
      {meta.definicion && <input aria-label="Definición" className={`${inputCls(c, "w-full")}`} placeholder="Definición (qué significa esta opción)" value={d.definicion} onChange={(e) => setD({ ...d, definicion: e.target.value })} />}
      <label className={`flex items-center gap-1 text-xs ${c.textDim}`}><input type="checkbox" checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} />Activo</label>
      {dirty && <button type="button" disabled={!d.nombre.trim()} onClick={save} className={btnPrimary}>Guardar</button>}
    </div>
  );
}

export function CatalogosTab({ crm, c }) {
  const [listaId, setListaId] = useState("titulo");
  const [nuevo, setNuevo] = useState("");
  const meta = LISTAS.find((l) => l.id === listaId);
  const items = crm.lista(listaId);
  const move = async (item, dir) => {
    const idx = items.findIndex((x) => x.id === item.id);
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const order = items.slice();
    [order[idx], order[j]] = [order[j], order[idx]];
    for (let i = 0; i < order.length; i++) if (order[i].orden !== i + 1) await crm.updateCatalogItem(order[i].id, { orden: i + 1 });
  };
  const add = async () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    const extra = listaId === "estado" ? { semantica: "otro", color: "slate" } : {};
    const row = await crm.createCatalogItem(listaId, nombre, extra);
    if (row) setNuevo("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {LISTAS.map((l) => (
          <button key={l.id} type="button" onClick={() => setListaId(l.id)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${listaId === l.id ? "bg-blue-600 border-blue-600 text-white" : `${c.panelBorder} ${c.textDim}`}`}>{l.label} <span className="opacity-70">{crm.lista(l.id).length}</span></button>
        ))}
      </div>
      {listaId === "estado" && <p className={`text-xs mb-2 ${c.textFaint}`}>Cada estado tiene un significado: “Pendiente” y “Enviado” alimentan los indicadores (planificado vs enviado); “Enviado” registra la fecha de envío automáticamente; “Cancelado” no cuenta como planificado. Debe haber al menos un estado Pendiente activo para duplicar mailings.</p>}
      {(listaId === "einstein" || listaId === "configuracion") && <p className={`text-xs mb-2 ${c.textFaint}`}>Las definiciones son editables. Cualquier texto marcado “por verificar” debe validarse contra cómo está configurado Marketing Cloud antes de darlo por cierto.</p>}
      {items.length === 0 && <p className={`text-xs py-3 ${c.textFaint}`}>Esta lista está vacía.</p>}
      {items.map((it, i) => <CatRow key={it.id + it.updated_at} item={it} meta={meta} crm={crm} c={c} first={i === 0} last={i === items.length - 1} onMove={move} />)}
      <div className={`flex gap-1.5 pt-3 mt-1 border-t ${c.borderSubtle}`}>
        <input className={inputCls(c)} placeholder={`Agregar ${meta.uno}…`} value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button type="button" disabled={!nuevo.trim()} onClick={add} className={`${btnOutline(c)} flex items-center gap-1 shrink-0 disabled:opacity-50`}><Plus className="w-3.5 h-3.5" />Agregar</button>
      </div>
      <p className={`text-xs mt-2 ${c.textFaint}`}>Los elementos no se borran: se desactivan, y los mailings antiguos conservan su valor.</p>
    </div>
  );
}

function RespRow({ r, crm, c, users }) {
  const [d, setD] = useState({ nombre: r.nombre, iniciales: r.iniciales, email: r.email || "", color: r.color, member_id: r.member_id || "", activo: r.activo });
  const dirty = d.nombre !== r.nombre || d.iniciales !== r.iniciales || d.email !== (r.email || "") || d.color !== r.color || d.member_id !== (r.member_id || "") || d.activo !== r.activo;
  const bad = !d.nombre.trim() || d.iniciales.trim().length < 1 || d.iniciales.trim().length > 4;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 py-2 border-t ${c.borderSubtle}`}>
      <RespDot resp={{ ...r, ...d }} size="md" />
      <input aria-label="Nombre" className={`${inputCls(c, "flex-1 min-w-[9rem]")}`} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
      <input aria-label="Iniciales" maxLength={4} className={`${inputCls(c, "w-16")}`} value={d.iniciales} onChange={(e) => setD({ ...d, iniciales: e.target.value })} />
      <input aria-label="Correo" type="email" className={`${inputCls(c, "flex-1 min-w-[12rem]")}`} placeholder="correo@empresa.cl" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
      <select aria-label="Color" className={`${inputCls(c, "w-24")}`} value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })}>{COLOR_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
      <select aria-label="Cuenta en la app" className={`${inputCls(c, "w-44")}`} value={d.member_id} onChange={(e) => setD({ ...d, member_id: e.target.value })}>
        <option value="">Sin cuenta en la app</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <label className={`flex items-center gap-1 text-xs ${c.textDim}`}><input type="checkbox" checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} />Activo</label>
      {dirty && <button type="button" disabled={bad} onClick={() => crm.saveResponsable(r.id, { ...d, member_id: d.member_id || null })} className={btnPrimary}>Guardar</button>}
    </div>
  );
}

export function ResponsablesTab({ crm, c, users }) {
  const [nuevo, setNuevo] = useState({ nombre: "", iniciales: "", email: "" });
  const ok = nuevo.nombre.trim() && nuevo.iniciales.trim().length >= 1 && nuevo.iniciales.trim().length <= 4;
  const add = async () => {
    const row = await crm.saveResponsable(null, { nombre: nuevo.nombre, iniciales: nuevo.iniciales, email: nuevo.email, color: COLOR_KEYS[crm.responsables.length % COLOR_KEYS.length], member_id: null, activo: true });
    if (row) setNuevo({ nombre: "", iniciales: "", email: "" });
  };
  return (
    <div>
      <p className={`text-xs mb-2 ${c.textFaint}`}>Las iniciales (1 a 4 letras) son las que se ven en el calendario y no se pueden repetir entre responsables activos. Si vinculas una cuenta de la app, esa persona recibe avisos de los comentarios que se le asignen. Los correos corporativos se guardan para el aviso por correo, que aún no está activo.</p>
      {crm.responsables.map((r) => <RespRow key={r.id + r.updated_at} r={r} crm={crm} c={c} users={users} />)}
      <div className={`flex flex-wrap gap-1.5 pt-3 mt-1 border-t ${c.borderSubtle}`}>
        <input className={`${inputCls(c, "flex-1 min-w-[9rem]")}`} placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <input maxLength={4} className={`${inputCls(c, "w-16")}`} placeholder="Inic." value={nuevo.iniciales} onChange={(e) => setNuevo({ ...nuevo, iniciales: e.target.value })} />
        <input type="email" className={`${inputCls(c, "flex-1 min-w-[12rem]")}`} placeholder="correo@empresa.cl" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
        <button type="button" disabled={!ok} onClick={add} className={`${btnOutline(c)} flex items-center gap-1 shrink-0 disabled:opacity-50`}><Plus className="w-3.5 h-3.5" />Agregar</button>
      </div>
    </div>
  );
}
