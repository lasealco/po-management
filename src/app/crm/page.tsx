import { AccessDenied } from "@/components/access-denied";
import { CrmClient } from "@/components/crm-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="CRM"
          message="Choose an active user in the header to open CRM."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="CRM"
          message="You need org.crm → view permission (enable in Settings → Roles after deploy)."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CrmClient canEdit={viewerHas(access.grantSet, "org.crm", "edit")} />
    </div>
  );
}
