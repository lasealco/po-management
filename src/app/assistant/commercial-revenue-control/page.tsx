import { GET } from "@/app/api/assistant/commercial-revenue-control/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { CommercialRevenueControlClient } from "./commercial-revenue-control-client";

export const dynamic = "force-dynamic";

export default async function CommercialRevenueControlPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.invoice_audit", "view") ||
      viewerHas(access.grantSet, "org.tariffs", "view") ||
      viewerHas(access.grantSet, "org.rfq", "view") ||
      viewerHas(access.grantSet, "org.reports", "view"));
  if (!canView) {
    return <AccessDenied title="Commercial & Revenue Control" message="You need CRM, orders, invoice audit, tariffs/RFQ, or reports view access to open Sprint 6." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.crm", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.invoice_audit", "edit") ||
    viewerHas(access.grantSet, "org.tariffs", "edit") ||
    viewerHas(access.grantSet, "org.rfq", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit");
  return <CommercialRevenueControlClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
