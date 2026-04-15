"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Summary = {
  generatedAt: string;
  isCustomerView: boolean;
  totals: {
    shipments: number;
    withBooking: number;
    openExceptions: number | null;
    customerOpenExceptions?: number | null;
    slaBreachedAlerts: number | null;
    slaBreachedExceptions: number | null;
    openSlaEscalationAlerts: number | null;
  };
  routeActions: {
    planLeg: number;
    markDeparture: number;
    recordArrival: number;
    routeComplete: number;
    noLegs: number;
  };
  ownerLoad: {
    alerts: {
      unassigned: number;
      top: Array<{ ownerUserId: string; ownerName: string; count: number }>;
    };
    exceptions: {
      unassigned: number;
      top: Array<{ ownerUserId: string; ownerName: string; count: number }>;
    };
  };
  ownerBalancing: {
    capacityThreshold: number;
    overloadedOwnerCount: number;
    underloadedOwnerCount: number;
    combinedTop: Array<{ ownerUserId: string; ownerName: string; count: number }>;
  };
  etaPerformance: {
    compared: number;
    onTime: number;
    late: number;
    onTimePct: number;
    avgDelayDays: number;
    topDelayedLanes: Array<{
      lane: string;
      total: number;
      delayed: number;
      overdueOpen: number;
      delayedPct: number;
    }>;
  };
  byStatus: Record<string, number>;
};

