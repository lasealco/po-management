import Link from "next/link";
import { notFound } from "next/navigation";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { RfqResponseEditClient, type LineDraft } from "@/components/rfq/rfq-response-edit-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getQuoteResponseForTenant } from "@/lib/rfq/quote-responses";
import { RfqRepoError } from "@/lib/rfq/rfq-repo-error";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function RfqResponseEditPage({
  params,
}: {
  params: Promise<{ id: string; responseId: string }>;
}) {
  const { id: requestId, responseId } = await params;
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.rfq", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  let response: Awaited<ReturnType<typeof getQuoteResponseForTenant>>;
  try {
    response = await getQuoteResponseForTenant({ tenantId: tenant.id, responseId });
  } catch (e) {
    if (e instanceof RfqRepoError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  if (response.quoteRequestId !== requestId) {
    notFound();
  }

  const lines: LineDraft[] = response.lines.map((l, idx) => ({
    lineType: l.lineType,
    label: l.label,
    amount: l.amount != null ? String(l.amount) : "",
    currency: l.currency,
    unitBasis: l.unitBasis ?? "",
    isIncluded: l.isIncluded,
    notes: l.notes ?? "",
    sortOrder: l.sortOrder ?? idx,
  }));

  const initial = {
    status: response.status,
    currency: response.currency,
    totalAllInAmount: response.totalAllInAmount != null ? String(response.totalAllInAmount) : "",
    validityFrom: response.validityFrom ? response.validityFrom.toISOString().slice(0, 10) : "",
    validityTo: response.validityTo ? response.validityTo.toISOString().slice(0, 10) : "",
    includedJson: JSON.stringify(response.includedChargesJson ?? [], null, 2),
    excludedJson: JSON.stringify(response.excludedChargesJson ?? [], null, 2),
    freeTimeJson: JSON.stringify(response.freeTimeSummaryJson ?? {}, null, 2),
    lines: lines.length > 0 ? lines : [
      {
        lineType: "MAIN_FREIGHT",
        label: "Ocean freight (all-in basis)",
        amount: "",
        currency: response.currency,
        unitBasis: "per 40HC",
        isIncluded: true,
        notes: "",
        sortOrder: 0,
      },
    ],
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 text-sm text-zinc-600">
        <Link href="/rfq/requests" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          RFQ requests
        </Link>
        <span className="mx-2 text-zinc-400">/</span>
        <Link href={`/rfq/requests/${requestId}`} className="font-medium text-[var(--arscmp-primary)] hover:underline">
          {response.quoteRequest.title}
        </Link>
        <span className="mx-2 text-zinc-400">/</span>
        <span className="text-zinc-900">Quote · {response.recipient.displayName}</span>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Quote response</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{response.recipient.displayName}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter totals, validity, charge inclusion lists (JSON), free time object, and optional line breakdown.
        </p>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quote request id</span>
            <RecordIdCopy id={requestId} copyButtonLabel="Copy request id" />
          </div>
          <div className="hidden h-4 w-px bg-zinc-200 sm:block" aria-hidden />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quote response id</span>
            <RecordIdCopy id={responseId} copyButtonLabel="Copy response id" />
          </div>
        </div>
        <div className="mt-8">
          <RfqResponseEditClient
            key={response.updatedAt.toISOString()}
            requestId={requestId}
            responseId={responseId}
            canEdit={canEdit}
            initial={initial}
          />
        </div>
      </section>
    </main>
  );
}
