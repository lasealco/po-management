import { WmsClient } from "@/components/wms-client";
import { getViewerGrantSet, viewerHasWmsSectionMutationEdit } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WmsStockPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHasWmsSectionMutationEdit(access.grantSet, "inventory"),
  );

  return <WmsClient canEdit={canEdit} section="stock" />;
}