export function ControlTowerReportsClient({
  summary,
  canEdit,
}: {
  summary: Summary;
  canEdit: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedSafe, setCopiedSafe] = useState(false);
  const [showSnapshotJson, setShowSnapshotJson] = useState(false);
  const json = useMemo(() => JSON.stringify(summary, null, 2), [summary]);
  const customerSafeJson = useMemo(() => {
    if (!summary.isCustomerView) return null;
    return JSON.stringify(
      {
        generatedAt: summary.generatedAt,
        isCustomerView: true,
        totals: {
          shipments: summary.totals.shipments,
          withBooking: summary.totals.withBooking,
          openExceptionsOnYourShipments: summary.totals.customerOpenExceptions ?? 0,
        },
        routeActions: summary.routeActions,
        etaPerformance: summary.etaPerformance,
        byStatus: summary.byStatus,
      },
      null,
      2,
    );
  }, [summary]);
  const exportStatusCsv = () => {
    const rows = [["status", "count"], ...Object.entries(summary.byStatus).map(([k, v]) => [k, String(v)])];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-tower-status-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportSlaCsv = () => {
    if (summary.isCustomerView) return;
    const rows = [
      ["metric", "count"],
      ["sla_breached_alerts", String(summary.totals.slaBreachedAlerts ?? 0)],
      ["sla_breached_exceptions", String(summary.totals.slaBreachedExceptions ?? 0)],
      ["open_sla_escalation_alerts", String(summary.totals.openSlaEscalationAlerts ?? 0)],
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-tower-sla-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRouteActionsCsv = () => {
    const items: Array<[string, number]> = [
      ["plan_leg", summary.routeActions.planLeg],
      ["mark_departure", summary.routeActions.markDeparture],
      ["record_arrival", summary.routeActions.recordArrival],
      ["route_complete", summary.routeActions.routeComplete],
      ["no_legs", summary.routeActions.noLegs],
    ];
    const rows = [["bucket", "count"], ...items.map(([k, v]) => [k, String(v)])];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-tower-route-actions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-900">
          <p className="text-xs font-semibold uppercase text-zinc-600">Shipments</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">{summary.totals.shipments}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-900">
          <p className="text-xs font-semibold uppercase text-zinc-600">With booking</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">{summary.totals.withBooking}</p>
        </div>
        {!summary.isCustomerView ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-900">
            <p className="text-xs font-semibold uppercase text-zinc-600">Open exceptions</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">{summary.totals.openExceptions ?? 0}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-4">
            <p className="text-xs font-semibold uppercase text-sky-800">Your open exceptions</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-950">
              {summary.totals.customerOpenExceptions ?? 0}
            </p>
            <p className="mt-1 text-xs text-sky-900">
              OPEN exceptions on shipments in your portal scope (not internal pipeline totals).
            </p>
          </div>
        )}
      </div>
      {!summary.isCustomerView ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">SLA pressure</h2>
            <button
              type="button"
              onClick={exportSlaCsv}
              className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800"
            >
              Export SLA CSV
            </button>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded border border-rose-100 bg-rose-50 px-3 py-2 text-rose-950">
              Breached alerts: <strong>{summary.totals.slaBreachedAlerts ?? 0}</strong>
            </div>
            <div className="rounded border border-rose-100 bg-rose-50 px-3 py-2 text-rose-950">
              Breached exceptions: <strong>{summary.totals.slaBreachedExceptions ?? 0}</strong>
            </div>
            <div className="rounded border border-violet-100 bg-violet-50 px-3 py-2 text-violet-950">
              Open SLA follow-ups: <strong>{summary.totals.openSlaEscalationAlerts ?? 0}</strong>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Triage:{" "}
            <Link href="/control-tower/command-center" className="font-medium text-sky-800 underline">
              Command center
            </Link>{" "}
            ·{" "}
            <Link href="/control-tower/workbench" className="font-medium text-sky-800 underline">
              Workbench
            </Link>
          </p>
        </div>
      ) : null}
      {!summary.isCustomerView ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Owner balancing guidance</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Threshold {summary.ownerBalancing.capacityThreshold} open items · overloaded{" "}
            {summary.ownerBalancing.overloadedOwnerCount} · underloaded{" "}
            {summary.ownerBalancing.underloadedOwnerCount}
          </p>
          <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {summary.ownerBalancing.combinedTop.map((r) => (
              <li
                key={r.ownerUserId}
                className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-950"
              >
                <span className="font-medium">{r.ownerName}</span>:{" "}
                <strong className="tabular-nums">{r.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">ETA reliability</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Compared: <strong>{summary.etaPerformance.compared}</strong> · On-time:{" "}
          <strong>{summary.etaPerformance.onTime}</strong> · Late: <strong>{summary.etaPerformance.late}</strong> ·
          On-time %: <strong>{summary.etaPerformance.onTimePct}%</strong> · Avg delay:{" "}
          <strong>{summary.etaPerformance.avgDelayDays}d</strong>
        </p>
        {summary.etaPerformance.topDelayedLanes.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[28rem] text-xs">
              <thead className="text-left uppercase text-zinc-500">
                <tr>
                  <th className="pr-3">Lane</th>
                  <th className="pr-3">Total</th>
                  <th className="pr-3">Delayed</th>
                  <th className="pr-3">Delayed %</th>
                  <th className="pr-3">Overdue open</th>
                </tr>
              </thead>
              <tbody>
                {summary.etaPerformance.topDelayedLanes.map((l) => (
                  <tr key={l.lane} className="border-t border-zinc-100 text-zinc-700">
                    <td className="py-1 pr-3">{l.lane}</td>
                    <td className="py-1 pr-3">{l.total}</td>
                    <td className="py-1 pr-3">{l.delayed}</td>
                    <td className="py-1 pr-3">{l.delayedPct}%</td>
                    <td className="py-1 pr-3">{l.overdueOpen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Route action buckets</h2>
          <button
            type="button"
            onClick={exportRouteActionsCsv}
            className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800"
          >
            Export CSV
          </button>
        </div>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-950">
            Plan leg: <strong className="tabular-nums">{summary.routeActions.planLeg}</strong>
          </div>
          <div className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-950">
            Mark departure: <strong className="tabular-nums">{summary.routeActions.markDeparture}</strong>
          </div>
          <div className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-950">
            Record arrival: <strong className="tabular-nums">{summary.routeActions.recordArrival}</strong>
          </div>
          <div className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-950">
            Route complete: <strong className="tabular-nums">{summary.routeActions.routeComplete}</strong>
          </div>
          <div className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-950">
            No legs: <strong className="tabular-nums">{summary.routeActions.noLegs}</strong>
          </div>
        </div>
      </div>
      {!summary.isCustomerView ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Owner workload</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <section>
              <p className="text-xs uppercase text-zinc-500">
                Alerts · Unassigned: {summary.ownerLoad.alerts.unassigned}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {summary.ownerLoad.alerts.top.map((r) => (
                  <li key={r.ownerUserId}>
                    {r.ownerName}: <strong>{r.count}</strong>
                  </li>
                ))}
                {summary.ownerLoad.alerts.top.length === 0 ? (
                  <li className="text-zinc-500">No open alert ownership load.</li>
                ) : null}
              </ul>
            </section>
            <section>
              <p className="text-xs uppercase text-zinc-500">
                Exceptions · Unassigned: {summary.ownerLoad.exceptions.unassigned}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {summary.ownerLoad.exceptions.top.map((r) => (
                  <li key={r.ownerUserId}>
                    {r.ownerName}: <strong>{r.count}</strong>
                  </li>
                ))}
                {summary.ownerLoad.exceptions.top.length === 0 ? (
                  <li className="text-zinc-500">No open exception ownership load.</li>
                ) : null}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Snapshot JSON (raw)</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSnapshotJson((v) => !v)}
              className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800"
            >
              {showSnapshotJson ? "Hide JSON" : "Show JSON"}
            </button>
            <button
              type="button"
              onClick={exportStatusCsv}
              className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800"
            >
              Export status CSV
            </button>
            {canEdit ? (
              <Link
                href="/control-tower/workbench"
                className="rounded border border-sky-300 px-3 py-1 text-xs font-medium text-sky-900"
              >
                Open Workbench
              </Link>
            ) : null}
            {!summary.isCustomerView ? (
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(json);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800"
              >
                {copied ? "Copied" : "Copy full"}
              </button>
            ) : null}
            {summary.isCustomerView && customerSafeJson ? (
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(customerSafeJson);
                  setCopiedSafe(true);
                  setTimeout(() => setCopiedSafe(false), 2000);
                }}
                className="rounded border border-sky-500 px-3 py-1 text-xs font-medium text-sky-900"
              >
                {copiedSafe ? "Copied" : "Copy customer-safe"}
              </button>
            ) : null}
          </div>
        </div>
        {showSnapshotJson ? (
          <pre className="max-h-[28rem] overflow-auto rounded-md border border-zinc-300 bg-white p-4 font-mono text-sm leading-relaxed text-zinc-950 shadow-inner">
            {summary.isCustomerView && customerSafeJson ? customerSafeJson : json}
          </pre>
        ) : (
          <p className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            Hidden by default. Use <span className="font-medium">Show JSON</span> only when you need raw payload details.
          </p>
        )}
        {summary.isCustomerView ? (
          <p className="mt-2 text-xs text-zinc-500">
            Preview matches the customer-safe export (no internal SLA or owner-load blocks).
          </p>
        ) : null}
      </div>
    </div>
  );
}
