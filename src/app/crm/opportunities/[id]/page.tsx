import { AccessDenied } from "@/components/access-denied";
import { CrmOpportunityDetail } from "@/components/crm-opportunity-detail";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CrmOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Opportunity"
          message="Choose an active user in the header to open this opportunity."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Opportunity"
          message="You need org.crm → view permission."
        />
      </div>
    );
  }

  const { id } = await params;

  return (
    <CrmOpportunityDetail
      opportunityId={id}
      actorUserId={access.user.id}
      canEditAll={viewerHas(access.grantSet, "org.crm", "edit")}
    />
  );
}
