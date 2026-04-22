import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export async function ApihubGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="API hub"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.apihub", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="API hub"
          message="Your role does not include Integration hub access (org.apihub → view). Ask an admin to add it in Settings → Roles, or switch to a Superuser demo account."
        />
      </div>
    );
  }
  return <>{children}</>;
}
