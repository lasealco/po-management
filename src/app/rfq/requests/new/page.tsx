import Link from "next/link";

import { RfqNewRequestFormClient } from "@/components/rfq/rfq-new-request-form-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function RfqNewRequestPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.rfq", "edit"));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 text-sm text-zinc-600">
        <Link href="/rfq/requests" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          RFQ requests
        </Link>
        <span className="mx-2 text-zinc-400">/</span>
        <span className="text-zinc-900">New</span>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow · Step 1</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">New ocean RFQ</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Defaults to <span className="font-medium">OCEAN</span> mode. After creation, add recipients and enter quotes
          per forwarder or NVO.
        </p>
        {!canEdit ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            View-only. Ask for <span className="font-medium">org.rfq → edit</span> to create RFQs.
          </p>
        ) : null}
        <div className="mt-8">
          <RfqNewRequestFormClient canEdit={canEdit} />
        </div>
      </section>
    </main>
  );
}
