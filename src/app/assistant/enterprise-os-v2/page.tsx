import { GET } from "@/app/api/assistant/enterprise-os-v2/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { EnterpriseOsV2Client } from "./enterprise-os-v2-client";

export const dynamic = "force-dynamic";

export default async function EnterpriseOsV2Page() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.apihub", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.products", "view") ||
      viewerHas(access.grantSet, "org.wms", "view"));
  if (!canView) {
    return <AccessDenied title="Autonomous Enterprise OS v2" message="You need reports, settings, API Hub, control tower, orders, products, or WMS view access to open Sprint 15." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.settings", "edit") ||
    viewerHas(access.grantSet, "org.apihub", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit") ||
    viewerHas(access.grantSet, "org.products", "edit") ||
    viewerHas(access.grantSet, "org.wms", "edit");
  return <EnterpriseOsV2Client initialSnapshot={snapshot} canEdit={canEdit} />;
}
