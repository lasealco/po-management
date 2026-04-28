import { AccessDenied } from "@/components/access-denied";
import { AssistantAutonomyWorkbenchClient } from "@/components/assistant/assistant-autonomy-workbench-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantAutonomyPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant autonomy workbench"
        message="Choose an active demo user: open Settings -> Demo session (/settings/demo)."
      />
    );
  }

  const hasGrant =
    viewerHas(access.grantSet, "org.orders", "view") ||
    viewerHas(access.grantSet, "org.wms", "view") ||
    viewerHas(access.grantSet, "org.controltower", "view") ||
    viewerHas(access.grantSet, "org.suppliers", "view") ||
    viewerHas(access.grantSet, "org.apihub", "view") ||
    viewerHas(access.grantSet, "org.scri", "view") ||
    viewerHas(access.grantSet, "org.invoice_audit", "view");

  if (!hasGrant) {
    return (
      <AccessDenied
        title="Assistant autonomy workbench"
        message="You need at least one operational grant for orders, WMS, Control Tower, suppliers, API Hub, risk, or invoice audit."
      />
    );
  }

  return <AssistantAutonomyWorkbenchClient />;
}
