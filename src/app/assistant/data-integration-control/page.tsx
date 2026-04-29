import { GET } from "@/app/api/assistant/data-integration-control/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { DataIntegrationControlClient } from "./data-integration-control-client";

export const dynamic = "force-dynamic";

export default async function DataIntegrationControlPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.apihub", "view") ||
      viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.products", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view"));
  if (!canView) {
    return <AccessDenied title="Data & Integration Control" message="You need API Hub, settings, product, supplier, CRM, or Control Tower view access to open Sprint 9." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.apihub", "edit") ||
    viewerHas(access.grantSet, "org.settings", "edit") ||
    viewerHas(access.grantSet, "org.products", "edit") ||
    viewerHas(access.grantSet, "org.suppliers", "edit") ||
    viewerHas(access.grantSet, "org.crm", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit");
  return <DataIntegrationControlClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
