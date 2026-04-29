import { GET } from "@/app/api/assistant/ai-quality-release/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { AiQualityReleaseClient } from "./ai-quality-release-client";

export const dynamic = "force-dynamic";

export default async function AiQualityReleasePage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") || viewerHas(access.grantSet, "org.reports", "view") || viewerHas(access.grantSet, "org.apihub", "view"));
  if (!canView) {
    return <AccessDenied title="AI Quality & Release Governance" message="You need settings, reports, or API Hub view access to open Sprint 10." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit = viewerHas(access.grantSet, "org.settings", "edit") || viewerHas(access.grantSet, "org.reports", "edit") || viewerHas(access.grantSet, "org.apihub", "edit");
  return <AiQualityReleaseClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
