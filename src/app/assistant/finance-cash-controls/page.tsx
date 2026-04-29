import { GET } from "@/app/api/assistant/finance-cash-controls/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { FinanceCashControlsClient } from "./finance-cash-controls-client";

export const dynamic = "force-dynamic";

export default async function FinanceCashControlsPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.invoice_audit", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.wms", "view"));
  if (!canView) {
    return <AccessDenied title="Finance, Cash & Accounting Controls" message="You need reports, orders, CRM, invoice audit, control tower, or WMS view access to open Sprint 12." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.crm", "edit") ||
    viewerHas(access.grantSet, "org.invoice_audit", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit") ||
    viewerHas(access.grantSet, "org.wms", "edit");
  return <FinanceCashControlsClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
