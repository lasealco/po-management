import { AccessDenied } from "@/components/access-denied";
import { GET } from "@/app/api/assistant/warehouse-capacity/route";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { WarehouseCapacityClient } from "./warehouse-capacity-client";

export const dynamic = "force-dynamic";

export default async function AssistantWarehouseCapacityPage() {
  const access = await getViewerGrantSet();
  if (!access?.user || !viewerHas(access.grantSet, "org.wms", "view")) {
    return <AccessDenied title="Warehouse capacity" message="You need org.wms view to open AMP15 warehouse capacity command." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <WarehouseCapacityClient initialSnapshot={snapshot} />;
}
