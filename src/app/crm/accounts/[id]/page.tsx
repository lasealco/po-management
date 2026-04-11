import { Suspense } from "react";

import { AccessDenied } from "@/components/access-denied";
import { CrmAccountDetail } from "@/components/crm-account-detail";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CrmAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Account"
          message="Choose an active user in the header to open this account."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Account"
          message="You need org.crm → view permission."
        />
      </div>
    );
  }

  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="px-6 py-16 text-sm text-zinc-500">Loading account…</div>
      }
    >
      <CrmAccountDetail
        accountId={id}
        actorUserId={access.user.id}
        canEditAll={viewerHas(access.grantSet, "org.crm", "edit")}
      />
    </Suspense>
  );
}
