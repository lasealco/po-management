import { GET } from "@/app/api/assistant/strategic-sourcing-category-intelligence/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { StrategicSourcingCategoryIntelligenceClient } from "./strategic-sourcing-category-intelligence-client";

export const dynamic = "force-dynamic";

export default async function StrategicSourcingCategoryIntelligencePage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.rfq", "view") ||
      viewerHas(access.grantSet, "org.tariffs", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.reports", "view"));
  if (!canView) {
    return (
      <AccessDenied
        title="Strategic Sourcing & Category Intelligence"
        message="You need suppliers, RFQ, tariffs, orders, or reports view access to open Sprint 19."
      />
    );
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.suppliers", "edit") ||
    viewerHas(access.grantSet, "org.rfq", "edit") ||
    viewerHas(access.grantSet, "org.tariffs", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit");
  return <StrategicSourcingCategoryIntelligenceClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
