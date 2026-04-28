"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Candidate = {
  actionKind: string;
  recentCount: number;
  policy: {
    id: string;
    status: string;
    readinessScore: number;
    rollbackPlan: string | null;
  } | null;
  sampleAction: { id: string; label: string; status: string; payload: unknown } | null;
  readiness: {
    score: number;
    completionPct: number;
    rejectionPct: number;
    shadowMatchPct: number;
    canEnable: boolean;
    guardrails: Array<{ key: string; label: string; passed: boolean; detail: string }>;
  };
  recommendedStatus: string;
};

type Payload = {
  generatedAt: string;
  releaseGate: { status: string; score: number; evaluatedAt: string } | null;
  evidenceCoveragePct: number;
  candidates: Candidate[];
  policies: Array<{
    id: string;
    actionKind: string;
    label: string;
    status: string;
    readinessScore: number;
    rollbackPlan: string | null;
    enabledAt: string | null;
    pausedAt: string | null;
  }>;
  shadowRuns: Array<{
    id: string;
    actionKind: string;
    predictedStatus: string;
    humanStatus: string | null;
    matched: boolean | null;
    runMode: string;
    notes: string | null;
    createdAt: string;
  }>;
};

const statusClass: Record<string, string> = {
  SHADOW: "border-sky-200 bg-sky-50 text-sky-900",
  ENABLED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-950",
  DISABLED: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

export function AssistantGovernedAutomationClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/assistant/governed-automation");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load governed automation."));
      return;
    }
    setData(raw as Payload);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>) {
    setBusy(`${action}:${String(body.actionKind ?? "")}`);
    setError(null);
    const res = await fetch("/api/assistant/governed-automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update governed automation."));
      return;
    }
    await load();
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
        Loading AMP8 governed automation...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP8</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Governed automation</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Move from shadow automation to controlled automation only when human decision history, evidence, release gate, and rollback guardrails pass.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">
            Refresh
          </button>
        </div>
        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">AMP7 release gate</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">{data.releaseGate?.status ?? "NOT EVALUATED"}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Evidence coverage</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">{data.evidenceCoveragePct}%</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Policies</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">{data.policies.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-950">Automation candidates</h3>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {data.candidates.map((candidate) => {
            const status = candidate.policy?.status ?? "NO POLICY";
            return (
              <article key={candidate.actionKind} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-950">{candidate.actionKind}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {candidate.recentCount} recent actions · readiness {candidate.readiness.score}/100 · shadow match {candidate.readiness.shadowMatchPct}%
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass[status] ?? "border-zinc-200 bg-white text-zinc-700"}`}>
                    {status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {candidate.readiness.guardrails.map((guardrail) => (
                    <div key={guardrail.key} className={`rounded-xl border p-2 text-xs ${guardrail.passed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
                      <span className="font-semibold">{guardrail.label}</span> · {guardrail.detail}
                    </div>
                  ))}
                </div>
                {candidate.policy?.rollbackPlan ? (
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                    {candidate.policy.rollbackPlan}
                  </pre>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    disabled={busy === `save_policy:${candidate.actionKind}`}
                    onClick={() => void post("save_policy", { actionKind: candidate.actionKind })}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
                  >
                    Create shadow policy
                  </button>
                  <button
                    disabled={busy === `record_shadow_run:${candidate.actionKind}`}
                    onClick={() =>
                      void post("record_shadow_run", {
                        actionKind: candidate.actionKind,
                        actionQueueItemId: candidate.sampleAction?.id ?? null,
                        predictedStatus: "DONE",
                        humanStatus: candidate.sampleAction?.status ?? null,
                        wouldExecutePayload: candidate.sampleAction?.payload ?? {},
                        notes: "Shadow comparison recorded from AMP8 workspace.",
                      })
                    }
                    className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Record shadow run
                  </button>
                  <button
                    disabled={!candidate.readiness.canEnable || busy === `set_status:${candidate.actionKind}`}
                    onClick={() => void post("set_status", { actionKind: candidate.actionKind, status: "ENABLED" })}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50"
                  >
                    Enable controlled
                  </button>
                  <button
                    disabled={busy === `set_status:${candidate.actionKind}`}
                    onClick={() => void post("set_status", { actionKind: candidate.actionKind, status: "PAUSED" })}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50"
                  >
                    Pause / rollback
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-950">Shadow run journal</h3>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {data.shadowRuns.map((run) => (
            <div key={run.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-zinc-900">{run.actionKind}</p>
                <span className={run.matched ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-700"}>
                  {run.matched == null ? "pending human decision" : run.matched ? "matched" : "mismatch"}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Predicted {run.predictedStatus} · human {run.humanStatus ?? "n/a"} · {new Date(run.createdAt).toLocaleString()}
              </p>
              {run.notes ? <p className="mt-1 text-xs text-zinc-600">{run.notes}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
