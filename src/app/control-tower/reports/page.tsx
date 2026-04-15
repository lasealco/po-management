import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getControlTowerReportsSummary } from "@/lib/control-tower/reports-summary";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

import { ControlTowerReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ControlTowerReportsPage() {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  const ctx =
    actorId !== null
      ? await getControlTowerPortalContext(actorId)
      : {
          isRestrictedView: false,
          isSupplierPortal: false,
          customerCrmAccountId: null,
        };
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );

  const summary =
    tenant != null ? await getControlTowerReportsSummary({ tenantId: tenant.id, ctx }) : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Control Tower reports</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Operational KPI snapshot (R4). Export workbench rows as CSV from the workbench page; here you can copy JSON
          for downstream BI.
        </p>
        {ctx.isRestrictedView ? (
          <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            Customer / supplier report: internal SLA, owner load, and exception pipeline metrics are hidden. Exports
            default to a customer-safe JSON slice.
          </p>
        ) : null}
      </header>
      {summary ? <ControlTowerReportsClient summary={summary} canEdit={canEdit} /> : (
        <p className="text-sm text-zinc-500">No tenant context.</p>
      )}
    </main>
  );
}
