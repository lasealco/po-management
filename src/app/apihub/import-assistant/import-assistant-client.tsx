"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import { APIHUB_MAPPING_ANALYSIS_NOTE_MAX } from "@/lib/apihub/constants";
import {
  IMPORT_ASSISTANT_DOMAINS,
  importAssistantDomainById,
  importAssistantNotePrefix,
  type ImportAssistantDomainId,
} from "@/lib/apihub/import-assistant-domains";
import { topImportAssistantDomainGuess } from "@/lib/apihub/import-assistant-domain-infer";
import { parseImportAssistantFileByName } from "@/lib/apihub/import-assistant-file-parse";
import { importAssistantConfidenceForRule } from "@/lib/apihub/import-assistant-rule-confidence";
import type { ApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";

import {
  buildImportAssistantChatContextPayload,
  ImportAssistantChatPanel,
} from "./import-assistant-chat-panel";
import type { ImportAssistantStep } from "./import-assistant-types";

type Props = {
  canEdit: boolean;
};

function terminalJobStatus(status: string) {
  return status === "succeeded" || status === "failed";
}

function xmlElementToValue(el: Element): unknown {
  const children = [...el.children];
  if (children.length === 0) {
    return el.textContent?.trim() ?? "";
  }
  const byTag = new Map<string, Element[]>();
  for (const ch of children) {
    const tag = ch.tagName;
    const list = byTag.get(tag) ?? [];
    list.push(ch);
    byTag.set(tag, list);
  }
  const out: Record<string, unknown> = {};
  for (const [tag, els] of byTag) {
    const key = tag.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    if (els.length === 1) {
      out[key] = xmlElementToValue(els[0]!);
    } else {
      out[key] = els.map((e) => xmlElementToValue(e));
    }
  }
  return out;
}

function recordsFromXmlString(xml: string): { ok: true; records: unknown[] } | { ok: false; message: string } {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const err = doc.querySelector("parsererror");
  if (err) {
    return { ok: false, message: "Could not parse XML. Check for a valid CargoWise or partner export." };
  }
  const root = doc.documentElement;
  if (!root) {
    return { ok: false, message: "XML has no root element." };
  }
  const top = xmlElementToValue(root);
  if (Array.isArray(top)) {
    const allObjs = top.every((x) => x !== null && typeof x === "object" && !Array.isArray(x));
    if (!allObjs) {
      return { ok: false, message: "XML top-level array must contain only objects for this assistant." };
    }
    return { ok: true, records: top };
  }
  if (top !== null && typeof top === "object") {
    const o = top as Record<string, unknown>;
    const vals = Object.values(o);
    const arrays = vals.filter((v): v is unknown[] => Array.isArray(v));
    if (arrays.length === 1) {
      const arr = arrays[0]!;
      const allObjs = arr.every((x) => x !== null && typeof x === "object" && !Array.isArray(x));
      if (allObjs && arr.length > 0) {
        return { ok: true, records: arr };
      }
    }
    return { ok: true, records: [top] };
  }
  return { ok: true, records: [{ value: top }] };
}

function confidenceLabel(c: string): { text: string; className: string } {
  if (c === "high") {
    return { text: "High", className: "border-emerald-200 bg-emerald-50 text-emerald-900" };
  }
  if (c === "medium") {
    return { text: "Medium", className: "border-amber-200 bg-amber-50 text-amber-900" };
  }
  return { text: "Confirm with you", className: "border-red-200 bg-red-50 text-red-900" };
}

export function ImportAssistantClient({ canEdit }: Props) {
  const router = useRouter();
  const [flowEpoch, setFlowEpoch] = useState(0);
  const [step, setStep] = useState<ImportAssistantStep>("domain");
  const [domain, setDomain] = useState<ImportAssistantDomainId | null>(null);
  const [userDoc, setUserDoc] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseMessage, setParseMessage] = useState<string | null>(null);
  const [records, setRecords] = useState<unknown[] | null>(null);
  const [guessDomain, setGuessDomain] = useState<ImportAssistantDomainId | null>(null);
  const [domainAligned, setDomainAligned] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ApiHubMappingAnalysisJobDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewAck, setReviewAck] = useState(false);
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
      setError(readApiHubErrorMessageFromJsonBody(data, "Could not load analysis job."));
      return null;
    }
    const j = (data as { job: ApiHubMappingAnalysisJobDto }).job;
    setJob(j);
    return j;
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  useEffect(() => {
    if (!jobId) {
      stopPoll();
      return;
    }
    void refreshJob(jobId);
    stopPoll();
    pollRef.current = setInterval(() => {
      void refreshJob(jobId).then((j) => {
        if (j && terminalJobStatus(j.status)) {
          stopPoll();
          if (j.status === "succeeded") {
            setStep("review");
          } else {
            setStep("analyze");
          }
        }
      });
    }, 900);
    return () => stopPoll();
  }, [jobId, refreshJob, stopPoll]);

  const domainMeta = domain ? importAssistantDomainById(domain) : null;
  const guessMeta = guessDomain ? importAssistantDomainById(guessDomain) : null;
  const keywordMismatch = Boolean(
    guessDomain && domain && guessDomain !== domain && guessDomain !== "other",
  );

  const ruleConfidences = useMemo(() => {
    if (!job?.outputProposal?.rules) return [];
    const notes = job.outputProposal.notes;
    return job.outputProposal.rules.map((rule) => ({
      rule,
      confidence: importAssistantConfidenceForRule(rule, notes),
    }));
  }, [job]);

  const needsConfirmationCount = useMemo(
    () => ruleConfidences.filter((r) => r.confidence === "needs_confirmation").length,
    [ruleConfidences],
  );

  const chatContextPayload = useMemo(
    () =>
      buildImportAssistantChatContextPayload({
        step,
        domainId: domain,
        domainTitle: domainMeta?.title ?? null,
        records,
        fileName,
        userDoc,
        guessDomainId: guessDomain,
        guessDomainTitle: guessMeta?.title ?? null,
        jobStatus: job?.status ?? null,
        proposedRuleCount: job?.outputProposal?.rules.length ?? null,
        mappingEngine: job?.outputProposal?.engine ?? null,
      }),
    [
      step,
      domain,
      domainMeta?.title,
      records,
      fileName,
      userDoc,
      guessDomain,
      guessMeta?.title,
      job?.status,
      job?.outputProposal?.rules.length,
      job?.outputProposal?.engine,
    ],
  );

  function resetFlow() {
    stopPoll();
    setFlowEpoch((e) => e + 1);
    setStep("domain");
    setDomain(null);
    setUserDoc("");
    setFileName(null);
    setParseMessage(null);
    setRecords(null);
    setGuessDomain(null);
    setDomainAligned(false);
    setJobId(null);
    setJob(null);
    setError(null);
    setBusy(false);
    setReviewAck(false);
  }

  function onPickDomain(id: ImportAssistantDomainId) {
    if (!canEdit) return;
    setDomain(id);
    setStep("upload");
    setRecords(null);
    setFileName(null);
    setParseMessage(null);
    setGuessDomain(null);
    setDomainAligned(false);
    setJobId(null);
    setJob(null);
    setReviewAck(false);
    setError(null);
  }

  async function onFileChange(file: File | null) {
    if (!canEdit) return;
    setParseMessage(null);
    setRecords(null);
    setGuessDomain(null);
    setDomainAligned(false);
    setError(null);
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    const lower = file.name.toLowerCase();
    let result:
      | { ok: true; records: unknown[] }
      | { ok: false; message: string };
    if (lower.endsWith(".xml")) {
      result = recordsFromXmlString(text);
    } else {
      const p = parseImportAssistantFileByName(file.name, text);
      if (!p.ok) {
        result = { ok: false, message: p.message };
      } else {
        result = { ok: true, records: p.records };
      }
    }
    if (!result.ok) {
      setParseMessage(result.message);
      return;
    }
    let nonObject = 0;
    for (const row of result.records) {
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        nonObject += 1;
      }
    }
    if (nonObject > 0) {
      setParseMessage(
        `Each row must be a plain object. ${nonObject} row(s) are not — try JSON, a simpler XML shape, or CSV.`,
      );
      return;
    }
    setRecords(result.records);
    setGuessDomain(topImportAssistantDomainGuess(result.records));
    setStep("confirm");
  }

  function confirmDomainAligned() {
    setDomainAligned(true);
    setStep("analyze");
  }

  async function runAnalysis() {
    if (!canEdit || !domain || !records?.length) return;
    setError(null);
    setBusy(true);
    setReviewAck(false);
    try {
      const prefix = importAssistantNotePrefix(domain);
      const headroom = APIHUB_MAPPING_ANALYSIS_NOTE_MAX - prefix.length - 8;
      const noteBody =
        userDoc.trim() && headroom > 0
          ? `${prefix}\n\nNotes:\n${userDoc.trim().slice(0, headroom)}`
          : prefix;
      const note = noteBody.slice(0, APIHUB_MAPPING_ANALYSIS_NOTE_MAX);
      const res = await fetch("/api/apihub/mapping-analysis-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not start analysis."));
        return;
      }
      const j = (data as { job: ApiHubMappingAnalysisJobDto }).job;
      setJobId(j.id);
      setJob(j);
      setStep("analyze");
    } finally {
      setBusy(false);
    }
  }

  async function processNow() {
    if (!canEdit || !jobId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/apihub/mapping-analysis-jobs/${encodeURIComponent(jobId)}/process`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Process failed."));
        return;
      }
      const j = (data as { job: ApiHubMappingAnalysisJobDto }).job;
      setJob(j);
      if (j.status === "succeeded") {
        setStep("review");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!canEdit || !jobId || !job || job.status !== "succeeded" || !job.outputProposal?.rules?.length) return;
    if (needsConfirmationCount > 0 && !reviewAck) return;
    const name = window.prompt("Template name:", `Import ${fileName ?? "file"}`.slice(0, 80));
    if (!name?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apihub/mapping-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), sourceMappingAnalysisJobId: jobId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not save template."));
        return;
      }
      router.refresh();
      setStep("connection");
    } finally {
      setBusy(false);
    }
  }

  async function materializeStaging() {
    if (!canEdit || !jobId || job?.status !== "succeeded") return;
    if (needsConfirmationCount > 0 && !reviewAck) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apihub/staging-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappingAnalysisJobId: jobId,
          title: `Assistant import ${jobId.slice(0, 8)}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Staging create failed."));
        return;
      }
      router.refresh();
      setStep("connection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,340px)] lg:items-start lg:gap-8">
        <div className="min-w-0">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Guided import</p>
          <h2 className="text-2xl font-semibold text-zinc-900">AI-assisted forwarder import</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            We do not guess your business purpose. You choose what this file is for, then we analyze structure and
            propose field mappings. Anything unclear is flagged for your confirmation before you save or stage data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/apihub"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Back to hub
          </Link>
          <button
            type="button"
            onClick={() => resetFlow()}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Start over
          </button>
          <a
            href="https://github.com/lasealco/po-management/blob/main/docs/apihub/import-assistant-dogfood.md"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            Dogfood checklist
          </a>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {(
            [
              ["domain", "1 — Purpose"],
              ["upload", "2 — File"],
              ["confirm", "3 — Check"],
              ["analyze", "4 — Analyze"],
              ["review", "5 — Review"],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                step === key || (key === "analyze" && step === "review") || (key === "review" && step === "connection")
                  ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)]/5 text-zinc-900"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </section>

      {!canEdit ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          View-only: ask an admin for <span className="font-mono text-xs">org.apihub → edit</span> to run analysis and
          save templates.
        </p>
      ) : null}

      {step === "domain" ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">What is this import about?</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Pick the closest match. We use this to ask the right follow-up questions — we do not auto-switch category
            later without you agreeing.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {IMPORT_ASSISTANT_DOMAINS.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={!canEdit}
                onClick={() => onPickDomain(d.id)}
                className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-left shadow-sm transition hover:border-[var(--arscmp-primary)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <p className="font-semibold text-zinc-900">{d.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600">{d.description}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "upload" && domainMeta ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Upload a sample file</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Purpose you selected: <span className="font-medium text-zinc-800">{domainMeta.title}</span>. Use a{" "}
            <span className="font-medium">redacted</span> sample if the file contains secrets. Supported:{" "}
            <span className="font-mono text-xs">.json</span>, <span className="font-mono text-xs">.csv</span>,{" "}
            <span className="font-mono text-xs">.xml</span>.
          </p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            File
            <input
              type="file"
              accept=".json,.csv,.xml,application/json,text/csv,text/xml,application/xml"
              className="mt-2 block w-full text-sm text-zinc-700"
              disabled={!canEdit}
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Notes or documentation (optional)
            <textarea
              className="mt-2 h-24 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              placeholder="Short excerpt is best — only the first part is kept on the analysis job note (server limit)."
              value={userDoc}
              onChange={(e) => setUserDoc(e.target.value)}
              disabled={!canEdit}
            />
          </label>
          {parseMessage ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {parseMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "confirm" && domainMeta && records ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Does this still match your purpose?</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Parsed <span className="font-semibold tabular-nums text-zinc-900">{records.length}</span> sample record
            {records.length === 1 ? "" : "s"} from <span className="font-mono text-xs">{fileName}</span>. Your category:{" "}
            <span className="font-medium text-zinc-800">{domainMeta.title}</span>.
          </p>
          {keywordMismatch && guessMeta ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Keyword check (non-binding)</p>
              <p className="mt-1">
                The sample mentions terms that often appear in <span className="font-medium">{guessMeta.title}</span>{" "}
                more than in <span className="font-medium">{domainMeta.title}</span>. We have{" "}
                <span className="font-medium">not</span> changed your selection.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950"
                  onClick={() => confirmDomainAligned()}
                >
                  Keep: {domainMeta.title}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white"
                  onClick={() => {
                    if (guessDomain) {
                      setDomain(guessDomain);
                    }
                    confirmDomainAligned();
                  }}
                >
                  Switch to: {guessMeta.title}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              {guessMeta && guessDomain === domain ? (
                <p>
                  Quick keyword scan aligns with <span className="font-medium">{domainMeta.title}</span> (sanity check
                  only).
                </p>
              ) : (
                <p>
                  No strong keyword signal for another category — if the sample is short or unusual, that is normal.
                </p>
              )}
              <button
                type="button"
                className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white"
                onClick={() => confirmDomainAligned()}
              >
                Looks right — continue
              </button>
            </div>
          )}
          {keywordMismatch ? null : (
            <p className="mt-3 text-xs text-zinc-500">
              If the file is not what you intended, go back and pick another purpose or upload a different sample.
            </p>
          )}
        </section>
      ) : null}

      {step === "analyze" && domainAligned ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Mapping analysis</h3>
          <p className="mt-2 text-sm text-zinc-600">
            The server proposes rules using the same pipeline as Mapping analysis jobs (heuristic and optional OpenAI
            assist). This can take a few seconds.
          </p>
          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!jobId ? (
              <button
                type="button"
                disabled={busy || !canEdit}
                onClick={() => void runAnalysis()}
                className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
              >
                Run analysis
              </button>
            ) : null}
            {jobId && job?.status === "queued" ? (
              <button
                type="button"
                disabled={busy || !canEdit}
                onClick={() => void processNow()}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
              >
                Process now
              </button>
            ) : null}
          </div>
          {job ? (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p>
                Status: <span className="font-semibold">{job.status}</span>
                {job.outputProposal ? (
                  <>
                    {" "}
                    · Engine <span className="font-mono text-xs">{job.outputProposal.engine}</span>
                  </>
                ) : null}
              </p>
              {job.errorMessage ? <p className="mt-2 text-red-700">{job.errorMessage}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === "review" && job?.outputProposal ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Origin → destination</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Each row is one mapping. <span className="font-medium">Confirm with you</span> means we should verify meaning
            with you or your forwarder before treating it as production truth.
          </p>
          {needsConfirmationCount > 0 ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900">
              <p className="font-semibold">{needsConfirmationCount} mapping(s) need explicit confirmation</p>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewAck}
                  onChange={(e) => setReviewAck(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I have reviewed the flagged rows and accept the proposal for a template or staging trial (you can
                  refine later in Mapping templates).
                </span>
              </label>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              No low-confidence identity mappings flagged — still review before production use.
            </p>
          )}
          <div className="mt-6 max-h-[28rem] space-y-2 overflow-y-auto">
            {ruleConfidences.map(({ rule, confidence }) => {
              const badge = confidenceLabel(confidence);
              return (
                <div
                  key={`${rule.sourcePath}-${rule.targetField}`}
                  className="grid gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 sm:grid-cols-[1fr_auto_1fr]"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Source (file)</p>
                    <p className="mt-1 font-mono text-xs text-zinc-900">{rule.sourcePath}</p>
                  </div>
                  <div className="flex items-center justify-center text-zinc-400">
                    <span className="text-lg" aria-hidden>
                      →
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Target (canonical)</p>
                    <p className="mt-1 font-mono text-xs text-zinc-900">{rule.targetField}</p>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      transform: <span className="font-mono">{rule.transform ?? "identity"}</span>
                      {rule.required ? " · required" : ""}
                    </p>
                  </div>
                  <div className="sm:col-span-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                      {badge.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                busy ||
                !canEdit ||
                job.status !== "succeeded" ||
                !job.outputProposal.rules.length ||
                (needsConfirmationCount > 0 && !reviewAck)
              }
              onClick={() => void saveTemplate()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
            >
              Save as mapping template
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !canEdit ||
                job.status !== "succeeded" ||
                (needsConfirmationCount > 0 && !reviewAck)
              }
              onClick={() => void materializeStaging()}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
            >
              Materialize staging batch
            </button>
            <button
              type="button"
              onClick={() => setStep("connection")}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800"
            >
              Connection options (next)
            </button>
          </div>
        </section>
      ) : null}

      {step === "connection" ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">How will files arrive in production?</h3>
          <p className="mt-2 text-sm text-zinc-600">
            We do not store passwords in this chat-style flow. Your administrator sets up connectors (SFTP, API, manual
            upload, etc.) under{" "}
            <Link href="/apihub#connectors" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              Connectors
            </Link>
            . Typical patterns:
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-zinc-700">
            <li>
              <span className="font-medium">Manual / upload</span> — you or partners upload when needed (good for
              pilots).
            </li>
            <li>
              <span className="font-medium">SFTP or FTPS</span> — scheduled drops to a secure folder (common with
              forwarders).
            </li>
            <li>
              <span className="font-medium">HTTPS API</span> — push or pull with URLs and credentials managed in
              settings.
            </li>
          </ul>
          <p className="mt-4 text-sm text-zinc-600">
            Bring this mapping template and a sample file to your IT contact to choose the right connector.
          </p>
          <Link
            href="/apihub#mapping-templates"
            className="mt-4 inline-flex rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
          >
            Open mapping templates on the hub
          </Link>
        </section>
      ) : null}
        </div>
        <ImportAssistantChatPanel flowEpoch={flowEpoch} contextPayload={chatContextPayload} />
      </div>
    </main>
  );
}
