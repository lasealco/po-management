import { WmsBillingClient } from "@/components/wms-billing-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WmsBillingPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.wms", "edit"),
  );

  return <WmsBillingClient canEdit={canEdit} />;
}
