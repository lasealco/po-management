"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    contractPackets: number;
    governancePackets: number;
    riskRooms: number;
    auditEvents: number;
    actionQueueItems: number;
    externalEvents: number;
    previewRiskScore: number;
    previewControlGaps: number;
  };
  preview: {
    riskScore: number;
    leadershipSummary: string;
    obligationGraph: { obligationCount: number; sourceCount: number; obligations: Array<{ sourceType: string; title: string; obligationCount: number; riskCount: number; status: string }> };
    controlTesting: { testedControlCount: number; controlGapCount: number; gaps: Array<{ sourceType: string; control: string; severity: string; finding: string }>; guardrail: string };
    auditEvidence: { auditEventCount: number; evidenceBackedCount: number; weakEvidenceCount: number; evidenceCoveragePct: number };
    contractPerformance: { packetCount: number; riskPacketCount: number; renewalRiskCount: number; complianceGapCount: number; riskPackets: Array<{ title: string; complianceScore: number; renewalRiskCount: number; complianceGapCount: number }> };
    regulatoryHorizon: { eventCount: number; events: Array<{ title: string; eventType: string; severity: string; confidence: number; reviewState: string }>; guardrail: string };
    externalRisk: { activeEventCount: number; highRiskRoomCount: number; topEvents: Array<{ title: string; severity: string; confidence: number; sourceCount: number }>; highRiskRooms: Array<{ title: string; severity: string; riskScore: number; status: string }> };
    responsePlan: { status: string; owners: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    riskScore: number;
    obligationCount: number;
    controlGapCount: number;
    auditEvidenceCount: number;
    contractRiskCount: number;
    externalRiskCount: number;
    obligationGraphJson: unknown;
    controlTestingJson: unknown;
    auditEvidenceJson: unknown;
    contractPerformanceJson: unknown;
    regulatoryHorizonJson: unknown;
    externalRiskJson: unknown;
    responsePlanJson: unknown;
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

export function EnterpriseRiskControlsClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/enterprise-risk-controls", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Enterprise Risk & Controls."));
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
    const res = await fetch("/api/assistant/enterprise-risk-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Enterprise Risk & Controls."));
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
          You can view Sprint 2, but creating packets and review actions require an edit grant in reporting, settings, suppliers, RFQ, tariffs, or SCRI.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 2</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Enterprise Risk & Controls</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Bring obligations, control testing, audit evidence, contract performance, regulatory horizon, and external risk pressure into one
              durable review packet for risk, compliance, audit, and legal owners.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview risk</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.riskScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Map obligations", "Unify contract, governance, audit, action queue, and external risk evidence."],
            ["Step 2", "Test controls", "Persist gaps, weak evidence, regulatory horizon, and response-plan ownership."],
            ["Step 3", "Approve response", "Queue or approve remediation review without mutating source systems."],
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
          onClick={() => void post("create_packet", {}, "Enterprise Risk & Controls packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 2 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Contracts", data.signals.contractPackets],
          ["Governance", data.signals.governancePackets],
          ["War rooms", data.signals.riskRooms],
          ["Audit", data.signals.auditEvents],
          ["Actions", data.signals.actionQueueItems],
          ["Events", data.signals.externalEvents],
          ["Gaps", data.signals.previewControlGaps],
          ["Risk", data.signals.previewRiskScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Control Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            {data.preview.obligationGraph.obligations.slice(0, 6).map((item) => (
              <article key={`${item.sourceType}-${item.title}`} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{item.sourceType} · {item.status}</p>
                <h4 className="mt-1 font-semibold text-zinc-950">{item.title}</h4>
                <p className="mt-1 text-sm text-zinc-600">Obligations {item.obligationCount} · risk signals {item.riskCount}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Controls, Evidence, and Horizon</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Control testing</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.controlTesting.controlGapCount} gap(s) across {data.preview.controlTesting.testedControlCount} tested signal(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Audit evidence</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.auditEvidence.evidenceCoveragePct}% coverage, {data.preview.auditEvidence.weakEvidenceCount} weak-evidence event(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Regulatory horizon</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.regulatoryHorizon.eventCount} event(s) that may require legal, compliance, or policy review.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">External risk</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.externalRisk.activeEventCount} active event(s), {data.preview.externalRisk.highRiskRoomCount} high-risk war room(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const gaps = readArray<{ control: string; severity: string; finding: string }>(packet.controlTestingJson, "gaps");
            const response = packet.responsePlanJson && typeof packet.responsePlanJson === "object" ? (packet.responsePlanJson as { status?: string; steps?: string[] }) : {};
            const horizon = readArray<{ title: string; severity: string }>(packet.regulatoryHorizonJson, "events");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · risk {packet.riskScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Obligations {packet.obligationCount} · control gaps {packet.controlGapCount} · evidence {packet.auditEvidenceCount} · contract risks {packet.contractRiskCount} · events {packet.externalRiskCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"}
                      onClick={() => void post("queue_control_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Enterprise Risk & Controls review queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"}
                      onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Enterprise Risk & Controls packet approved.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Approve packet
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Control gaps</p>
                    <p className="mt-1">{gaps.slice(0, 2).map((gap) => `${gap.severity}: ${gap.control}`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Response</p>
                    <p className="mt-1">{response.status ?? "Review"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Horizon</p>
                    <p className="mt-1">{horizon.slice(0, 2).map((event) => `${event.severity}: ${event.title}`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{rollback[0] ?? "No source mutation."}</p>
                  </div>
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional review note"
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 2 packets yet. Create the first durable Enterprise Risk & Controls packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
