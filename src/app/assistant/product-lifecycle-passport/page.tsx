import { GET } from "@/app/api/assistant/product-lifecycle-passport/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ProductLifecyclePassportClient } from "./product-lifecycle-passport-client";

export const dynamic = "force-dynamic";

export default async function ProductLifecyclePassportPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.products", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.wms", "view") ||
      viewerHas(access.grantSet, "org.orders", "view"));
  if (!canView) {
    return <AccessDenied title="Product Lifecycle & Compliance Passport" message="You need products, suppliers, reports, WMS, or orders view access to open Sprint 13." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.products", "edit") ||
    viewerHas(access.grantSet, "org.suppliers", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.wms", "edit") ||
    viewerHas(access.grantSet, "org.orders", "edit");
  return <ProductLifecyclePassportClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
