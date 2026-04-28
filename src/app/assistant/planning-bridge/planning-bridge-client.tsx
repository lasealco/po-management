"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    demandLines: number;
    supplyLines: number;
    inventoryRows: number;
    constraints: number;
    previewPlanningScore: number;
  };
  preview: {
    planningScore: number;
    demandUnits: number;
    availableUnits: number;
    inboundUnits: number;
    shortageUnits: number;
    gapAnalysis: { gaps?: Array<{ productLabel: string; shortageUnits: number; coveragePct: number }> };
    recommendations: { steps?: Array<{ step: string; owner: string; action: string }> };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    planningScore: number;
    horizonDays: number;
    demandUnits: string;
    availableUnits: string;
    inboundUnits: string;
    shortageUnits: string;
    gapAnalysisJson: unknown;
    constraintJson: unknown;
    scenarioJson: unknown;
    recommendationJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    scenarioDraftId: string | null;
    approvedAt: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key: string): T[] {
  if (!value || typeof value !== "object") return [];
  const next = (value as Record<string, unknown>)[key];
  return Array.isArray(next) ? (next as T[]) : [];
}

export function PlanningBridgeClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/planning-bridge", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load planning bridge."));
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
    const res = await fetch("/api/assistant/planning-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update planning bridge."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP22</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">AI Planning &amp; S&amp;OP Bridge</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Combine open demand, inbound supply, available inventory, warehouse pressure, and execution constraints into
          a planning packet and Twin scenario draft. The assistant creates a plan for approval, not source-record changes.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Collect demand", "Sales order demand, customer pressure, and planning horizon."],
            ["Step 2", "Constrain supply", "Available stock, inbound POs, WMS capacity, and data constraints."],
            ["Step 3", "Approve plan", "Twin scenario assumptions and S&OP packet queued for review."],
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
          onClick={() => void post("create_packet", {}, "Planning bridge packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create planning packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Demand lines", data.signals.demandLines],
          ["Supply lines", data.signals.supplyLines],
          ["Inventory rows", data.signals.inventoryRows],
          ["Constraints", data.signals.constraints],
          ["Plan score", data.signals.previewPlanningScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Planning Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.planningScore}/100 · demand {data.preview.demandUnits} · available {data.preview.availableUnits} · inbound {data.preview.inboundUnits} · shortage {data.preview.shortageUnits}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h4 className="font-semibold text-zinc-950">Top gaps</h4>
            <div className="mt-3 space-y-2">
              {(data.preview.gapAnalysis.gaps ?? []).slice(0, 5).map((gap) => (
                <div key={gap.productLabel} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-medium text-zinc-900">{gap.productLabel}</p>
                  <p className="text-zinc-600">Shortage {gap.shortageUnits} · coverage {gap.coveragePct}%</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h4 className="font-semibold text-zinc-950">Planning actions</h4>
            <div className="mt-3 space-y-2">
              {(data.preview.recommendations.steps ?? []).slice(0, 5).map((step) => (
                <div key={step.step} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-medium text-zinc-900">{step.step}</p>
                  <p className="text-zinc-600">{step.owner}: {step.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Planning Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const gaps = readArray<{ productLabel: string; shortageUnits: number; coveragePct: number }>(packet.gapAnalysisJson, "gaps");
            const constraints = readArray<{ label: string; severity: string; detail: string }>(packet.constraintJson, "items");
            const steps = readArray<{ step: string; action: string }>(packet.recommendationJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.planningScore}/100 · {packet.horizonDays} days
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Demand {Number(packet.demandUnits).toLocaleString()} · available {Number(packet.availableUnits).toLocaleString()} · inbound {Number(packet.inboundUnits).toLocaleString()} · shortage {Number(packet.shortageUnits).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Scenario {packet.scenarioDraftId ?? "not linked"} · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_planning_review", { packetId: packet.id, approvalNote: approvalNotes[packet.id] ?? "" }, "Planning review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Gaps</p>
                    <p className="mt-1">{gaps.slice(0, 3).map((gap) => `${gap.productLabel}: ${gap.shortageUnits}`).join(", ") || "No shortage gaps"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Constraints</p>
                    <p className="mt-1">{constraints.slice(0, 3).map((item) => `${item.severity} ${item.label}`).join(", ") || "No constraints"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Actions</p>
                    <p className="mt-1">{steps.slice(0, 3).map((step) => step.step).join(", ") || "No actions"}</p>
                  </div>
                </div>
                <textarea
                  value={approvalNotes[packet.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional planning approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No planning bridge packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
