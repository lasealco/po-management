"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubIngestionJobStatus } from "@/lib/apihub/constants";
import { APIHUB_INGESTION_JOB_STATUSES } from "@/lib/apihub/constants";
import type { ApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";

import { ApiHubAdvancedJsonDisclosure } from "./apihub-advanced-json";
import { IngestionRunDetailExpand } from "./ingestion-run-detail-expand";

export type IngestionOpsSummaryPayload = {
  totals: Record<ApiHubIngestionJobStatus, number>;
  windows: {
    last24h: Record<ApiHubIngestionJobStatus, number>;
    previous24h: Record<ApiHubIngestionJobStatus, number>;
  };
  inFlight: number;
  totalRuns: number;
  asOf: string;
};

type StatusFilter = "" | ApiHubIngestionJobStatus;

type Props = {
  canView: boolean;
  /** `org.apihub` edit — enables Retry on failed runs in the expanded row. */
  canEdit?: boolean;
  initialSummary: IngestionOpsSummaryPayload | null;
  initialRuns: ApiHubIngestionRunDto[];
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

function statusBadgeClass(status: string) {
  switch (status) {
    case "succeeded":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "failed":
      return "border-red-200 bg-red-50 text-red-900";
    case "running":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "queued":
      return "border-zinc-200 bg-zinc-100 text-zinc-800";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

function trendLabel(last: number, prev: number): string {
  const d = last - prev;
  if (d === 0) return "same as prior 24h";
  if (d > 0) return `↑ ${d} vs prior 24h`;
  return `↓ ${Math.abs(d)} vs prior 24h`;
}

export function IngestionOpsPanel({ canView, canEdit = false, initialSummary, initialRuns }: Props) {
  const [summary, setSummary] = useState<IngestionOpsSummaryPayload | null>(initialSummary);
  const [runs, setRuns] = useState<ApiHubIngestionRunDto[]>(initialRuns);
  const [filter, setFilter] = useState<StatusFilter>("");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opsApiErrorBody, setOpsApiErrorBody] = useState<unknown | null>(null);
  const skipNextFilterFetch = useRef(true);

  const loadSummary = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/apihub/ingestion-jobs/ops-summary", { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setOpsApiErrorBody(data);
      setError(readApiHubErrorMessageFromJsonBody(data, "Could not load ops summary."));
      return false;
    }
    setSummary(data as IngestionOpsSummaryPayload);
    return true;
  }, []);

  const loadRuns = useCallback(async (status: StatusFilter): Promise<boolean> => {
    const params = new URLSearchParams({ limit: "20" });
    if (status) params.set("status", status);
    const res = await fetch(`/api/apihub/ingestion-jobs?${params.toString()}`, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setOpsApiErrorBody(data);
      setError(readApiHubErrorMessageFromJsonBody(data, "Could not load ingestion runs."));
      return false;
    }
    const runsPayload = (data as { runs?: ApiHubIngestionRunDto[] }).runs ?? [];
    setRuns(runsPayload);
    return true;
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    setOpsApiErrorBody(null);
    setBusy(true);
    try {
      const summaryOk = await loadSummary();
      if (!summaryOk) return;
      const runsOk = await loadRuns(filter);
      if (!runsOk) return;
    } catch (e) {
      setOpsApiErrorBody(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [filter, loadRuns, loadSummary]);

  useEffect(() => {
    if (!canView) return;
    if (skipNextFilterFetch.current) {
      skipNextFilterFetch.current = false;
      return;
    }
    void (async () => {
      setError(null);
      setOpsApiErrorBody(null);
      try {
        await loadRuns(filter);
      } catch (e) {
        setOpsApiErrorBody(null);
        setError(e instanceof Error ? e.message : "Could not load runs.");
      }
    })();
  }, [canView, filter, loadRuns]);

  const cards = useMemo(() => {
    if (!summary) return [];
    const s = summary;
    return APIHUB_INGESTION_JOB_STATUSES.map((st) => ({
      key: st,
      label: st.charAt(0).toUpperCase() + st.slice(1),
      total: s.totals[st],
      trend: trendLabel(s.windows.last24h[st], s.windows.previous24h[st]),
    }));
  }, [summary]);

  if (!canView) {
    return (
      <section id="ingestion-ops" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Operator triage</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900">Ingestion runs</h2>
        <p className="mt-3 max-w-xl text-sm text-zinc-600">
          Choose a demo user in{" "}
          <Link href="/settings/demo" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            Settings → Demo session
          </Link>{" "}
          to load tenant-scoped run summaries and filters.
        </p>
      </section>
    );
  }

  return (
    <section id="ingestion-ops" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Operator triage</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">Ingestion runs</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Snapshot from the ops summary API plus quick status filters on the ingestion jobs list. Use{" "}
            <span className="font-medium text-zinc-800">Refresh</span> after pipeline or connector changes. Open{" "}
            <span className="font-medium text-zinc-800">View</span> on a run for timing, retries, apply fields, and
            automatic stale-reclaim notes; raw JSON stays under Advanced. Failed runs: with{" "}
            <span className="font-mono text-[11px] text-zinc-700">org.apihub → edit</span>, use{" "}
            <span className="font-medium text-zinc-800">Retry run</span> in the expanded detail.
          </p>
          {summary ? (
            <p className="mt-2 text-xs text-zinc-500">
              As of <span className="font-medium text-zinc-700">{formatWhen(summary.asOf)}</span> (tenant totals +
              24h windows).
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
          {opsApiErrorBody != null ? (
            <ApiHubAdvancedJsonDisclosure
              value={opsApiErrorBody}
              label="Advanced — ingestion ops API error body"
              description="From the most recent failed ops-summary or ingestion-jobs list request."
              maxHeightClass="max-h-56"
              dark={false}
            />
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">In flight</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{summary.inFlight}</p>
              <p className="mt-1 text-xs text-zinc-600">Queued + running</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total runs</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{summary.totalRuns}</p>
              <p className="mt-1 text-xs text-zinc-600">All lifecycle rows</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Last 24h (new runs)</p>
              <p className="mt-2 text-sm text-zinc-800">
                <span className="font-semibold tabular-nums">{summary.windows.last24h.failed}</span> failed ·{" "}
                <span className="font-semibold tabular-nums">{summary.windows.last24h.succeeded}</span> succeeded ·{" "}
                <span className="font-semibold tabular-nums">{summary.windows.last24h.running}</span> running ·{" "}
                <span className="font-semibold tabular-nums">{summary.windows.last24h.queued}</span> queued
              </p>
              <p className="mt-2 text-xs text-zinc-500">Window is by run `createdAt`, not finish time.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{c.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{c.total}</p>
                <p className="mt-1 text-xs text-zinc-600">{c.trend}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-zinc-600">No summary loaded yet — use Refresh.</p>
      )}

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quick filters</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === ""
                ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            All
          </button>
          {APIHUB_INGESTION_JOB_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
                filter === st
                  ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Run id</th>
              <th className="px-4 py-3">Connector</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Error code</th>
              <th className="px-4 py-3">Attempt</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 w-28">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-600">
                  No runs match this filter.
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">{r.id}</td>
                    <td
                      className="max-w-[7rem] truncate px-4 py-3 font-mono text-[11px] text-zinc-600"
                      title={r.connectorId ?? undefined}
                    >
                      {r.connectorId
                        ? r.connectorId.length > 12
                          ? `${r.connectorId.slice(0, 10)}…`
                          : r.connectorId
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td
                      className="max-w-[10rem] truncate px-4 py-3 font-mono text-[11px] text-zinc-700"
                      title={r.status === "failed" && r.errorCode ? r.errorCode : undefined}
                    >
                      {r.status === "failed" && r.errorCode ? r.errorCode : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.attempt}/{r.maxAttempts}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{r.triggerKind}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{formatWhen(r.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedRunId((cur) => (cur === r.id ? null : r.id))}
                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                        aria-expanded={expandedRunId === r.id}
                      >
                        {expandedRunId === r.id ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expandedRunId === r.id ? (
                    <tr className="bg-zinc-50/80">
                      <td colSpan={8} className="p-0">
                        <IngestionRunDetailExpand
                          runId={r.id}
                          canRetry={canEdit}
                          onRetryComplete={(info) => {
                            void (async () => {
                              setError(null);
                              setOpsApiErrorBody(null);
                              setBusy(true);
                              try {
                                const summaryOk = await loadSummary();
                                if (!summaryOk) return;
                                const runsOk = await loadRuns(filter);
                                if (!runsOk) return;
                                setExpandedRunId(info.newRunId);
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
