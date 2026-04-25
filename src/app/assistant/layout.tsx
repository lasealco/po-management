import { AccessDenied } from "@/components/access-denied";
import { AssistantSubnav } from "@/components/assistant/assistant-subnav";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Assistant"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  if (!canCt && !canOrders) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Assistant"
          message="You need org.controltower → view and/or org.orders → view to use the assistant workspace (chat or inbox)."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Assistant</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          <strong>Chat</strong> turns messages into sales-order drafts. <strong>Inbox</strong> pulls open Control Tower
          work and draft sales orders in one list so you can clear items without opening five modules.
        </p>
        <AssistantSubnav />
        {children}
      </div>
    </div>
  );
}
