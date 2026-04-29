import { GET } from "@/app/api/assistant/customer-success-account-intelligence/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { CustomerSuccessAccountIntelligenceClient } from "./customer-success-account-intelligence-client";

export const dynamic = "force-dynamic";

export default async function CustomerSuccessAccountIntelligencePage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.invoice_audit", "view"));
  if (!canView) {
    return (
      <AccessDenied
        title="Customer Success & Account Intelligence"
        message="You need CRM, orders, reports, Control Tower, or invoice audit view access to open Sprint 18."
      />
    );
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.crm", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit") ||
    viewerHas(access.grantSet, "org.invoice_audit", "edit");
  return <CustomerSuccessAccountIntelligenceClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
