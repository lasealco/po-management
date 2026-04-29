import { GET } from "@/app/api/assistant/executive-operating-system/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ExecutiveOperatingSystemClient } from "./executive-operating-system-client";

export const dynamic = "force-dynamic";

export default async function ExecutiveOperatingSystemPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.reports", "view") ||
      viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view"));
  if (!canView) {
    return <AccessDenied title="Executive Operating System" message="You need reports, settings, CRM, or Control Tower view access to open Sprint 4." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.reports", "edit") ||
    viewerHas(access.grantSet, "org.settings", "edit") ||
    viewerHas(access.grantSet, "org.crm", "edit") ||
    viewerHas(access.grantSet, "org.controltower", "edit");
  return <ExecutiveOperatingSystemClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
