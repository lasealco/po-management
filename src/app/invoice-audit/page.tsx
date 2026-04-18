import Link from "next/link";

import { DemoSeedCopyBlock } from "@/components/invoice-audit/demo-seed-copy-block";
import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listInvoiceIntakesForTenant } from "@/lib/invoice-audit/invoice-intakes";
import { formatPricingSnapshotSourceType } from "@/lib/invoice-audit/pricing-snapshot-source-nav";
import { getPhase06WorkflowHint } from "@/lib/invoice-audit/phase06-workflow-hint";
import { getDemoTenant } from "@/lib/demo-tenant";
import { subNavActiveClass } from "@/lib/subnav-active-class";

export const dynamic = "force-dynamic";

type InvoiceQueue = "audit" | "finance" | "handoff";

function parseQueueParam(raw: string | string[] | undefined): InvoiceQueue | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "audit" || v === "finance" || v === "handoff") return v;
  return null;
}

function rowMatchesQueue(
  row: {
    status: string;
    reviewDecision: string;
    approvedForAccounting: boolean;
  },
  queue: InvoiceQueue,
): boolean {
  if (queue === "audit") return row.status === "PARSED" || row.status === "FAILED";
  if (queue === "finance") return row.status === "AUDITED" && row.reviewDecision === "NONE";
  return row.status === "AUDITED" && row.reviewDecision !== "NONE" && !row.approvedForAccounting;
}

function queueDescription(q: InvoiceQueue): string {
  if (q === "audit") return "PARSED or FAILED — run or fix audit from each intake.";
  if (q === "finance") return "AUDITED with no finance decision yet — Approve or Override on each intake.";
  return "Finance recorded, accounting handoff not marked — Step 3 on each intake.";
}

function rollupBadge(outcome: string) {
  if (outcome === "PASS") return "bg-emerald-100 text-emerald-900";
  if (outcome === "WARN") return "bg-amber-100 text-amber-950";
  if (outcome === "FAIL") return "bg-red-100 text-red-900";
  if (outcome === "PENDING") return "bg-sky-100 text-sky-950";
  return "bg-zinc-100 text-zinc-700";
}

function reviewBadge(decision: string) {
  if (decision === "APPROVED") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
  if (decision === "OVERRIDDEN") return "bg-amber-50 text-amber-950 ring-1 ring-amber-200";
  return "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200";
}

function accountingBadge(ready: boolean) {
  if (ready) return "bg-sky-50 text-sky-900 ring-1 ring-sky-200";
  return "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200";
}

function reviewCellLabel(decision: string) {
  if (decision === "APPROVED") return "Approve";
  if (decision === "OVERRIDDEN") return "Override";
  return "—";
}

