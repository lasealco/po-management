import { WmsClient } from "@/components/wms-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WmsSetupPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.wms", "edit"),
  );

  return <WmsClient canEdit={canEdit} section="setup" />;
}
