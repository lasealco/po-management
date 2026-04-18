import Link from "next/link";

import { DemoSeedCopyBlock } from "@/components/invoice-audit/demo-seed-copy-block";
import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
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
  const canInvoiceAuditView = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "view"));
  const canInvoiceAuditEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "edit"));

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
              {canInvoiceAuditView ? (
                <>
                  {" "}
                  <Link href="/invoice-audit" className="font-medium text-[var(--arscmp-primary)] hover:underline">
                    Invoice intakes
                  </Link>{" "}
                  run carrier lines against a frozen snapshot;{" "}
                  <Link
                    href="/invoice-audit/readiness"
                    className="font-medium text-[var(--arscmp-primary)] hover:underline"
                  >
                    DB readiness
                  </Link>{" "}
                  checks migrations before a demo.
                  {canInvoiceAuditEdit ? (
                    <span>
                      {" "}
                      With edit access, open a row below then <span className="font-medium">New intake</span> from the
                      snapshot detail (or the last column here).
                    </span>
                  ) : null}
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
                <th className="py-2 pr-4">Snapshot id</th>
                <th className="py-2 pr-4">Summary</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Booking</th>
                {canInvoiceAuditEdit ? <th className="py-2 pr-4">Invoice audit</th> : null}
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={canInvoiceAuditEdit ? 7 : 6} className="px-4 py-10 text-left text-sm text-zinc-600">
                    <p className="font-medium text-zinc-800">No snapshots in this tenant yet</p>
                    <p className="mt-2 max-w-xl text-sm">
                      Freeze one from a published{" "}
                      <span className="font-medium">tariff contract version</span> or an{" "}
                      <span className="font-medium">RFQ quote response</span> (requires the usual tariff or RFQ edit
                      grants). Snapshots are immutable — invoice audit always compares carrier lines to the frozen JSON.
                    </p>
                    {canInvoiceAuditView ? (
                      <div className="mt-4 max-w-xl rounded-xl border border-sky-100 bg-sky-50/90 px-3 py-3">
                        <p className="text-xs font-semibold text-sky-950">Invoice audit demo shortcut</p>
                        <p className="mt-1 text-xs text-sky-900/90">
                          If you only need a walkthrough intake, this command creates a minimal snapshot when the
                          library is empty, then seeds a PARSED intake for <span className="font-medium">demo-company</span>.
                        </p>
                        <DemoSeedCopyBlock className="mt-2" />
                        <p className="mt-2 text-xs text-sky-900/80">
                          <Link href="/invoice-audit/readiness?refresh=1" className="font-medium hover:underline">
                            DB readiness
                          </Link>
                          {" · "}
                          <Link href="/invoice-audit" className="font-medium hover:underline">
                            Invoice intakes
                          </Link>
                        </p>
                      </div>
                    ) : null}
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
                    <td className="max-w-[10rem] py-3 pr-4">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {s.sourceType === "TARIFF_CONTRACT_VERSION" ? "Contract" : "RFQ"}
                      </span>
                      <div className="mt-1">
                        {s.sourceRecordId.trim() ? (
                          <RecordIdCopy id={s.sourceRecordId} copyButtonLabel="Copy source record id" />
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <RecordIdCopy id={s.id} />
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
                    <td className="py-3 pr-4 align-top text-zinc-600">
                      {s.shipmentBooking ? (
                        <div className="space-y-1">
                          {s.shipmentBooking.bookingNo ? (
                            <div className="text-xs font-medium text-zinc-800">{s.shipmentBooking.bookingNo}</div>
                          ) : null}
                          <RecordIdCopy id={s.shipmentBooking.id} copyButtonLabel="Copy booking id" />
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    {canInvoiceAuditEdit ? (
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
