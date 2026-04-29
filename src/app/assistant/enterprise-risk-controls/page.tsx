import { GET } from "@/app/api/assistant/enterprise-risk-controls/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { EnterpriseRiskControlsClient } from "./enterprise-risk-controls-client";

export const dynamic = "force-dynamic";

export default async function EnterpriseRiskControlsPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.rfq", "view") ||
      viewerHas(access.grantSet, "org.tariffs", "view") ||
      viewerHas(access.grantSet, "org.scri", "view"));
  if (!canView) {
    return <AccessDenied title="Enterprise Risk & Controls" message="You need reporting, settings, supplier, RFQ, tariff, or SCRI view access to open Sprint 2." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.settings", "edit") ||
    viewerHas(access.grantSet, "org.suppliers", "edit") ||
    viewerHas(access.grantSet, "org.rfq", "edit") ||
    viewerHas(access.grantSet, "org.tariffs", "edit") ||
    viewerHas(access.grantSet, "org.scri", "edit");
  return <EnterpriseRiskControlsClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
