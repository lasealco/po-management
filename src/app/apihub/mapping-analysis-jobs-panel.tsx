"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";

type Props = {
  initialJobs: ApiHubMappingAnalysisJobDto[];
  canUse: boolean;
};

const SAMPLE_RECORDS = `[
  { "shipment": { "id": " sh-1 " }, "totals": { "amount": "42.5" } },
  { "shipment": { "id": "sh-2" }, "totals": { "amount": "12" } }
]`;

function terminal(status: string) {
  return status === "succeeded" || status === "failed";
}

export function MappingAnalysisJobsPanel({ initialJobs, canUse }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [recordsJson, setRecordsJson] = useState(SAMPLE_RECORDS);
  const [targetFieldsText, setTargetFieldsText] = useState("");
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ApiHubMappingAnalysisJobDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshJob = useCallback(async (id: string) => {
    const res = await fetch(`/api/apihub/mapping-analysis-jobs/${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(readApiHubErrorMessageFromJsonBody(data, "Could not load job."));
      return null;
    }
    const job = (data as { job: ApiHubMappingAnalysisJobDto }).job;
    setActiveJob(job);
    setJobs((prev) => {
      const rest = prev.filter((j) => j.id !== job.id);
      return [job, ...rest];
    });
    return job;
  }, []);

  useEffect(() => {
    return () => stopPoll();
  }, [stopPoll]);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    if (!activeId) {
      stopPoll();
      return;
    }
    void refreshJob(activeId);
    stopPoll();
    pollRef.current = setInterval(() => {
      void refreshJob(activeId).then((j) => {
        if (j && terminal(j.status)) {
          stopPoll();
        }
      });
    }, 900);
    return () => stopPoll();
  }, [activeId, refreshJob, stopPoll]);

  async function submitCreate() {
    setError(null);
    let records: unknown;
    try {
      records = JSON.parse(recordsJson.trim());
    } catch {
      setError("Records must be valid JSON (array of objects).");
      return;
    }
    const body: Record<string, unknown> = { records };
    const tf = targetFieldsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tf.length) {
      body.targetFields = tf;
    }
    if (note.trim()) {
      body.note = note.trim();
    }
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/mapping-analysis-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Create failed."));
        return;
      }
      const job = (data as { job: ApiHubMappingAnalysisJobDto }).job;
      setActiveId(job.id);
      setActiveJob(job);
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
    } finally {
      setBusy(false);
    }
  }

  async function runProcessNow() {
    if (!activeId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/apihub/mapping-analysis-jobs/${encodeURIComponent(activeId)}/process`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Process failed."));
        return;
      }
      const job = (data as { job: ApiHubMappingAnalysisJobDto }).job;
      setActiveJob(job);
      setJobs((prev) => {
        const rest = prev.filter((j) => j.id !== job.id);
        return [job, ...rest];
      });
    } finally {
      setBusy(false);
    }
  }

  if (!canUse) {
    return (
      <section id="mapping-analysis-jobs" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Mapping analysis jobs (P2)</h2>
        <p className="mt-2 text-sm text-zinc-600">Open Settings → Demo session to run async analysis jobs.</p>
      </section>
    );
  }

  return (
    <section id="mapping-analysis-jobs" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">P2 — Analysis</p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-900">Mapping analysis jobs</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">
        Queue a <span className="font-medium text-zinc-800">structured mapping proposal</span> from sample records.
        Jobs run asynchronously after submit (deterministic heuristic today; LLM slot later). Use{" "}
        <span className="font-medium">Process now</span> if the status stays queued locally.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sample records (JSON)</label>
          <textarea
            className="mt-2 h-48 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
            value={recordsJson}
            onChange={(e) => setRecordsJson(e.target.value)}
          />
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Target field hints (optional, comma or newline)
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            value={targetFieldsText}
            onChange={(e) => setTargetFieldsText(e.target.value)}
            placeholder="shipmentId, amount"
          />
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Note (optional)</label>
          <input
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitCreate()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
            >
              Queue analysis job
            </button>
            <button
              type="button"
              disabled={busy || !activeId || activeJob?.status !== "queued"}
              onClick={() => void runProcessNow()}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              Process now
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent jobs</p>
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
            {jobs.length === 0 ? <li className="text-zinc-500">No jobs yet.</li> : null}
            {jobs.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(j.id);
                    setActiveJob(j);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    activeId === j.id ? "border-[var(--arscmp-primary)] bg-white" : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="font-mono text-xs text-zinc-500">{j.id.slice(0, 12)}…</span>
                  <span className="ml-2 font-medium text-zinc-900">{j.status}</span>
                  <span className="ml-2 text-xs text-zinc-500">{j.input.recordCount} records</span>
                </button>
              </li>
            ))}
          </ul>

          {activeJob ? (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
              <p className="font-semibold text-zinc-900">Active job</p>
              <p className="mt-1 text-xs text-zinc-600">
                Status: <span className="font-medium text-zinc-800">{activeJob.status}</span>
                {activeJob.outputProposal ? (
                  <>
                    {" "}
                    · Engine: <span className="font-mono text-xs">{activeJob.outputProposal.engine}</span>
                  </>
                ) : null}
              </p>
              {activeJob.errorMessage ? <p className="mt-2 text-sm text-red-600">{activeJob.errorMessage}</p> : null}
              {activeJob.outputProposal ? (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Proposed rules</p>
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-50 p-2 font-mono text-[11px] text-zinc-800">
                    {JSON.stringify(activeJob.outputProposal.rules, null, 2)}
                  </pre>
                  {activeJob.outputProposal.stagingPreview ? (
                    <>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Staging preview</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {activeJob.outputProposal.stagingPreview.sampling.previewedRecords} of{" "}
                        {activeJob.outputProposal.stagingPreview.sampling.totalRecords} records sampled
                      </p>
                      <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-zinc-700">
                        {activeJob.outputProposal.stagingPreview.rows.slice(0, 6).map((row) => (
                          <li key={row.recordIndex} className="rounded border border-zinc-100 bg-zinc-50/80 px-2 py-1 font-mono">
                            #{row.recordIndex}: {JSON.stringify(row.mapped)}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    {activeJob.outputProposal.notes.slice(0, 3).join(" · ")}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
