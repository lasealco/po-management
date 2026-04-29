"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type ScenarioRun = {
  key: string;
  title: string;
  horizon: string;
  simulatedDemand: number;
  simulatedSupply: number;
  gapUnits: number;
  transportRisk: number;
  costImpact: number;
  riskScore: number;
  serviceLevelPct: number;
  valueImpact: number;
  guardrail: string;
};

type SimulationPacket = {
  id: string;
  title: string;
  status: string;
  simulationScore: number;
  scenarioCount: number;
  assumptionCount: number;
  signalCount: number;
  dataFreshnessRiskCount: number;
  recommendedScenarioKey: string | null;
  assumptionLedgerJson: unknown;
  scenarioRunJson: unknown;
  comparisonJson: unknown;
  recommendationJson: unknown;
  replayPlanJson: unknown;
  archivePlanJson: unknown;
  approvalPlanJson: unknown;
  rollbackPlanJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Snapshot = {
  signals: {
    signalCount: number;
    scenarioCount: number;
    previewSimulationScore: number;
    recommendedScenarioKey: string;
    staleSignals: number;
    networkRecommendationKey: string | null;
  };
  preview: {
    simulationScore: number;
    scenarioCount: number;
    assumptionCount: number;
    signalCount: number;
    dataFreshnessRiskCount: number;
    recommendedScenarioKey: string;
    assumptions: { signals: Array<{ domain: string; label: string; currentValue: number; unit: string; confidence: string; stale: boolean }>; guardrail: string };
    scenarioRuns: { runs: ScenarioRun[] };
    comparison: { comparisons: Array<{ key: string; title: string; compositeScore: number; serviceLevelPct: number; riskScore: number; costImpact: number }> };
    recommendation: { title: string; rationale: string[]; promotionActions: string[]; guardrail: string };
    replayPlan: { steps: string[] };
    archivePlan: { steps: string[]; archivePolicy: string };
    approvalPlan: { steps: string[]; guardrail: string };
    rollbackPlan: { steps: string[] };
    leadershipSummary: string;
  };
  packets: SimulationPacket[];
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function SimulationStudioClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/simulation-studio", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load simulation studio."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.packetId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/simulation-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update simulation studio."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP34</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Multi-Scenario Simulation Studio</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Run replayable what-if scenarios across demand, supply, inventory, transport, finance, risk, work queue, and
          AMP33 network signals. Results are archived as review evidence before any downstream plan is promoted.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Step 1", "Assumptions", "Freeze signal values, confidence, stale data, and scenario definitions."],
            ["Step 2", "Run", "Generate baseline and stress simulations with deterministic math."],
            ["Step 3", "Compare", "Rank service, gap, cost, risk, and value outcomes."],
            ["Step 4", "Archive", "Queue review and preserve the packet for replay and audit."],
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
          disabled={busy === "create_packet"}
          onClick={() => void post("create_packet", {}, "Simulation packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create simulation packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Signals", data.signals.signalCount],
          ["Scenarios", data.signals.scenarioCount],
          ["Score", data.signals.previewSimulationScore],
          ["Recommended", data.signals.recommendedScenarioKey],
          ["Stale signals", data.signals.staleSignals],
          ["AMP33 link", data.signals.networkRecommendationKey ?? "none"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 break-words text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Simulation Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.simulationScore}/100 · assumptions {data.preview.assumptionCount} · signals {data.preview.signalCount} · stale {data.preview.dataFreshnessRiskCount}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {data.preview.scenarioRuns.runs.map((run) => (
            <div key={run.key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{run.horizon}</p>
              <h4 className="mt-1 font-semibold text-zinc-950">{run.title}</h4>
              <p className="mt-1 text-sm text-zinc-600">
                Service {run.serviceLevelPct}% · gap {run.gapUnits} · risk {run.riskScore} · cost {run.costImpact}
              </p>
              <p className="mt-2 text-xs text-zinc-500">{run.guardrail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Simulation Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const runs = readArray<ScenarioRun>(packet.scenarioRunJson, "runs");
            const comparisons = readArray<{ title: string; compositeScore: number; serviceLevelPct: number; riskScore: number }>(packet.comparisonJson, "comparisons");
            const replaySteps = readArray<string>(packet.replayPlanJson, "steps");
            const archiveSteps = readArray<string>(packet.archivePlanJson, "steps");
            const rollbackSteps = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.simulationScore}/100 · {packet.recommendedScenarioKey}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Scenarios {packet.scenarioCount} · assumptions {packet.assumptionCount} · signals {packet.signalCount} · stale {packet.dataFreshnessRiskCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_simulation_review", { packetId: packet.id, approvalNote: notes[packet.id] ?? "" }, "Simulation review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue simulation review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  {[
                    ["Runs", runs.slice(0, 2).map((item) => item.title).join("; ") || "None"],
                    ["Comparison", comparisons.slice(0, 2).map((item) => `${item.title}: ${item.compositeScore}`).join("; ") || "None"],
                    ["Replay", replaySteps.slice(0, 2).join("; ") || "No replay steps"],
                    ["Archive", archiveSteps.slice(0, 2).join("; ") || "No archive steps"],
                    ["Rollback", rollbackSteps.slice(0, 2).join("; ") || "No rollback steps"],
                  ].map(([label, copy]) => (
                    <div key={label} className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                      <p className="font-semibold text-zinc-950">{label}</p>
                      <p className="mt-1">{copy}</p>
                    </div>
                  ))}
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional simulation review note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No simulation packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
