import Link from "next/link";
import { notFound } from "next/navigation";

import { PricingSnapshotBreakdownPanel } from "@/components/pricing-snapshots/pricing-snapshot-breakdown-panel";
import { getBookingPricingSnapshotForTenant, SnapshotRepoError } from "@/lib/booking-pricing-snapshot";
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

export default async function PricingSnapshotDetailPage(props: { params: Promise<{ id: string }> }) {
  const tenant = await getDemoTenant();
  const { id } = await props.params;
  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  let row;
  try {
    row = await getBookingPricingSnapshotForTenant({ tenantId: tenant.id, snapshotId: id });
  } catch (e) {
    if (e instanceof SnapshotRepoError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/pricing-snapshots"
            className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            ← All snapshots
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Pricing snapshot</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">{row.sourceSummary ?? row.id}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-right shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Frozen total</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {fmtMoney(row.totalEstimatedCost.toString(), row.currency)}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {row.frozenAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
      </div>

      {row.shipmentBooking ? (
        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Linked booking</h2>
          <p className="mt-2 text-sm text-zinc-600">
            This snapshot is associated with shipment booking{" "}
            <span className="font-mono text-xs">{row.shipmentBooking.id}</span>
            {row.shipmentBooking.bookingNo ? (
              <>
                {" "}
                (<span className="font-semibold">{row.shipmentBooking.bookingNo}</span>)
              </>
            ) : null}
            . When the booking workspace ships, show this row as the economics frozen at quote/contract selection time.
          </p>
        </section>
      ) : null}

      <PricingSnapshotBreakdownPanel
        sourceType={row.sourceType}
        sourceRecordId={row.sourceRecordId}
        currency={row.currency}
        totalEstimatedCost={row.totalEstimatedCost.toString()}
        totalDerivation={row.totalDerivation}
        breakdownJson={row.breakdownJson}
        freeTimeBasisJson={row.freeTimeBasisJson}
        commercialJson={row.commercialJson}
        basisSide={row.basisSide}
      />
    </main>
  );
}
