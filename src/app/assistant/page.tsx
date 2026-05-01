import { Suspense } from "react";

import { AccessDenied } from "@/components/access-denied";
import { AssistantSalesOperationsCockpit } from "@/components/assistant/assistant-sales-operations-cockpit";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Sales & Operations Assistant"
        message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
      />
    );
  }
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  if (!canOrders) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Orders access required</h2>
        <p className="mt-2 text-sm text-zinc-600">
          This cockpit needs <code className="rounded bg-zinc-100 px-1">org.orders → view</code> for sales drafts and
          inventory answers. Use the sidebar to open Inbox, Command center, or other workspaces if your grants allow.
        </p>
      </div>
    );
  }

  const canCreate = viewerHas(access.grantSet, "org.orders", "edit");

  return (
    <Suspense fallback={<div className="min-h-[28rem] animate-pulse rounded-2xl bg-zinc-100" aria-hidden />}>
      <AssistantSalesOperationsCockpit canCreateSalesOrder={canCreate} />
    </Suspense>
  );
}
