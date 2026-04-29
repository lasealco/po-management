import { WmsBillingClient } from "@/components/wms-billing-client";
import { getViewerGrantSet, viewerHasWmsSectionMutationEdit } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WmsBillingPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHasWmsSectionMutationEdit(access.grantSet, "operations"),
  );

  return <WmsBillingClient canEdit={canEdit} />;
}
