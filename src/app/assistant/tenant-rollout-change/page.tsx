import { GET } from "@/app/api/assistant/tenant-rollout-change/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { TenantRolloutChangeClient } from "./tenant-rollout-change-client";

export const dynamic = "force-dynamic";

export default async function TenantRolloutChangePage() {
  const access = await getViewerGrantSet();
  const canView = access?.user && (viewerHas(access.grantSet, "org.settings", "view") || viewerHas(access.grantSet, "org.reports", "view"));
  if (!canView) {
    return <AccessDenied title="Tenant Rollout & Change Enablement" message="You need settings or reports view access to open Sprint 11." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit = viewerHas(access.grantSet, "org.settings", "edit") || viewerHas(access.grantSet, "org.reports", "edit");
  return <TenantRolloutChangeClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
