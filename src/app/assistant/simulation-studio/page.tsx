import { GET } from "@/app/api/assistant/simulation-studio/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { SimulationStudioClient } from "./simulation-studio-client";

export const dynamic = "force-dynamic";

export default async function AssistantSimulationStudioPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.wms", "view"));
  if (!canOpen) {
    return <AccessDenied title="Assistant simulation studio" message="You need settings, reports, orders, operations, or WMS view access to open AMP34." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <SimulationStudioClient initialSnapshot={snapshot} />;
}
