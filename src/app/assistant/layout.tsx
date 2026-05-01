import { Suspense } from "react";

import { AccessDenied } from "@/components/access-denied";
import { AssistantSidebar } from "@/components/assistant/assistant-sidebar";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Assistant"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  const canProducts = viewerHas(access.grantSet, "org.products", "view");
  const canSuppliers = viewerHas(access.grantSet, "org.suppliers", "view");
  const canWms = viewerHas(access.grantSet, "org.wms", "view");
  const canTariffs = viewerHas(access.grantSet, "org.tariffs", "view");
  const canRfq = viewerHas(access.grantSet, "org.rfq", "view");
  const canInvoiceAudit = viewerHas(access.grantSet, "org.invoice_audit", "view");
  const canApiHub = viewerHas(access.grantSet, "org.apihub", "view");
  const canRisk = viewerHas(access.grantSet, "org.scri", "view");
  const canSettings = viewerHas(access.grantSet, "org.settings", "view");
  const canReports = viewerHas(access.grantSet, "org.reports", "view");
  if (
    !canCt &&
    !canOrders &&
    !canProducts &&
    !canSuppliers &&
    !canWms &&
    !canTariffs &&
    !canRfq &&
    !canInvoiceAudit &&
    !canApiHub &&
    !canRisk &&
    !canSettings &&
    !canReports
  ) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Assistant"
          message="You need at least one operational view grant to use the assistant workspace."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <Suspense
            fallback={<div className="h-72 w-full shrink-0 animate-pulse rounded-2xl bg-zinc-100 lg:w-56" aria-hidden />}
          >
            <AssistantSidebar className="w-full lg:w-56 lg:shrink-0" />
          </Suspense>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
