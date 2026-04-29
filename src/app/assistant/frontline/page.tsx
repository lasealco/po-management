import { GET } from "@/app/api/assistant/frontline/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { FrontlineClient } from "./frontline-client";

export const dynamic = "force-dynamic";

export default async function AssistantFrontlinePage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.wms", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view"));
  if (!canOpen) {
    return <AccessDenied title="Frontline & Mobile Execution Intelligence" message="You need WMS, Control Tower, or supplier view access to open Sprint 24 (AMP26)." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <FrontlineClient initialSnapshot={snapshot} />;
}
