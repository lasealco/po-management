import Link from "next/link";
import { notFound } from "next/navigation";

import { RfqCompareTable } from "@/components/rfq/rfq-compare-table";
import { buildRfqCompareRows } from "@/lib/rfq/build-compare-rows";
import { getQuoteRequestDetail } from "@/lib/rfq/quote-requests";
import { RfqRepoError } from "@/lib/rfq/rfq-repo-error";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function RfqComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  let detail: Awaited<ReturnType<typeof getQuoteRequestDetail>>;
  try {
    detail = await getQuoteRequestDetail({ tenantId: tenant.id, quoteRequestId: id });
  } catch (e) {
    if (e instanceof RfqRepoError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const rows = buildRfqCompareRows(detail);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 text-sm text-zinc-600">
        <Link href="/rfq/requests" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          RFQ requests
        </Link>
        <span className="mx-2 text-zinc-400">/</span>
        <Link href={`/rfq/requests/${id}`} className="font-medium text-[var(--arscmp-primary)] hover:underline">
          {detail.title}
        </Link>
        <span className="mx-2 text-zinc-400">/</span>
        <span className="text-zinc-900">Compare</span>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Comparison</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Quotes side by side</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {detail.originLabel} → {detail.destinationLabel} · {detail.transportMode}. Peer benchmark uses submitted
          all-in totals only, grouped by currency — it does not normalize surcharges or validity windows.
        </p>
        <div className="mt-6">
          <RfqCompareTable rows={rows} />
        </div>
      </section>
    </main>
  );
}
