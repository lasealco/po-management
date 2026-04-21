"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubIngestionAlertsSummaryDto } from "@/lib/apihub/ingestion-alerts-dto";

type Props = {
  canView: boolean;
  initialSummary: ApiHubIngestionAlertsSummaryDto | null;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function severityChip(sev: string) {
  switch (sev) {
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-950";
    default:
      return "border-red-200 bg-red-50 text-red-900";
  }
}

export function IngestionAlertsPanel({ canView, initialSummary }: Props) {
  const [summary, setSummary] = useState<ApiHubIngestionAlertsSummaryDto | null>(initialSummary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/ingestion-alerts-summary?limit=12", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(readApiHubErrorMessageFromJsonBody(data, "Could not load alerts summary."));
      }
      setSummary(data as ApiHubIngestionAlertsSummaryDto);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!canView) {
    return (
      <section id="ingestion-alerts" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Operator triage</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900">Apply and retry alerts</h2>
        <p className="mt-3 max-w-xl text-sm text-zinc-600">
          Choose a demo user in{" "}
          <Link href="/settings/demo" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            Settings → Demo session
          </Link>{" "}
          to see priority issues from recent apply and retry audit activity.
        </p>
      </section>
    );
  }

  const total = summary
    ? summary.counts.error + summary.counts.warn + summary.counts.info
    : 0;
  const hasIssues = total > 0;

  return (
    <section id="ingestion-alerts" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Operator triage</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">Apply and retry alerts</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Snapshot from <span className="font-medium text-zinc-800">GET /api/apihub/ingestion-alerts-summary</span>{" "}
            (recent apply/retry client errors in audit). Use{" "}
            <span className="font-medium text-zinc-800">Refresh</span> after triage. Open the detailed{" "}
            <Link href="/apihub#apply-conflicts" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              Apply conflicts
            </Link>{" "}
            table for row-level diagnostics.
          </p>
          {summary ? (
            <p className="mt-2 text-xs text-zinc-500">
              Generated <span className="font-medium text-zinc-700">{formatWhen(summary.generatedAt)}</span> · scanned
              up to <span className="font-medium text-zinc-700">{summary.limit}</span> audit rows
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <>
          <div
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              hasIssues ? "border-amber-200 bg-amber-50/80 text-amber-950" : "border-emerald-200 bg-emerald-50/70 text-emerald-950"
            }`}
          >
            {hasIssues ? (
              <span>
                <span className="font-semibold">Priority:</span> {summary.counts.error} error
                {summary.counts.error === 1 ? "" : "s"}, {summary.counts.warn} warning
                {summary.counts.warn === 1 ? "" : "s"}
                {summary.counts.info > 0 ? `, ${summary.counts.info} info` : ""} in this window.
              </span>
            ) : (
              <span>
                <span className="font-semibold">All clear:</span> no recent apply or retry client errors in the audited
                window.
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Errors</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-red-700">{summary.counts.error}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Warnings</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-800">{summary.counts.warn}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Info</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-sky-800">{summary.counts.info}</p>
            </div>
          </div>

          {summary.alerts.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">Run</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800">
                  {summary.alerts.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${severityChip(a.severity)}`}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-zinc-600">{a.source}</td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="font-medium text-zinc-900">{a.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-600">{a.detail}</p>
                        <p className="mt-1 font-mono text-[10px] text-zinc-500">{a.resultCode}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-700">{a.ingestionRunId}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-600">{formatWhen(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 text-sm text-zinc-600">No alert rows in this window.</p>
          )}
        </>
      ) : (
        <p className="mt-6 text-sm text-zinc-600">No summary loaded — use Refresh.</p>
      )}
    </section>
  );
}
