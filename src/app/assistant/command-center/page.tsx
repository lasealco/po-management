import { AccessDenied } from "@/components/access-denied";
import { AssistantCommandCenterClient } from "@/components/assistant/assistant-command-center-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantCommandCenterPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant command center"
        message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
      />
    );
  }

  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  if (!canCt && !canOrders) {
    return (
      <AccessDenied
        title="Assistant command center"
        message="You need org.controltower → view and/or org.orders → view to use the assistant command center."
      />
    );
  }

  return <AssistantCommandCenterClient />;
}
