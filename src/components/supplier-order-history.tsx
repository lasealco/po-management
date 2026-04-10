"use client";

import Link from "next/link";
import type { SupplierOrderAnalytics } from "@/lib/supplier-order-analytics";

const STATUS_SEGMENTS = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-zinc-500",
] as const;

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDurationHours(h: number | null): string {
  if (h == null) return "—";
  if (h >= 72) return `${(h / 24).toFixed(1)} d`;
  return `${h} h`;
}

export function SupplierOrderHistorySection({
  analytics,
}: {
  analytics: SupplierOrderAnalytics;
}) {
  const maxMonthlyCount = Math.max(1, ...analytics.last12Months.map((m) => m.orderCount));
  const hasParents = analytics.parentOrderCount > 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Purchase order history</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Parent purchase orders for this supplier (split child lines counted separately). Based on
        live data.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Parent POs</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
            {analytics.parentOrderCount}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Split children</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
            {analytics.splitChildOrderCount}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">First / last PO</p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            {analytics.firstOrderAt ? formatShortDate(analytics.firstOrderAt) : "—"}
          </p>
          <p className="text-sm text-zinc-600">
            {analytics.lastOrderAt ? formatShortDate(analytics.lastOrderAt) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Value by currency</p>
          <ul className="mt-1 space-y-1 text-sm text-zinc-800">
            {analytics.totalByCurrency.length === 0 ? (
              <li className="text-zinc-500">—</li>
            ) : (
              analytics.totalByCurrency.map((r) => (
                <li key={r.currency} className="flex justify-between gap-2 tabular-nums">
                  <span className="font-medium">{r.currency}</span>
                  <span>
                    {r.totalAmount} <span className="text-xs text-zinc-500">({r.orderCount})</span>
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-10 border-t border-zinc-200 pt-8">
        <h3 className="text-lg font-semibold text-zinc-900">Performance & on-time</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Confirm timing uses workflow logs (
          <code className="rounded bg-zinc-100 px-1">send_to_supplier</code> →{" "}
          <code className="rounded bg-zinc-100 px-1">confirm</code>
          ). Shared-thread timing is the first non-internal message after send (buyer or supplier).
          Supplier portal timing uses shared messages from users in your configured supplier-portal
          role(s) (default <code className="rounded bg-zinc-100 px-1">Supplier portal</code>).
          Header shipping
          compares earliest ASN <code className="rounded bg-zinc-100 px-1">shippedAt</code> to PO
          requested delivery (UTC calendar days). Line planned compares each{" "}
          <code className="rounded bg-zinc-100 px-1">ShipmentItem.plannedShipDate</code> to the same
          ASN <code className="rounded bg-zinc-100 px-1">shippedAt</code>.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Order confirmation
            </p>
            <dl className="mt-3 space-y-2 text-sm text-zinc-800">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Sent to supplier</dt>
                <dd className="tabular-nums font-medium">
                  {analytics.performance.confirmation.ordersSentToSupplier}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Confirmed</dt>
                <dd className="tabular-nums font-medium text-emerald-800">
                  {analytics.performance.confirmation.ordersConfirmedAfterSend}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Declined</dt>
                <dd className="tabular-nums font-medium text-rose-800">
                  {analytics.performance.confirmation.ordersDeclinedAfterSend}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Buyer cancelled (after send)</dt>
                <dd className="tabular-nums font-medium text-amber-800">
                  {analytics.performance.confirmation.ordersBuyerCancelledAfterSend}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Awaiting confirm</dt>
                <dd className="tabular-nums font-medium text-sky-800">
                  {analytics.performance.confirmation.ordersAwaitingConfirmation}
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-600">
              <p className="font-medium text-zinc-700">Hours to confirm (after send)</p>
              <p className="mt-1">
                Avg {formatDurationHours(analytics.performance.confirmation.avgHoursToConfirm)} ·
                Median {formatDurationHours(analytics.performance.confirmation.medianHoursToConfirm)}{" "}
                · P90 {formatDurationHours(analytics.performance.confirmation.p90HoursToConfirm)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Shared thread response
            </p>
            <dl className="mt-3 space-y-2 text-sm text-zinc-800">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Sent POs (baseline)</dt>
                <dd className="tabular-nums font-medium">
                  {analytics.performance.sharedThread.ordersSentToSupplier}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">With shared reply after send</dt>
                <dd className="tabular-nums font-medium">
                  {analytics.performance.sharedThread.ordersWithSharedReplyAfterSend}
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-600">
              <p className="font-medium text-zinc-700">Hours to first shared message</p>
              <p className="mt-1">
                Avg{" "}
                {formatDurationHours(analytics.performance.sharedThread.avgHoursToFirstSharedReply)}{" "}
                · Median{" "}
                {formatDurationHours(
                  analytics.performance.sharedThread.medianHoursToFirstSharedReply,
                )}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Ship vs requested date
            </p>
            <dl className="mt-3 space-y-2 text-sm text-zinc-800">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">POs with due date</dt>
                <dd className="tabular-nums font-medium">
                  {analytics.performance.shippingVsRequested.ordersWithRequestedDelivery}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Shipped (with due date)</dt>
                <dd className="tabular-nums font-medium">
                  {analytics.performance.shippingVsRequested.ordersShippedWithDueDate}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">On-time ship</dt>
                <dd className="tabular-nums font-medium text-emerald-800">
                  {analytics.performance.shippingVsRequested.onTimeShipCount}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Late ship</dt>
                <dd className="tabular-nums font-medium text-rose-800">
                  {analytics.performance.shippingVsRequested.lateShipCount}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Awaiting ship</dt>
                <dd className="tabular-nums font-medium text-amber-800">
                  {analytics.performance.shippingVsRequested.awaitingShipmentCount}
                </dd>
              </div>
            </dl>
            {analytics.performance.shippingVsRequested.ordersShippedWithDueDate > 0 ? (
              <>
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-200">
                  {(() => {
                    const on = analytics.performance.shippingVsRequested.onTimeShipCount;
                    const late = analytics.performance.shippingVsRequested.lateShipCount;
                    const t = on + late;
                    const onPct = t > 0 ? (on / t) * 100 : 0;
                    return (
                      <>
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${onPct}%` }}
                          title={`On-time: ${on}`}
                        />
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${100 - onPct}%` }}
                          title={`Late: ${late}`}
                        />
                      </>
                    );
                  })()}
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  On-time ship rate (of shipped with due date):{" "}
                  <span className="font-semibold text-zinc-900">
                    {analytics.performance.shippingVsRequested.onTimeShipPct ?? "—"}%
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">No shipped POs with a due date yet.</p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Supplier portal reply
            </p>
            <dl className="mt-3 space-y-2 text-sm text-zinc-800">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Sent POs (baseline)</dt>
                <dd className="tabular-nums font-medium">
                  {analytics.performance.supplierPortal.ordersSentToSupplier}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">With portal message after send</dt>
                <dd className="tabular-nums font-medium">
                  {analytics.performance.supplierPortal.ordersWithSupplierPortalMessageAfterSend}
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-600">
              <p className="font-medium text-zinc-700">Hours to first portal user message</p>
              <p className="mt-1">
                Avg{" "}
                {formatDurationHours(
                  analytics.performance.supplierPortal.avgHoursToFirstSupplierPortalMessage,
                )}{" "}
                · Median{" "}
                {formatDurationHours(
                  analytics.performance.supplierPortal.medianHoursToFirstSupplierPortalMessage,
                )}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              ASN lines vs planned ship date
            </p>
            <dl className="mt-3 space-y-2 text-sm text-zinc-800">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Lines with planned date</dt>
                <dd className="tabular-nums font-medium">
                  {analytics.performance.lineShipVsPlanned.linesWithPlannedShipDate}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">On-time (ship day ≤ plan)</dt>
                <dd className="tabular-nums font-medium text-emerald-800">
                  {analytics.performance.lineShipVsPlanned.onTimeLineCount}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">Late</dt>
                <dd className="tabular-nums font-medium text-rose-800">
                  {analytics.performance.lineShipVsPlanned.lateLineCount}
                </dd>
              </div>
            </dl>
            {analytics.performance.lineShipVsPlanned.linesWithPlannedShipDate > 0 ? (
              <>
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-200">
                  {(() => {
                    const on = analytics.performance.lineShipVsPlanned.onTimeLineCount;
                    const late = analytics.performance.lineShipVsPlanned.lateLineCount;
                    const t = on + late;
                    const onPct = t > 0 ? (on / t) * 100 : 0;
                    return (
                      <>
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${onPct}%` }}
                          title={`On-time lines: ${on}`}
                        />
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${100 - onPct}%` }}
                          title={`Late lines: ${late}`}
                        />
                      </>
                    );
                  })()}
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  On-time line rate:{" "}
                  <span className="font-semibold text-zinc-900">
                    {analytics.performance.lineShipVsPlanned.onTimeLinePct ?? "—"}%
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">
                No shipment lines with a planned ship date for this supplier yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {hasParents ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">By status (parent POs)</h3>
            <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="flex h-full w-full">
                {analytics.byStatus.map((s, i) => (
                  <div
                    key={s.statusCode}
                    className={`h-full ${STATUS_SEGMENTS[i % STATUS_SEGMENTS.length]}`}
                    style={{ width: `${s.pctOfOrders}%` }}
                    title={`${s.statusLabel}: ${s.orderCount} (${s.pctOfOrders}%)`}
                  />
                ))}
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {analytics.byStatus.map((s, i) => (
                <li key={s.statusCode} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-sm ${STATUS_SEGMENTS[i % STATUS_SEGMENTS.length]}`}
                    />
                    <span className="text-zinc-800">{s.statusLabel}</span>
                  </span>
                  <span className="tabular-nums text-zinc-600">
                    {s.orderCount}{" "}
                    <span className="text-xs text-zinc-400">({s.pctOfOrders}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Orders per month (12 mo, UTC)</h3>
            <div className="mt-3 flex h-[132px] items-end gap-1">
              {analytics.last12Months.map((m) => {
                const barPx = Math.round(
                  Math.max(6, (m.orderCount / maxMonthlyCount) * 112),
                );
                return (
                  <div key={m.yearMonth} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full max-w-[28px] rounded-t bg-violet-500/90 transition-colors hover:bg-violet-600"
                      style={{ height: `${barPx}px` }}
                      title={`${m.label}: ${m.orderCount} PO(s)`}
                    />
                    <span className="max-w-full truncate text-center text-[9px] font-medium text-zinc-500">
                      {m.label.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-400">Bar height = relative volume within the year.</p>
          </div>
        </div>
      ) : null}

      {hasParents ? (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-zinc-900">Recent parent POs</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {analytics.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-50/80">
                    <td className="px-3 py-2">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-medium text-amber-800 underline-offset-2 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                      {o.title ? (
                        <p className="text-xs text-zinc-500">{o.title}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                      {formatShortDate(o.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        {o.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-800">
                      {o.currency} {o.totalAmount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">No parent purchase orders for this supplier yet.</p>
      )}
    </section>
  );
}
