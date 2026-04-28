import { AccessDenied } from "@/components/access-denied";
import { buildAssistantOperatingSnapshot } from "@/app/api/assistant/operating-system/route";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { AssistantOperatingSystemClient } from "./assistant-operating-system-client";

export const dynamic = "force-dynamic";

export default async function AssistantOperatingSystemPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant operating system"
        message="Choose an active demo user: open Settings -> Demo session (/settings/demo)."
      />
    );
  }
  const canView =
    viewerHas(access.grantSet, "org.orders", "view") ||
    viewerHas(access.grantSet, "org.controltower", "view") ||
    viewerHas(access.grantSet, "org.settings", "view");
  if (!canView) {
    return (
      <AccessDenied
        title="Assistant operating system"
        message="You need an operational or settings view grant to open the customer demo operating system."
      />
    );
  }
  const snapshot = await buildAssistantOperatingSnapshot(access.tenant.id, access.tenant.name);
  return <AssistantOperatingSystemClient initialSnapshot={snapshot} canExport={viewerHas(access.grantSet, "org.settings", "edit")} />;
}
