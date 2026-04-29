"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    qualityScore: number;
    leadershipSummary: string;
    evaluationSuite: { evalCaseCount: number; failedEvalCount: number; weakCaseCount: number; correctionCaseCount: number; guardrail: string };
    groundingQuality: { auditEventCount: number; evidenceCoveragePct: number; weakAnswerCount: number; negativeFeedbackRatePct: number; weakExamples: Array<{ surface: string; answerKind: string; objectType: string | null }>; guardrail: string };
    promptModelChange: { promptRiskCount: number; promptCount: number; approvedPromptCount: number; agentRisks: Array<{ title: string; status: string; governanceScore: number }>; guardrail: string };
    automationRegression: { automationPolicyCount: number; shadowRunCount: number; automationRiskCount: number; risks: Array<{ actionKind: string; status: string; shadowMatchRatePct: number; riskReasons: string[] }>; guardrail: string };
    observabilityWatch: { incidentCount: number; openIncidentCount: number; observabilityRiskCount: number; severeIncidents: Array<{ title: string; severity: string; healthScore: number }>; guardrail: string };
    releaseGate: { releaseBlockerCount: number; releaseDecision: string; releaseBlockers: Array<{ type: string; key: string; detail: string }>; computed: { status: string; score: number; threshold: number }; guardrail: string };
    rollbackDrill: { rollbackStepCount: number; pendingQualityActions: Array<{ actionKind: string; priority: string }>; steps: string[]; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[]; guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    qualityScore: number;
    auditEventCount: number;
    evalCaseCount: number;
    failedEvalCount: number;
    promptRiskCount: number;
    automationRiskCount: number;
    observabilityRiskCount: number;
    releaseBlockerCount: number;
    evaluationSuiteJson: unknown;
    groundingQualityJson: unknown;
    promptModelChangeJson: unknown;
    automationRegressionJson: unknown;
    observabilityWatchJson: unknown;
    releaseGateJson: unknown;
    rollbackDrillJson: unknown;
    responsePlanJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    approvedAt: string | null;
    approvalNote: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function AiQualityReleaseClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/ai-quality-release", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load AI Quality Release Governance."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    if (!canEdit) return;
    setBusy(String(body.packetId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/ai-quality-release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update AI Quality Release Governance."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 10, but packet creation and release review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 10</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">AI Quality, Evaluation & Release Governance</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Evaluate grounding, prompt/model/tool changes, automation regressions, observability, release gates, and rollback drills before any assistant release expands behavior.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview quality</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.qualityScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Evaluate behavior", "Load audit, feedback, review examples, prompt library, release gates, automation, shadow, observability, and governance signals."],
            ["Step 2", "Freeze release evidence", "Persist eval suites, grounding quality, prompt/model/tool risk, regression watch, release gate, and rollback drill evidence."],
            ["Step 3", "Approve before rollout", "Queue release review without publishing prompts, switching models, granting tools, enabling automation, or changing runtime behavior."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "AI Quality Release packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 10 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-10">
        {[
          ["Audits", data.signals.audits],
          ["Examples", data.signals.reviewExamples],
          ["Prompts", data.signals.promptLibraryItems],
          ["Gates", data.signals.releaseGates],
          ["Policies", data.signals.automationPolicies],
          ["Shadow", data.signals.shadowRuns],
          ["Incidents", data.signals.observabilityIncidents],
          ["Agents", data.signals.agentGovernancePackets],
          ["Programs", data.signals.advancedProgramPackets],
          ["Score", data.signals.previewQualityScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Quality Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Evaluation suite</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.evaluationSuite.evalCaseCount} eval case(s), {data.preview.evaluationSuite.failedEvalCount} failed signal(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Grounding quality</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.groundingQuality.evidenceCoveragePct}% evidence coverage, {data.preview.groundingQuality.weakAnswerCount} weak answer(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Release gate</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.releaseGate.releaseDecision} with {data.preview.releaseGate.releaseBlockerCount} blocker(s).</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Regression and Rollback</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Prompt/model/tool risk</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.promptModelChange.promptRiskCount} prompt, model, tool, or agent risk(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Automation regression</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.automationRegression.automationRiskCount} automation risk(s), {data.preview.automationRegression.shadowRunCount} shadow run(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Rollback drill</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.rollbackDrill.rollbackStepCount} rollback step(s), {data.preview.rollbackDrill.pendingQualityActions.length} queued quality action(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const weakExamples = readArray<{ surface: string; answerKind: string; objectType: string | null }>(packet.groundingQualityJson, "weakExamples");
            const automationRisks = readArray<{ actionKind: string; status: string; riskReasons: string[] }>(packet.automationRegressionJson, "risks");
            const releaseBlockers = readArray<{ type: string; key: string; detail: string }>(packet.releaseGateJson, "releaseBlockers");
            const rollback = readArray<string>(packet.rollbackDrillJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.qualityScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Audits {packet.auditEventCount} · evals {packet.evalCaseCount} · failed {packet.failedEvalCount} · prompt risk {packet.promptRiskCount} · automation {packet.automationRiskCount} · blockers {packet.releaseBlockerCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "RELEASE_REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_release_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "AI release review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "AI Quality Release packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Weak examples</p><p className="mt-1">{weakExamples.slice(0, 2).map((item) => `${item.surface}: ${item.answerKind}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Automation</p><p className="mt-1">{automationRisks.slice(0, 2).map((item) => `${item.actionKind}: ${item.riskReasons.join(", ")}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Blockers</p><p className="mt-1">{releaseBlockers.slice(0, 2).map((item) => `${item.key}: ${item.detail}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No release mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional AI quality release review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 10 packets yet. Create the first durable AI Quality Release packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
