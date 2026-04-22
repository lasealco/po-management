"use client";

import { useEffect, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import { APIHUB_INGESTION_ERROR_STALE_RUNNING } from "@/lib/apihub/constants";
import type { ApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";

import { ApiHubAdvancedJsonDisclosure } from "./apihub-advanced-json";

type ObservabilityDto = {
  timings: {
    queueWaitMs: number | null;
    runMs: number | null;
    totalMs: number | null;
    ageMs: number;
  };
  retries: {
    retryDepth: number;
    rootRunId: string;
    remainingAttempts: number;
  };
};

type RunDetailResponse = {
  run: ApiHubIngestionRunDto;
  observability: ObservabilityDto;
};

type TimelineEvent = {
  runId: string;
  attempt: number;
  status: string;
  at: string;
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

function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function tryApplyCountsFromResultSummary(
  raw: string | null,
): { created: number; updated: number; skipped: number } | null {
  if (raw == null || !String(raw).trim()) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(String(raw)) as unknown;
  } catch {
    return null;
  }
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  const nested =
    rec.targetSummary != null && typeof rec.targetSummary === "object" && !Array.isArray(rec.targetSummary)
      ? (rec.targetSummary as Record<string, unknown>)
      : rec;
  const read = (k: string): number | null => {
    const v = nested[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const n = Math.trunc(v);
    return n >= 0 && n <= 1_000_000_000 ? n : null;
  };
  const c = read("created");
  const u = read("updated");
  const s = read("skipped");
  if (c === null && u === null && s === null) return null;
  return { created: c ?? 0, updated: u ?? 0, skipped: s ?? 0 };
}

function tryMappedRowCount(raw: string | null): number | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const obj = JSON.parse(String(raw)) as unknown;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const rows = (obj as Record<string, unknown>).rows;
      if (Array.isArray(rows)) return rows.length;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function StepChip(props: {
  label: string;
  done: boolean;
  active?: boolean;
  variant?: "ok" | "bad" | "neutral";
}) {
  const { label, done, active, variant = "neutral" } = props;
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold";
  if (done && variant === "ok") {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-900`}>
        <span aria-hidden>✓</span> {label}
      </span>
    );
  }
  if (done && variant === "bad") {
    return (
      <span className={`${base} border-red-200 bg-red-50 text-red-900`}>
        <span aria-hidden>✕</span> {label}
      </span>
    );
  }
  if (active) {
    return (
      <span className={`${base} border-amber-200 bg-amber-50 text-amber-900`}>
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
        {label}
      </span>
    );
  }
  if (done) {
    return (
      <span className={`${base} border-zinc-200 bg-zinc-100 text-zinc-800`}>
        <span aria-hidden>✓</span> {label}
      </span>
    );
  }
  return <span className={`${base} border-dashed border-zinc-300 bg-white text-zinc-500`}>{label}</span>;
}

type Props = {
  runId: string;
  canRetry?: boolean;
  onRetryComplete?: (info: { newRunId: string; idempotentReplay: boolean }) => void;
};

export function IngestionRunDetailExpand({ runId, canRetry = false, onRetryComplete }: Props) {
  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runApiErrorBody, setRunApiErrorBody] = useState<unknown | null>(null);
  const [timelineApiErrorBody, setTimelineApiErrorBody] = useState<unknown | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryErrorBody, setRetryErrorBody] = useState<unknown | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRunApiErrorBody(null);
    setTimelineApiErrorBody(null);
    setDetail(null);
    setTimeline(null);

    void (async () => {
      try {
        const [runRes, tlRes] = await Promise.all([
          fetch(`/api/apihub/ingestion-jobs/${encodeURIComponent(runId)}`, { method: "GET" }),
          fetch(`/api/apihub/ingestion-jobs/${encodeURIComponent(runId)}/timeline?limit=12`, {
            method: "GET",
          }),
        ]);
        const runJson = await runRes.json().catch(() => ({}));
        if (!runRes.ok) {
          if (!cancelled) {
            setRunApiErrorBody(runJson);
            setError(readApiHubErrorMessageFromJsonBody(runJson, "Could not load run."));
          }
          return;
        }
        const tlJson = await tlRes.json().catch(() => ({}));
        const events =
          tlRes.ok && Array.isArray((tlJson as { events?: unknown }).events)
            ? ((tlJson as { events: TimelineEvent[] }).events ?? [])
            : [];
        const tlErr = !tlRes.ok ? tlJson : null;

        if (!cancelled) {
          setDetail(runJson as RunDetailResponse);
          setTimeline(events);
          setTimelineApiErrorBody(tlErr);
        }
      } catch (e) {
        if (!cancelled) {
          setRunApiErrorBody(null);
          setTimelineApiErrorBody(null);
          setError(e instanceof Error ? e.message : "Could not load run detail.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function handleRetry() {
    if (!canRetry || !onRetryComplete) return;
    setRetryBusy(true);
    setRetryError(null);
    setRetryErrorBody(null);
    try {
      const res = await fetch(`/api/apihub/ingestion-jobs/${encodeURIComponent(runId)}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRetryErrorBody(data);
        setRetryError(readApiHubErrorMessageFromJsonBody(data, "Retry request failed."));
        return;
      }
      const run = (data as { run?: { id?: string }; idempotentReplay?: boolean }).run;
      const newRunId = run && typeof run.id === "string" ? run.id : null;
      if (!newRunId) {
        setRetryError("Retry succeeded but response had no run id.");
        return;
      }
      onRetryComplete({
        newRunId,
        idempotentReplay: Boolean((data as { idempotentReplay?: boolean }).idempotentReplay),
      });
    } catch (e) {
      setRetryErrorBody(null);
      setRetryError(e instanceof Error ? e.message : "Retry request failed.");
    } finally {
      setRetryBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="border-t border-zinc-100 bg-zinc-50/90 px-4 py-6 text-sm text-zinc-600">
        Loading run detail…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-red-100 bg-red-50/80 px-4 py-4 text-sm text-red-800" role="alert">
        <p>{error}</p>
        {runApiErrorBody != null ? (
          <div className="mt-3">
            <ApiHubAdvancedJsonDisclosure
              value={runApiErrorBody}
              label="Advanced — run detail API error body"
              description="From GET …/ingestion-jobs/[id] when the response was not OK."
              maxHeightClass="max-h-56"
              dark={false}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const { run, observability } = detail;
  const t = observability.timings;
  const r = observability.retries;

  const enqueued = Boolean(run.enqueuedAt);
  const started = Boolean(run.startedAt);
  const finished = Boolean(run.finishedAt);
  const succeeded = run.status === "succeeded";
  const failed = run.status === "failed";
  const applied = Boolean(run.appliedAt);
  const runningNow = run.status === "running" || (started && !finished);

  const applyCounts = tryApplyCountsFromResultSummary(run.resultSummary);
  const mappedRows = tryMappedRowCount(run.resultSummary);

  const advancedPayload = { run, observability, timelinePreview: timeline ?? [] };

  return (
    <div className="border-t border-zinc-100 bg-zinc-50/90 px-4 py-5 text-sm text-zinc-800">
      {failed && canRetry && onRetryComplete ? (
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</p>
            <p className="mt-1 max-w-xl text-xs text-zinc-600">
              Queue a new run linked to this attempt (same connector and retry budget). Requires{" "}
              <span className="font-mono text-[11px]">org.apihub → edit</span>.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retryBusy || r.remainingAttempts <= 0}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
            >
              {retryBusy ? "Retrying…" : "Retry run"}
            </button>
            {r.remainingAttempts <= 0 ? (
              <p className="text-xs text-zinc-600">No retry budget left on this row (attempt cap reached).</p>
            ) : null}
            {retryError ? (
              <p className="max-w-md text-xs text-red-800" role="alert">
                {retryError}
              </p>
            ) : null}
            {retryErrorBody != null ? (
              <ApiHubAdvancedJsonDisclosure
                value={retryErrorBody}
                label="Advanced — retry API error body"
                description="From POST …/ingestion-jobs/[id]/retry when the response was not OK."
                maxHeightClass="max-h-48"
                dark={false}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {failed && !canRetry ? (
        <p className="mb-5 text-xs text-zinc-600">
          <span className="font-medium text-zinc-800">View-only:</span> failed runs can be retried via{" "}
          <span className="font-mono text-[11px]">POST …/ingestion-jobs/[id]/retry</span> when you have{" "}
          <span className="font-mono text-[11px]">org.apihub → edit</span>.
        </p>
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Run progress</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StepChip label="Enqueued" done={enqueued} />
        <StepChip label="Running" done={started} active={runningNow} />
        <StepChip
          label={failed ? "Failed" : "Finished"}
          done={finished}
          active={false}
          variant={failed ? "bad" : finished ? "ok" : "neutral"}
        />
        <StepChip
          label="Applied downstream"
          done={applied}
          variant={applied ? "ok" : "neutral"}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Timing</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-700">
            <li>
              <span className="text-zinc-500">Queue wait:</span> {formatMs(t.queueWaitMs)}
            </li>
            <li>
              <span className="text-zinc-500">Run time:</span> {formatMs(t.runMs)}
            </li>
            <li>
              <span className="text-zinc-500">Enqueue → finish:</span> {formatMs(t.totalMs)}
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Retries</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-700">
            <li>
              <span className="text-zinc-500">Attempt:</span>{" "}
              <span className="font-mono tabular-nums">
                {run.attempt}/{run.maxAttempts}
              </span>
            </li>
            <li>
              <span className="text-zinc-500">Remaining:</span> {r.remainingAttempts}
            </li>
            <li>
              <span className="text-zinc-500">Chain depth:</span> {r.retryDepth}
            </li>
            <li className="truncate" title={r.rootRunId}>
              <span className="text-zinc-500">Root run:</span>{" "}
              <span className="font-mono text-[11px]">{r.rootRunId}</span>
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pipeline output</p>
          {failed && (run.errorCode || run.errorMessage) ? (
            <p className="mt-2 text-xs text-red-800">
              {run.errorCode ? (
                <span className="font-mono font-semibold">{run.errorCode}</span>
              ) : null}
              {run.errorCode && run.errorMessage ? " · " : null}
              {run.errorMessage ?? ""}
            </p>
          ) : null}
          {failed && run.errorCode === APIHUB_INGESTION_ERROR_STALE_RUNNING ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/90 p-3 text-xs leading-relaxed text-zinc-700 shadow-sm">
              <p className="font-semibold text-zinc-900">Automatic stale reclaim</p>
              <p className="mt-1.5">
                The scheduled ApiHub worker marked this run failed after it stayed in{" "}
                <span className="font-medium">Running</span> longer than{" "}
                <span className="font-mono text-[11px]">APIHUB_INGESTION_RUN_STALE_RUNNING_MS</span> (default 24
                hours, configurable up to 7 days). This is not necessarily an application bug. Use{" "}
                <span className="font-mono text-[11px]">POST /api/apihub/ingestion-jobs/[id]/retry</span> when you are
                ready for another attempt.
              </p>
            </div>
          ) : null}
          {succeeded ? (
            <ul className="mt-2 space-y-1 text-xs text-zinc-700">
              {mappedRows != null ? (
                <li>
                  <span className="text-zinc-500">Mapped rows (from summary):</span>{" "}
                  <span className="font-semibold tabular-nums">{mappedRows}</span>
                </li>
              ) : null}
              {applyCounts ? (
                <li>
                  <span className="text-zinc-500">Last apply counts (if present):</span>{" "}
                  <span className="tabular-nums">
                    {applyCounts.created} created · {applyCounts.updated} updated · {applyCounts.skipped}{" "}
                    skipped
                  </span>
                </li>
              ) : (
                <li className="text-zinc-600">
                  No structured <span className="font-mono">created/updated/skipped</span> block in{" "}
                  <span className="font-mono">resultSummary</span> yet.
                </li>
              )}
              {applied ? (
                <li>
                  <span className="text-zinc-500">Marked applied:</span>{" "}
                  {run.appliedAt ? formatWhen(run.appliedAt) : "—"}
                </li>
              ) : succeeded ? (
                <li className="text-zinc-600">Not marked applied — downstream apply may not have run.</li>
              ) : null}
            </ul>
          ) : !failed ? (
            <p className="mt-2 text-xs text-zinc-600">Run not finished yet.</p>
          ) : null}
        </div>
      </div>

      {timelineApiErrorBody != null ? (
        <div className="mt-6 space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-xs text-amber-950">
          <p className="font-semibold text-amber-950">Timeline request failed; run summary above is still valid.</p>
          <ApiHubAdvancedJsonDisclosure
            value={timelineApiErrorBody}
            label="Advanced — timeline API error body"
            description="From GET …/ingestion-jobs/[id]/timeline when the response was not OK."
            maxHeightClass="max-h-48"
            dark={false}
          />
        </div>
      ) : null}

      {timeline && timeline.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Status timeline (retry tree)
          </p>
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white text-xs text-zinc-700">
            {timeline.map((ev, i) => (
              <li
                key={`${ev.runId}-${ev.at}-${ev.status}-${i}`}
                className="flex flex-wrap items-baseline gap-x-2 border-b border-zinc-100 px-3 py-2 last:border-b-0"
              >
                <span className="font-mono text-[10px] text-zinc-500">{formatWhen(ev.at)}</span>
                <span className="capitalize text-zinc-800">{ev.status}</span>
                <span className="text-zinc-500">
                  attempt {ev.attempt} ·{" "}
                  <span className="font-mono" title={ev.runId}>
                    {ev.runId.slice(0, 8)}…
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <ApiHubAdvancedJsonDisclosure
          value={advancedPayload}
          description="Full API payload for debugging. Operators usually do not need this."
        />
      </div>
    </div>
  );
}
