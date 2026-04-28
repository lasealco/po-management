import { AccessDenied } from "@/components/access-denied";
import { buildAssistantAdminConsoleSnapshot } from "@/app/api/assistant/admin-console/route";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { AssistantAdminConsoleClient } from "./assistant-admin-console-client";

export const dynamic = "force-dynamic";

export default async function AssistantAdminPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant admin"
        message="Choose an active demo user: open Settings -> Demo session (/settings/demo)."
      />
    );
  }
  if (!viewerHas(access.grantSet, "org.settings", "view")) {
    return (
      <AccessDenied
        title="Assistant admin"
        message="You need org.settings view to inspect assistant rollout and compliance controls."
      />
    );
  }
  const snapshot = await buildAssistantAdminConsoleSnapshot(access.tenant.id);
  return <AssistantAdminConsoleClient initialSnapshot={snapshot} canEdit={viewerHas(access.grantSet, "org.settings", "edit")} />;
}
