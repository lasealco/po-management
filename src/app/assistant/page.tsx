import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { AssistantMp1Client } from "@/components/assistant/assistant-mp1-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Sales assistant"
        message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
      />
    );
  }
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  if (!canOrders) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Sales chat needs orders access</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Natural-language sales order drafts require <code className="rounded bg-zinc-100 px-1">org.orders → view</code>.
          You can still use the <strong>Inbox</strong> tab for Control Tower alerts and exceptions (if you have the
          Tower).
        </p>
        <Link
          href="/assistant/inbox"
          className="mt-4 inline-flex rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Open Inbox
        </Link>
      </div>
    );
  }

  const canCreate = viewerHas(access.grantSet, "org.orders", "edit");

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Sales chat</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Natural language to draft sales orders. The assistant does not send email. Use the <strong>Inbox</strong> tab for
        open Tower work and other drafts.
      </p>
      <div className="mt-6">
        <AssistantMp1Client canCreateSalesOrder={canCreate} />
      </div>
    </div>
  );
}
