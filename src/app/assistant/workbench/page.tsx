import { AccessDenied } from "@/components/access-denied";
import { AssistantCopilotWorkbenchClient } from "@/components/assistant/assistant-copilot-workbench-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantWorkbenchPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant workbench"
        message="Choose an active demo user: open Settings -> Demo session (/settings/demo)."
      />
    );
  }

  const hasAssistantGrant =
    viewerHas(access.grantSet, "org.orders", "view") ||
    viewerHas(access.grantSet, "org.products", "view") ||
    viewerHas(access.grantSet, "org.suppliers", "view") ||
    viewerHas(access.grantSet, "org.wms", "view") ||
    viewerHas(access.grantSet, "org.controltower", "view");

  if (!hasAssistantGrant) {
    return (
      <AccessDenied
        title="Assistant workbench"
        message="You need at least one operational grant, such as orders, products, suppliers, WMS, or Control Tower."
      />
    );
  }

  return <AssistantCopilotWorkbenchClient />;
}
