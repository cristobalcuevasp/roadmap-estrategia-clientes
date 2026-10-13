import { useMemo, useState } from "react";
import { useFbCtx } from "./ctx";
import { SidePanel, CenterModal, Field, inputCls, btnPrimary, btnGhost, CAT_COLORS, swatchCls } from "../crm/crmUi";
import { COLOR_KEYS } from "../../lib/team";
import { isValidISO } from "../../lib/crm/calendar";
import { ESTADOS_PERSONA, ESTADOS_OBJETIVO, PRIORIDADES, CATEGORIAS_SUGERIDAS, ROLES_EJEMPLO } from "../../lib/fb/constants";
import { RichEditor, FieldError, PersonaSelect, Confirm } from "./FbParts";
import { isBlank } from "../../lib/fb/richtext";

const Grid = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>;
const Footer = ({ onCancel, onSave, saving, label = "Guardar", disabled, c, extra }) => (
  <div className="flex items-center gap-2">
    {extra}
    <span className="flex-1" />
    <button type="button" onClick={onCancel} className={btnGhost(c)}>Cancelar</button>
    <button type="button" onClick={onSave} disabled={saving || disabled} className={btnPrimary}>{saving ? "Guardando…" : label}</button>
  </div>
);

/* ---------------------------------- integrante ---------------------------------- */

