import { AccessDenied } from "@/components/access-denied";
import { GET } from "@/app/api/assistant/exception-center/route";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ExceptionCenterClient } from "./exception-center-client";

export const dynamic = "force-dynamic";

export default async function AssistantExceptionCenterPage() {
  const access = await getViewerGrantSet();
  const canOpen = Boolean(
    access?.user &&
      (viewerHas(access.grantSet, "org.controltower", "view") ||
        viewerHas(access.grantSet, "org.wms", "view") ||
        viewerHas(access.grantSet, "org.suppliers", "view") ||
        viewerHas(access.grantSet, "org.orders", "view") ||
        viewerHas(access.grantSet, "org.invoice_audit", "view") ||
        viewerHas(access.grantSet, "org.apihub", "view") ||
        viewerHas(access.grantSet, "org.scri", "view")),
  );
  if (!canOpen) {
    return <AccessDenied title="Exception nerve center" message="You need at least one operational view grant to open AMP17." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <ExceptionCenterClient initialSnapshot={snapshot} />;
}
