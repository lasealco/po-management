"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type WeakAnswer = {
  id: string;
  prompt: string;
  answerKind: string;
  message: string | null;
  feedback: string | null;
  objectType: string | null;
  objectId: string | null;
  actorName: string;
  evidenceItems: Array<{ label: string; href: string | null; excerpt: string | null }>;
  createdAt: string;
};
type PromptItem = {
  id: string;
  title: string;
  prompt: string;
  roleScope: string | null;
  domain: string | null;
  objectType: string | null;
  status: string;
  usageCount: number;
  updatedAt: string;
};
type EvidenceQualityPayload = {
  generatedAt: string;
  metrics: Record<string, number>;
  weakAnswers: WeakAnswer[];
  evidenceRecords: Array<{ id: string; auditEventId: string | null; label: string; href: string | null; sourceType: string; confidence: string; createdAt: string }>;
  reviewExamples: Array<{ id: string; auditEventId: string; label: string; correctionNote: string | null; status: string; updatedAt: string }>;
  promptLibrary: PromptItem[];
  releaseGate: {
    score: number;
    threshold: number;
    status: string;
    checks: Array<{ key: string; label: string; passed: boolean; metric: string; weight: number }>;
    latestSaved: { id: string; status: string; score: number; threshold: number; evaluatedAt: string } | null;
  };
};

export function AssistantEvidenceQualityClient() {
  const [data, setData] = useState<EvidenceQualityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [promptTitle, setPromptTitle] = useState("Review late shipment risk");
  const [promptText, setPromptText] = useState("Review this shipment for customer impact, recovery options, and evidence links.");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/assistant/evidence-quality");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load evidence quality workspace."));
      return;
    }
    setData(raw as EvidenceQualityPayload);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    const res = await fetch("/api/assistant/evidence-quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update evidence quality workspace."));
      return;
    }
    await load();
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
        Loading AMP7 evidence quality...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP7</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Evidence, quality, and training</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Inspect evidence, review weak answers, create prompt starters, and run a release gate before assistant changes ship.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">
            Refresh
          </button>
        </div>
        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {Object.entries(data.metrics).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">{key}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-950">Release gate</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Current score {data.releaseGate.score}/{data.releaseGate.threshold}:{" "}
              <span className={data.releaseGate.status === "PASSED" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                {data.releaseGate.status}
              </span>
            </p>
          </div>
          <button
            type="button"
            disabled={busy === "evaluate_gate"}
            onClick={() => void post("evaluate_gate", { notes: "Evaluated from AMP7 workspace." })}
            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Evaluate and save gate
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.releaseGate.checks.map((check) => (
            <div key={check.key} className={`rounded-xl border p-3 ${check.passed ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              <p className="font-semibold text-zinc-950">{check.label}</p>
              <p className="mt-1 text-sm text-zinc-600">{check.metric}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-950">Weak-answer review queue</h3>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {data.weakAnswers.map((answer) => (
            <article key={answer.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-950">{answer.prompt.length > 120 ? `${answer.prompt.slice(0, 120)}...` : answer.prompt}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {answer.answerKind} · {answer.feedback ?? "no feedback"} · {answer.actorName}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-amber-950">
                  {answer.evidenceItems.length} evidence
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-700">{answer.message ?? "No answer text stored."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={busy === "record_review"}
                  onClick={() =>
                    void post("record_review", {
                      auditEventId: answer.id,
                      label: "CORRECTION",
                      correctionNote: "Reviewed in AMP7: add stronger evidence and object-specific answer before reuse.",
                    })
                  }
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50"
                >
                  Queue correction example
                </button>
                <button
                  disabled={busy === "attach_evidence"}
                  onClick={() =>
                    void post("attach_evidence", {
                      auditEventId: answer.id,
                      label: answer.objectType ? `${answer.objectType}:${answer.objectId ?? "object"}` : "Manual reviewer evidence",
                      href: answer.objectType && answer.objectId ? `/${answer.objectType}/${answer.objectId}` : null,
                      sourceType: "REVIEWER",
                      confidence: "MEDIUM",
                    })
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Add evidence
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Prompt library</h3>
          <div className="mt-3 space-y-2">
            {data.promptLibrary.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.title}</p>
                    <p className="text-xs text-zinc-500">
                      {item.status} · {item.domain ?? "general"} · used {item.usageCount}
                    </p>
                  </div>
                  <Link href={`/assistant?prompt=${encodeURIComponent(item.prompt)}&run=1`} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                    Run
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-3">
            <input value={promptTitle} onChange={(event) => setPromptTitle(event.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <button
              disabled={busy === "save_prompt"}
              onClick={() => void post("save_prompt", { title: promptTitle, prompt: promptText, status: "APPROVED", domain: "operations" })}
              className="mt-2 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save approved prompt
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Evidence ledger and examples</h3>
          <div className="mt-3 space-y-2">
            {data.evidenceRecords.slice(0, 10).map((record) => (
              <div key={record.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
                <p className="font-semibold text-zinc-900">{record.label}</p>
                <p className="text-xs text-zinc-500">
                  {record.sourceType} · {record.confidence} · {new Date(record.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {data.reviewExamples.slice(0, 8).map((example) => (
              <div key={example.id} className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm">
                <p className="font-semibold text-zinc-900">{example.label}</p>
                <p className="text-xs text-zinc-500">
                  {example.status} · {example.correctionNote ?? "No correction note"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
