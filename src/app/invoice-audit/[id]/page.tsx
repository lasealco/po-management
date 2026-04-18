import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceIntakeDetailActions } from "@/components/invoice-audit/invoice-intake-detail-actions";
import { InvoiceLinesMatchTable } from "@/components/invoice-audit/invoice-lines-match-table";
import { InvoiceMatchResultPanel } from "@/components/invoice-audit/invoice-match-result-panel";
import { InvoiceOutcomeBanner } from "@/components/invoice-audit/invoice-outcome-banner";
import { InvoiceAccountingHandoffScaffold } from "@/components/invoice-audit/invoice-accounting-handoff-scaffold";
import { InvoiceIntakeOpsNotesScaffold } from "@/components/invoice-audit/invoice-intake-ops-notes-scaffold";
import { InvoiceReviewScaffold } from "@/components/invoice-audit/invoice-review-scaffold";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getInvoiceIntakeForTenant } from "@/lib/invoice-audit/invoice-intakes";
import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import { DISCREPANCY_CATEGORY, formatDiscrepancyCategoryLabel } from "@/lib/invoice-audit/discrepancy-categories";
import { formatSnapshotMatchLabel } from "@/lib/invoice-audit/snapshot-match-label";
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

  const appliedTolerance = intake.auditResults[0]?.toleranceRule ?? null;

  const discrepancyRollup = (() => {
    const m = new Map<string, number>();
    for (const r of intake.auditResults) {
      const cats = r.discrepancyCategories;
      if (!Array.isArray(cats)) continue;
      for (const c of cats) {
        if (typeof c === "string" && c.trim()) m.set(c, (m.get(c) ?? 0) + 1);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();

  const rollupAttentionKeys = new Set<string>([
    DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE,
    DISCREPANCY_CATEGORY.ALL_IN_BASKET_MATCH,
  ]);
  const discrepancyRollupAttention = discrepancyRollup.filter(([k]) => !rollupAttentionKeys.has(k));

  const suggestCloseoutDocumentation =
    intake.status === "AUDITED" &&
    (intake.rollupOutcome === "FAIL" ||
      intake.rollupOutcome === "WARN" ||
      intake.unknownLineCount > 0 ||
      intake.redLineCount > 0);

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
        suggestCloseoutDocumentation={suggestCloseoutDocumentation}
      />

      <InvoiceMatchResultPanel
        snapshotId={intake.bookingPricingSnapshot.id}
        snapshotSummary={intake.bookingPricingSnapshot.sourceSummary}
        lineCount={intake.lines.length}
        auditResultCount={intake.auditResults.length}
        polCode={intake.polCode}
        podCode={intake.podCode}
      />

      {intake.status === "AUDITED" && intake.auditResults.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Discrepancy categories (rollup)</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Counts how often each category appears across line audit rows (Phase 06 auditability). Expand per-line
            JSON below for the full payload. Pure “within tolerance” matches are summarized separately so attention
            items stand out.
          </p>
          {discrepancyRollupAttention.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {discrepancyRollupAttention.map(([key, count]) => (
                <li
                  key={key}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-950"
                  title={key}
                >
                  {formatDiscrepancyCategoryLabel(key)} · {count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-emerald-900">
              No attention categories beyond successful matches (see per-line JSON for every stored category key).
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Audit run</h2>
        {intake.lastAuditAt ? (
          <p className="mt-2 text-sm text-zinc-600">
            Last completed{" "}
            <span className="font-medium tabular-nums text-zinc-800">
              {intake.lastAuditAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
            .
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">No audit has been run yet for this intake.</p>
        )}
        {intake.auditResults.length > 0 ? (
          <p className="mt-2 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">Tolerance</span>
            {appliedTolerance ? (
              <>
                : {appliedTolerance.name}
                {appliedTolerance.currencyScope ? (
                  <span className="font-mono text-xs text-zinc-500"> · {appliedTolerance.currencyScope}</span>
                ) : (
                  <span className="text-xs text-zinc-500"> · any currency</span>
                )}
                {appliedTolerance.amountAbsTolerance != null ? (
                  <span className="tabular-nums text-zinc-700">
                    {" "}
                    · abs Δ {appliedTolerance.amountAbsTolerance.toString()}
                  </span>
                ) : null}
                {appliedTolerance.percentTolerance != null ? (
                  <span className="tabular-nums text-zinc-700">
                    {" "}
                    · {(Number(appliedTolerance.percentTolerance) * 100).toFixed(2)}%
                  </span>
                ) : null}
                {!appliedTolerance.active ? (
                  <span className="ml-1 text-xs font-medium text-amber-800">(rule inactive at read time)</span>
                ) : null}
              </>
            ) : (
              <>
                : <span className="font-medium text-zinc-800">Built-in defaults</span>
                <span className="text-xs text-zinc-500"> (no tenant rule matched this intake currency.)</span>
              </>
            )}
            {canEdit ? (
              <>
                {" "}
                <Link
                  href="/invoice-audit/tolerance-rules"
                  className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  Manage rules
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        {intake.auditResults.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Tolerance bands influence per-line GREEN vs AMBER during audit only. They do not set finance{" "}
            <span className="font-medium text-zinc-700">Approve/Override</span> or accounting handoff — those are Steps
            2–3 below.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Linked snapshot</h2>
        <p className="mt-2 font-mono text-xs text-zinc-600">{intake.bookingPricingSnapshotId}</p>
        <p className="mt-2 text-sm text-zinc-600">
          Frozen total (reference):{" "}
          <span className="font-semibold tabular-nums text-zinc-900">
            {intake.bookingPricingSnapshot.totalEstimatedCost.toString()} {intake.bookingPricingSnapshot.currency}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            href={`/pricing-snapshots/${intake.bookingPricingSnapshot.id}`}
            className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            Open pricing snapshot
          </Link>
          {canEdit ? (
            <Link
              href={`/invoice-audit/new?snapshotId=${encodeURIComponent(intake.bookingPricingSnapshotId)}`}
              className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
            >
              New intake with same snapshot
            </Link>
          ) : null}
        </div>
      </section>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Parsed lines &amp; match results</h2>
        <InvoiceLinesMatchTable lines={lines} auditResults={auditResults} />
      </div>

      {intake.auditResults.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">Stored match payload (per line)</p>
          <p className="mt-1 text-xs text-zinc-500">
            Summary matches the table column; expand JSON for the full audit trail stored on each result.
          </p>
          <ul className="mt-3 space-y-2">
            {intake.auditResults.map((r) => (
              <li key={r.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="text-sm text-zinc-800">
                  <span className="font-semibold">Line {r.line?.lineNo ?? "?"}</span>
                  <span className="mx-2 text-zinc-400">·</span>
                  <span>{formatSnapshotMatchLabel(r.snapshotMatchedJson)}</span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-[var(--arscmp-primary)]">
                    snapshotMatchedJson
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-100">
                    {JSON.stringify(r.snapshotMatchedJson, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
        <p className="font-semibold text-zinc-900">Tolerance rules</p>
        <p className="mt-2">
          Amount bands apply when <span className="font-medium text-zinc-800">Run audit</span> compares invoice lines to
          the snapshot (not when you save finance review or accounting handoff).{" "}
          <Link href="/invoice-audit/tolerance-rules" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            View or edit tolerance rules
          </Link>
          .
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h2 className="mt-1 text-sm font-semibold text-zinc-900">Closeout: ops → finance → accounting</h2>
        <p className="mt-2 text-sm text-zinc-600">
          After audit completes, work top to bottom. Intake <span className="font-medium text-zinc-800">status</span>{" "}
          and <span className="font-medium text-zinc-800">rollup</span> are operational labels for this workspace —
          they are not sent to carriers or ERP from this screen.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>
            <span className="font-medium text-zinc-800">Step 1</span> — Ops notes for tickets, contacts, dispute
            context.
          </li>
          <li>
            <span className="font-medium text-zinc-800">Step 2</span> — Finance review: <span className="font-medium">Approve</span>{" "}
            or <span className="font-medium">Override</span> with an audit trail (not the same as tolerance bands above).
          </li>
          <li>
            <span className="font-medium text-zinc-800">Step 3</span> — Accounting handoff after Step 2, when posting
            may proceed.
          </li>
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">Tolerance rules</span> (tenant configuration + Audit run summary)
          only affect line classification when audit runs — they are not Step 2 or Step 3.
        </p>
      </section>

      <InvoiceIntakeOpsNotesScaffold
        intakeId={intake.id}
        canEdit={canEdit}
        initialNotes={intake.rawSourceNotes}
      />

      <section id="invoice-audit-escalation" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Escalation &amp; carrier comms (MVP)</h2>
        <p className="mt-2 text-sm text-zinc-600">
          This module does not send email or EDI to carriers. Use your normal carrier or forwarder workflow outside the
          app, then leave an audit trail here.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600">
          <li>
            <span className="font-medium text-zinc-800">Status / rollup</span> are placeholders for triage — not
            integrated carrier or accounting feeds.
          </li>
          <li>
            Put ticket ids and who was contacted in{" "}
            <a href="#invoice-audit-ops-notes" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              Step 1 — Ops &amp; escalation notes
            </a>
            .
          </li>
          <li>
            <span className="font-medium text-zinc-800">Finance review</span> is Approve or Override (commercial
            acceptance); <span className="font-medium text-zinc-800">Accounting handoff</span> is a separate “ready for
            posting systems” flag after finance has signed off.
          </li>
          <li>Per-line outcomes and stored JSON remain the technical audit trail for matched pricing.</li>
        </ul>
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

      <InvoiceAccountingHandoffScaffold
        intakeId={intake.id}
        canEdit={canEdit}
        status={intake.status}
        reviewDecision={intake.reviewDecision}
        approvedForAccounting={intake.approvedForAccounting}
        accountingApprovedAt={intake.accountingApprovedAt?.toISOString() ?? null}
        accountingApprovalNote={intake.accountingApprovalNote}
        disabledReason={
          intake.status === "FAILED"
            ? "Resolve audit errors before recording accounting handoff."
            : null
        }
      />
    </main>
  );
}
