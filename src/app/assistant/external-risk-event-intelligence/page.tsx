import { GET } from "@/app/api/assistant/external-risk-event-intelligence/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ExternalRiskEventIntelligenceClient } from "./external-risk-event-intelligence-client";

export const dynamic = "force-dynamic";

export default async function ExternalRiskEventIntelligencePage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.scri", "view") ||
      viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.settings", "view"));
  if (!canView) {
    return (
      <AccessDenied
        title="External Risk & Event Intelligence"
        message="You need SCRI, reports, orders, Control Tower, or settings view access to open Sprint 20."
      />
    );
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.scri", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit") ||
    viewerHas(access.grantSet, "org.settings", "edit");
  return <ExternalRiskEventIntelligenceClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
