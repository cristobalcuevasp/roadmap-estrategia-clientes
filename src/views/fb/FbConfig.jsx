import { useMemo, useState } from "react";
import { Plus, Pencil, Info } from "lucide-react";
import { useFbCtx } from "./ctx";
import { inputCls, btnPrimary, btnOutline } from "../crm/crmUi";
import { Card, Chip, Empty, PersonaAvatar } from "./FbParts";
import { excerpt } from "../../lib/fb/richtext";
import { ROLES_EJEMPLO, estadoPersonaMeta } from "../../lib/fb/constants";

const UMBRALES = [
  { clave: "dias_sin_feedback", label: "Días sin feedback para alertar", hint: "Se avisa de quien lleva más días que este número sin una reunión con minuta." },
  { clave: "dias_aviso_vencimiento", label: "Anticipación del aviso de vencimiento (días)", hint: "Los compromisos que vencen dentro de este plazo aparecen como «por vencer»." },
  { clave: "dias_objetivo_sin_actualizar", label: "Días sin actualizar un objetivo para alertar", hint: "Un objetivo activo que no se toca en este plazo aparece como «sin actualizar»." },
];

function Umbral({ u }) {
  const { fb, c } = useFbCtx();
  const [v, setV] = useState(String(fb.cfg[u.clave]));
  const n = Number(v);
  const valido = Number.isInteger(n) && n >= 1 && n <= 365;
  const cambio = valido && n !== fb.cfg[u.clave];
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-[16rem]"><span className={`block text-xs font-medium mb-1 ${c.textDim}`}>{u.label}</span>
        <input type="number" min={1} max={365} className={inputCls(c, "w-28")} value={v} onChange={(e) => setV(e.target.value)} aria-invalid={!valido} />
        <span className={`block text-xs mt-1 ${valido ? c.textFaint : "text-red-500"}`}>{valido ? u.hint : "Indica un número entero entre 1 y 365."}</span></label>
      <button disabled={!cambio} onClick={() => fb.saveConfigDias(u.clave, n)} className={btnPrimary}>Guardar</button>
    </div>
  );
}

