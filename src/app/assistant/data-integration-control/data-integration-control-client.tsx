"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    integrationScore: number;
    leadershipSummary: string;
    connectorReadiness: { connectorCount: number; readyConnectorCount: number; attentionConnectorCount: number; blockedConnectorCount: number; failedRunCount: number; connectors: Array<{ name: string; sourceKind: string; readiness: { overall: string; reasons: string[] }; failedRunCount: number }>; guardrail: string };
    dataContract: { contractGapCount: number; sourceKinds: string[]; mappingTemplateCount: number; missingContractSignals: Array<{ label: string; reason: string }>; guardrail: string };
    mappingReview: { mappingGapCount: number; mappingJobCount: number; failedJobCount: number; weakTemplateCount: number; guardrail: string };
    stagingReview: { stagingRiskCount: number; stagingBatchCount: number; openBatchCount: number; stagingRowCount: number; riskyRows: Array<{ label: string; targetDomain: string; issueCount: number; reason: string }>; guardrail: string };
    masterDataQuality: { masterDataRiskCount: number; latest: null | { title: string; qualityScore: number; duplicateCount: number; gapCount: number; conflictCount: number }; guardrail: string };
    twinIngest: { twinIngestRiskCount: number; ingestEventCount: number; nonIdempotentEventCount: number; staleIngest: boolean; guardrail: string };
    launchChecklist: { launchActionCount: number; steps: Array<{ key: string; status: string; detail: string }>; pendingReviews: Array<{ title: string; severity: string; sourceType: string }>; pendingActions: Array<{ actionKind: string; priority: string }>; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    integrationScore: number;
    connectorCount: number;
    blockedConnectorCount: number;
    mappingGapCount: number;
    stagingRiskCount: number;
    masterDataRiskCount: number;
    twinIngestRiskCount: number;
    launchActionCount: number;
    connectorReadinessJson: unknown;
    dataContractJson: unknown;
    mappingReviewJson: unknown;
    stagingReviewJson: unknown;
    masterDataQualityJson: unknown;
    twinIngestJson: unknown;
    launchChecklistJson: unknown;
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

export function DataIntegrationControlClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/data-integration-control", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Data & Integration Control."));
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
    const res = await fetch("/api/assistant/data-integration-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Data & Integration Control."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 9, but packet creation and integration review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 9</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Data & Integration Control Plane</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Govern API Hub connectors, data contracts, mappings, staging rows, MDM quality, twin ingest, and launch readiness without silently changing integration or source-system state.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview integration</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.integrationScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Assess readiness", "Load connector lifecycle, auth, sync, mapping, staging, master-data, twin ingest, and review evidence."],
            ["Step 2", "Freeze launch evidence", "Persist readiness gaps, data contracts, mapping review, staging risks, MDM blockers, twin ingest, and rollback controls."],
            ["Step 3", "Approve before rollout", "Queue integration review without activating connectors, applying rows, changing MDM, exposing partners, or triggering syncs."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Data Integration packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 9 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-10">
        {[
          ["Connectors", data.signals.connectors],
          ["Runs", data.signals.ingestionRuns],
          ["Templates", data.signals.mappingTemplates],
          ["Jobs", data.signals.mappingJobs],
          ["Batches", data.signals.stagingBatches],
          ["Rows", data.signals.stagingRows],
          ["Reviews", data.signals.assistantReviewItems],
          ["MDM", data.signals.masterDataRuns],
          ["Twin events", data.signals.twinIngestEvents],
          ["Score", data.signals.previewIntegrationScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Integration Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Connector readiness</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.connectorReadiness.readyConnectorCount} ready, {data.preview.connectorReadiness.attentionConnectorCount} attention, {data.preview.connectorReadiness.blockedConnectorCount} blocked.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Contracts and mappings</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.dataContract.contractGapCount} contract gap(s), {data.preview.mappingReview.mappingGapCount} mapping gap(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Staging and MDM</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.stagingReview.stagingRiskCount} staging risk(s), {data.preview.masterDataQuality.masterDataRiskCount} MDM risk(s).</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Launch Checklist</h3>
          <div className="mt-4 space-y-3">
            {data.preview.launchChecklist.steps.map((step) => (
              <div key={step.key} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-950">{step.key.replaceAll("_", " ")} · {step.status}</p>
                <p className="mt-1 text-sm text-zinc-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const connectors = readArray<{ name: string; readiness: { overall: string; reasons: string[] }; failedRunCount: number }>(packet.connectorReadinessJson, "connectors");
            const contractGaps = readArray<{ label: string; reason: string }>(packet.dataContractJson, "missingContractSignals");
            const riskyRows = readArray<{ label: string; targetDomain: string; reason: string }>(packet.stagingReviewJson, "riskyRows");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.integrationScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Connectors {packet.connectorCount} · blocked {packet.blockedConnectorCount} · mapping {packet.mappingGapCount} · staging {packet.stagingRiskCount} · MDM {packet.masterDataRiskCount} · twin {packet.twinIngestRiskCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "INTEGRATION_REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_integration_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Integration review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Data Integration packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Connectors</p><p className="mt-1">{connectors.slice(0, 2).map((item) => `${item.name}: ${item.readiness.overall}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Contracts</p><p className="mt-1">{contractGaps.slice(0, 2).map((item) => `${item.label}: ${item.reason}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Staging</p><p className="mt-1">{riskyRows.slice(0, 2).map((item) => `${item.targetDomain}: ${item.label}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No source mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional integration launch review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 9 packets yet. Create the first durable Data Integration packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
