import { AccessDenied } from "@/components/access-denied";
import { CrmQuoteDetail } from "@/components/crm-quote-detail";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CrmQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied title="Quote" message="Choose an active user in the header." />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied title="Quote" message="You need org.crm → view permission." />
      </div>
    );
  }

  const { id } = await params;

  return (
    <CrmQuoteDetail
      quoteId={id}
      actorUserId={access.user.id}
      canEditAll={viewerHas(access.grantSet, "org.crm", "edit")}
    />
  );
}
