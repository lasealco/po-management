import Link from "next/link";

import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listBookingPricingSnapshotsForTenant } from "@/lib/booking-pricing-snapshot";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

function fmtMoney(amount: string, currency: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default async function PricingSnapshotsListPage() {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canFreeze =
    Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit")) ||
    Boolean(access?.user && viewerHas(access.grantSet, "org.rfq", "edit"));
  const canInvoiceAudit = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const snapshots = await listBookingPricingSnapshotsForTenant({ tenantId: tenant.id, take: 200 });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Booking pricing snapshots</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Immutable copies of estimated ocean economics from a contract version or an RFQ response.
              Totals and line detail stay fixed even if live tariffs or quotes change later.
              {canInvoiceAudit ? (
                <>
                  {" "}
                  Open a snapshot, then use <span className="font-medium">New intake with this snapshot</span> to run
                  invoice audit against the frozen lines.
                </>
              ) : null}
            </p>
          </div>
          {canFreeze ? (
            <Link
              href="/pricing-snapshots/new"
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              Freeze snapshot
            </Link>
          ) : null}
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Frozen</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Summary</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Booking</th>
                {canInvoiceAudit ? <th className="py-2 pr-4">Invoice audit</th> : null}
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={canInvoiceAudit ? 6 : 5} className="py-10 text-center text-zinc-500">
                    No snapshots yet. Freeze one from a contract version or RFQ response.
                  </td>
                </tr>
              ) : (
                snapshots.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100">
                    <td className="py-3 pr-4 text-zinc-700">
                      {s.frozenAt.toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {s.sourceType === "TARIFF_CONTRACT_VERSION" ? "Contract" : "RFQ"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/pricing-snapshots/${s.id}`}
                        className="font-medium text-[var(--arscmp-primary)] hover:underline"
                      >
                        {s.sourceSummary ?? s.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-zinc-800">
                      {fmtMoney(s.totalEstimatedCost.toString(), s.currency)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-600">
                      {s.shipmentBooking ? (
                        <span className="font-mono text-xs">
                          {s.shipmentBooking.bookingNo ?? s.shipmentBooking.id.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    {canInvoiceAudit ? (
                      <td className="py-3 pr-4">
                        <Link
                          href={`/invoice-audit/new?snapshotId=${encodeURIComponent(s.id)}`}
                          className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
                        >
                          New intake
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
