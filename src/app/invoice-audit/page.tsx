import Link from "next/link";

import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listInvoiceIntakesForTenant } from "@/lib/invoice-audit/invoice-intakes";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

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

export default async function InvoiceAuditListPage() {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const intakes = await listInvoiceIntakesForTenant({ tenantId: tenant.id, take: 200 });

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

        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Received</th>
                <th className="py-2 pr-4">Vendor / ref</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Rollup</th>
                <th className="py-2 pr-4">Review</th>
                <th className="py-2 pr-4">Lines</th>
                <th className="py-2 pr-4">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {intakes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500">
                    No intakes yet. Create one with a pricing snapshot id and parsed lines.
                  </td>
                </tr>
              ) : (
                intakes.map((row) => {
                  const lineTotal =
                    row.greenLineCount + row.amberLineCount + row.redLineCount + row.unknownLineCount;
                  const parsedLines = row._count.lines;
                  return (
                    <tr key={row.id} className="border-b border-zinc-100">
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.receivedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
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
                        >
                          {row.reviewDecision === "NONE" ? "—" : row.reviewDecision}
                        </span>
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-zinc-700">
                        {lineTotal > 0 ? (
                          <span>
                            <span className="text-emerald-700">{row.greenLineCount}</span>/
                            <span className="text-amber-700">{row.amberLineCount}</span>/
                            <span className="text-red-700">{row.redLineCount}</span>/
                            <span className="text-zinc-500">{row.unknownLineCount}</span>
                          </span>
                        ) : parsedLines > 0 ? (
                          <span className="text-zinc-500">
                            {parsedLines} parsed · audit {row.status === "AUDITED" ? "done" : "pending"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[14rem] truncate py-3 pr-4 text-xs text-zinc-600">
                        {row.bookingPricingSnapshot.sourceSummary ?? row.bookingPricingSnapshotId}
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
