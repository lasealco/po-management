import { AccessDenied } from "@/components/access-denied";
import { AssistantExecutionWorkbenchClient } from "@/components/assistant/assistant-execution-workbench-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantExecutionPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant execution workbench"
        message="Choose an active demo user: open Settings -> Demo session (/settings/demo)."
      />
    );
  }

  const hasGrant =
    viewerHas(access.grantSet, "org.orders", "view") ||
    viewerHas(access.grantSet, "org.wms", "view") ||
    viewerHas(access.grantSet, "org.controltower", "view") ||
    viewerHas(access.grantSet, "org.tariffs", "view") ||
    viewerHas(access.grantSet, "org.rfq", "view") ||
    viewerHas(access.grantSet, "org.invoice_audit", "view");

  if (!hasGrant) {
    return (
      <AccessDenied
        title="Assistant execution workbench"
        message="You need at least one operational grant for orders, WMS, Control Tower, tariffs, RFQ, or invoice audit."
      />
    );
  }

  return <AssistantExecutionWorkbenchClient />;
}
