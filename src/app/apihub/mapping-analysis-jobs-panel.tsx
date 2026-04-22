"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";

import { ApiHubAdvancedJsonDisclosure } from "./apihub-advanced-json";

type Props = {
  initialJobs: ApiHubMappingAnalysisJobDto[];
  canView: boolean;
  canEdit: boolean;
};

const SAMPLE_RECORDS = `[
  { "shipment": { "id": " sh-1 " }, "totals": { "amount": "42.5" } },
  { "shipment": { "id": "sh-2" }, "totals": { "amount": "12" } }
]`;

function terminal(status: string) {
  return status === "succeeded" || status === "failed";
}

function formatJobCreatedShort(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type RecordsDraftPreview =
  | { kind: "empty" }
  | { kind: "parse_error"; message: string }
  | { kind: "not_array"; message: string }
  | { kind: "ok"; count: number; nonObjectCount: number };

function recordsDraftPreviewFromJson(recordsJson: string): RecordsDraftPreview {
  const t = recordsJson.trim();
  if (!t) return { kind: "empty" };
  try {
    const v: unknown = JSON.parse(t);
    if (!Array.isArray(v)) {
      return { kind: "not_array", message: "Records must be a JSON array of objects." };
    }
    let nonObjectCount = 0;
    for (const item of v) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        nonObjectCount += 1;
      }
    }
    return { kind: "ok", count: v.length, nonObjectCount };
  } catch {
    return { kind: "parse_error", message: "Invalid JSON — fix syntax before queueing." };
  }
}

function MappingAnalysisRecordsDraftPreview({ preview }: { preview: RecordsDraftPreview }) {
  if (preview.kind === "empty") {
    return (
      <div className="mt-2 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-xs text-zinc-600">
        Paste a JSON array of sample record objects. The server expects the same shape you submit.
      </div>
    );
  }
  if (preview.kind === "parse_error" || preview.kind === "not_array") {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
        {preview.message}
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2 text-xs text-zinc-800 shadow-sm">
      <p className="font-semibold uppercase tracking-wide text-zinc-500">Draft check (client)</p>
      <p className="mt-1">
        <span className="tabular-nums font-semibold text-zinc-900">{preview.count}</span> element
        {preview.count === 1 ? "" : "s"} in the array.
      </p>
      {preview.nonObjectCount > 0 ? (
        <p className="mt-1 text-amber-900">
          {preview.nonObjectCount} entr{preview.nonObjectCount === 1 ? "y is" : "ies are"} not plain objects — the API may reject or skip them.
        </p>
      ) : null}
    </div>
  );
}

