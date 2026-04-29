import { GET } from "@/app/api/assistant/transport-carrier-procurement/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { TransportCarrierProcurementClient } from "./transport-carrier-procurement-client";

export const dynamic = "force-dynamic";

export default async function TransportCarrierProcurementPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.rfq", "view") ||
      viewerHas(access.grantSet, "org.tariffs", "view") ||
      viewerHas(access.grantSet, "org.invoice_audit", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.reports", "view"));
  if (!canView) {
    return (
      <AccessDenied
        title="Transportation & Carrier Procurement"
        message="You need RFQ, tariffs, invoice audit, orders, Control Tower, or reports view access to open Sprint 16."
      />
    );
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.rfq", "edit") ||
    viewerHas(access.grantSet, "org.tariffs", "edit") ||
    viewerHas(access.grantSet, "org.invoice_audit", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit");
  return <TransportCarrierProcurementClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
