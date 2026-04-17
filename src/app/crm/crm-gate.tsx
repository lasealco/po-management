import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

/** Server gate: CRM routes require org.crm → view (same as APIs). */
export async function CrmGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="CRM"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="CRM"
          message="You need org.crm → view permission (enable in Settings → Roles after deploy)."
        />
      </div>
    );
  }
  return <>{children}</>;
}
