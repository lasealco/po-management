import Link from "next/link";
import { notFound } from "next/navigation";

import { PricingSnapshotBreakdownPanel } from "@/components/pricing-snapshots/pricing-snapshot-breakdown-panel";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getBookingPricingSnapshotForTenant, SnapshotRepoError } from "@/lib/booking-pricing-snapshot";
import {
  extractSnapshotPriceCandidates,
  summarizeContractGeographyFromCandidates,
} from "@/lib/invoice-audit/snapshot-candidates";
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
  const access = await getViewerGrantSet();
  const canInvoiceAuditView = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "view"));
  const canInvoiceAuditEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "edit"));
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

  const auditExtract = extractSnapshotPriceCandidates(row.breakdownJson);
  const contractGeo =
    auditExtract.ok && auditExtract.sourceType === "TARIFF_CONTRACT_VERSION"
      ? summarizeContractGeographyFromCandidates(auditExtract.candidates)
      : null;

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
          <p className="mt-2 font-mono text-xs text-zinc-500">id {row.id}</p>
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

      {canInvoiceAuditView ? (
        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Invoice audit</h2>
          {auditExtract.ok ? (
            <>
              <p className="mt-2 text-sm text-zinc-600">
                This frozen breakdown yields{" "}
                <span className="font-semibold text-zinc-900">{auditExtract.candidates.length}</span> comparable line
                {auditExtract.candidates.length === 1 ? "" : "s"} for ocean matching (same extractor as run-audit).
                {auditExtract.sourceType === "QUOTE_RESPONSE" && auditExtract.rfqGrandTotal != null ? (
                  <>
                    {" "}
                    RFQ reference total:{" "}
                    <span className="font-mono font-semibold text-zinc-800">{auditExtract.rfqGrandTotal}</span>{" "}
                    {row.currency}.
                  </>
                ) : null}
                {auditExtract.sourceType === "TARIFF_CONTRACT_VERSION" && auditExtract.contractGrandTotal != null ? (
                  <>
                    {" "}
                    Contract frozen grand:{" "}
                    <span className="font-mono font-semibold text-zinc-800">{auditExtract.contractGrandTotal}</span>{" "}
                    {row.currency} (used for all-in lines when invoice equipment is not set).
                  </>
                ) : null}
              </p>
              {auditExtract.sourceType === "QUOTE_RESPONSE" &&
              auditExtract.rfqRouteLocodes &&
              (auditExtract.rfqRouteLocodes.pol || auditExtract.rfqRouteLocodes.pod) ? (
                <p className="mt-2 font-mono text-xs text-zinc-600">
                  Quote route hints (from RFQ labels): POL {auditExtract.rfqRouteLocodes.pol ?? "—"} → POD{" "}
                  {auditExtract.rfqRouteLocodes.pod ?? "—"} (used when invoice intakes include POL/POD codes).
                </p>
              ) : null}
              {auditExtract.sourceType === "TARIFF_CONTRACT_VERSION" && contractGeo ? (
                <p className="mt-2 font-mono text-xs text-zinc-600">
                  Contract rate geography: POL {contractGeo.polCodes.length ? contractGeo.polCodes.join(", ") : "—"} →
                  POD {contractGeo.podCodes.length ? contractGeo.podCodes.join(", ") : "—"} (from frozen FCL rate
                  lines).
                </p>
              ) : null}
              {auditExtract.candidates.length > 0 ? (
                <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Snapshot line labels (demo)
                  </p>
                  <p className="mt-2 flex flex-wrap gap-1.5 text-[11px] leading-snug text-zinc-800">
                    {auditExtract.candidates.slice(0, 12).map((c) => (
                      <span
                        key={c.id}
                        title={`${c.kind}: ${c.label}`}
                        className="max-w-[14rem] truncate rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono"
                      >
                        {c.label.length > 44 ? `${c.label.slice(0, 44)}…` : c.label}
                      </span>
                    ))}
                    {auditExtract.candidates.length > 12 ? (
                      <span className="self-center text-zinc-500">+{auditExtract.candidates.length - 12} more</span>
                    ) : null}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    For clearest matches, mirror these labels in invoice text or set{" "}
                    <span className="font-mono">normalizedLabel</span> to an exact snapshot line title when you import
                    parsed lines.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-amber-900">
              Invoice audit cannot parse this snapshot: {auditExtract.error}
            </p>
          )}
          {canInvoiceAuditEdit ? (
            <div className="mt-4">
              <Link
                href={`/invoice-audit/new?snapshotId=${encodeURIComponent(row.id)}`}
                className="inline-flex rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
              >
                New intake with this snapshot
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">You need invoice audit edit permission to create an intake.</p>
          )}
        </section>
      ) : null}

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