export function MappingAnalysisJobsPanel({ initialJobs, canView, canEdit }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [recordsJson, setRecordsJson] = useState(SAMPLE_RECORDS);
  const [targetFieldsText, setTargetFieldsText] = useState("");
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ApiHubMappingAnalysisJobDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysisApiErrorBody, setAnalysisApiErrorBody] = useState<unknown | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordsDraftPreview = useMemo(() => recordsDraftPreviewFromJson(recordsJson), [recordsJson]);

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
      setAnalysisApiErrorBody(data);
      setError(readApiHubErrorMessageFromJsonBody(data, "Could not load job."));
      return null;
    }
    setAnalysisApiErrorBody(null);
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
    if (!canEdit) return;
    setError(null);
    setAnalysisApiErrorBody(null);
    setInfo(null);
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
        setAnalysisApiErrorBody(data);
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

  async function saveProposedRulesAsTemplate() {
    if (!canEdit || !activeId || !activeJob || activeJob.status !== "succeeded" || !activeJob.outputProposal?.rules?.length) {
      return;
    }
    const name = window.prompt("Template name (saved from this analysis job):", `Analysis ${activeId.slice(0, 8)}`);
    if (!name || !name.trim()) {
      return;
    }
    setError(null);
    setAnalysisApiErrorBody(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/mapping-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sourceMappingAnalysisJobId: activeId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAnalysisApiErrorBody(data);
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not create template."));
        return;
      }
      setInfo("Mapping template created from this job. Open Mapping templates below to edit or audit.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function materializeStaging() {
    if (!canEdit || !activeId || !activeJob || activeJob.status !== "succeeded") return;
    setError(null);
    setAnalysisApiErrorBody(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/staging-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappingAnalysisJobId: activeId,
          title: `From analysis ${activeId.slice(0, 8)}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAnalysisApiErrorBody(data);
        setError(readApiHubErrorMessageFromJsonBody(data, "Staging batch create failed."));
        return;
      }
      setInfo("Staging batch created. Refresh the staging list below if it is open.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runProcessNow() {
    if (!canEdit || !activeId) return;
    setError(null);
    setAnalysisApiErrorBody(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/apihub/mapping-analysis-jobs/${encodeURIComponent(activeId)}/process`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAnalysisApiErrorBody(data);
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

  if (!canView) {
    return (
      <section id="mapping-analysis-jobs" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Mapping analysis jobs (P2)</h2>
        <p className="mt-2 text-sm text-zinc-600">You need Integration hub access (org.apihub → view).</p>
      </section>
    );
  }

  return (
    <section id="mapping-analysis-jobs" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">P2 — Analysis</p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-900">Mapping analysis jobs</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">
        Queue a <span className="font-medium text-zinc-800">structured mapping proposal</span> from sample records.
        Jobs run asynchronously after submit: deterministic heuristic plus optional OpenAI JSON assist when{" "}
        <span className="font-mono text-[11px] text-zinc-700">APIHUB_OPENAI_API_KEY</span> or{" "}
        <span className="font-mono text-[11px] text-zinc-700">OPENAI_API_KEY</span> is set server-side. Use{" "}
        <span className="font-medium">Process now</span> if the status stays queued locally. Stuck{" "}
        <span className="font-medium">processing</span> rows are requeued by the scheduled ApiHub cron after{" "}
        <span className="font-mono text-[11px] text-zinc-700">APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS</span>{" "}
        (default 15m). Use <span className="font-medium">Materialize staging</span> after success to persist capped rows
        for APIs.
      </p>
      {!canEdit ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          View-only: your role has org.apihub → view but not edit. Queue, process, and materialize require org.apihub →
          edit.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sample records (JSON)</label>
          <MappingAnalysisRecordsDraftPreview preview={recordsDraftPreview} />
          <textarea
            className="mt-2 h-48 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 disabled:opacity-60"
            value={recordsJson}
            onChange={(e) => setRecordsJson(e.target.value)}
            disabled={!canEdit}
          />
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Target field hints (optional, comma or newline)
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60"
            value={targetFieldsText}
            onChange={(e) => setTargetFieldsText(e.target.value)}
            placeholder="shipmentId, amount"
            disabled={!canEdit}
          />
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Note (optional)</label>
          <input
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canEdit}
          />
          {error ? (
            <div className="mt-3 space-y-3">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
              {analysisApiErrorBody != null ? (
                <ApiHubAdvancedJsonDisclosure
                  value={analysisApiErrorBody}
                  label="Advanced — last analysis API error body"
                  description="From the most recent failed mapping-analysis or related request on this panel."
                  maxHeightClass="max-h-56"
                  dark={false}
                />
              ) : null}
            </div>
          ) : null}
          {info ? <p className="mt-3 text-sm text-emerald-800">{info}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !canEdit}
              onClick={() => void submitCreate()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
            >
              Queue analysis job
            </button>
            <button
              type="button"
              disabled={busy || !canEdit || !activeId || activeJob?.status !== "queued"}
              onClick={() => void runProcessNow()}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              Process now
            </button>
            <button
              type="button"
              disabled={busy || !canEdit || !activeId || activeJob?.status !== "succeeded"}
              onClick={() => void materializeStaging()}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              Materialize staging
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !canEdit ||
                !activeId ||
                activeJob?.status !== "succeeded" ||
                !(activeJob?.outputProposal?.rules && activeJob.outputProposal.rules.length > 0)
              }
              onClick={() => void saveProposedRulesAsTemplate()}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              Save rules as template
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
                    setError(null);
                    setAnalysisApiErrorBody(null);
                    setActiveId(j.id);
                    setActiveJob(j);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    activeId === j.id ? "border-[var(--arscmp-primary)] bg-white" : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-mono text-xs text-zinc-500">{j.id.slice(0, 12)}…</span>
                    <span className="font-medium text-zinc-900">{j.status}</span>
                    <span className="text-xs text-zinc-500">{j.input.recordCount} records</span>
                    <span className="text-[11px] text-zinc-500" title={j.createdAt}>
                      {formatJobCreatedShort(j.createdAt)}
                    </span>
                  </div>
                  {j.status === "failed" && j.errorMessage ? (
                    <p
                      className="mt-1 line-clamp-2 text-[11px] leading-snug text-red-700"
                      title={j.errorMessage}
                    >
                      {j.errorMessage}
                    </p>
                  ) : null}
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
              {activeJob.outputProposal?.llm ? (
                <p className="mt-2 text-xs text-zinc-600">
                  LLM:{" "}
                  {activeJob.outputProposal.llm.used ? (
                    <span className="font-medium text-emerald-800">used</span>
                  ) : activeJob.outputProposal.llm.attempted ? (
                    <span className="font-medium text-amber-800">attempted, fell back</span>
                  ) : (
                    <span className="font-medium text-zinc-700">not attempted</span>
                  )}
                  {activeJob.outputProposal.llm.model ? (
                    <>
                      {" "}
                      · model <span className="font-mono text-[11px]">{activeJob.outputProposal.llm.model}</span>
                    </>
                  ) : null}
                  {activeJob.outputProposal.llm.error ? (
                    <>
                      {" "}
                      · <span className="text-red-700">{activeJob.outputProposal.llm.error}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
              {activeJob.errorMessage ? <p className="mt-2 text-sm text-red-600">{activeJob.errorMessage}</p> : null}
              {activeJob.status === "processing" ? (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2 text-xs leading-relaxed text-zinc-700">
                  <p className="font-semibold text-zinc-900">While processing</p>
                  <p className="mt-1">
                    Most jobs finish quickly. If this stays in <span className="font-medium">processing</span> after a
                    deploy or timeout, the ApiHub cron (about every 10 minutes on Pro) resets stale rows to{" "}
                    <span className="font-medium">queued</span> using{" "}
                    <span className="font-mono text-[11px]">APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS</span> (default
                    15m), then drains the queue. You can still use <span className="font-medium">Process now</span> when
                    the job is <span className="font-medium">queued</span>.
                  </p>
                </div>
              ) : null}
              {activeJob.outputProposal ? (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Proposed rules</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    <span className="font-semibold tabular-nums text-zinc-800">
                      {activeJob.outputProposal.rules.length}
                    </span>{" "}
                    rule{activeJob.outputProposal.rules.length === 1 ? "" : "s"}
                  </p>
                  {activeJob.outputProposal.rules.length > 0 ? (
                    <ul className="mt-2 flex max-h-20 flex-wrap gap-1 overflow-y-auto text-xs">
                      {activeJob.outputProposal.rules.map((rule, idx) => (
                        <li
                          key={`${idx}-${rule.targetField}-${rule.sourcePath}`}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-800"
                          title={rule.sourcePath}
                        >
                          {rule.targetField}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-2">
                    <ApiHubAdvancedJsonDisclosure
                      value={activeJob.outputProposal.rules}
                      label="Advanced — proposed rules JSON"
                      maxHeightClass="max-h-48"
                      dark={false}
                    />
                  </div>
                  {activeJob.outputProposal.stagingPreview ? (
                    <>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Staging preview</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {activeJob.outputProposal.stagingPreview.sampling.previewedRecords} of{" "}
                        {activeJob.outputProposal.stagingPreview.sampling.totalRecords} records sampled
                      </p>
                      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-zinc-700">
                        {activeJob.outputProposal.stagingPreview.rows.slice(0, 6).map((row) => {
                          const mapped = row.mapped as unknown;
                          const fieldKeys =
                            mapped && typeof mapped === "object" && !Array.isArray(mapped)
                              ? Object.keys(mapped as Record<string, unknown>)
                              : [];
                          const previewKeys = fieldKeys.slice(0, 10).join(", ");
                          return (
                            <li
                              key={row.recordIndex}
                              className="rounded border border-zinc-100 bg-zinc-50/80 px-2 py-2"
                            >
                              <p className="font-semibold text-zinc-900">Record {row.recordIndex}</p>
                              {previewKeys ? (
                                <p className="mt-1 text-[11px] text-zinc-600">
                                  Fields: {previewKeys}
                                  {fieldKeys.length > 10 ? "…" : ""}
                                </p>
                              ) : (
                                <p className="mt-1 text-[11px] text-zinc-500">No mapped object on this row.</p>
                              )}
                              <div className="mt-2">
                                <ApiHubAdvancedJsonDisclosure
                                  value={row.mapped}
                                  label="Advanced — mapped record JSON"
                                  maxHeightClass="max-h-40"
                                  dark={false}
                                />
                              </div>
                            </li>
                          );
                        })}
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