export default async function InvoiceAuditListPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "edit"));
  const sp = props.searchParams ? await props.searchParams : {};
  const queue = parseQueueParam(sp.queue);

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const intakes = await listInvoiceIntakesForTenant({ tenantId: tenant.id, take: 200 });
  const rowsToShow = queue ? intakes.filter((r) => rowMatchesQueue(r, queue)) : intakes;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Invoice intakes</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Parse carrier invoices into lines, then audit each line against a frozen{" "}
              <Link href="/pricing-snapshots" className="font-medium text-[var(--arscmp-primary)] hover:underline">
                pricing snapshot
              </Link>
              . Failures and discrepancies are always surfaced with a message or category — never dropped silently.
              After audit, open an intake for closeout: ops notes, finance review, then accounting handoff. If
              actions fail with a database or migration message, check{" "}
              <Link href="/invoice-audit/readiness" className="font-medium text-[var(--arscmp-primary)] hover:underline">
                DB readiness
              </Link>
              .
            </p>
          </div>
          {canEdit ? (
            <Link
              href="/invoice-audit/new"
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              New intake
            </Link>
          ) : null}
        </div>

        <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50/90 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">Demo &amp; admin shortcuts</p>
          <p className="mt-1 text-xs text-sky-950/90">
            Re-seed a PARSED intake (and a minimal snapshot if the library is empty) for <span className="font-medium">demo-company</span>{" "}
            before walkthroughs. Requires <span className="font-mono text-[11px]">DATABASE_URL</span> in{" "}
            <span className="font-mono text-[11px]">.env.local</span>.
          </p>
          <DemoSeedCopyBlock className="mt-2" />
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-sky-950">
            <Link href="/invoice-audit/tolerance-rules" className="text-[var(--arscmp-primary)] hover:underline">
              Tolerance rules
            </Link>
            <Link href="/invoice-audit/readiness?refresh=1" className="text-[var(--arscmp-primary)] hover:underline">
              DB readiness (no cache)
            </Link>
            <Link href="/pricing-snapshots" className="text-[var(--arscmp-primary)] hover:underline">
              Pricing snapshots
            </Link>
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Queues</span>
          <Link
            href="/invoice-audit"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              queue == null ? subNavActiveClass : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            All
          </Link>
          <Link
            href="/invoice-audit?queue=audit"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              queue === "audit" ? subNavActiveClass : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Run audit
          </Link>
          <Link
            href="/invoice-audit?queue=finance"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              queue === "finance" ? subNavActiveClass : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Finance review
          </Link>
          <Link
            href="/invoice-audit?queue=handoff"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              queue === "handoff" ? subNavActiveClass : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Accounting handoff
          </Link>
        </div>
        {queue ? (
          <p className="mt-2 text-xs text-zinc-600">
            <span className="font-medium text-zinc-800">Filtered:</span> {queueDescription(queue)}{" "}
            <Link href="/invoice-audit" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              Clear filter
            </Link>
          </p>
        ) : null}

        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Received</th>
                <th className="py-2 pr-4">Intake id</th>
                <th className="py-2 pr-4">Vendor / ref</th>
                <th className="py-2 pr-4" title="Prioritized Phase 06 action with deep link when applicable">
                  Next
                </th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4" title="Worst line outcome after the last audit run">
                  Rollup
                </th>
                <th className="py-2 pr-4" title="Step 2 finance sign-off (separate from tolerance bands)">
                  Review
                </th>
                <th className="py-2 pr-4" title="Step 3 accounting handoff flag">
                  Acct
                </th>
                <th className="py-2 pr-4">Lines</th>
                <th className="py-2 pr-4">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {intakes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-zinc-500">
                    <p>No intakes yet.</p>
                    <p className="mt-2 text-xs text-zinc-600">
                      Create one from <span className="font-medium">New intake</span> (pick a frozen pricing
                      snapshot), or seed a PARSED demo intake — the demo script creates a minimal snapshot for{" "}
                      <span className="font-medium">demo-company</span> if none exists yet:{" "}
                      <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">
                        USE_DOTENV_LOCAL=1 npm run db:seed:invoice-audit-demo
                      </code>
                      .
                    </p>
                  </td>
                </tr>
              ) : rowsToShow.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-sm text-zinc-600">
                    No intakes in this queue.
                    <div className="mt-2">
                      <Link href="/invoice-audit" className="font-medium text-[var(--arscmp-primary)] hover:underline">
                        Show all intakes
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                rowsToShow.map((row) => {
                  const lineTotal =
                    row.greenLineCount + row.amberLineCount + row.redLineCount + row.unknownLineCount;
                  const parsedLines = row._count.lines;
                  const nextHint = getPhase06WorkflowHint({
                    status: row.status,
                    rollupOutcome: row.rollupOutcome,
                    reviewDecision: row.reviewDecision,
                    approvedForAccounting: row.approvedForAccounting,
                    parseError: row.parseError,
                    auditRunError: row.auditRunError,
                    unknownLineCount: row.unknownLineCount,
                    redLineCount: row.redLineCount,
                  });
                  return (
                    <tr key={row.id} className="border-b border-zinc-100">
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.receivedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <RecordIdCopy id={row.id} />
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/invoice-audit/${row.id}`}
                          className="font-medium text-[var(--arscmp-primary)] hover:underline"
                        >
                          {row.vendorLabel ?? row.externalInvoiceNo ?? row.id.slice(0, 8)}
                        </Link>
                        {row.externalInvoiceNo && row.vendorLabel ? (
                          <div className="text-xs text-zinc-500">{row.externalInvoiceNo}</div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        {nextHint ? (
                          <Link
                            href={`/invoice-audit/${row.id}${nextHint.hash}`}
                            className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
                          >
                            {nextHint.label}
                          </Link>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800">
                          {row.status}
                        </span>
                        {row.auditRunError ? (
                          <div className="mt-1 text-xs text-red-600">Has audit error</div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${rollupBadge(row.rollupOutcome)}`}>
                          {row.rollupOutcome}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${reviewBadge(row.reviewDecision)}`}
                          title={row.reviewDecision === "NONE" ? "No finance decision yet" : `Stored as ${row.reviewDecision}`}
                        >
                          {reviewCellLabel(row.reviewDecision)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${accountingBadge(row.approvedForAccounting)}`}
                          title={row.approvedForAccounting ? "Ready for accounting handoff" : "Not marked for accounting"}
                        >
                          {row.approvedForAccounting ? "Ready" : "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-zinc-700">
                        {lineTotal > 0 ? (
                          <span
                            title={
                              row.unknownLineCount > 0
                                ? `${row.unknownLineCount} line(s) could not be matched to the snapshot — open intake to triage before finance sign-off.`
                                : "G/A/R/U = green / amber / red / unknown line counts after last audit."
                            }
                          >
                            <span className="text-emerald-700">{row.greenLineCount}</span>/
                            <span className="text-amber-700">{row.amberLineCount}</span>/
                            <span className="text-red-700">{row.redLineCount}</span>/
                            <span
                              className={
                                row.unknownLineCount > 0
                                  ? "font-semibold text-violet-800 underline decoration-violet-300 decoration-dotted underline-offset-2"
                                  : "text-zinc-500"
                              }
                            >
                              {row.unknownLineCount}
                            </span>
                            {row.unknownLineCount > 0 ? (
                              <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                                unknown
                              </span>
                            ) : null}
                          </span>
                        ) : parsedLines > 0 ? (
                          <span className="text-zinc-500">
                            {parsedLines} parsed · audit {row.status === "AUDITED" ? "done" : "pending"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[14rem] py-3 pr-4 text-xs text-zinc-600">
                        <div className="truncate font-medium text-zinc-800">
                          {row.bookingPricingSnapshot.sourceSummary ?? row.bookingPricingSnapshotId}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-zinc-500" title={row.bookingPricingSnapshot.sourceRecordId}>
                          {formatPricingSnapshotSourceType(String(row.bookingPricingSnapshot.sourceType))} ·{" "}
                          <span className="font-mono">{row.bookingPricingSnapshot.sourceRecordId}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
