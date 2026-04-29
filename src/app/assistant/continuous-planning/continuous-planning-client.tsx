"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type PlanningPacket = {
  id: string;
  title: string;
  status: string;
  planHealthScore: number;
  replanningTriggerCount: number;
  demandVariancePct: number;
  supplyCoveragePct: number;
  inventoryCoveragePct: number;
  transportRiskCount: number;
  recoveryActionCount: number;
  controlSnapshotJson: unknown;
  varianceJson: unknown;
  triggerJson: unknown;
  recoveryPlanJson: unknown;
  ownerWorkJson: unknown;
  approvalPlanJson: unknown;
  rollbackPlanJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Snapshot = {
  signals: {
    planHealthScore: number;
    replanningTriggerCount: number;
    demandVariancePct: number;
    supplyCoveragePct: number;
    inventoryCoveragePct: number;
    transportRiskCount: number;
    recoveryActionCount: number;
  };
  preview: {
    planHealthScore: number;
    replanningTriggerCount: number;
    demandVariancePct: number;
    supplyCoveragePct: number;
    inventoryCoveragePct: number;
    transportRiskCount: number;
    recoveryActionCount: number;
    triggers: { triggers: Array<{ key: string; severity: string; detail: string }> };
    recoveryPlan: { actions: Array<{ actionKind: string; priority: string; owner: string; detail: string }>; recommendation: string; guardrail: string };
    ownerWork: { workItems: Array<{ owner: string; actionKind: string; priority: string; detail: string }> };
    approvalPlan: { steps: string[]; guardrail: string };
    rollbackPlan: { steps: string[] };
    leadershipSummary: string;
  };
  packets: PlanningPacket[];
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function ContinuousPlanningClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/continuous-planning", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load continuous planning."));
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
    const res = await fetch("/api/assistant/continuous-planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update continuous planning."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP35</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Continuous Planning Control Tower</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Monitor plan versus actual across demand, supply, inventory, WMS, transport, supplier commitments, finance risk,
          and AMP34 simulation recommendations. Replanning remains approval-gated.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Step 1", "Sense", "Read live demand, supply, inventory, WMS, transport, finance, and simulation signals."],
            ["Step 2", "Compare", "Calculate plan-vs-actual variances and coverage."],
            ["Step 3", "Trigger", "Identify breached replanning triggers and owners."],
            ["Step 4", "Review", "Queue recovery work before downstream execution."],
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
          onClick={() => void post("create_packet", {}, "Continuous planning packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create planning packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {[
          ["Health", data.signals.planHealthScore],
          ["Triggers", data.signals.replanningTriggerCount],
          ["Demand var", `${data.signals.demandVariancePct}%`],
          ["Supply cov", `${data.signals.supplyCoveragePct}%`],
          ["Inventory cov", `${data.signals.inventoryCoveragePct}%`],
          ["Transport risk", data.signals.transportRiskCount],
          ["Recovery", data.signals.recoveryActionCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 break-words text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Plan Health Preview</h3>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Triggers</p>
            <p className="mt-1 text-sm text-amber-800">
              {data.preview.triggers.triggers.slice(0, 4).map((trigger) => `${trigger.severity} ${trigger.key}`).join("; ") || "No breached triggers"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Recovery</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.recoveryPlan.recommendation}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Guardrail</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.approvalPlan.guardrail}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Planning Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const triggers = readArray<{ key: string; severity: string; detail: string }>(packet.triggerJson, "triggers");
            const actions = readArray<{ actionKind: string; priority: string; owner: string; detail: string }>(packet.recoveryPlanJson, "actions");
            const workItems = readArray<{ owner: string; actionKind: string; priority: string }>(packet.ownerWorkJson, "workItems");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · health {packet.planHealthScore}/100 · triggers {packet.replanningTriggerCount}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Demand {packet.demandVariancePct}% · supply {packet.supplyCoveragePct}% · inventory {packet.inventoryCoveragePct}% · recovery actions {packet.recoveryActionCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_planning_review", { packetId: packet.id, approvalNote: notes[packet.id] ?? "" }, "Planning review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue planning review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {[
                    ["Triggers", triggers.slice(0, 2).map((item) => `${item.severity} ${item.key}`).join("; ") || "None"],
                    ["Actions", actions.slice(0, 2).map((item) => `${item.owner}: ${item.actionKind}`).join("; ") || "None"],
                    ["Owner work", workItems.slice(0, 2).map((item) => `${item.owner}: ${item.priority}`).join("; ") || "None"],
                    ["Rollback", rollback.slice(0, 2).join("; ") || "No rollback steps"],
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
                  placeholder="Optional planning review note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No continuous planning packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
