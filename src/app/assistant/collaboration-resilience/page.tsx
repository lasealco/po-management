import { GET } from "@/app/api/assistant/collaboration-resilience/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { CollaborationResilienceClient } from "./collaboration-resilience-client";

export const dynamic = "force-dynamic";

export default async function CollaborationResiliencePage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.srm", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.wms", "view"));
  if (!canView) {
    return <AccessDenied title="Collaboration & Resilience" message="You need reports, supplier/SRM, CRM, Control Tower, or WMS view access to open Sprint 5." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.srm", "edit") ||
    viewerHas(access.grantSet, "org.suppliers", "edit") ||
    viewerHas(access.grantSet, "org.crm", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit") ||
    viewerHas(access.grantSet, "org.wms", "edit");
  return <CollaborationResilienceClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
