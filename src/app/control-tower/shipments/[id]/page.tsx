import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { ControlTowerShipment360 } from "@/components/control-tower-shipment-360";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";

export const dynamic = "force-dynamic";

const SHIPMENT_TABS = new Set([
  "details",
  "routing",
  "milestones",
  "documents",
  "notes",
  "commercial",
  "alerts",
  "exceptions",
  "audit",
]);

export default async function ControlTowerShipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, spRaw] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const sp = spRaw as Record<string, string | string[] | undefined>;
  const rawTab = sp.tab;
  const tabParam = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  const initialTab =
    typeof tabParam === "string" && SHIPMENT_TABS.has(tabParam) ? tabParam : undefined;
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );
  const actorId = await getActorUserId();
  const ctx =
    actorId !== null
      ? await getControlTowerPortalContext(actorId)
      : {
          isRestrictedView: false,
          isSupplierPortal: false,
          customerCrmAccountId: null,
        };

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      {ctx.isRestrictedView ? (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Your view is scoped to customer- or supplier-visible shipments; internal alerts, exceptions, and audit may be
          hidden.
        </p>
      ) : null}
      <ControlTowerShipment360 shipmentId={id} canEdit={canEdit} initialTab={initialTab} />
    </main>
  );
}
