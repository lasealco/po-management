import { WmsClient } from "@/components/wms-client";
import { getViewerGrantSet, viewerHasWmsSectionMutationEdit } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WmsSetupPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHasWmsSectionMutationEdit(access.grantSet, "setup"),
  );

  return <WmsClient canEdit={canEdit} section="setup" />;
}
