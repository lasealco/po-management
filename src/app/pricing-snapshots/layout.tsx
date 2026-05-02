import { RatesModuleSidebar } from "@/components/rates-audit/rates-module-sidebar";
import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

import { PricingSnapshotsGate } from "./pricing-snapshots-gate";

export default async function PricingSnapshotsLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  const { linkVisibility, setupIncomplete } = await resolveNavState(access);

  return (
    <PricingSnapshotsGate>
      <div className="min-h-screen bg-zinc-50">
        <ModuleWorkspaceShell
          sidebar={
            <RatesModuleSidebar
              variant="pricing-snapshots"
              linkVisibility={linkVisibility}
              setupIncomplete={setupIncomplete}
            />
          }
        >
          {children}
        </ModuleWorkspaceShell>
      </div>
    </PricingSnapshotsGate>
  );
}
