import Link from "next/link";
import { notFound } from "next/navigation";

import { RfqClarificationsClient, type ClarificationRow } from "@/components/rfq/rfq-clarifications-client";
import { RfqCompareTable } from "@/components/rfq/rfq-compare-table";
import { RfqRecipientsClient, type RecipientRow } from "@/components/rfq/rfq-recipients-client";
import { RfqRequestStatusClient } from "@/components/rfq/rfq-request-status-client";
import { RfqResponsesPanelClient, type ResponsePanelRow } from "@/components/rfq/rfq-responses-panel-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { buildRfqCompareRows } from "@/lib/rfq/build-compare-rows";
import { getQuoteRequestDetail } from "@/lib/rfq/quote-requests";
import { RfqRepoError } from "@/lib/rfq/rfq-repo-error";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RfqRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  let detail: Awaited<ReturnType<typeof getQuoteRequestDetail>>;
  try {
    detail = await getQuoteRequestDetail({ tenantId: tenant.id, quoteRequestId: id });
  } catch (e) {
    if (e instanceof RfqRepoError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { name: "asc" },
    take: 400,
    select: { id: true, name: true, code: true },
  });

  const recipientRows: RecipientRow[] = detail.recipients.map((rec) => ({
    id: rec.id,
    displayName: rec.displayName,
    contactEmail: rec.contactEmail,
    invitationStatus: rec.invitationStatus,
    supplier: rec.supplier ? { id: rec.supplier.id, name: rec.supplier.name, code: rec.supplier.code } : null,
    responseId: rec.response?.id ?? null,
    responseStatus: rec.response?.status ?? null,
  }));

  const responsePanelRows: ResponsePanelRow[] = detail.recipients.map((rec) => ({
    recipientId: rec.id,
    displayName: rec.displayName,
    responseId: rec.response?.id ?? null,
    status: rec.response?.status ?? null,
  }));

  const clarificationRows: ClarificationRow[] = detail.clarifications.map((m) => ({
    id: m.id,
    body: m.body,
    visibility: m.visibility,
    createdAt: m.createdAt.toISOString().slice(0, 19).replace("T", " "),
    authorName: m.author?.name ?? null,
  }));

  const compareRows = buildRfqCompareRows(detail);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
        <div>
          <Link href="/rfq/requests" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            RFQ requests
          </Link>
          <span className="mx-2 text-zinc-400">/</span>
          <span className="text-zinc-900">{detail.title}</span>
        </div>
        <Link
          href={`/rfq/requests/${id}/compare`}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Full comparison view
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">RFQ</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{detail.title}</h1>
            <p className="mt-2 text-sm text-zinc-600">
              <span className="font-medium text-zinc-800">{detail.transportMode}</span> · {detail.originLabel} →{" "}
              {detail.destinationLabel}
            </p>
            {detail.equipmentSummary ? (
              <p className="mt-1 text-sm text-zinc-600">Equipment: {detail.equipmentSummary}</p>
            ) : null}
            {detail.cargoDescription ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{detail.cargoDescription}</p>
            ) : null}
            {detail.quotesDueAt ? (
              <p className="mt-2 text-xs text-zinc-500">Quotes due: {detail.quotesDueAt.toISOString().slice(0, 16).replace("T", " ")}</p>
            ) : null}
          </div>
          <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800">{detail.status}</div>
        </div>

        <div className="mt-6">
          <RfqRequestStatusClient key={detail.updatedAt.toISOString()} requestId={detail.id} initialStatus={detail.status} canEdit={canEdit} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Recipients</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Link suppliers from your directory or add a standalone contact email for future outbound automation.
        </p>
        <div className="mt-4">
          <RfqRecipientsClient requestId={detail.id} canEdit={canEdit} suppliers={suppliers} recipients={recipientRows} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Quote responses</h2>
        <p className="mt-1 text-sm text-zinc-600">Draft and submit per recipient; then run review from the dropdown.</p>
        <div className="mt-4">
          <RfqResponsesPanelClient requestId={detail.id} canEdit={canEdit} rows={responsePanelRows} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Comparison (submitted quotes)</h2>
          <Link
            href={`/rfq/requests/${id}/compare`}
            className="shrink-0 text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            Full-width compare
          </Link>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Totals, validity, included/excluded charge lists, free time summary, and a same-currency peer benchmark when at
          least two quotes publish an all-in amount.
        </p>
        <div className="mt-4">
          <RfqCompareTable rows={compareRows} quoteRequestId={id} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Clarifications</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Internal vs recipient-visible messages. Recipient-visible posts store optional metadata for a future email
          composer — nothing is sent today.
        </p>
        <div className="mt-4">
          <RfqClarificationsClient requestId={detail.id} canEdit={canEdit} messages={clarificationRows} />
        </div>
      </section>
    </main>
  );
}
