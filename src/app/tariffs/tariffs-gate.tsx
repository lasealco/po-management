import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export async function TariffsGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Tariffs"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.tariffs", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Tariffs"
          message="You need org.tariffs → view permission."
        />
      </div>
    );
  }
  return <>{children}</>;
}
