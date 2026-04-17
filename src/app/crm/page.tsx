import { AccessDenied } from "@/components/access-denied";
import { CrmClient } from "@/components/crm-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
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

  return (
    <CrmClient
      canEdit={viewerHas(access.grantSet, "org.crm", "edit")}
      actorUserId={access.user.id}
    />
  );
}
