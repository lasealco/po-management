import { getActorUserId } from "@/lib/authz";
import { ControlTowerCommandCenter } from "@/components/control-tower-command-center";
import { ControlTowerReportingHubWorkbenchLinks } from "@/components/control-tower-reporting-hub-workbench-links";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";

export const dynamic = "force-dynamic";

export default async function ControlTowerCommandCenterPage() {
  const actorId = await getActorUserId();
  const ctx =
    actorId !== null
      ? await getControlTowerPortalContext(actorId)
      : { isRestrictedView: false, isSupplierPortal: false, customerCrmAccountId: null };

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <ControlTowerReportingHubWorkbenchLinks />
        <h1 className="text-2xl font-semibold text-zinc-900">Command center</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Lanes stack vertically by the next route action on each shipment (empty lanes are hidden by default — use
          &quot;Show all lanes&quot; when you need the full board). Filter by the first assigned owner on open alerts
          or exceptions. Cards link to Shipment 360 for execution; titles prefer the PO when shipment numbers look
          like ASN references.
          {ctx.isRestrictedView
            ? " Dispatch-owner filtering is available to internal users only."
            : null}
        </p>
      </header>
      <ControlTowerCommandCenter restrictedView={ctx.isRestrictedView} />
    </main>
  );
}
