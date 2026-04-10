import { AccessDenied } from "@/components/access-denied";
import { WmsClient } from "@/components/wms-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WmsPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Warehouse operations"
          message="Choose an active user in the header to open WMS."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.wms", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Warehouse operations"
          message="You need org.wms -> view permission."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <WmsClient canEdit={viewerHas(access.grantSet, "org.wms", "edit")} />
    </div>
  );
}
