import { GET } from "@/app/api/assistant/incident-nerve-center/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { IncidentNerveCenterClient } from "./incident-nerve-center-client";

export const dynamic = "force-dynamic";

export default async function IncidentNerveCenterPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.apihub", "view") ||
      viewerHas(access.grantSet, "org.invoice_audit", "view"));
  if (!canView) {
    return (
      <AccessDenied
        title="Incident Nerve Center"
        message="You need Control Tower, reports, orders, settings, API Hub, or invoice audit view access to open Sprint 17."
      />
    );
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.controltower", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.settings", "edit") ||
    viewerHas(access.grantSet, "org.apihub", "edit") ||
    viewerHas(access.grantSet, "org.invoice_audit", "edit");
  return <IncidentNerveCenterClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
