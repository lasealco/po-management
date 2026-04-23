import type { SrmBookingSlaSummary, SrmOrderVolumeKpi } from "@/lib/srm/srm-analytics-aggregates";
import Link from "next/link";

function isoDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export function SrmAnalyticsDateForm({
  kind,
  from,
  to,
}: {
  kind: "product" | "logistics";
  from: string;
  to: string;
}) {
  return (
    <form
      method="get"
      action="/srm/analytics"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4"
    >
      <input type="hidden" name="kind" value={kind} />
      <label className="flex flex-col text-sm text-zinc-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">From (UTC)</span>
        <input
          type="date"
          name="from"
          defaultValue={isoDateInput(from)}
          className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5"
        />
      </label>
      <label className="flex flex-col text-sm text-zinc-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">To (UTC)</span>
        <input
          type="date"
          name="to"
          defaultValue={isoDateInput(to)}
          className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5"
        />
      </label>
      <button
        type="submit"
        className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white"
      >
        Apply range
      </button>
    </form>
  );
}

function BarStack({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-600">
        <span className="font-medium text-zinc-800">{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-zinc-100">
        <div
          className="h-2 rounded-sm bg-[var(--arscmp-primary)]/90"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SrmOrderKpiPanel({
  kpi,
  canViewOrders,
}: {
  kpi: SrmOrderVolumeKpi | null;
  canViewOrders: boolean;
}) {
  if (!canViewOrders) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
        <p className="text-sm font-medium text-amber-900">Purchase order metrics are hidden</p>
        <p className="mt-2 text-xs text-amber-950/80">
          Spend and order-count KPIs use purchase order totals. Your session needs <strong>org.orders</strong> →{" "}
          <strong>view</strong> in addition to supplier access. Ask an admin to adjust the demo role, or use a demo user
          with orders access.
        </p>
      </section>
    );
  }
  if (!kpi) return null;

  const maxCount = kpi.bySupplier[0]?.orderCount ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Order volume (parent POs in range)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Parent orders only; one supplier per header. {kpi.srmKind === "logistics" ? "Logistics" : "Product"} category.
        </p>
        <p className="mt-3 text-2xl font-semibold text-zinc-900">{kpi.totalOrders}</p>
        <p className="text-xs text-zinc-500">Total orders in date range</p>
        <div className="mt-4 space-y-3">
          {kpi.bySupplier.length === 0 ? (
            <p className="text-sm text-zinc-600">No orders in this range.</p>
          ) : (
            kpi.bySupplier.slice(0, 8).map((s) => (
              <BarStack key={s.supplierId} label={s.supplierName} value={s.orderCount} max={maxCount} />
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Concentration (MVP)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Share of <strong>all parent orders</strong> in range that come from the top 3 suppliers (by order count) — an
          order-count / supplier-risk proxy, not revenue-weighted.
        </p>
        <p className="mt-4 text-2xl font-semibold text-zinc-900">
          {kpi.concentration.top3OrderCountPct}%
        </p>
        <p className="text-xs text-zinc-500">Top-3 order share (count-based)</p>

        {kpi.concentration.byCurrency.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">No spend in this range (no placed PO totals).</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {kpi.concentration.byCurrency.map((c) => (
              <li key={c.currency} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
                <p className="font-medium text-zinc-800">
                  {c.currency} · total {c.totalSpend} · top-3 share {c.top3SpendPct}%
                </p>
                <ol className="mt-1 list-decimal pl-4 text-xs text-zinc-600">
                  {c.top3Suppliers.map((r) => (
                    <li key={r.supplierId}>
                      {r.name} — {r.amount} ({r.pctOfCurrencyTotal}% of {c.currency} total)
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lg:col-span-2">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Spend (by currency)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {kpi.bySupplier.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-zinc-600">
                    No data.
                  </td>
                </tr>
              ) : (
                kpi.bySupplier.map((s) => (
                  <tr key={s.supplierId}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{s.supplierName}</td>
                    <td className="px-4 py-3 text-zinc-700">{s.orderCount}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {s.byCurrency.length
                        ? s.byCurrency.map((c) => `${c.currency} ${c.totalAmount}`).join(" · ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/srm/${s.supplierId}?kind=${kpi.srmKind}`}
                        className="text-[var(--arscmp-primary)] hover:underline"
                      >
                        Open 360
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SrmBookingSlaPanel({ summary }: { summary: SrmBookingSlaSummary | null }) {
  if (!summary) return null;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Booking confirmation vs SLA (logistics)</h2>
      <p className="mt-1 text-xs text-zinc-500">{summary.disclaimer}</p>
      {summary.isSparse ? (
        <p className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-2 text-sm text-amber-950">
          No completed booking confirmations in this window (or milestones missing). Policy SLA hours still apply when
          data exists — expand production tracking in a later slice.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-700">
          <li>
            <span className="text-zinc-500">In range (sent):</span> {summary.inRangeWithSent}
          </li>
          <li>
            <span className="text-zinc-500">With confirmation + SLA math:</span> {summary.withConfirmation}
          </li>
          <li className="text-emerald-800">
            <span className="text-zinc-500">Met SLA:</span> {summary.metSla}
          </li>
          <li className="text-rose-800">
            <span className="text-zinc-500">Missed SLA:</span> {summary.missedSla}
          </li>
          <li>
            <span className="text-zinc-500">Indeterminate:</span> {summary.indeterminate}
          </li>
        </ul>
      )}

      {summary.sample.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-1 pr-2">Forwarder</th>
                <th className="py-1 pr-2">Policy (h)</th>
                <th className="py-1 pr-2">Sent</th>
                <th className="py-1 pr-2">Confirmed</th>
                <th className="py-1 pr-2">Hours</th>
                <th className="py-1 pr-2">Met?</th>
              </tr>
            </thead>
            <tbody>
              {summary.sample.map((r) => (
                <tr key={r.bookingId} className="border-t border-zinc-100 text-zinc-800">
                  <td className="py-1.5 pr-2 font-medium">{r.forwarderName}</td>
                  <td className="py-1.5 pr-2">{r.policySlaHours}</td>
                  <td className="py-1.5 pr-2 text-zinc-500">{r.bookingSentAt ? r.bookingSentAt.slice(0, 16) : "—"}</td>
                  <td className="py-1.5 pr-2 text-zinc-500">{r.confirmedAt ? r.confirmedAt.slice(0, 16) : "—"}</td>
                  <td className="py-1.5 pr-2">{r.hoursToConfirm ?? "—"}</td>
                  <td className="py-1.5 pr-2">
                    {r.metSla == null ? "—" : r.metSla ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
