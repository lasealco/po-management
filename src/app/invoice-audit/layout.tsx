import { RatesModuleSidebar } from "@/components/rates-audit/rates-module-sidebar";
import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

import { InvoiceAuditGate } from "./invoice-audit-gate";

export default async function InvoiceAuditLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  const { linkVisibility, setupIncomplete } = await resolveNavState(access);

  return (
    <InvoiceAuditGate>
      <div className="min-h-screen bg-zinc-50">
        <ModuleWorkspaceShell
          sidebar={
            <RatesModuleSidebar
              variant="invoice-audit"
              linkVisibility={linkVisibility}
              setupIncomplete={setupIncomplete}
            />
          }
        >
          {children}
        </ModuleWorkspaceShell>
      </div>
    </InvoiceAuditGate>
  );
}