/** Configuración del módulo (solo el líder): integrantes, catálogo de roles y umbrales de las alertas. */
export function FbConfig() {
  const { fb, c, dark, openPersona, openRol, go, nameOf, users } = useFbCtx();
  const enUso = useMemo(() => {
    const m = new Map();
    for (const r of fb.personaRoles) if (r.estado === "activo") m.set(r.rol_id, (m.get(r.rol_id) || 0) + 1);
    return m;
  }, [fb.personaRoles]);
  const sugeridos = ROLES_EJEMPLO.filter((n) => !fb.roles.some((r) => r.nombre.trim().toLowerCase() === n.toLowerCase()));

  return (
    <div className="space-y-3">
      <Card c={c} title="Integrantes y fichas" right={<button onClick={() => openPersona()} className={`${btnOutline(c)} flex items-center gap-1`}><Plus className="w-3 h-3" />Nuevo integrante</button>} pad={false}>
        {fb.personas.length === 0 ? <Empty c={c} title="Aún no hay integrantes" /> : (
          <ul>{fb.personas.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 border-b last:border-b-0 ${c.panelBorder}`}>
              <PersonaAvatar persona={p} size="sm" />
              <button type="button" onClick={() => go({ name: "ficha", personaId: p.id, tab: "resumen" })} className="flex-1 min-w-[10rem] text-left"><span className={`block text-xs font-medium ${c.text}`}>{p.nombre}</span><span className={`text-xs ${c.textFaint}`}>{[p.cargo, p.area].filter(Boolean).join(" · ") || "Sin cargo"}</span></button>
              <span className={`text-xs ${c.textDim}`}>Líder: {nameOf(p.lider_member_id) || "Sin definir"}</span>
              {(() => {
                const activa = !!(p.member_id && users.find((u) => u.id === p.member_id)?.userId);
                if (activa) return <Chip color="emerald" dark={dark} title="Ya creó su cuenta: al ingresar ve su propia ficha (solo lectura)">Con cuenta activa</Chip>;
                if (p.member_id) return <Chip color="amber" dark={dark} title="Está vinculada a un integrante del equipo que todavía no crea su cuenta: hasta entonces solo la ves tú">Vinculada · sin cuenta aún</Chip>;
                return <Chip color="slate" dark={dark} title="Sin cuenta vinculada: solo la ve el líder">Sin cuenta vinculada</Chip>;
              })()}
              <Chip color={estadoPersonaMeta(p.estado).color} dark={dark}>{estadoPersonaMeta(p.estado).label}</Chip>
              <button type="button" onClick={() => openPersona(p.id)} aria-label={`Editar ficha de ${p.nombre}`} className={`p-1 ${c.textFaint}`}><Pencil className="w-3.5 h-3.5" /></button>
            </li>
          ))}</ul>
        )}
      </Card>

      <Card c={c} title="Catálogo de roles" right={<button onClick={() => openRol()} className={`${btnOutline(c)} flex items-center gap-1`}><Plus className="w-3 h-3" />Nuevo rol</button>} pad={false}>
        {fb.roles.length === 0 ? <Empty c={c} title="Aún no hay roles" text="Crea los roles que usas en el equipo y asígnalos desde la ficha de cada persona." action={<button onClick={() => openRol()} className={btnPrimary}>Crear el primer rol</button>} /> : (
          <ul>{fb.roles.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 border-b last:border-b-0 ${c.panelBorder}`}>
              <button type="button" onClick={() => openRol(r.id)} className="flex-1 min-w-[12rem] text-left"><span className={`block text-xs font-medium ${c.text}`}>{r.nombre}</span><span className={`text-xs ${c.textFaint}`}>{excerpt(r.descripcion || r.responsabilidades, 110) || "Sin descripción"}</span></button>
              <span className={`text-xs ${c.textDim}`}>{enUso.get(r.id) || 0} persona{(enUso.get(r.id) || 0) === 1 ? "" : "s"}</span>
              {!r.activo && <Chip dark={dark}>Inactivo</Chip>}
              <button type="button" onClick={() => openRol(r.id)} aria-label={`Editar rol ${r.nombre}`} className={`p-1 ${c.textFaint}`}><Pencil className="w-3.5 h-3.5" /></button>
            </li>
          ))}</ul>
        )}
        {sugeridos.length > 0 && <div className={`px-3 py-2 border-t ${c.panelBorder}`}><p className={`text-xs mb-1 ${c.textFaint}`}>Ejemplos de roles (toca uno para crearlo):</p><div className="flex flex-wrap gap-1.5">{sugeridos.map((n) => <button key={n} type="button" onClick={() => openRol(null, n)} className={`text-xs px-2 py-0.5 rounded-full border ${c.panelBorder} ${c.textDim} ${c.rowHover}`}>{n}</button>)}</div></div>}
      </Card>

      <Card c={c} title="Alertas del panel">
        <div className="space-y-3">{UMBRALES.map((u) => <Umbral key={u.clave} u={u} />)}</div>
        <p className={`flex gap-1.5 text-xs mt-3 ${c.textFaint}`}><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />Las alertas se muestran en el panel («Prioridades de seguimiento»). El envío por correo o notificación push, la frecuencia y los destinatarios configurables aún no están disponibles.</p>
      </Card>

      <Card c={c} title="Privacidad y conservación">
        <ul className={`text-xs space-y-1.5 list-disc pl-5 ${c.textDim}`}>
          <li>Solo el líder ve todas las fichas, las notas privadas y el registro de cambios. Cada integrante con cuenta vinculada ve únicamente su propia ficha, en solo lectura, con las minutas ya publicadas.</li>
          <li>Las notas privadas nunca aparecen en las minutas ni en la impresión.</li>
          <li>Los registros se conservan sin límite de tiempo: las políticas de retención y eliminación automática aún no están disponibles.</li>
          <li>Esta versión no admite archivos adjuntos: las evidencias se registran como texto o enlaces.</li>
        </ul>
      </Card>
    </div>
  );
}
