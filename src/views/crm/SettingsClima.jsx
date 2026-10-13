import { useEffect, useState } from "react";
import { BANDAS, normalizeCortes, bandRangeLabel } from "../../lib/crm/weather";
import { Field, inputCls, btnPrimary } from "./crmUi";

const ESTADO_EJEC = { ok: "completa", parcial: "parcial (algunas comunas fallaron)", error: "con error", en_curso: "en curso" };

export function ClimaTab({ crm, c }) {
  const s = crm.settings;
  const [cortes, setCortes] = useState(s.cortes);
  const [dias, setDias] = useState(s.diasPronostico);
  const [umbral, setUmbral] = useState(s.sugerencia.umbral);
  const [prop, setProp] = useState(s.sugerencia.proporcion);
  useEffect(() => { setCortes(s.cortes); setDias(s.diasPronostico); setUmbral(s.sugerencia.umbral); setProp(s.sugerencia.proporcion); }, [s.cortes, s.diasPronostico, s.sugerencia.umbral, s.sugerencia.proporcion]);

  const cortesNum = cortes.map(Number);
  const cortesOk = JSON.stringify(normalizeCortes(cortesNum)) === JSON.stringify(cortesNum);
  const run = crm.ultimaEjecucion;
  const hayDatos = crm.clima.length > 0;

  return (
    <div className="space-y-4">
      <div className={`rounded-md border p-2.5 text-xs space-y-1 ${c.panelBorder} ${c.textDim}`}>
        <p className="font-semibold">Estado de los datos de clima</p>
        <p>{hayDatos ? `Hay ${crm.clima.length} pronósticos diarios por comuna cargados.` : "Todavía no hay ningún pronóstico cargado: el calendario no muestra clima hasta que la actualización automática se ejecute."}</p>
        <p>{run ? `Última ejecución: ${new Date(run.fin || run.inicio).toLocaleString("es-CL")} · ${ESTADO_EJEC[run.estado] || run.estado}${run.fuente ? ` · fuente ${run.fuente}` : ""}${run.comunas_ok || run.comunas_error ? ` · ${run.comunas_ok} comunas ok, ${run.comunas_error} con error` : ""}.` : "No se ha registrado ninguna ejecución."}</p>
        {run?.detalle && <p className={c.textFaint}>Detalle: {run.detalle}</p>}
        <p className={c.textFaint}>El dato es la probabilidad de precipitación diaria que entrega la fuente para cada comuna con tiendas abiertas; por región se promedia ponderando por tiendas abiertas. Más allá del horizonte de la fuente no se muestra nada.</p>
      </div>

      <div>
        <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${c.textDim}`}>Escala de colores (probabilidad de lluvia)</h4>
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {BANDAS.map((b) => <span key={b.id} className={`text-xs px-2 py-1 rounded ${b.bar} ${c.text}`}>{b.label}: {bandRangeLabel(b.id, cortesOk ? cortesNum : s.cortes)}</span>)}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {cortes.map((v, i) => (
            <Field key={i} c={c} label={`Corte ${i + 1} (%)`}><input type="number" min="1" max="99" className={inputCls(c)} value={v} onChange={(e) => setCortes(cortes.map((x, j) => (j === i ? e.target.value : x)))} /></Field>
          ))}
        </div>
        {!cortesOk && <p className="text-xs text-red-500 mt-1">Los cuatro cortes deben ser crecientes y estar entre 1 y 99.</p>}
        <div className="flex justify-end mt-2"><button type="button" disabled={!cortesOk || JSON.stringify(cortesNum) === JSON.stringify(s.cortes)} onClick={() => crm.saveConfig("clima_escala", { cortes: cortesNum })} className={btnPrimary}>Guardar escala</button></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field c={c} label="Días de pronóstico confiable" hint="Pasado ese plazo el dato se marca como tendencia."><input type="number" min="1" max="16" className={inputCls(c)} value={dias} onChange={(e) => setDias(e.target.value)} /></Field>
        <Field c={c} label="Sugerencia: umbral de lluvia (%)"><input type="number" min="1" max="100" className={inputCls(c)} value={umbral} onChange={(e) => setUmbral(e.target.value)} /></Field>
        <Field c={c} label="Sugerencia: % de tiendas sobre el umbral" hint="Se sugiere evaluar una campaña si lo supera."><input type="number" min="0" max="99" className={inputCls(c)} value={prop} onChange={(e) => setProp(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" disabled={!(Number(dias) >= 1 && Number(dias) <= 16) || Number(dias) === s.diasPronostico} onClick={() => crm.saveConfig("clima_pronostico_dias", { dias: Number(dias) })} className={btnPrimary}>Guardar días</button>
        <button type="button" disabled={!(Number(umbral) >= 1 && Number(umbral) <= 100 && Number(prop) >= 0 && Number(prop) <= 99) || (Number(umbral) === s.sugerencia.umbral && Number(prop) === s.sugerencia.proporcion)} onClick={() => crm.saveConfig("clima_sugerencia", { umbral: Number(umbral), proporcion: Number(prop) })} className={btnPrimary}>Guardar sugerencia</button>
      </div>
      <p className={`text-xs ${c.textFaint}`}>La sugerencia es una hipótesis para apoyar la decisión humana: el sistema nunca programa ni envía nada por el clima.</p>
    </div>
  );
}
