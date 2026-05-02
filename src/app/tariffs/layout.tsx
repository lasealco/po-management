import { RatesModuleSidebar } from "@/components/rates-audit/rates-module-sidebar";
import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

import { TariffsGate } from "./tariffs-gate";

export default async function TariffsLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  const { linkVisibility, setupIncomplete } = await resolveNavState(access);

  return (
    <TariffsGate>
      <div className="min-h-screen bg-zinc-50">
        <ModuleWorkspaceShell
          sidebar={
            <RatesModuleSidebar
              variant="tariffs"
              linkVisibility={linkVisibility}
              setupIncomplete={setupIncomplete}
            />
          }
        >
          {children}
        </ModuleWorkspaceShell>
      </div>
    </TariffsGate>
  );
}
