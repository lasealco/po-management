import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { ControlTowerWorkbench } from "@/components/control-tower-workbench";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";

export const dynamic = "force-dynamic";

export default async function ControlTowerWorkbenchPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );
  const actorId = await getActorUserId();
  const ctx =
    actorId !== null
      ? await getControlTowerPortalContext(actorId)
      : { isRestrictedView: false, isSupplierPortal: false, customerCrmAccountId: null };

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Tracking workbench</h1>
        <p className="mt-1 text-sm text-zinc-600">
          High-volume list with status, mode, and text search across PO numbers, tracking, carriers, and saved B/L
          references. The first column prefers the PO when the stored shipment number looks like an ASN-style ref
          (e.g. ASN-GEN-…).
          {ctx.isRestrictedView
            ? " Your view is scoped to customer or supplier-visible shipments."
            : null}
        </p>
      </header>
      <ControlTowerWorkbench canEdit={canEdit} restrictedView={ctx.isRestrictedView} />
    </main>
  );
}
