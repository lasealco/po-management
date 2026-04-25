import { AccessDenied } from "@/components/access-denied";
import { AssistantMp1Client } from "@/components/assistant/assistant-mp1-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Sales assistant"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Sales assistant"
          message="You need org.orders → view to use the assistant workspace."
        />
      </div>
    );
  }

  const canCreate = viewerHas(access.grantSet, "org.orders", "edit");

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Sales assistant</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Split layout: conversation on the left, proposed **draft** and evidence on the right. The assistant does not
          send email or post to customers from here.
        </p>
        <div className="mt-8">
          <AssistantMp1Client canCreateSalesOrder={canCreate} />
        </div>
      </div>
    </div>
  );
}
