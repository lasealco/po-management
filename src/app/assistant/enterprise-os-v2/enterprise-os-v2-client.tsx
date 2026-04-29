"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    enterpriseScore: number;
    autonomyMode: string;
    leadershipSummary: string;
    operatingSignalCount: number;
    domainControlCount: number;
    governanceRiskCount: number;
    valueRiskCount: number;
    rolloutRiskCount: number;
    executionActionCount: number;
    enterpriseTelemetry: { operatingSignalCount: number; pendingActionCount: number; highPriorityActionCount: number; evidenceCoveragePct: number; negativeFeedbackRatePct: number; operatingReportScore: number; guardrail: string };
    autonomyReadiness: { autonomyMode: string; loopCount: number; averageLoopScore: number; controlledLoopCount: number; autonomyRiskCount: number; guardrail: string };
    governanceReliability: { governanceRiskCount: number; certifiedAgentPacketCount: number; reliabilityPacketCount: number; executivePacketCount: number; guardrail: string };
    valueExecution: { valueRiskCount: number; rolloutRiskCount: number; totalEstimatedValue: number; averageRoiPct: number; averageAdoptionScore: number; guardrail: string };
    domainOrchestration: { domainControlCount: number; domainRiskCount: number; approvedProgramCount: number; productLifecyclePacketCount: number; guardrail: string };
    commandCouncil: { status: string; blockerCount: number; blockers: string[]; owners: string[]; cadence: string[]; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[]; guardrail: string };
    rollbackPlan: { steps: string[]; guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    enterpriseScore: number;
    autonomyMode: string;
    operatingSignalCount: number;
    domainControlCount: number;
    governanceRiskCount: number;
    valueRiskCount: number;
    rolloutRiskCount: number;
    executionActionCount: number;
    autonomyReadinessJson: unknown;
    governanceReliabilityJson: unknown;
    valueExecutionJson: unknown;
    domainOrchestrationJson: unknown;
    commandCouncilJson: unknown;
    rollbackPlanJson: unknown;
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

function money(value: number) {
  return `USD ${Math.round(value).toLocaleString("en-US")}`;
}

export function EnterpriseOsV2Client({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/enterprise-os-v2", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Autonomous Enterprise OS v2."));
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
    const res = await fetch("/api/assistant/enterprise-os-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Autonomous Enterprise OS v2."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 15, but packet creation and enterprise council review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 15</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Autonomous Enterprise OS v2</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Coordinate observe/decide/act/learn loops across value, governance, reliability, rollout, finance, product, and domain controls before enterprise-wide operating changes.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview enterprise</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.enterpriseScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.autonomyMode}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Observe enterprise signals", "Load operating reports, autonomous loops, value, executive, governance, AI quality, reliability, rollout, finance, product, domain, audit, and action evidence."],
            ["Step 2", "Freeze OS packet", "Persist telemetry, autonomy readiness, governance/reliability, value execution, domain orchestration, command council, response plan, and rollback evidence."],
            ["Step 3", "Approve before expansion", "Queue council review before expanding automation, budgets, finance/product/tenant changes, releases, communications, or source-system operations."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Autonomous Enterprise OS v2 packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 15 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-10">
        {[
          ["Loops", data.signals.autonomousLoops],
          ["Value", data.signals.valuePackets],
          ["Executive", data.signals.executivePackets],
          ["Governance", data.signals.agentGovernancePackets],
          ["Quality", data.signals.aiQualityPackets],
          ["Reliability", data.signals.platformReliabilityPackets],
          ["Rollout", data.signals.tenantRolloutPackets],
          ["Finance", data.signals.financePackets],
          ["Programs", data.signals.advancedProgramPackets],
          ["Score", data.signals.previewEnterpriseScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Enterprise Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Enterprise telemetry</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.enterpriseTelemetry.operatingSignalCount} signals, {data.preview.enterpriseTelemetry.pendingActionCount} pending actions, {data.preview.enterpriseTelemetry.evidenceCoveragePct}% evidence coverage.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Autonomy readiness</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.autonomyReadiness.autonomyMode}, {data.preview.autonomyReadiness.loopCount} loop(s), {data.preview.autonomyReadiness.autonomyRiskCount} risk(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Command council</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.commandCouncil.status}, {data.preview.commandCouncil.blockerCount} blocker(s).</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Execution Controls</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Governance and reliability</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.governanceReliability.governanceRiskCount} risk(s), {data.preview.governanceReliability.certifiedAgentPacketCount} certified agent packet(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Value execution</p>
              <p className="mt-1 text-sm text-zinc-600">{money(data.preview.valueExecution.totalEstimatedValue)} estimated value, {data.preview.valueExecution.valueRiskCount} value/finance risk(s), {data.preview.valueExecution.rolloutRiskCount} rollout risk(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Domain orchestration</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.domainOrchestration.domainControlCount} domain control(s), {data.preview.domainOrchestration.domainRiskCount} domain risk(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const blockers = readArray<string>(packet.commandCouncilJson, "blockers");
            const programRisks = readArray<{ programTitle: string; riskCount: number }>(packet.domainOrchestrationJson, "programRisks");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.enterpriseScore}/100 · {packet.autonomyMode} · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Signals {packet.operatingSignalCount} · domains {packet.domainControlCount} · governance {packet.governanceRiskCount} · value {packet.valueRiskCount} · rollout {packet.rolloutRiskCount} · actions {packet.executionActionCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "COUNCIL_REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_council_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Enterprise council review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Autonomous Enterprise OS v2 packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Council blockers</p><p className="mt-1">{blockers.slice(0, 2).join("; ") || "No blockers"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Domain risks</p><p className="mt-1">{programRisks.slice(0, 2).map((item) => `${item.programTitle}: ${item.riskCount}`).join("; ") || "No domain risks"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No enterprise mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional enterprise council review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 15 packets yet. Create the first durable Autonomous Enterprise OS v2 packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
