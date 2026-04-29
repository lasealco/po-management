"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    autonomyScore: number;
    leadershipSummary: string;
    capacityPosture: { warehouseCount: number; openTaskCount: number; agedTaskCount: number; heldBalanceCount: number; byWarehouse: Array<{ label: string; capacityScore: number; openTaskCount: number; agedTaskCount: number; heldBalanceCount: number; allocationPct: number }>; guardrail: string };
    taskRecovery: { openTaskCount: number; agedTaskCount: number; riskyTasks: Array<{ warehouseName: string; taskType: string; ageHours: number; productName: string | null; shipmentNo: string | null; orderNumber: string | null; proposedAction: string }>; guardrail: string };
    waveHealth: { waveRiskCount: number; waveRisks: Array<{ warehouseName: string; waveNo: string; status: string; riskReasons: string[] }>; guardrail: string };
    outboundFulfillment: { outboundRiskCount: number; risks: Array<{ warehouseName: string; outboundNo: string; status: string; riskReasons: string[] }>; guardrail: string };
    exceptionEvidence: { exceptionCount: number; shipmentExceptions: Array<{ shipmentNo: string | null; status: string; exceptionCount: number; lateReceiving: boolean }>; guardrail: string };
    supervisorAction: { recoveryActionCount: number; actions: Array<{ owner: string; priority: string; action: string }>; pendingActions: Array<{ actionKind: string; priority: string }>; guardrail: string };
    mobileWork: { mobileCandidateCount: number; mobileCandidates: Array<{ taskType: string; label: string; priority: string; requiresSupervisorApproval: boolean }>; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    autonomyScore: number;
    warehouseCount: number;
    openTaskCount: number;
    agedTaskCount: number;
    waveRiskCount: number;
    outboundRiskCount: number;
    exceptionCount: number;
    recoveryActionCount: number;
    capacityPostureJson: unknown;
    taskRecoveryJson: unknown;
    waveHealthJson: unknown;
    outboundFulfillmentJson: unknown;
    exceptionEvidenceJson: unknown;
    supervisorActionJson: unknown;
    mobileWorkJson: unknown;
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

export function WarehouseFulfillmentAutonomyClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/warehouse-fulfillment-autonomy", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Warehouse & Fulfillment Autonomy."));
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
    const res = await fetch("/api/assistant/warehouse-fulfillment-autonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Warehouse & Fulfillment Autonomy."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 8, but packet creation and supervisor review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 8</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Warehouse & Fulfillment Autonomy</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Turn WMS capacity, task recovery, wave health, outbound risk, shipment exceptions, supervisor actions, and mobile work drafts into one approval-gated autonomy workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview autonomy</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.autonomyScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Read the floor", "Load WMS tasks, waves, inventory, outbounds, shipments, capacity plans, and queued recovery evidence."],
            ["Step 2", "Draft safe recovery", "Persist task, wave, outbound, exception, supervisor, mobile, and rollback plans as packet evidence."],
            ["Step 3", "Approve before execution", "Queue supervisor review without completing tasks, moving stock, releasing waves, shipping orders, or changing promises."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Warehouse Fulfillment packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 8 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {[
          ["Warehouses", data.signals.warehouses],
          ["Tasks", data.signals.tasks],
          ["Waves", data.signals.waves],
          ["Outbounds", data.signals.outboundOrders],
          ["Inventory", data.signals.inventoryBalances],
          ["Shipments", data.signals.shipments],
          ["Capacity", data.signals.capacityPlans],
          ["Queue", data.signals.actionQueueItems],
          ["Score", data.signals.previewAutonomyScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Fulfillment Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Capacity posture</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.capacityPosture.warehouseCount} warehouse(s), {data.preview.capacityPosture.openTaskCount} open task(s), {data.preview.capacityPosture.heldBalanceCount} held balance(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Task recovery</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.taskRecovery.agedTaskCount} aged task(s), {data.preview.mobileWork.mobileCandidateCount} mobile draft candidate(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Supervisor work</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.supervisorAction.recoveryActionCount} recovery action(s), {data.preview.supervisorAction.pendingActions.length} pending queue link(s).</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Risks and Guardrails</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Wave health</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.waveHealth.waveRiskCount} wave risk(s) need release/close review.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Outbound fulfillment</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.outboundFulfillment.outboundRiskCount} outbound risk(s) across pick, pack, ship, or ship-date lag.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Exceptions</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.exceptionEvidence.exceptionCount} shipment or receiving exception signal(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const riskyTasks = readArray<{ warehouseName: string; taskType: string; ageHours: number; proposedAction: string }>(packet.taskRecoveryJson, "riskyTasks");
            const waveRisks = readArray<{ warehouseName: string; waveNo: string; status: string; riskReasons: string[] }>(packet.waveHealthJson, "waveRisks");
            const outboundRisks = readArray<{ warehouseName: string; outboundNo: string; status: string; riskReasons: string[] }>(packet.outboundFulfillmentJson, "risks");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.autonomyScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Warehouses {packet.warehouseCount} · open tasks {packet.openTaskCount} · aged {packet.agedTaskCount} · waves {packet.waveRiskCount} · outbounds {packet.outboundRiskCount} · exceptions {packet.exceptionCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "SUPERVISOR_REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_supervisor_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Supervisor review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Warehouse Fulfillment packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Tasks</p><p className="mt-1">{riskyTasks.slice(0, 2).map((item) => `${item.taskType} ${item.ageHours}h: ${item.proposedAction}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Waves</p><p className="mt-1">{waveRisks.slice(0, 2).map((item) => `${item.waveNo}: ${item.riskReasons.join(", ")}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Outbounds</p><p className="mt-1">{outboundRisks.slice(0, 2).map((item) => `${item.outboundNo}: ${item.riskReasons.join(", ")}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No source mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional supervisor review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 8 packets yet. Create the first durable Warehouse Fulfillment packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
