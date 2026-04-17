import { AccessDenied } from "@/components/access-denied";
import { CrmLeadDetail } from "@/components/crm-lead-detail";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CrmLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Lead"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied title="Lead" message="You need org.crm → view permission." />
      </div>
    );
  }

  const { id } = await params;

  return (
    <CrmLeadDetail
      leadId={id}
      actorUserId={access.user.id}
      canEditAll={viewerHas(access.grantSet, "org.crm", "edit")}
    />
  );
}
