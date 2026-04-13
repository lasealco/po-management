import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { ControlTowerShipment360 } from "@/components/control-tower-shipment-360";

export const dynamic = "force-dynamic";

export default async function ControlTowerShipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <ControlTowerShipment360 shipmentId={id} canEdit={canEdit} />
    </main>
  );
}
