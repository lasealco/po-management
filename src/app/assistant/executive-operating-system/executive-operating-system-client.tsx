"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    executiveScore: number;
    leadershipSummary: string;
    boardBrief: { metricCount: number; readiness: string; metrics: Array<{ label: string; value: number; source: string; format?: string }>; summaryBullets: string[]; guardrail: string };
    investorNarrative: { narrativeRiskCount: number; thesis: string; proofPoints: string[]; narrativeRisks: string[]; guardrail: string };
    corpDevRadar: { signalCount: number; buildPartnerBuySignals: Array<{ sourceType: string; title: string; reason: string }>; guardrail: string };
    executiveTwin: { dimensions: Record<string, number>; weakDimensionCount: number; weakDimensions: Array<{ dimension: string; score: number; recommendation: string }>; scenarioPrompts: string[]; guardrail: string };
    strategyExecution: { strategyRiskCount: number; actionBacklogCount: number; strategyRisks: Array<{ sourceType: string; title: string; severity: string; issue: string }>; executionSteps: string[] };
    decisionLedger: { decisionCount: number; decisions: Array<{ sourceType: string; title: string; status: string }>; guardrail: string };
    learningLoop: { learningSignalCount: number; learningSignals: Array<{ sourceType: string; learning: string }>; nextReview: string };
    operatingCadence: { status: string; cadence: string[]; owners: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    executiveScore: number;
    boardMetricCount: number;
    investorNarrativeRiskCount: number;
    corpDevSignalCount: number;
    strategyRiskCount: number;
    decisionCount: number;
    learningSignalCount: number;
    boardBriefJson: unknown;
    investorNarrativeJson: unknown;
    corpDevRadarJson: unknown;
    executiveTwinJson: unknown;
    strategyExecutionJson: unknown;
    decisionLedgerJson: unknown;
    learningLoopJson: unknown;
    operatingCadenceJson: unknown;
    rollbackPlanJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    approvedAt: string | null;
    approvalNote: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key?: string): T[] {
  const next = key && value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;
  return Array.isArray(next) ? (next as T[]) : [];
}

function metricValue(metric: { value: number; format?: string }) {
  if (metric.format === "currency") return Math.round(metric.value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return String(metric.value);
}

export function ExecutiveOperatingSystemClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/executive-operating-system", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Executive Operating System."));
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
    const res = await fetch("/api/assistant/executive-operating-system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Executive Operating System."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 4, but creating packets and executive review actions require reports, settings, CRM, or Control Tower edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 4</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Executive Operating System</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Convert assistant operations into board materials, investor narrative, corp-dev radar, executive twin scenarios,
              strategy execution, decision ledger, and learning loop review.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.executiveScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.operatingCadence.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Build executive view", "Gather value, revenue, risk, trust, autonomous loop, operating report, audit, and action signals."],
            ["Step 2", "Create packet", "Persist board brief, investor narrative, corp-dev radar, executive twin, decisions, and learning loop."],
            ["Step 3", "Approve safely", "Queue or approve executive review without publishing materials, changing strategy, or mutating source systems."],
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
          disabled={!canEdit || busy === "create_packet"}
          onClick={() => void post("create_packet", {}, "Executive Operating System packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 4 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-10">
        {[
          ["Reports", data.signals.operatingReports],
          ["Value", data.signals.valuePackets],
          ["Revenue", data.signals.revenuePackets],
          ["Loops", data.signals.autonomousLoops],
          ["Risk", data.signals.riskPackets],
          ["Trust", data.signals.trustPackets],
          ["Audit", data.signals.auditEvents],
          ["Actions", data.signals.actionQueueItems],
          ["Risks", data.signals.previewStrategyRisks],
          ["Score", data.signals.previewExecutiveScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Board and Investor Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            {data.preview.boardBrief.metrics.map((metric) => (
              <article key={metric.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">{metricValue(metric)}</p>
                <p className="mt-1 text-sm text-zinc-600">{metric.source}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Strategy, Twin, and Learning</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Investor narrative</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.investorNarrative.narrativeRiskCount} risk(s). {data.preview.investorNarrative.thesis}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Corp-dev radar</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.corpDevRadar.signalCount} build/partner/buy signal(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Executive twin</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.executiveTwin.weakDimensionCount} weak dimension(s): {data.preview.executiveTwin.weakDimensions.map((item) => item.dimension).join(", ") || "none"}.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Learning loop</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.learningLoop.learningSignalCount} learning signal(s). {data.preview.learningLoop.nextReview}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const boardMetrics = readArray<{ label: string; value: number; format?: string }>(packet.boardBriefJson, "metrics");
            const narrativeRisks = readArray<string>(packet.investorNarrativeJson, "narrativeRisks");
            const strategyRisks = readArray<{ title: string; severity: string }>(packet.strategyExecutionJson, "strategyRisks");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.executiveScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Board {packet.boardMetricCount} · narrative risks {packet.investorNarrativeRiskCount} · corp-dev {packet.corpDevSignalCount} · strategy {packet.strategyRiskCount} · decisions {packet.decisionCount} · learning {packet.learningSignalCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"}
                      onClick={() => void post("queue_executive_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Executive review queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"}
                      onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Executive packet approved.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Approve packet
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Board metrics</p>
                    <p className="mt-1">{boardMetrics.slice(0, 2).map((metric) => `${metric.label}: ${metricValue(metric)}`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Narrative risks</p>
                    <p className="mt-1">{narrativeRisks.slice(0, 2).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Strategy risks</p>
                    <p className="mt-1">{strategyRisks.slice(0, 2).map((risk) => `${risk.severity}: ${risk.title}`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{rollback[0] ?? "No source mutation."}</p>
                  </div>
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional executive review note"
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 4 packets yet. Create the first durable Executive Operating System packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
