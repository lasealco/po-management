import { GET } from "@/app/api/assistant/continuous-planning/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ContinuousPlanningClient } from "./continuous-planning-client";

export const dynamic = "force-dynamic";

export default async function AssistantContinuousPlanningPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.wms", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view"));
  if (!canOpen) {
    return <AccessDenied title="Assistant continuous planning" message="You need settings, orders, WMS, or operations view access to open AMP35." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <ContinuousPlanningClient initialSnapshot={snapshot} />;
}
