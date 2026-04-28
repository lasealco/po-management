"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Snapshot = {
  metrics: {
    entityCount: number;
    edgeCount: number;
    graphConfidenceScore: number;
    openRiskCount: number;
    scenarioCount: number;
    entityKinds: Array<{ entityKind: string; count: number }>;
  };
  summary: string;
  missingEdges: string[];
  recentRisks: Array<{ id: string; code: string; severity: string; title: string; detail: string | null; playbookSummary: string }>;
  recentScenarios: Array<{ id: string; title: string | null; status: string; updatedAt: string }>;
  insights: Array<{
    id: string;
    prompt: string;
    summary: string;
    graphConfidenceScore: number;
    scenarioDraftId: string | null;
    riskSignalId: string | null;
    status: string;
    createdAt: string;
  }>;
};

export function TwinAssistantClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [prompt, setPrompt] = useState("What if our highest open risk delays a shipment by 5 days?");
  const [riskSignalId, setRiskSignalId] = useState(initialSnapshot.recentRisks[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/supply-chain-twin/assistant", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load twin assistant snapshot");
    setSnapshot((await res.json()) as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch(() => undefined), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createInsight() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/supply-chain-twin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_scenario_insight", prompt, riskSignalId: riskSignalId || null }),
      });
      if (!res.ok) throw new Error("Could not create scenario insight");
      setMessage("Scenario insight created and queued for review.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create scenario insight");
    } finally {
      setBusy(false);
    }
  }

  async function closeInsight(insightId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/supply-chain-twin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close_insight", insightId }),
      });
      if (!res.ok) throw new Error("Could not close insight");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP10 Twin Assistant</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Graph confidence", `${snapshot.metrics.graphConfidenceScore}/100`],
            ["Entities", snapshot.metrics.entityCount],
            ["Edges", snapshot.metrics.edgeCount],
            ["Open risks", snapshot.metrics.openRiskCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
            </div>
          ))}
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 text-sm text-zinc-100">{snapshot.summary}</pre>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Create What-If Scenario From Prompt</h2>
        <p className="mt-1 text-sm text-zinc-600">
          The assistant creates a draft scenario, evidence record, and review task. It never mutates the twin graph silently.
        </p>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          className="mt-4 w-full rounded-xl border border-zinc-300 p-3 text-sm"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={riskSignalId}
            onChange={(event) => setRiskSignalId(event.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">No linked risk</option>
            {snapshot.recentRisks.map((risk) => (
              <option key={risk.id} value={risk.id}>
                {risk.severity} · {risk.code}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void createInsight()}
            disabled={busy || !prompt.trim()}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create scenario insight
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Graph Gaps And Risk Links</h2>
          <div className="mt-4 space-y-3">
            {snapshot.missingEdges.map((gap) => (
              <p key={gap} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {gap}
              </p>
            ))}
            {snapshot.recentRisks.map((risk) => (
              <article key={risk.id} className="rounded-xl border border-zinc-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{risk.severity} · {risk.code}</p>
                <h3 className="mt-1 font-semibold text-zinc-900">{risk.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{risk.playbookSummary}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Assistant Insights</h2>
          <div className="mt-4 space-y-3">
            {snapshot.insights.length === 0 ? <p className="text-sm text-zinc-500">No twin assistant insights yet.</p> : null}
            {snapshot.insights.map((insight) => (
              <article key={insight.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {insight.status} · confidence {insight.graphConfidenceScore}/100
                    </p>
                    <h3 className="mt-1 font-semibold text-zinc-900">{insight.prompt}</h3>
                  </div>
                  {insight.status !== "CLOSED" ? (
                    <button className="text-xs font-semibold text-zinc-500 hover:text-zinc-900" onClick={() => void closeInsight(insight.id)}>
                      Close
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-zinc-600">{insight.summary}</p>
                {insight.scenarioDraftId ? (
                  <Link href={`/supply-chain-twin/scenarios/${insight.scenarioDraftId}`} className="mt-3 inline-block text-sm font-semibold text-[var(--arscmp-primary)]">
                    Open scenario
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
