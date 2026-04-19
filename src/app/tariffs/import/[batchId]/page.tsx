import Link from "next/link";
import { notFound } from "next/navigation";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { TariffImportBatchIdsBar } from "@/components/tariffs/tariff-import-batch-ids-bar";
import { TariffImportParseBadge, TariffImportReviewBadge } from "@/components/tariffs/tariff-import-badges";
import { TariffImportBatchWorkflowClient } from "@/components/tariffs/tariff-import-batch-workflow-client";
import { TariffImportStagingGridClient, type StagingRowView } from "@/components/tariffs/tariff-import-staging-grid-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getTariffImportBatchForTenant } from "@/lib/tariff/import-batches";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function TariffImportBatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  let batch: Awaited<ReturnType<typeof getTariffImportBatchForTenant>>;
  try {
    batch = await getTariffImportBatchForTenant({ tenantId: tenant.id, batchId });
  } catch (e) {
    if (e instanceof TariffRepoError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const stagingRows: StagingRowView[] = batch.stagingRows.map((r) => ({
    id: r.id,
    rowType: r.rowType,
    rawPayload: r.rawPayload,
    normalizedPayload: r.normalizedPayload,
    unresolvedFlags: r.unresolvedFlags,
    approved: r.approved,
    confidenceScore: r.confidenceScore != null ? String(r.confidenceScore) : null,
  }));

  const fileHref = batch.sourceFileUrl?.startsWith("http") ? batch.sourceFileUrl : batch.sourceFileUrl ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 text-sm text-zinc-600">
        <Link href="/tariffs/import" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          Import center
        </Link>
        <span className="mx-2 text-zinc-400">/</span>
        {batch.uploadedFilename ? (
          <span className="text-zinc-900">{batch.uploadedFilename}</span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2 text-zinc-900">
            <span className="text-zinc-500">Untitled upload</span>
            <RecordIdCopy id={batch.id} copyButtonLabel="Copy batch id" />
          </span>
        )}
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Import batch</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{batch.uploadedFilename ?? "Untitled file"}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <TariffImportParseBadge status={batch.parseStatus} />
              <TariffImportReviewBadge status={batch.reviewStatus} />
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                {batch.sourceType}
              </span>
            </div>
            <TariffImportBatchIdsBar batchId={batch.id} />
          </div>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Legal entity</dt>
            <dd className="mt-1 text-zinc-800">{batch.legalEntity?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Stored file</dt>
            <dd className="mt-1 break-all text-zinc-800">
              {fileHref ? (
                <a href={fileHref} className="font-medium text-[var(--arscmp-primary)] hover:underline" target="_blank" rel="noreferrer">
                  Open file
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">MIME type</dt>
            <dd className="mt-1 font-mono text-xs text-zinc-700">{batch.sourceMimeType ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Byte size</dt>
            <dd className="mt-1 text-zinc-800">{batch.sourceByteSize ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Source metadata (JSON)</dt>
            <dd className="mt-1">
              <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
                {JSON.stringify(batch.sourceMetadata ?? {}, null, 2)}
              </pre>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">External reference</dt>
            <dd className="mt-1 text-zinc-800">{batch.sourceReference ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Updated</dt>
            <dd className="mt-1 text-xs text-zinc-600">{batch.updatedAt.toISOString()}</dd>
          </div>
        </dl>

        <div className="mt-8">
          <TariffImportBatchWorkflowClient
            key={batch.updatedAt.toISOString()}
            batchId={batch.id}
            initialParseStatus={batch.parseStatus}
            initialReviewStatus={batch.reviewStatus}
            canEdit={canEdit}
          />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Staging</p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900">Parsed rows</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {stagingRows.length} row{stagingRows.length === 1 ? "" : "s"}. Raw strings live in{" "}
          <code className="rounded bg-zinc-100 px-1">rawPayload</code> for future charge and geography alias mapping.
        </p>
        <div className="mt-6">
          <TariffImportStagingGridClient batchId={batch.id} rows={stagingRows} canEdit={canEdit} />
        </div>
      </section>
    </main>
  );
}
