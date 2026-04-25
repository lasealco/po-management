import { AccessDenied } from "@/components/access-denied";
import { AssistantInboxClient } from "@/components/assistant/assistant-inbox-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
export const dynamic = "force-dynamic";

export default async function AssistantInboxPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Inbox"
        message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
      />
    );
  }
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  if (!canCt && !canOrders) {
    return <AccessDenied title="Inbox" message="Not allowed for this user." />;
  }

  const canAckAlert = canCt && viewerHas(access.grantSet, "org.controltower", "edit");
  const canCreate = canOrders && viewerHas(access.grantSet, "org.orders", "edit");

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Attention inbox</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Open Control Tower <strong>alerts</strong> and <strong>exceptions</strong> (if you have the Tower) plus
        <strong> draft sales orders</strong> (if you have orders). Acknowledge alerts here or open a record to work it.
      </p>
      <div className="mt-6">
        <AssistantInboxClient canAckAlert={canAckAlert} canCreateSalesOrder={canCreate} />
      </div>
    </div>
  );
}
