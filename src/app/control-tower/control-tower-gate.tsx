import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export async function ControlTowerGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Control Tower"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.controltower", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Control Tower"
          message="You need org.controltower → view permission."
        />
      </div>
    );
  }
  return <>{children}</>;
}