export function PersonaForm({ id }) {
  const { fb, c, setOverlay, go, lideres, users, hoy } = useFbCtx();
  const actual = id ? fb.personasPorId.get(id) : null;
  const [d, setD] = useState(() => actual ? { ...actual, fecha_incorporacion: actual.fecha_incorporacion || "", lider_member_id: actual.lider_member_id || "", member_id: actual.member_id || "" }
    : { nombre: "", cargo: "", area: "", fecha_incorporacion: "", lider_member_id: fb.access?.member_id || "", estado: "activo", color: "blue", member_id: "" });
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const vinculados = new Set(fb.personas.filter((p) => p.member_id && p.id !== id).map((p) => p.member_id));
  const cuentas = users.filter((u) => !vinculados.has(u.id));

  const guardar = async () => {
    const e = {};
    if (isBlank(d.nombre)) e.nombre = "Escribe el nombre completo.";
    else if (d.nombre.trim().length > 120) e.nombre = "El nombre es demasiado largo (máximo 120 caracteres).";
    if (d.fecha_incorporacion && !isValidISO(d.fecha_incorporacion)) e.fecha_incorporacion = "La fecha no es válida.";
    if (d.fecha_incorporacion && d.fecha_incorporacion > hoy) e.fecha_incorporacion = "La fecha de incorporación no puede ser futura.";
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const out = await fb.savePersona(id, d);
    setSaving(false);
    if (!out) return;
    setOverlay(null);
    fb.refresh();
    if (!id) { go({ name: "ficha", personaId: out.id, tab: "roles" }); }
  };

  return (
    <SidePanel title={id ? "Editar ficha" : "Nuevo integrante"} subtitle="Feedback & Desarrollo" onClose={() => setOverlay(null)} c={c}
      footer={<Footer c={c} onCancel={() => setOverlay(null)} onSave={guardar} saving={saving} label={id ? "Guardar cambios" : "Crear ficha"} />}>
      <Grid>
        <Field label="Nombre completo *" full c={c}><input className={inputCls(c)} value={d.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={120} autoFocus /><FieldError msg={err.nombre} /></Field>
        <Field label="Cargo formal" c={c}><input className={inputCls(c)} value={d.cargo} onChange={(e) => set("cargo", e.target.value)} maxLength={120} /></Field>
        <Field label="Área o especialidad" c={c}><input className={inputCls(c)} value={d.area} onChange={(e) => set("area", e.target.value)} maxLength={120} /></Field>
        <Field label="Fecha de incorporación" c={c}><input type="date" className={inputCls(c)} value={d.fecha_incorporacion} max={hoy} onChange={(e) => set("fecha_incorporacion", e.target.value)} /><FieldError msg={err.fecha_incorporacion} /></Field>
        <Field label="Estado" c={c}><select className={inputCls(c)} value={d.estado} onChange={(e) => set("estado", e.target.value)}>{ESTADOS_PERSONA.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        <Field label="Líder responsable" full c={c}>
          <select className={inputCls(c)} value={d.lider_member_id} onChange={(e) => set("lider_member_id", e.target.value)}><option value="">Sin definir</option>{lideres.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
        </Field>
        <Field label="Cuenta vinculada" full c={c} hint="Cuando esa persona haya creado su cuenta, podrá ver esta ficha (solo lectura) al ingresar. Mientras tanto, o sin vínculo, solo la ve el líder.">
          <select className={inputCls(c)} value={d.member_id} onChange={(e) => set("member_id", e.target.value)}><option value="">Sin cuenta vinculada</option>{cuentas.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        </Field>
        <Field label="Color del avatar" full c={c}>
          <div className="flex gap-2 flex-wrap">{COLOR_KEYS.map((k) => (
            <button key={k} type="button" onClick={() => set("color", k)} aria-label={k} aria-pressed={d.color === k} className={`w-6 h-6 rounded-full ${swatchCls(k)} ${d.color === k ? "ring-2 ring-offset-2 ring-blue-500 ring-offset-transparent" : ""}`} />
          ))}</div>
        </Field>
      </Grid>
    </SidePanel>
  );
}

/* ----------------------------------- seguimiento ----------------------------------- */

export function SeguimientoModal({ personaId, id }) {
  const { fb, c, setOverlay, hoy } = useFbCtx();
  const actual = id ? fb.seguimientos.find((s) => s.id === id) : null;
  const [d, setD] = useState(() => actual ? { persona_id: actual.persona_id, fecha: actual.fecha, hora: actual.hora ? actual.hora.slice(0, 5) : "", motivo: actual.motivo, estado: actual.estado }
    : { persona_id: personaId || "", fecha: "", hora: "", motivo: "", estado: "programado" });
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const activas = fb.personas.filter((p) => p.estado !== "inactivo" || p.id === d.persona_id);

  const guardar = async (patch = {}) => {
    const x = { ...d, ...patch };
    const e = {};
    if (!x.persona_id) e.persona_id = "Elige a la persona.";
    if (!isValidISO(x.fecha)) e.fecha = "Indica una fecha válida.";
    else if (!id && x.fecha < hoy) e.fecha = "La fecha no puede ser anterior a hoy.";
    if (x.hora && !/^\d{2}:\d{2}$/.test(x.hora)) e.hora = "La hora no es válida.";
    if (x.motivo.length > 1000) e.motivo = "El motivo es demasiado largo.";
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const out = await fb.saveSeguimiento(id, x);
    setSaving(false);
    if (out) { setOverlay(null); }
  };

  return (
    <>
      <CenterModal title={id ? "Seguimiento" : "Agendar seguimiento"} onClose={() => setOverlay(null)} width="max-w-md" c={c}
        footer={<Footer c={c} onCancel={() => setOverlay(null)} onSave={() => guardar()} saving={saving} label={id ? "Guardar" : "Agendar"}
          extra={actual && actual.estado === "programado" ? <button type="button" onClick={() => setCancelar(true)} className="text-xs text-red-500 px-2 py-1.5">Cancelar seguimiento</button> : null} />}>
        <Grid>
          <Field label="Persona *" full c={c}><PersonaSelect personas={activas} value={d.persona_id} onChange={(v) => set("persona_id", v)} c={c} disabled={!!id} /><FieldError msg={err.persona_id} /></Field>
          <Field label="Fecha *" c={c}><input type="date" className={inputCls(c)} value={d.fecha} min={id ? undefined : hoy} onChange={(e) => set("fecha", e.target.value)} /><FieldError msg={err.fecha} /></Field>
          <Field label="Hora" c={c}><input type="time" className={inputCls(c)} value={d.hora} onChange={(e) => set("hora", e.target.value)} /><FieldError msg={err.hora} /></Field>
          <Field label="Motivo" full c={c}><input className={inputCls(c)} value={d.motivo} onChange={(e) => set("motivo", e.target.value)} maxLength={1000} placeholder="Ej.: revisar avance de los compromisos" /><FieldError msg={err.motivo} /></Field>
          {id && <Field label="Estado" full c={c}><select className={inputCls(c)} value={d.estado} onChange={(e) => set("estado", e.target.value)}><option value="programado">Programado</option><option value="realizado">Realizado</option><option value="cancelado">Cancelado</option></select>
            <p className={`text-xs mt-1 ${c.textFaint}`}>Al publicar la minuta de una reunión, los seguimientos programados de esa fecha pasan solos a «Realizado».</p></Field>}
        </Grid>
      </CenterModal>
      {cancelar && <Confirm title="Cancelar seguimiento" c={c} danger confirmLabel="Cancelar seguimiento" cancelLabel="Volver" onCancel={() => setCancelar(false)} onConfirm={() => { setCancelar(false); guardar({ estado: "cancelado" }); }}>
        <p>El seguimiento quedará marcado como cancelado y dejará de aparecer en las próximas reuniones.</p></Confirm>}
    </>
  );
}

/* -------------------------------------- objetivo -------------------------------------- */

export function ObjetivoForm({ personaId, id }) {
  const { fb, c, setOverlay, hoy } = useFbCtx();
  const actual = id ? fb.objetivos.find((o) => o.id === id) : null;
  const pid = actual?.persona_id || personaId;
  const rolesPersona = useMemo(() => fb.personaRoles.filter((r) => r.persona_id === pid).map((r) => ({ ...r, nombre: fb.rolesPorId.get(r.rol_id)?.nombre || "—" })), [fb.personaRoles, fb.rolesPorId, pid]);
  const [d, setD] = useState(() => actual ? { ...actual, fecha_objetivo: actual.fecha_objetivo || "" } : { titulo: "", descripcion: "", resultado_esperado: "", prioridad: "media", fecha_objetivo: "", estado: "pendiente", avance: 0, criterios_exito: "", observaciones: "", categoria: "" });
  const [roles, setRoles] = useState(() => (id ? fb.objetivoRoles.filter((x) => x.objetivo_id === id).map((x) => x.rol_id) : []));
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const persona = fb.personasPorId.get(pid);

  const guardar = async () => {
    const e = {};
    if (isBlank(d.titulo)) e.titulo = "Escribe el título del objetivo.";
    else if (d.titulo.trim().length > 200) e.titulo = "El título es demasiado largo (máximo 200 caracteres).";
    if (d.fecha_objetivo && !isValidISO(d.fecha_objetivo)) e.fecha_objetivo = "La fecha no es válida.";
    if (d.fecha_objetivo && !id && d.fecha_objetivo < hoy) e.fecha_objetivo = "La fecha objetivo no puede ser anterior a hoy.";
    const av = Number(d.avance);
    if (!Number.isFinite(av) || av < 0 || av > 100) e.avance = "El avance debe estar entre 0 y 100.";
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const out = await fb.saveObjetivo(id, { ...d, persona_id: pid, avance: d.estado === "cumplido" ? 100 : av }, roles);
    setSaving(false);
    if (out) setOverlay(null);
  };

  return (
    <SidePanel title={id ? "Editar objetivo" : "Nuevo objetivo"} subtitle={persona ? `¿Qué espero de ${persona.nombre}?` : ""} width="max-w-2xl" onClose={() => setOverlay(null)} c={c}
      footer={<Footer c={c} onCancel={() => setOverlay(null)} onSave={guardar} saving={saving} label={id ? "Guardar cambios" : "Crear objetivo"} />}>
      <Grid>
        <Field label="Título *" full c={c}><input className={inputCls(c)} value={d.titulo} onChange={(e) => set("titulo", e.target.value)} maxLength={200} autoFocus /><FieldError msg={err.titulo} /></Field>
        <Field label="Descripción" full c={c}><RichEditor value={d.descripcion} onChange={(v) => set("descripcion", v)} rows={3} c={c} ariaLabel="Descripción" /></Field>
        <Field label="Resultado esperado" full c={c}><RichEditor value={d.resultado_esperado} onChange={(v) => set("resultado_esperado", v)} rows={3} c={c} ariaLabel="Resultado esperado" /></Field>
        <Field label="Criterios de éxito" full c={c} hint="Cómo se verificará que se logró: hechos observables, no impresiones."><RichEditor value={d.criterios_exito} onChange={(v) => set("criterios_exito", v)} rows={3} c={c} ariaLabel="Criterios de éxito" /></Field>
        <Field label="Prioridad" c={c}><select className={inputCls(c)} value={d.prioridad} onChange={(e) => set("prioridad", e.target.value)}>{PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
        <Field label="Fecha objetivo" c={c}><input type="date" className={inputCls(c)} value={d.fecha_objetivo} onChange={(e) => set("fecha_objetivo", e.target.value)} /><FieldError msg={err.fecha_objetivo} /></Field>
        <Field label="Estado" c={c}><select className={inputCls(c)} value={d.estado} onChange={(e) => setD((x) => ({ ...x, estado: e.target.value, avance: e.target.value === "cumplido" ? 100 : x.avance }))}>{ESTADOS_OBJETIVO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        <Field label={`Avance: ${d.estado === "cumplido" ? 100 : Number(d.avance) || 0}%`} c={c}>
          <input type="range" min={0} max={100} step={5} value={d.estado === "cumplido" ? 100 : d.avance} disabled={d.estado === "cumplido"} onChange={(e) => set("avance", Number(e.target.value))} className="w-full" aria-label="Avance" /><FieldError msg={err.avance} />
        </Field>
        <Field label="Categoría" full c={c}>
          <input className={inputCls(c)} list="fb-cats" value={d.categoria} onChange={(e) => set("categoria", e.target.value)} maxLength={60} placeholder="Opcional" />
          <datalist id="fb-cats">{CATEGORIAS_SUGERIDAS.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label="Roles vinculados" full c={c} hint={rolesPersona.length ? "Elige los roles a los que responde este objetivo." : "Esta persona aún no tiene roles. Asígnalos en la pestaña «Roles y expectativas» para poder vincularlos."}>
          <div className="flex flex-wrap gap-2">{rolesPersona.map((r) => (
            <label key={r.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border cursor-pointer ${c.panelBorder} ${c.text}`}>
              <input type="checkbox" checked={roles.includes(r.rol_id)} onChange={() => setRoles((x) => (x.includes(r.rol_id) ? x.filter((i) => i !== r.rol_id) : [...x, r.rol_id]))} />
              {r.nombre}{r.estado === "historico" ? " (histórico)" : ""}
            </label>
          ))}</div>
        </Field>
        <Field label="Observaciones" full c={c}><RichEditor value={d.observaciones} onChange={(v) => set("observaciones", v)} rows={2} c={c} ariaLabel="Observaciones" /></Field>
      </Grid>
    </SidePanel>
  );
}

/* ----------------------------------------- rol ----------------------------------------- */

export function RolForm({ id, nombreInicial = "" }) {
  const { fb, c, setOverlay } = useFbCtx();
  const actual = id ? fb.rolesPorId.get(id) : null;
  const [d, setD] = useState(() => actual ? { ...actual } : { nombre: nombreInicial, descripcion: "", responsabilidades: "", expectativas: "", activo: true });
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const enUso = id ? fb.personaRoles.filter((r) => r.rol_id === id && r.estado === "activo").length : 0;

  const guardar = async () => {
    const e = {};
    if (isBlank(d.nombre)) e.nombre = "Escribe el nombre del rol.";
    else if (d.nombre.trim().length > 80) e.nombre = "El nombre es demasiado largo (máximo 80 caracteres).";
    else if (fb.roles.some((r) => r.id !== id && r.nombre.trim().toLowerCase() === d.nombre.trim().toLowerCase())) e.nombre = "Ya existe un rol con ese nombre.";
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const out = await fb.saveRol(id, d);
    setSaving(false);
    if (out) setOverlay(null);
  };

  return (
    <SidePanel title={id ? "Editar rol" : "Nuevo rol"} subtitle="Catálogo de roles" width="max-w-xl" onClose={() => setOverlay(null)} c={c}
      footer={<Footer c={c} onCancel={() => setOverlay(null)} onSave={guardar} saving={saving} label={id ? "Guardar cambios" : "Crear rol"} />}>
      {id && enUso > 0 && <p className={`text-xs rounded-md p-2 ${c.dark ? "bg-amber-500/10 text-amber-300" : "bg-amber-50 text-amber-800"}`}>Este rol está activo en {enUso} persona{enUso === 1 ? "" : "s"}: los cambios se verán en todas sus fichas. Las minutas ya publicadas conservan lo que decía el rol cuando se hicieron.</p>}
      <Grid>
        <Field label="Nombre *" full c={c}><input className={inputCls(c)} value={d.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={80} autoFocus /><FieldError msg={err.nombre} /></Field>
        <Field label="Descripción" full c={c}><RichEditor value={d.descripcion} onChange={(v) => set("descripcion", v)} rows={3} c={c} ariaLabel="Descripción del rol" /></Field>
        <Field label="Responsabilidades principales" full c={c}><RichEditor value={d.responsabilidades} onChange={(v) => set("responsabilidades", v)} rows={4} c={c} ariaLabel="Responsabilidades" /></Field>
        <Field label="Expectativas del líder" full c={c}><RichEditor value={d.expectativas} onChange={(v) => set("expectativas", v)} rows={4} c={c} ariaLabel="Expectativas" /></Field>
        {id && <label className={`col-span-2 flex items-center gap-2 text-xs ${c.text}`}><input type="checkbox" checked={d.activo} onChange={(e) => set("activo", e.target.checked)} />Rol activo (disponible para asignar)</label>}
      </Grid>
    </SidePanel>
  );
}

/* ------------------------------------ asignar rol ------------------------------------ */

export function AsignarRolForm({ personaId, asigId, nombreInicial = "" }) {
  const { fb, c, setOverlay, hoy } = useFbCtx();
  const asig = asigId ? fb.personaRoles.find((r) => r.id === asigId) : null;
  const pid = asig?.persona_id || personaId;
  const persona = fb.personasPorId.get(pid);
  const rolActivosIds = new Set(fb.personaRoles.filter((r) => r.persona_id === pid && r.estado === "activo").map((r) => r.rol_id));
  const disponibles = fb.roles.filter((r) => r.activo && !rolActivosIds.has(r.id));
  const [modo, setModo] = useState(asig ? "existente" : nombreInicial || disponibles.length === 0 ? "nuevo" : "existente");
  const [rolId, setRolId] = useState(asig?.rol_id || "");
  const [nuevo, setNuevo] = useState({ nombre: nombreInicial, descripcion: "", responsabilidades: "", expectativas: "", activo: true });
  const [d, setD] = useState(() => ({ fecha_asignacion: asig?.fecha_asignacion || hoy, responsabilidades: asig?.responsabilidades || "", expectativas: asig?.expectativas || "" }));
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [historico, setHistorico] = useState(false);
  const rolBase = fb.rolesPorId.get(modo === "existente" ? rolId : "") || null;
  const sugeridos = ROLES_EJEMPLO.filter((n) => !fb.roles.some((r) => r.nombre.trim().toLowerCase() === n.toLowerCase()));

  const guardar = async () => {
    const e = {};
    if (!asig && modo === "existente" && !rolId) e.rol = "Elige un rol o crea uno nuevo.";
    if (!asig && modo === "nuevo") {
      if (isBlank(nuevo.nombre)) e.nombre = "Escribe el nombre del rol.";
      else if (fb.roles.some((r) => r.nombre.trim().toLowerCase() === nuevo.nombre.trim().toLowerCase())) e.nombre = "Ya existe un rol con ese nombre: elígelo de la lista.";
    }
    if (!isValidISO(d.fecha_asignacion)) e.fecha_asignacion = "La fecha no es válida.";
    else if (d.fecha_asignacion > hoy) e.fecha_asignacion = "La fecha de asignación no puede ser futura.";
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    let out;
    if (asig) out = await fb.updatePersonaRol(asig.id, { fecha_asignacion: d.fecha_asignacion, responsabilidades: d.responsabilidades, expectativas: d.expectativas });
    else {
      let rid = rolId;
      if (modo === "nuevo") { const r = await fb.saveRol(null, nuevo); if (!r) { setSaving(false); return; } rid = r.id; }
      out = await fb.assignRol({ persona_id: pid, rol_id: rid, ...d });
    }
    setSaving(false);
    if (out) setOverlay(null);
  };
  const pasarAHistorico = async () => {
    setHistorico(false);
    setSaving(true);
    const out = await fb.updatePersonaRol(asig.id, { estado: "historico", fecha_termino: hoy });
    setSaving(false);
    if (out) setOverlay(null);
  };

  return (
    <>
      <SidePanel title={asig ? `Rol: ${fb.rolesPorId.get(asig.rol_id)?.nombre || ""}` : "Asignar rol"} subtitle={persona?.nombre} width="max-w-xl" onClose={() => setOverlay(null)} c={c}
        footer={<Footer c={c} onCancel={() => setOverlay(null)} onSave={guardar} saving={saving} label={asig ? "Guardar cambios" : "Asignar rol"}
          extra={asig && asig.estado === "activo" ? <button type="button" onClick={() => setHistorico(true)} className="text-xs text-amber-600 px-2 py-1.5">Pasar a histórico</button> : null} />}>
        {!asig && (
          <div role="radiogroup" aria-label="Origen del rol" className="flex gap-2">
            {[["existente", "Elegir del catálogo"], ["nuevo", "Crear un rol nuevo"]].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={modo === k} onClick={() => setModo(k)} className={`px-3 py-1.5 text-xs rounded-md border ${modo === k ? "border-blue-500 text-blue-500" : `${c.panelBorder} ${c.textDim}`}`}>{l}</button>
            ))}
          </div>
        )}
        {!asig && modo === "existente" && (
          <Field label="Rol *" c={c}>
            <select className={inputCls(c)} value={rolId} onChange={(e) => setRolId(e.target.value)}><option value="">{disponibles.length ? "Elige un rol" : "No hay roles disponibles: crea uno nuevo"}</option>{disponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>
            <FieldError msg={err.rol} />
          </Field>
        )}
        {!asig && modo === "nuevo" && (
          <div className="space-y-3">
            <Field label="Nombre del rol *" c={c}><input className={inputCls(c)} value={nuevo.nombre} onChange={(e) => setNuevo((x) => ({ ...x, nombre: e.target.value }))} maxLength={80} /><FieldError msg={err.nombre} /></Field>
            {sugeridos.length > 0 && <div><p className={`text-xs mb-1 ${c.textFaint}`}>Ejemplos (toca uno para usarlo como nombre):</p><div className="flex flex-wrap gap-1.5">{sugeridos.map((n) => <button key={n} type="button" onClick={() => setNuevo((x) => ({ ...x, nombre: n }))} className={`text-xs px-2 py-0.5 rounded-full border ${c.panelBorder} ${c.textDim} ${c.rowHover}`}>{n}</button>)}</div></div>}
            <Field label="Descripción" c={c}><RichEditor value={nuevo.descripcion} onChange={(v) => setNuevo((x) => ({ ...x, descripcion: v }))} rows={2} c={c} ariaLabel="Descripción del rol" /></Field>
            <Field label="Responsabilidades principales" c={c}><RichEditor value={nuevo.responsabilidades} onChange={(v) => setNuevo((x) => ({ ...x, responsabilidades: v }))} rows={3} c={c} ariaLabel="Responsabilidades del rol" /></Field>
            <Field label="Expectativas del líder" c={c}><RichEditor value={nuevo.expectativas} onChange={(v) => setNuevo((x) => ({ ...x, expectativas: v }))} rows={3} c={c} ariaLabel="Expectativas del rol" /></Field>
          </div>
        )}
        <Field label="Fecha de asignación" c={c}><input type="date" className={inputCls(c)} value={d.fecha_asignacion} max={hoy} onChange={(e) => setD((x) => ({ ...x, fecha_asignacion: e.target.value }))} /><FieldError msg={err.fecha_asignacion} /></Field>
        <div className={`rounded-md border p-3 space-y-3 ${c.panelBorder}`}>
          <p className={`text-xs font-medium ${c.text}`}>Ajustes solo para {persona?.nombre?.split(" ")[0] || "esta persona"} <span className={`font-normal ${c.textFaint}`}>(opcional: déjalos vacíos para usar lo definido en el rol)</span></p>
          <Field label="Responsabilidades específicas" c={c} hint={rolBase?.responsabilidades ? `Del rol: ${rolBase.responsabilidades.slice(0, 120)}${rolBase.responsabilidades.length > 120 ? "…" : ""}` : undefined}>
            <RichEditor value={d.responsabilidades} onChange={(v) => setD((x) => ({ ...x, responsabilidades: v }))} rows={3} c={c} ariaLabel="Responsabilidades específicas" />
          </Field>
          <Field label="Expectativas específicas" c={c} hint={rolBase?.expectativas ? `Del rol: ${rolBase.expectativas.slice(0, 120)}${rolBase.expectativas.length > 120 ? "…" : ""}` : undefined}>
            <RichEditor value={d.expectativas} onChange={(v) => setD((x) => ({ ...x, expectativas: v }))} rows={3} c={c} ariaLabel="Expectativas específicas" />
          </Field>
        </div>
      </SidePanel>
      {historico && <Confirm title="Pasar el rol a histórico" c={c} confirmLabel="Pasar a histórico" onCancel={() => setHistorico(false)} onConfirm={pasarAHistorico}>
        <p>El rol dejará de contar como rol actual de {persona?.nombre}, con fecha de término hoy. Se conserva en la ficha y en las minutas anteriores.</p></Confirm>}
    </>
  );
}
