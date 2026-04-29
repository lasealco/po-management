import { GET } from "@/app/api/assistant/privacy-security-trust/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { PrivacySecurityTrustClient } from "./privacy-security-trust-client";

export const dynamic = "force-dynamic";

export default async function PrivacySecurityTrustPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.apihub", "view") ||
      viewerHas(access.grantSet, "org.scri", "view"));
  if (!canView) {
    return <AccessDenied title="Privacy, Security & Trust" message="You need settings, reports, API Hub, or SCRI view access to open Sprint 3." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.settings", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.apihub", "edit") ||
    viewerHas(access.grantSet, "org.scri", "edit");
  return <PrivacySecurityTrustClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
