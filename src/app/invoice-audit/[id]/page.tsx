import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceIntakeDetailActions } from "@/components/invoice-audit/invoice-intake-detail-actions";
import { InvoiceLinesMatchTable } from "@/components/invoice-audit/invoice-lines-match-table";
import { InvoiceMatchResultPanel } from "@/components/invoice-audit/invoice-match-result-panel";
import { InvoiceOutcomeBanner } from "@/components/invoice-audit/invoice-outcome-banner";
import { InvoiceReviewScaffold } from "@/components/invoice-audit/invoice-review-scaffold";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getInvoiceIntakeForTenant } from "@/lib/invoice-audit/invoice-intakes";
import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function InvoiceIntakeDetailPage(props: { params: Promise<{ id: string }> }) {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "edit"));
  const { id } = await props.params;

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  let intake;
  try {
    intake = await getInvoiceIntakeForTenant({ tenantId: tenant.id, intakeId: id });
  } catch (e) {
    if (e instanceof InvoiceAuditError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const lines = intake.lines.map((l) => ({
    id: l.id,
    lineNo: l.lineNo,
    rawDescription: l.rawDescription,
    currency: l.currency,
    amount: l.amount.toString(),
    unitBasis: l.unitBasis,
    equipmentType: l.equipmentType,
    chargeStructureHint: l.chargeStructureHint,
  }));

  const auditResults = intake.auditResults.map((r) => ({
    invoiceLineId: r.invoiceLineId,
    outcome: r.outcome,
    discrepancyCategories: r.discrepancyCategories,
    expectedAmount: r.expectedAmount?.toString() ?? null,
    amountVariance: r.amountVariance?.toString() ?? null,
    explanation: r.explanation,
    snapshotMatchedJson: r.snapshotMatchedJson,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <Link href="/invoice-audit" className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
          ← All intakes
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Invoice intake</h1>
            <p className="mt-2 text-sm text-zinc-600">
              {intake.vendorLabel ?? "Vendor unknown"} · {intake.externalInvoiceNo ?? "No invoice #"} ·{" "}
              {intake.currency}
            </p>
            {intake.polCode || intake.podCode ? (
              <p className="mt-1 font-mono text-xs text-zinc-500">
                POL {intake.polCode ?? "—"} → POD {intake.podCode ?? "—"}
              </p>
            ) : null}
          </div>
          {canEdit ? <InvoiceIntakeDetailActions intakeId={intake.id} canEdit={canEdit} status={intake.status} /> : null}
        </div>
      </div>

      <InvoiceOutcomeBanner
        status={intake.status}
        rollupOutcome={intake.rollupOutcome}
        parseError={intake.parseError}
        auditRunError={intake.auditRunError}
        greenLineCount={intake.greenLineCount}
        amberLineCount={intake.amberLineCount}
        redLineCount={intake.redLineCount}
        unknownLineCount={intake.unknownLineCount}
      />

      <InvoiceMatchResultPanel
        snapshotId={intake.bookingPricingSnapshot.id}
        snapshotSummary={intake.bookingPricingSnapshot.sourceSummary}
        lineCount={intake.lines.length}
        auditResultCount={intake.auditResults.length}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Linked snapshot</h2>
        <p className="mt-2 font-mono text-xs text-zinc-600">{intake.bookingPricingSnapshotId}</p>
        <p className="mt-2 text-sm text-zinc-600">
          Frozen total (reference):{" "}
          <span className="font-semibold tabular-nums text-zinc-900">
            {intake.bookingPricingSnapshot.totalEstimatedCost.toString()} {intake.bookingPricingSnapshot.currency}
          </span>
        </p>
        <Link
          href={`/pricing-snapshots/${intake.bookingPricingSnapshot.id}`}
          className="mt-3 inline-block text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
        >
          Open pricing snapshot
        </Link>
      </section>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Parsed lines &amp; match results</h2>
        <InvoiceLinesMatchTable lines={lines} auditResults={auditResults} />
      </div>

      {intake.auditResults.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">Snapshot match JSON (per line)</p>
          <p className="mt-1 text-xs text-zinc-500">
            Each row&apos;s <code className="rounded bg-white px-1">snapshotMatchedJson</code> is stored on the audit
            result for audit trail.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 font-mono text-xs">
            {intake.auditResults.map((r) => (
              <li key={r.id}>
                Line {r.line?.lineNo ?? "?"}: {JSON.stringify(r.snapshotMatchedJson)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-900">Provider escalation</p>
        <p className="mt-2">
          Not implemented in this foundation. Next step: open a Control Tower exception, email template, or supplier
          case from a RED / OVERRIDDEN line with pre-filled charge context.
        </p>
      </section>

      <InvoiceReviewScaffold
        intakeId={intake.id}
        canEdit={canEdit}
        status={intake.status}
        reviewDecision={intake.reviewDecision}
        disabledReason={
          intake.status === "FAILED"
            ? "Fix audit errors and re-run audit before recording a review decision."
            : null
        }
      />
    </main>
  );
}
