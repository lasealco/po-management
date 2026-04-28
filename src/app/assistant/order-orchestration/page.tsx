import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { GET } from "@/app/api/assistant/order-orchestration/route";
import { OrderOrchestrationClient } from "./order-orchestration-client";

export const dynamic = "force-dynamic";

export default async function AssistantOrderOrchestrationPage() {
  const access = await getViewerGrantSet();
  if (!access?.user || !viewerHas(access.grantSet, "org.orders", "view")) {
    return <AccessDenied title="Order orchestration" message="You need org.orders view to open AMP13 order orchestration." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <OrderOrchestrationClient initialSnapshot={snapshot} />;
}
