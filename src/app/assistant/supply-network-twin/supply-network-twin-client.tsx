"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    twinScore: number;
    leadershipSummary: string;
    graphCoverage: { graphNodeCount: number; graphEdgeCount: number; missingCoverage: Array<{ domain: string; sourceCount: number; gap: string }>; guardrail: string };
    networkBaseline: { openOrderCount: number; openOrderValue: number; shipmentCount: number; lateShipmentCount: number; exceptionShipmentCount: number; inventoryLocationCount: number; allocationPct: number; supplierCount: number; customerCount: number };
    scenarioCommand: { scenarioCount: number; recommendedScenarioKey: string; latestNetwork: null | { title: string; networkScore: number }; latestSimulation: null | { title: string; simulationScore: number }; latestPlanning: null | { title: string; planHealthScore: number }; drafts: Array<{ title: string | null; status: string }>; guardrail: string };
    bottleneck: { bottleneckCount: number; bottlenecks: Array<{ type: string; label: string; severity: string }>; guardrail: string };
    disruption: { disruptionRiskCount: number; activeTwinRiskCount: number; resilienceRiskCount: number; topRisks: Array<{ title: string; severity: string }>; guardrail: string };
    recoveryPlaybook: { recoveryActionCount: number; actions: Array<{ owner: string; priority: string; action: string }>; pendingActions: Array<{ actionKind: string; priority: string }>; guardrail: string };
    confidence: { confidenceScore: number; avgInsightScore: number; missingCoverageCount: number; staleScenarioSignalCount: number; openInsights: Array<{ summary: string; graphConfidenceScore: number }> };
    responsePlan: { status: string; owners: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    twinScore: number;
    graphNodeCount: number;
    graphEdgeCount: number;
    scenarioCount: number;
    bottleneckCount: number;
    disruptionRiskCount: number;
    recoveryActionCount: number;
    graphCoverageJson: unknown;
    scenarioCommandJson: unknown;
    bottleneckJson: unknown;
    disruptionJson: unknown;
    recoveryPlaybookJson: unknown;
    confidenceJson: unknown;
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

export function SupplyNetworkTwinClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/supply-network-twin", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Supply Network Twin."));
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
    const res = await fetch("/api/assistant/supply-network-twin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Supply Network Twin."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 7, but packet creation and scenario review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 7</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Supply Network Twin & Scenario Command</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Combine twin graph coverage, network design, simulation, continuous planning, disruption signals, and recovery playbooks into one approval-gated scenario command workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview twin score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.twinScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Map the network twin", "Load graph nodes/edges plus orders, shipments, inventory, suppliers, customers, planning, simulation, and risk signals."],
            ["Step 2", "Freeze scenario evidence", "Persist baseline, bottlenecks, disruption risks, recovery playbooks, confidence, and rollback controls."],
            ["Step 3", "Review before execution", "Queue or approve scenario review without changing operations, graph records, network plans, or customer promises."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Supply Network Twin packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 7 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-10">
        {[
          ["Nodes", data.signals.twinEntities],
          ["Edges", data.signals.twinEdges],
          ["Risks", data.signals.twinRisks],
          ["Scenarios", data.signals.scenarioDrafts],
          ["Network", data.signals.networkPackets],
          ["Simulation", data.signals.simulationPackets],
          ["Planning", data.signals.planningPackets],
          ["Shipments", data.signals.shipments],
          ["Inventory", data.signals.inventoryLocations],
          ["Score", data.signals.previewTwinScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Network Twin Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Graph coverage</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.graphCoverage.graphNodeCount} node(s), {data.preview.graphCoverage.graphEdgeCount} edge(s), {data.preview.graphCoverage.missingCoverage.length} coverage gap(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Network baseline</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.networkBaseline.openOrderCount} open order(s), {data.preview.networkBaseline.shipmentCount} shipment(s), {data.preview.networkBaseline.allocationPct}% inventory allocation.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Scenario command</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.scenarioCommand.scenarioCount} scenario signal(s), recommended {data.preview.scenarioCommand.recommendedScenarioKey}.</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Disruption and Recovery</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Bottlenecks</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.bottleneck.bottleneckCount} bottleneck(s) across inventory, shipments, and planning.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Disruption risk</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.disruption.disruptionRiskCount} disruption risk(s), {data.preview.disruption.activeTwinRiskCount} active twin risk signal(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Confidence</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.confidence.confidenceScore}/100 confidence with {data.preview.confidence.staleScenarioSignalCount} stale scenario signal(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const missingCoverage = readArray<{ domain: string; gap: string }>(packet.graphCoverageJson, "missingCoverage");
            const bottlenecks = readArray<{ type: string; label: string; severity: string }>(packet.bottleneckJson, "bottlenecks");
            const topRisks = readArray<{ title: string; severity: string }>(packet.disruptionJson, "topRisks");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.twinScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Nodes {packet.graphNodeCount} · edges {packet.graphEdgeCount} · scenarios {packet.scenarioCount} · bottlenecks {packet.bottleneckCount} · disruptions {packet.disruptionRiskCount} · recovery {packet.recoveryActionCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_network_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Supply network review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Supply Network Twin packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Coverage gaps</p><p className="mt-1">{missingCoverage.slice(0, 2).map((item) => `${item.domain}: ${item.gap}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Bottlenecks</p><p className="mt-1">{bottlenecks.slice(0, 2).map((item) => `${item.severity}: ${item.label}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Disruptions</p><p className="mt-1">{topRisks.slice(0, 2).map((item) => `${item.severity}: ${item.title}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No source mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional supply network review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 7 packets yet. Create the first durable Supply Network Twin packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
