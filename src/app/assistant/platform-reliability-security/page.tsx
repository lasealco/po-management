import { GET } from "@/app/api/assistant/platform-reliability-security/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { PlatformReliabilitySecurityClient } from "./platform-reliability-security-client";

export const dynamic = "force-dynamic";

export default async function PlatformReliabilitySecurityPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.apihub", "view") ||
      viewerHas(access.grantSet, "org.scri", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view"));
  if (!canView) {
    return <AccessDenied title="Platform Reliability & Security Operations" message="You need reports, settings, API Hub, SCRI, or control tower view access to open Sprint 14." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.settings", "edit") ||
    viewerHas(access.grantSet, "org.apihub", "edit") ||
    viewerHas(access.grantSet, "org.scri", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit");
  return <PlatformReliabilitySecurityClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
