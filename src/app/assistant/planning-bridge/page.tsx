import { GET } from "@/app/api/assistant/planning-bridge/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { PlanningBridgeClient } from "./planning-bridge-client";

export const dynamic = "force-dynamic";

export default async function AssistantPlanningBridgePage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.orders", "view") || viewerHas(access.grantSet, "org.crm", "view")) &&
    (viewerHas(access.grantSet, "org.suppliers", "view") || viewerHas(access.grantSet, "org.products", "view")) &&
    (viewerHas(access.grantSet, "org.wms", "view") || viewerHas(access.grantSet, "org.controltower", "view"));
  if (!canOpen) {
    return <AccessDenied title="Planning bridge" message="You need demand, supply, and execution view access to open AMP22." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <PlanningBridgeClient initialSnapshot={snapshot} />;
}
