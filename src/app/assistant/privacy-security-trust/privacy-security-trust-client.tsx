"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    governancePackets: number;
    agentGovernancePackets: number;
    observabilityIncidents: number;
    auditEvents: number;
    actionQueueItems: number;
    automationPolicies: number;
    externalEvents: number;
    previewTrustScore: number;
    previewTrustBlockers: number;
  };
  preview: {
    trustScore: number;
    leadershipSummary: string;
    consentPosture: { auditSignalCount: number; evidenceCoveragePct: number; consentReviewCandidates: Array<{ surface: string; answerKind: string; reason: string }>; guardrail: string };
    dataSubjectRights: { requestCount: number; workflowCount: number; legalHoldBlockCount: number; requests: Array<{ title: string; requestType: string; count: number; status: string }>; guardrail: string };
    dataTransfer: { transferRiskCount: number; events: Array<{ title: string; eventType: string; severity: string; confidence: number; reviewState: string }>; requiredReviews: string[]; guardrail: string };
    identityAccess: { identityRiskCount: number; riskyAgents: Array<{ title: string; highRiskAgentCount: number; governanceScore: number }>; weakPolicies: Array<{ actionKind: string; status: string; readinessScore: number; threshold: number }>; guardrail: string };
    securityExceptions: { exceptionCount: number; queue: Array<{ actionKind: string; priority: string; objectType: string | null }>; incidents: Array<{ title: string; severity: string; healthScore: number; evidenceGapCount: number }>; guardrail: string };
    threatExposure: { threatSignalCount: number; externalThreats: Array<{ title: string; severity: string; confidence: number; reviewState: string }>; weakTrustSignals: Array<{ surface: string; answerKind: string }>; guardrail: string };
    trustAssurance: { status: string; owners: string[]; blockers: string[]; assuranceChecklist: string[] };
    responsePlan: { status: string; owners: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    trustScore: number;
    privacyRiskCount: number;
    dsrRequestCount: number;
    transferRiskCount: number;
    identityRiskCount: number;
    securityExceptionCount: number;
    threatSignalCount: number;
    consentPostureJson: unknown;
    dataSubjectRightsJson: unknown;
    dataTransferJson: unknown;
    identityAccessJson: unknown;
    securityExceptionJson: unknown;
    threatExposureJson: unknown;
    trustAssuranceJson: unknown;
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

export function PrivacySecurityTrustClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/privacy-security-trust", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Privacy, Security & Trust."));
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
    const res = await fetch("/api/assistant/privacy-security-trust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Privacy, Security & Trust."));
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
          You can view Sprint 3, but creating packets and trust review actions require settings, reports, API Hub, or SCRI edit access.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 3</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Privacy, Security & Trust</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Govern consent posture, DSR workflows, data transfers, zero-trust access, security exceptions, threat exposure,
              and trust assurance in one review-gated assistant workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview trust</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.trustScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.trustAssurance.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Inspect trust posture", "Gather governance, agent, observability, audit, automation, action, and external risk signals."],
            ["Step 2", "Create packet", "Persist consent, DSR, transfer, identity, security exception, threat, and assurance evidence."],
            ["Step 3", "Review safely", "Queue or approve trust remediation without mutating source records or permissions."],
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
          onClick={() => void post("create_packet", {}, "Privacy, Security & Trust packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 3 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-9">
        {[
          ["Governance", data.signals.governancePackets],
          ["Agents", data.signals.agentGovernancePackets],
          ["Incidents", data.signals.observabilityIncidents],
          ["Audit", data.signals.auditEvents],
          ["Actions", data.signals.actionQueueItems],
          ["Policies", data.signals.automationPolicies],
          ["Events", data.signals.externalEvents],
          ["Blockers", data.signals.previewTrustBlockers],
          ["Trust", data.signals.previewTrustScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Trust Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            {data.preview.trustAssurance.blockers.slice(0, 6).map((blocker) => (
              <article key={blocker} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">Trust blocker</p>
                <p className="mt-1 text-sm text-zinc-700">{blocker}</p>
              </article>
            ))}
            {data.preview.trustAssurance.blockers.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No trust blockers in the live preview.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Privacy, Access, and Threat Controls</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Consent posture</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.consentPosture.evidenceCoveragePct}% evidence coverage across {data.preview.consentPosture.auditSignalCount} privacy signal(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">DSR workflows</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.dataSubjectRights.requestCount} request signal(s), {data.preview.dataSubjectRights.legalHoldBlockCount} legal-hold blocker(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Identity and access</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.identityAccess.identityRiskCount} identity, entitlement, tool-scope, or automation risk signal(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Security and threat exposure</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.securityExceptions.exceptionCount} exception(s), {data.preview.threatExposure.threatSignalCount} threat/trust signal(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const blockers = readArray<string>(packet.trustAssuranceJson, "blockers");
            const transferEvents = readArray<{ title: string; severity: string }>(packet.dataTransferJson, "events");
            const exceptions = readArray<{ actionKind?: string; title?: string; severity?: string; priority?: string }>(packet.securityExceptionJson, "queue");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · trust {packet.trustScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Privacy {packet.privacyRiskCount} · DSR {packet.dsrRequestCount} · transfers {packet.transferRiskCount} · identity {packet.identityRiskCount} · exceptions {packet.securityExceptionCount} · threats {packet.threatSignalCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"}
                      onClick={() => void post("queue_trust_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Privacy, Security & Trust review queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"}
                      onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Privacy, Security & Trust packet approved.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Approve packet
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Blockers</p>
                    <p className="mt-1">{blockers.slice(0, 2).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Transfers</p>
                    <p className="mt-1">{transferEvents.slice(0, 2).map((event) => `${event.severity}: ${event.title}`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Exceptions</p>
                    <p className="mt-1">{exceptions.slice(0, 2).map((item) => item.actionKind ?? item.title ?? item.severity ?? item.priority).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{rollback[0] ?? "No source mutation."}</p>
                  </div>
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional trust review note"
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 3 packets yet. Create the first durable Privacy, Security & Trust packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
