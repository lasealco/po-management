"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Loop = {
  id: string;
  title: string;
  status: string;
  loopScore: number;
  automationMode: string;
  observedSignalCount: number;
  decisionCount: number;
  proposedActionCount: number;
  approvedAutomationCount: number;
  anomalyCount: number;
  learningCount: number;
  observeJson: unknown;
  decideJson: unknown;
  actJson: unknown;
  learnJson: unknown;
  policyJson: unknown;
  outcomeJson: unknown;
  rollbackJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Snapshot = {
  signals: {
    observed: number;
    policies: number;
    shadowRuns: number;
    previewLoopScore: number;
    previewMode: string;
    anomalies: number;
  };
  preview: {
    loopScore: number;
    automationMode: string;
    observedSignalCount: number;
    decisionCount: number;
    proposedActionCount: number;
    approvedAutomationCount: number;
    anomalyCount: number;
    learningCount: number;
    observe: { anomalies: Array<{ sourceType: string; domain: string; severity: string; detail: string }>; byDomain: Record<string, { count: number; maxSeverity: string }> };
    decide: { decisions: Array<{ domain: string; decision: string; severity: string; reason: string }> };
    act: { proposedActions: Array<{ actionKind: string; domain: string; executionMode: string; guardrail: string }> };
    learn: { learnings: Array<{ type: string; count: number; recommendation: string }> };
    policy: { automationMode: string; allowedActions: string[]; blockedReasons: string[]; shadowMatchRatePct: number };
    outcome: { pendingActions: number; doneActions: number; successMetric: string };
    rollback: { steps: string[]; killSwitchActive: boolean };
    leadershipSummary: string;
  };
  loops: Loop[];
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function AutonomousLoopClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/autonomous-loop", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load autonomous loop."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.loopId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/autonomous-loop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update autonomous loop."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP32</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Autonomous Supply-Chain Operating Loop</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Run a governed observe, decide, act, and learn loop across assistant signals, action queue work, observability,
          automation policy, release gates, playbooks, and value outcomes. Execution stays approval-gated.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Step 1", "Observe", "Cluster cross-module signals and anomalies."],
            ["Step 2", "Decide", "Draft recovery or monitor decisions with evidence."],
            ["Step 3", "Act", "Propose review-only or controlled actions under policy."],
            ["Step 4", "Learn", "Capture feedback, shadow mismatches, and value patterns."],
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
          disabled={busy === "create_loop"}
          onClick={() => void post("create_loop", {}, "Autonomous loop iteration created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create loop iteration
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-6">
        {[
          ["Signals", data.signals.observed],
          ["Policies", data.signals.policies],
          ["Shadow runs", data.signals.shadowRuns],
          ["Score", data.signals.previewLoopScore],
          ["Mode", data.signals.previewMode],
          ["Anomalies", data.signals.anomalies],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Loop Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.loopScore}/100 · mode {data.preview.automationMode} · decisions {data.preview.decisionCount} · actions {data.preview.proposedActionCount} · learnings {data.preview.learningCount} · shadow match {data.preview.policy.shadowMatchRatePct}%
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-900">Anomalies</p>
            <p className="mt-1 text-sm text-red-800">
              {data.preview.observe.anomalies.slice(0, 3).map((item) => `${item.severity} ${item.domain}`).join("; ") || "No anomalies"}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Decisions</p>
            <p className="mt-1 text-sm text-amber-800">
              {data.preview.decide.decisions.slice(0, 3).map((item) => `${item.domain}: ${item.decision}`).join("; ") || "No decisions"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Policy</p>
            <p className="mt-1 text-sm text-zinc-700">
              {data.preview.policy.blockedReasons.join("; ") || `Allowed: ${data.preview.policy.allowedActions.join(", ")}`}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Rollback</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.rollback.steps.slice(0, 2).join("; ")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Loop Iterations</h3>
        <div className="mt-4 space-y-4">
          {data.loops.map((loop) => {
            const anomalies = readArray<{ severity: string; domain: string }>(loop.observeJson, "anomalies");
            const decisions = readArray<{ domain: string; decision: string }>(loop.decideJson, "decisions");
            const actions = readArray<{ actionKind: string; executionMode: string }>(loop.actJson, "proposedActions");
            const learnings = readArray<{ type: string; recommendation: string }>(loop.learnJson, "learnings");
            const blocked = readArray<string>(loop.policyJson, "blockedReasons");
            const rollback = readArray<string>(loop.rollbackJson, "steps");
            return (
              <article key={loop.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {loop.status} · {loop.automationMode} · score {loop.loopScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{loop.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Signals {loop.observedSignalCount} · decisions {loop.decisionCount} · actions {loop.proposedActionCount} · approved automation {loop.approvedAutomationCount} · anomalies {loop.anomalyCount} · learnings {loop.learningCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(loop.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === loop.id || loop.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_loop_review", { loopId: loop.id, approvalNote: notes[loop.id] ?? "" }, "Loop review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue loop review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{loop.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-6">
                  {[
                    ["Anomalies", anomalies.slice(0, 2).map((item) => `${item.severity} ${item.domain}`).join("; ") || "None"],
                    ["Decisions", decisions.slice(0, 2).map((item) => `${item.domain}: ${item.decision}`).join("; ") || "None"],
                    ["Actions", actions.slice(0, 2).map((item) => `${item.actionKind}: ${item.executionMode}`).join("; ") || "None"],
                    ["Learn", learnings.slice(0, 2).map((item) => item.type).join("; ") || "None"],
                    ["Policy", blocked.slice(0, 2).join("; ") || "No blockers"],
                    ["Rollback", rollback.slice(0, 2).join("; ") || "No steps"],
                  ].map(([label, copy]) => (
                    <div key={label} className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                      <p className="font-semibold text-zinc-950">{label}</p>
                      <p className="mt-1">{copy}</p>
                    </div>
                  ))}
                </div>
                <textarea
                  value={notes[loop.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [loop.id]: event.target.value }))}
                  placeholder="Optional loop review note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.loops.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No loop iterations yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
