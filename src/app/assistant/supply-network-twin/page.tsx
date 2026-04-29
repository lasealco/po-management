import { GET } from "@/app/api/assistant/supply-network-twin/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { SupplyNetworkTwinClient } from "./supply-network-twin-client";

export const dynamic = "force-dynamic";

export default async function SupplyNetworkTwinPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.wms", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.crm", "view"));
  if (!canView) {
    return <AccessDenied title="Supply Network Twin" message="You need reports, Control Tower, WMS, orders, suppliers, or CRM view access to open Sprint 7." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit") ||
    viewerHas(access.grantSet, "org.wms", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.suppliers", "edit") ||
    viewerHas(access.grantSet, "org.crm", "edit");
  return <SupplyNetworkTwinClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
