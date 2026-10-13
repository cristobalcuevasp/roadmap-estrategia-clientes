import { useState } from "react";
import { CenterModal } from "./crmUi";
import { CatalogosTab, ResponsablesTab } from "./SettingsCatalogos";
import { ReglasTab } from "./SettingsReglas";
import { FeriadosTab } from "./SettingsFeriados";
import { ClimaTab } from "./SettingsClima";

const TABS = [
  { id: "catalogos", label: "Catálogos" },
  { id: "responsables", label: "Responsables" },
  { id: "pago", label: "Días de pago" },
  { id: "feriados", label: "Feriados" },
  { id: "clima", label: "Clima" },
];

export function SettingsModal({ crm, ctx, users, onClose, initialTab = "catalogos" }) {
  const { c } = ctx;
  const [tab, setTab] = useState(initialTab);
  return (
    <CenterModal c={c} title="Configuración de Programación CRM" onClose={onClose} width="max-w-3xl">
      <div role="tablist" className="flex flex-wrap gap-1 mb-3 -mt-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === t.id ? c.navActive : c.navIdle}`}>{t.label}</button>
        ))}
      </div>
      {tab === "catalogos" && <CatalogosTab crm={crm} c={c} />}
      {tab === "responsables" && <ResponsablesTab crm={crm} c={c} users={users} />}
      {tab === "pago" && <ReglasTab crm={crm} c={c} />}
      {tab === "feriados" && <FeriadosTab crm={crm} c={c} />}
      {tab === "clima" && <ClimaTab crm={crm} c={c} />}
    </CenterModal>
  );
}
