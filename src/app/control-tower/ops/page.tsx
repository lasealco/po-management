import { getActorUserId } from "@/lib/authz";
import { ControlTowerReportingHubWorkbenchLinks } from "@/components/control-tower-reporting-hub-workbench-links";
import { getControlTowerOpsSummary } from "@/lib/control-tower/ops-summary";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

import { ControlTowerOpsClient } from "./ops-client";

export const dynamic = "force-dynamic";

export default async function ControlTowerOpsPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>;
}) {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  const sp = searchParams ? await searchParams : {};
  const focus = typeof sp.focus === "string" ? sp.focus.toLowerCase() : "";
  const ctx =
    actorId !== null
      ? await getControlTowerPortalContext(actorId)
      : {
          isRestrictedView: false,
          isSupplierPortal: false,
          customerCrmAccountId: null,
        };
  const summary =
    tenant != null && actorId != null
      ? await getControlTowerOpsSummary({ tenantId: tenant.id, ctx, actorUserId: actorId })
      : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <ControlTowerReportingHubWorkbenchLinks />
        <h1 className="text-2xl font-semibold text-zinc-900">Ops console</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Guardrails and control-plane view for SLA automation, owner balancing, exception lifecycle, and collaboration
          signals.
        </p>
      </header>
      {summary ? (
        <ControlTowerOpsClient initialSummary={summary} focus={focus} />
      ) : (
        <p className="text-sm text-zinc-500">No tenant context.</p>
      )}
    </main>
  );
}
