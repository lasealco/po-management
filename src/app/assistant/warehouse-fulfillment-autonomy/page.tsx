import { GET } from "@/app/api/assistant/warehouse-fulfillment-autonomy/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { WarehouseFulfillmentAutonomyClient } from "./warehouse-fulfillment-autonomy-client";

export const dynamic = "force-dynamic";

export default async function WarehouseFulfillmentAutonomyPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.wms", "view") || viewerHas(access.grantSet, "org.controltower", "view") || viewerHas(access.grantSet, "org.orders", "view"));
  if (!canView) {
    return <AccessDenied title="Warehouse & Fulfillment Autonomy" message="You need WMS, Control Tower, or orders view access to open Sprint 8." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit = viewerHas(access.grantSet, "org.wms", "edit") || viewerHas(access.grantSet, "org.controltower", "edit") || viewerHas(access.grantSet, "org.orders", "edit");
  return <WarehouseFulfillmentAutonomyClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
