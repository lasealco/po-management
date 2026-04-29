"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    nerveScore: number;
    leadershipSummary: string;
    controlTower: { controlTowerRiskCount: number; guardrail: string };
    crossModule: { crossModuleIncidentCount: number; guardrail: string };
    blastRadius: { blastRadiusSignalCount: number; guardrail: string };
    playbookRecovery: { recoveryGapCount: number; guardrail: string };
    observabilityTwin: { observabilityRiskCount: number; twinRiskCount: number; guardrail: string };
    financeIntegration: { financeIntegrationRiskCount: number; guardrail: string };
    dedupeMerge: { dedupeCandidateCount: number; guardrail: string };
    customerComms: { guardrail: string };
    responsePlan: { status: string; guardrail: string };
    rollbackPlan: { guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    nerveScore: number;
    controlTowerRiskCount: number;
    crossModuleIncidentCount: number;
    blastRadiusSignalCount: number;
    recoveryGapCount: number;
    observabilityRiskCount: number;
    twinRiskCount: number;
    financeIntegrationRiskCount: number;
    controlTowerJson: unknown;
    blastRadiusJson: unknown;
    playbookRecoveryJson: unknown;
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

export function IncidentNerveCenterClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/incident-nerve-center", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Incident Nerve Center."));
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
    const res = await fetch("/api/assistant/incident-nerve-center", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Incident Nerve Center."));
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
      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view Sprint 17, but packet creation and incident command actions require edit access.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 17</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Cross-Domain Exception &amp; Incident Nerve Center</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Unify Control Tower exceptions, assistant incident rooms, blast radius, playbook gaps, observability and Twin signals, finance/integration spikes, and dedupe hints — human-led merges,
              owners, and communications only.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview nerve score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.nerveScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Aggregate exception signals", "Pull CT exceptions, incident rooms, observability, Twin, war rooms, invoices, integration reviews, and queues."],
            ["Step 2", "Create nerve-center packet", "Persist blast radius, playbook/recovery, dedupe hints, comms guardrails, response plan, and rollback evidence."],
            ["Step 3", "Command review first", "Queue or approve review — merges, owners, customer/carrier sends, and closures stay manual."],
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
          onClick={() => void post("create_packet", {}, "Incident Nerve Center packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 17 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {[
          ["CT exceptions", data.signals.ctExceptions],
          ["Incident rooms", data.signals.assistantIncidents],
          ["Observability", data.signals.observabilityIncidents],
          ["Twin signals", data.signals.twinRiskSignals],
          ["War rooms", data.signals.riskWarRooms],
          ["Invoices", data.signals.invoiceIntakes],
          ["API Hub", data.signals.apiHubReviewItems],
          ["Score", data.signals.previewNerveScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live nerve-center preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Control Tower &amp; cross-module</p>
              <p className="mt-1 text-sm text-zinc-600">
                CT risk overlay {data.preview.controlTower.controlTowerRiskCount}; cross-module incident signals {data.preview.crossModule.crossModuleIncidentCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Blast radius &amp; recovery</p>
              <p className="mt-1 text-sm text-zinc-600">
                Blast cues {data.preview.blastRadius.blastRadiusSignalCount}; playbook/recovery gaps {data.preview.playbookRecovery.recoveryGapCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Observability, Twin, finance</p>
              <p className="mt-1 text-sm text-zinc-600">
                Observability/war-room overlay {data.preview.observabilityTwin.observabilityRiskCount}; unacknowledged Twin {data.preview.observabilityTwin.twinRiskCount}; finance/integration cues{" "}
                {data.preview.financeIntegration.financeIntegrationRiskCount}; dedupe hints {data.preview.dedupeMerge.dedupeCandidateCount}.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Guardrails</h3>
          <div className="mt-4 grid gap-3 text-sm text-zinc-700">
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.controlTower.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.crossModule.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.customerComms.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.responsePlan.guardrail}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const openCt = readArray<{ shipmentNo: string | null }>(packet.controlTowerJson, "openExceptions");
            const multiShipment = readArray<{ shipmentId: string }>(packet.blastRadiusJson, "multiExceptionShipments");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.nerveScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      CT {packet.controlTowerRiskCount} · rooms {packet.crossModuleIncidentCount} · blast {packet.blastRadiusSignalCount} · recovery {packet.recoveryGapCount} · obs {packet.observabilityRiskCount}{" "}
                      · twin {packet.twinRiskCount} · finance/integration {packet.financeIntegrationRiskCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"}
                      onClick={() => void post("queue_incident_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Incident command review queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"}
                      onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Incident Nerve Center packet approved.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Approve packet
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Control Tower</p>
                    <p className="mt-1">{openCt.slice(0, 2).map((row) => row.shipmentNo ?? "Shipment").join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Blast clusters</p>
                    <p className="mt-1">{multiShipment.slice(0, 2).map((row) => row.shipmentId.slice(0, 8)).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Recovery gaps</p>
                    <p className="mt-1">{packet.recoveryGapCount} open gap(s)</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{rollback[0] ?? "No silent mutation."}</p>
                  </div>
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional incident command note"
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 17 packets yet. Create the first durable Incident Nerve Center packet from the live preview.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
