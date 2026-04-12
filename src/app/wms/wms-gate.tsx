import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

/** Server gate: WMS routes require org.wms → view (same as APIs). */
export async function WmsGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Warehouse operations"
          message="Choose an active user in the header to open WMS."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.wms", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Warehouse operations"
          message="You need org.wms → view permission."
        />
      </div>
    );
  }
  return <>{children}</>;
}
