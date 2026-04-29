"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type NetworkPacket = {
  id: string;
  title: string;
  status: string;
  networkScore: number;
  facilityCount: number;
  laneCount: number;
  customerNodeCount: number;
  supplierNodeCount: number;
  scenarioCount: number;
  serviceRiskCount: number;
  costRiskCount: number;
  recommendedScenarioKey: string | null;
  baselineJson: unknown;
  scenarioJson: unknown;
  tradeoffJson: unknown;
  serviceImpactJson: unknown;
  riskExposureJson: unknown;
  approvalPlanJson: unknown;
  rollbackPlanJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Scenario = {
  key: string;
  title: string;
  horizon: string;
  changeType: string;
  expectedCostDeltaPct: number;
  expectedServiceDeltaPct: number;
  riskLevel: string;
  actions: string[];
  guardrail: string;
};

type Snapshot = {
  signals: {
    facilities: number;
    lanes: number;
    suppliers: number;
    customers: number;
    previewNetworkScore: number;
    recommendedScenarioKey: string;
    serviceRisks: number;
    costRisks: number;
  };
  preview: {
    networkScore: number;
    facilityCount: number;
    laneCount: number;
    customerNodeCount: number;
    supplierNodeCount: number;
    scenarioCount: number;
    serviceRiskCount: number;
    costRiskCount: number;
    recommendedScenarioKey: string;
    baseline: {
      allocationPct: number;
      constrainedFacilities: Array<{ label: string; utilizationPct: number; openTaskCount: number }>;
      highExceptionLanes: Array<{ lane: string; mode: string; exceptionPct: number }>;
      lowVolumeLaneCount: number;
      missingDataCount: number;
    };
    scenarios: { scenarios: Scenario[] };
    tradeoffs: { comparisons: Array<{ key: string; title: string; costDeltaPct: number; serviceDeltaPct: number; riskLevel: string }> };
    serviceImpact: { facilityServiceWatchCount: number; laneServiceWatchCount: number };
    riskExposure: { serviceRisks: Array<{ type: string; detail: string }>; costRisks: Array<{ type: string; detail: string }> };
    approvalPlan: { steps: string[]; guardrail: string };
    rollbackPlan: { steps: string[] };
    leadershipSummary: string;
  };
  packets: NetworkPacket[];
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function NetworkDesignClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/network-design", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load network design."));
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
    const res = await fetch("/api/assistant/network-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update network design."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP33</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Network Design & Footprint Strategy</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Compare facility, lane, supplier, and customer footprint scenarios from real tenant evidence. AMP33 creates a
          decision packet and review queue item only; execution remains approval-gated.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Step 1", "Baseline", "Summarize facilities, inventory pressure, lanes, customers, and suppliers."],
            ["Step 2", "Scenarios", "Compare no-change, rebalance, lane consolidation, and resilience options."],
            ["Step 3", "Tradeoffs", "Show service, cost, risk, and missing-data assumptions."],
            ["Step 4", "Review", "Queue human approval before downstream network work begins."],
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
          onClick={() => void post("create_packet", {}, "Network design packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create network design packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Facilities", data.signals.facilities],
          ["Lanes", data.signals.lanes],
          ["Suppliers", data.signals.suppliers],
          ["Customers", data.signals.customers],
          ["Score", data.signals.previewNetworkScore],
          ["Scenario", data.signals.recommendedScenarioKey],
          ["Service risks", data.signals.serviceRisks],
          ["Cost risks", data.signals.costRisks],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 break-words text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Network Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.networkScore}/100 · allocation {data.preview.baseline.allocationPct}% · scenarios {data.preview.scenarioCount} · missing data {data.preview.baseline.missingDataCount}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {data.preview.scenarios.scenarios.map((scenario) => (
            <div key={scenario.key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{scenario.changeType}</p>
              <h4 className="mt-1 font-semibold text-zinc-950">{scenario.title}</h4>
              <p className="mt-1 text-sm text-zinc-600">
                {scenario.horizon} · cost {scenario.expectedCostDeltaPct}% · service +{scenario.expectedServiceDeltaPct}% · {scenario.riskLevel} risk
              </p>
              <p className="mt-2 text-xs text-zinc-500">{scenario.guardrail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Network Design Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const scenarios = readArray<Scenario>(packet.scenarioJson, "scenarios");
            const serviceRisks = readArray<{ type: string; detail: string }>(packet.riskExposureJson, "serviceRisks");
            const costRisks = readArray<{ type: string; detail: string }>(packet.riskExposureJson, "costRisks");
            const approvalSteps = readArray<string>(packet.approvalPlanJson, "steps");
            const rollbackSteps = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.networkScore}/100 · {packet.recommendedScenarioKey}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Facilities {packet.facilityCount} · lanes {packet.laneCount} · customers {packet.customerNodeCount} · suppliers {packet.supplierNodeCount} · scenarios {packet.scenarioCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_network_review", { packetId: packet.id, approvalNote: notes[packet.id] ?? "" }, "Network review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue network review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  {[
                    ["Scenarios", scenarios.slice(0, 2).map((item) => item.title).join("; ") || "None"],
                    ["Service risk", serviceRisks.slice(0, 2).map((item) => item.detail).join("; ") || "None"],
                    ["Cost risk", costRisks.slice(0, 2).map((item) => item.detail).join("; ") || "None"],
                    ["Approval", approvalSteps.slice(0, 2).join("; ") || "No approval steps"],
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
                  placeholder="Optional network review note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No network design packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
