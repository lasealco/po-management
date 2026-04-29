"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    reliabilityScore: number;
    leadershipSummary: string;
    openIncidentCount: number;
    securityRiskCount: number;
    connectorRiskCount: number;
    automationRiskCount: number;
    changeBlockerCount: number;
    operationalActionCount: number;
    reliabilityPosture: { openIncidentCount: number; highSeverityIncidentCount: number; averageHealthScore: number; evidenceCoveragePct: number; negativeFeedbackRatePct: number; guardrail: string };
    securityOperations: { trustPacketCount: number; riskyTrustPacketCount: number; securityRiskCount: number; guardrail: string };
    connectorHealth: { connectorCount: number; ingestionRunCount: number; connectorRiskCount: number; guardrail: string };
    automationSafety: { automationPolicyCount: number; shadowRunCount: number; automationRiskCount: number; guardrail: string };
    incidentReadiness: { unresolvedIncidentCount: number; pendingReliabilityActionCount: number; postmortemNeededCount: number; guardrail: string };
    releaseChangeControl: { releasePacketCount: number; blockedReleasePacketCount: number; rolloutControlCount: number; changeBlockerCount: number; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[]; guardrail: string };
    rollbackPlan: { steps: string[]; guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    reliabilityScore: number;
    openIncidentCount: number;
    securityRiskCount: number;
    connectorRiskCount: number;
    automationRiskCount: number;
    changeBlockerCount: number;
    operationalActionCount: number;
    reliabilityPostureJson: unknown;
    securityOperationsJson: unknown;
    connectorHealthJson: unknown;
    automationSafetyJson: unknown;
    incidentReadinessJson: unknown;
    releaseChangeControlJson: unknown;
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

export function PlatformReliabilitySecurityClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/platform-reliability-security", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Platform Reliability & Security Operations."));
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
    const res = await fetch("/api/assistant/platform-reliability-security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Platform Reliability & Security Operations."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 14, but packet creation and platform operations review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 14</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Platform Reliability & Security Operations</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Freeze reliability posture, security operations, connector health, automation safety, incident readiness, release/change controls, and rollback evidence before production operations.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview reliability</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.reliabilityScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Sense platform health", "Load observability incidents, trust packets, release gates, admin controls, API Hub connectors, ingestion runs, automation evidence, audit events, and action queue items."],
            ["Step 2", "Freeze ops packet", "Persist reliability posture, security operations, connector health, automation safety, incident readiness, change controls, response plan, and rollback evidence."],
            ["Step 3", "Approve before action", "Queue SRE/security review before paging, runtime flags, connector retries, secret rotation, automation changes, deployments, or security communications."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Platform Reliability packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 14 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-10">
        {[
          ["Incidents", data.signals.observabilityIncidents],
          ["Trust", data.signals.privacySecurityPackets],
          ["Release", data.signals.aiQualityReleasePackets],
          ["Admin", data.signals.adminControls],
          ["Connectors", data.signals.connectors],
          ["Runs", data.signals.ingestionRuns],
          ["Policies", data.signals.automationPolicies],
          ["Shadow", data.signals.shadowRuns],
          ["Actions", data.signals.actionQueueItems],
          ["Score", data.signals.previewReliabilityScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Platform Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Reliability posture</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.reliabilityPosture.openIncidentCount} open incident(s), {data.preview.reliabilityPosture.highSeverityIncidentCount} high severity, {data.preview.reliabilityPosture.evidenceCoveragePct}% evidence coverage.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Security operations</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.securityOperations.securityRiskCount} security risk signal(s), {data.preview.securityOperations.riskyTrustPacketCount} risky trust packet(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Release/change controls</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.releaseChangeControl.changeBlockerCount} blocker(s), {data.preview.releaseChangeControl.blockedReleasePacketCount} blocked release packet(s).</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Ops Readiness</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Connector health</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.connectorHealth.connectorRiskCount} connector risk(s), {data.preview.connectorHealth.connectorCount} connector(s), {data.preview.connectorHealth.ingestionRunCount} ingestion run(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Automation safety</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.automationSafety.automationRiskCount} automation risk(s), {data.preview.automationSafety.shadowRunCount} shadow run(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Incident readiness</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.incidentReadiness.unresolvedIncidentCount} unresolved incident(s), {data.preview.incidentReadiness.pendingReliabilityActionCount} pending ops action(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const severeIncidents = readArray<{ title: string; severity: string; healthScore: number }>(packet.reliabilityPostureJson, "severeIncidents");
            const connectorRisks = readArray<{ name: string; authState: string; status: string }>(packet.connectorHealthJson, "staleOrUnreadyConnectors");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.reliabilityScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Incidents {packet.openIncidentCount} · security {packet.securityRiskCount} · connectors {packet.connectorRiskCount} · automation {packet.automationRiskCount} · change {packet.changeBlockerCount} · actions {packet.operationalActionCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "OPS_REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_ops_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Platform operations review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Platform Reliability packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Incidents</p><p className="mt-1">{severeIncidents.slice(0, 2).map((item) => `${item.title}: ${item.severity}/${item.healthScore}`).join("; ") || "No severe incidents"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Connectors</p><p className="mt-1">{connectorRisks.slice(0, 2).map((item) => `${item.name}: ${item.status}/${item.authState}`).join("; ") || "No connector risks"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No platform mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional SRE/security review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 14 packets yet. Create the first durable Platform Reliability & Security Operations packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
