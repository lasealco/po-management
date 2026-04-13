"use client";

import { useMemo, useState } from "react";

type Summary = {
  generatedAt: string;
  isCustomerView: boolean;
  totals: {
    shipments: number;
    withBooking: number;
    openExceptions: number | null;
  };
  routeActions: {
    planLeg: number;
    markDeparture: number;
    recordArrival: number;
    routeComplete: number;
    noLegs: number;
  };
  byStatus: Record<string, number>;
};

export function ControlTowerReportsClient({
  summary,
  canEdit: _canEdit,
}: {
  summary: Summary;
  canEdit: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(summary, null, 2), [summary]);
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-zinc-500">Shipments</p>
          <p className="mt-1 text-2xl font-semibold">{summary.totals.shipments}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-zinc-500">With booking</p>
          <p className="mt-1 text-2xl font-semibold">{summary.totals.withBooking}</p>
        </div>
        {!summary.isCustomerView ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Open exceptions</p>
            <p className="mt-1 text-2xl font-semibold">{summary.totals.openExceptions ?? 0}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-sky-950">
            Customer-safe report: exception counts hidden.
          </div>
        )}
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
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
            Plan leg: <strong>{summary.routeActions.planLeg}</strong>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
            Mark departure: <strong>{summary.routeActions.markDeparture}</strong>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
            Record arrival: <strong>{summary.routeActions.recordArrival}</strong>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
            Route complete: <strong>{summary.routeActions.routeComplete}</strong>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
            No legs: <strong>{summary.routeActions.noLegs}</strong>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Snapshot JSON</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportStatusCsv}
              className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800"
            >
              Export status CSV
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(json);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <pre className="max-h-[28rem] overflow-auto rounded bg-zinc-50 p-3 text-xs text-zinc-800">{json}</pre>
      </div>
    </div>
  );
}
