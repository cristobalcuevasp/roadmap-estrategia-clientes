import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useFbCtx } from "./ctx";
import { btnPrimary, btnOutline } from "../crm/crmUi";
import { Card, Empty, PersonaAvatar, Chip } from "./FbParts";
import { fmtDow, fmtWeek, mondayOf, fmtDMY } from "../../lib/crm/calendar";
import { esAbierto } from "../../lib/fb/logic";

function FilaSeguimiento({ s, atrasado }) {
  const { fb, c, dark, go, openSeguimiento, esLider } = useFbCtx();
  const p = fb.personasPorId.get(s.persona_id);
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 border-b last:border-b-0 ${c.panelBorder}`}>
      <PersonaAvatar persona={p} size="sm" />
      <button type="button" onClick={() => openSeguimiento(s.persona_id, s.id)} className="flex-1 min-w-[12rem] text-left">
        <span className={`block text-xs font-medium ${c.text}`}>{p?.nombre}</span>
        <span className={`text-xs ${atrasado ? "text-red-500" : c.textDim}`}>{fmtDow(s.fecha)} {s.fecha.slice(0, 4)}{s.hora ? ` · ${s.hora.slice(0, 5)}` : ""}{s.motivo ? ` · ${s.motivo}` : ""}</span>
      </button>
      {s.estado !== "programado" && <Chip color={s.estado === "realizado" ? "emerald" : "slate"} dark={dark}>{s.estado === "realizado" ? "Realizado" : "Cancelado"}</Chip>}
      {atrasado && <Chip color="red" dark={dark}>Atrasado</Chip>}
      {esLider && s.estado === "programado" && <div className="flex gap-1.5">
        <button type="button" onClick={() => go({ name: "preparar", personaId: s.persona_id })} className={btnOutline(c)}>Preparar</button>
        <button type="button" onClick={() => go({ name: "feedback", personaId: s.persona_id })} className={btnOutline(c)}>Registrar feedback</button>
      </div>}
      {s.estado === "realizado" && s.sesion_id && <button type="button" onClick={() => go({ name: "minuta", sesionId: s.sesion_id })} className="text-xs text-blue-500">Ver minuta</button>}
    </li>
  );
}

/** Próximas revisiones: seguimientos agendados (por semana) y compromisos con revisión programada. */
export function FbAgenda() {
  const { fb, c, hoy, go, openSeguimiento, openCompromiso } = useFbCtx();
  const prog = useMemo(() => fb.seguimientos.filter((s) => s.estado === "programado").sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora || "").localeCompare(String(b.hora || ""))), [fb.seguimientos]);
  const atrasados = prog.filter((s) => s.fecha < hoy);
  const proximos = prog.filter((s) => s.fecha >= hoy);
  const semanas = useMemo(() => {
    const m = new Map();
    for (const s of proximos) { const k = mondayOf(s.fecha); m.set(k, [...(m.get(k) || []), s]); }
    return [...m.entries()];
  }, [proximos]);
  const revisiones = useMemo(() => fb.compromisos.filter((x) => esAbierto(x) && x.fecha_proxima_revision).sort((a, b) => a.fecha_proxima_revision.localeCompare(b.fecha_proxima_revision)), [fb.compromisos]);
  const pasados = useMemo(() => fb.seguimientos.filter((s) => s.estado !== "programado").sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8), [fb.seguimientos]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className={`text-xs ${c.textDim}`}>Reuniones de seguimiento y revisiones de compromisos que vienen. Al publicar una minuta con «próxima revisión» se agenda sola.</p>
        <button onClick={() => openSeguimiento()} className={`${btnPrimary} ml-auto flex items-center gap-1.5 shrink-0`}><Plus className="w-3.5 h-3.5" />Agendar seguimiento</button>
      </div>

      {atrasados.length > 0 && <Card c={c} title={`Atrasados (${atrasados.length})`} pad={false}><ul>{atrasados.map((s) => <FilaSeguimiento key={s.id} s={s} atrasado />)}</ul></Card>}

      {proximos.length === 0 && atrasados.length === 0 ? (
        <Card c={c}><Empty c={c} title="No hay seguimientos agendados" text="Agenda una reunión de seguimiento o define una próxima revisión al guardar una minuta." action={<button onClick={() => openSeguimiento()} className={btnPrimary}>Agendar seguimiento</button>} /></Card>
      ) : semanas.map(([lunes, items]) => (
        <Card key={lunes} c={c} title={fmtWeek(lunes)} pad={false}><ul>{items.map((s) => <FilaSeguimiento key={s.id} s={s} />)}</ul></Card>
      ))}

      <Card c={c} title={`Revisiones de compromisos programadas (${revisiones.length})`} pad={false}>
        {revisiones.length === 0 ? <Empty c={c} title="Sin revisiones programadas" text="Puedes fijar la próxima revisión al registrar o revisar un compromiso." /> : (
          <ul>{revisiones.map((x) => {
            const vencida = x.fecha_proxima_revision <= hoy;
            return (
              <li key={x.id} className={`border-b last:border-b-0 ${c.panelBorder}`}>
                <button type="button" onClick={() => openCompromiso(x.id)} className={`w-full flex items-center gap-3 px-3 py-2 text-left ${c.rowHover}`}>
                  <PersonaAvatar persona={fb.personasPorId.get(x.persona_id)} size="sm" />
                  <span className="flex-1 min-w-0"><span className={`block text-xs ${c.text}`}>{x.descripcion}</span><span className={`text-xs ${vencida ? "text-red-500" : c.textFaint}`}>{fb.personasPorId.get(x.persona_id)?.nombre} · revisar el {fmtDMY(x.fecha_proxima_revision)}{vencida ? " (pendiente)" : ""}</span></span>
                </button>
              </li>
            );
          })}</ul>
        )}
      </Card>

      {pasados.length > 0 && <Card c={c} title="Realizados y cancelados recientes" pad={false}><ul>{pasados.map((s) => <FilaSeguimiento key={s.id} s={s} />)}</ul></Card>}
    </div>
  );
}
