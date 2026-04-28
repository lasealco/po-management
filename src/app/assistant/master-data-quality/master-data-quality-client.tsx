"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    records: number;
    stagingConflicts: number;
    previewQualityScore: number;
    previewBlockers: number;
  };
  preview: {
    qualityScore: number;
    duplicateCount: number;
    gapCount: number;
    staleCount: number;
    conflictCount: number;
    enrichmentPlan: { steps?: Array<{ step: string; owner: string; action: string }> };
  };
  runs: Array<{
    id: string;
    title: string;
    status: string;
    qualityScore: number;
    duplicateCount: number;
    gapCount: number;
    staleCount: number;
    conflictCount: number;
    summaryJson: unknown;
    duplicateGroupsJson: unknown;
    gapAnalysisJson: unknown;
    staleRecordsJson: unknown;
    conflictJson: unknown;
    enrichmentPlanJson: unknown;
    actionQueueItemId: string | null;
    approvedAt: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key?: string): T[] {
  const next = key && value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;
  return Array.isArray(next) ? (next as T[]) : [];
}

function readNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object") return 0;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "number" ? next : 0;
}

export function MasterDataQualityClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/master-data-quality", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load master data quality."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.runId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/master-data-quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update master data quality."));
      return;
    }
    setMessage(success);
    if (raw && typeof raw === "object" && "snapshot" in raw) setData((raw as { snapshot: Snapshot }).snapshot);
    else await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP21</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Master Data Quality</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Scan products, suppliers, CRM accounts, locations, and API Hub staging rows for duplicates, missing fields,
          stale records, and mapping conflicts. The assistant proposes cleanup work and queues approvals, but never
          overwrites canonical master data automatically.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Scan records", "Products, suppliers, customers, warehouses, and staging rows."],
            ["Step 2", "Prioritize hygiene", "Duplicates, completeness gaps, stale data, and mapping conflicts."],
            ["Step 3", "Approve cleanup", "Queue dedupe and enrichment work for human governance."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={busy === "create_scan"}
          onClick={() => void post("create_scan", {}, "Master data quality scan created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create quality scan
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Scanned records", data.signals.records],
          ["Quality score", data.signals.previewQualityScore],
          ["Open blockers", data.signals.previewBlockers],
          ["Staging conflicts", data.signals.stagingConflicts],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Hygiene Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.qualityScore}/100 · duplicates {data.preview.duplicateCount} · gaps {data.preview.gapCount} · stale {data.preview.staleCount} · conflicts {data.preview.conflictCount}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(data.preview.enrichmentPlan.steps ?? []).map((step) => (
            <div key={step.step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">{step.step}</p>
              <p className="mt-1 text-sm text-zinc-600">{step.owner}: {step.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Quality Runs</h3>
        <div className="mt-4 space-y-4">
          {data.runs.map((run) => {
            const duplicateGroups = readArray<{ domain: string; labels: string[]; count: number; severity: string }>(run.duplicateGroupsJson);
            const gaps = readArray<{ domain: string; label: string; missing: string[]; severity: string }>(run.gapAnalysisJson);
            const conflicts = readArray<{ label: string; issues: string[]; severity: string }>(run.conflictJson);
            const recordCount = readNumber(run.summaryJson, "recordCount");
            const steps = readArray<{ step: string; owner: string; action: string }>(run.enrichmentPlanJson, "steps");
            return (
              <article key={run.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {run.status} · score {run.qualityScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{run.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      {recordCount} records · duplicates {run.duplicateCount} · gaps {run.gapCount} · stale {run.staleCount} · conflicts {run.conflictCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(run.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === run.id || run.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_review", { runId: run.id, approvalNote: approvalNotes[run.id] ?? "" }, "Master data quality review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Duplicates</p>
                    <p className="mt-1">{duplicateGroups.slice(0, 3).map((item) => `${item.domain} ${item.labels.join(" / ")} (${item.count})`).join(", ") || "None detected"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Gaps</p>
                    <p className="mt-1">{gaps.slice(0, 3).map((item) => `${item.label}: ${item.missing.join(", ")}`).join("; ") || "None detected"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Staging conflicts</p>
                    <p className="mt-1">{conflicts.slice(0, 3).map((item) => `${item.label}: ${item.issues.join(", ")}`).join("; ") || "None detected"}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-white p-3 text-sm text-zinc-700">
                  <p className="font-semibold text-zinc-950">Governance plan</p>
                  <ul className="mt-2 space-y-1">
                    {steps.map((step) => (
                      <li key={step.step}>{step.step}: {step.action}</li>
                    ))}
                  </ul>
                </div>
                <textarea
                  value={approvalNotes[run.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [run.id]: event.target.value }))}
                  placeholder="Optional governance approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.runs.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No master data quality runs yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
