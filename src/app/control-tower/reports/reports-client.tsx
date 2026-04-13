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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Snapshot JSON</h2>
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
        <pre className="max-h-[28rem] overflow-auto rounded bg-zinc-50 p-3 text-xs text-zinc-800">{json}</pre>
      </div>
    </div>
  );
}
