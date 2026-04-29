"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number | string>;
  preview: {
    eventIntelligenceScore: number;
    leadershipSummary: string;
    externalEventJson: { eventReviewRiskCount: number; guardrail: string };
    exposureMappingJson: { exposureLinkageRiskCount: number; guardrail: string };
    twinScenarioJson: { twinScenarioRiskCount: number; guardrail: string };
    mitigationPortfolioJson: { mitigationRecommendationRiskCount: number; guardrail: string };
    escalationCadenceJson: { coordinationEscalationRiskCount: number; guardrail: string };
    credibilityJson: { credibilityRiskCount: number; guardrail: string };
    responsePlan: { status: string; guardrail: string };
    rollbackPlan: { guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    eventIntelligenceScore: number;
    eventReviewRiskCount: number;
    exposureLinkageRiskCount: number;
    twinScenarioRiskCount: number;
    mitigationRecommendationRiskCount: number;
    coordinationEscalationRiskCount: number;
    credibilityRiskCount: number;
    externalEventJson: unknown;
    exposureMappingJson: unknown;
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

export function ExternalRiskEventIntelligenceClient({
  initialSnapshot,
  canEdit,
}: {
  initialSnapshot: Snapshot;
  canEdit: boolean;
}) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/external-risk-event-intelligence", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load External Risk Intelligence."));
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
    const res = await fetch("/api/assistant/external-risk-event-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update External Risk Intelligence."));
      return;
    }
    setMessage(success);
    if (raw && typeof raw === "object" && "snapshot" in raw) setData((raw as { snapshot: Snapshot }).snapshot);
    else await load();
  }

  const previewScore =
    typeof data.signals.previewEventIntelligenceScore === "number"
      ? data.signals.previewEventIntelligenceScore
      : data.preview.eventIntelligenceScore;

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view Sprint 20, but packet creation and risk actions require edit access.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 20</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">External Risk &amp; Event Intelligence (SCRI)</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              SCRI triage cues, deterministic exposure links, Twin posture, ACTIVE mitigation recommendations, escalation bridges, and ingest credibility — advisory overlay;
              no SCRI/Twin mutations from this workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview intelligence score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{previewScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Aggregate SCRI + Twin telemetry", "External events, exposure entities, Twin signals/insights, recommendations, war rooms, SCRI task bridges."],
            ["Step 2", "Create intelligence packet", "Persist dimensional JSON, executive narrative, response plan, rollback notes."],
            ["Step 3", "Risk council review", "Queue or approve review — SCRI/Twin actions stay governed elsewhere."],
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
          onClick={() => void post("create_packet", {}, "External risk intelligence packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 20 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {[
          ["SCRI events", data.signals.scriEventsSampled],
          ["Twin signals", data.signals.twinSignalsSampled],
          ["Twin insights", data.signals.twinInsightsSampled],
          ["War rooms", data.signals.warRoomsSampled],
          ["SCRI task links", data.signals.taskLinksTracked],
          ["Score", previewScore],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{typeof value === "number" ? value : Number(value ?? 0)}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live SCRI / Twin preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Events &amp; exposure</p>
              <p className="mt-1 text-sm text-zinc-600">
                SCRI triage cues {data.preview.externalEventJson.eventReviewRiskCount}; exposure linkage cues {data.preview.exposureMappingJson.exposureLinkageRiskCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Twin &amp; mitigation</p>
              <p className="mt-1 text-sm text-zinc-600">
                Twin/scenario cues {data.preview.twinScenarioJson.twinScenarioRiskCount}; mitigation portfolio signals {data.preview.mitigationPortfolioJson.mitigationRecommendationRiskCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Escalation &amp; credibility</p>
              <p className="mt-1 text-sm text-zinc-600">
                Coordination cues {data.preview.escalationCadenceJson.coordinationEscalationRiskCount}; credibility cues {data.preview.credibilityJson.credibilityRiskCount}.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Guardrails</h3>
          <div className="mt-4 grid gap-3 text-sm text-zinc-700">
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.externalEventJson.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.exposureMappingJson.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.twinScenarioJson.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.responsePlan.guardrail}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const reviewSignals = readArray<{ title?: string }>(packet.externalEventJson, "reviewSignals");
            const exposureGaps = readArray<{ title?: string }>(packet.exposureMappingJson, "exposureGaps");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.eventIntelligenceScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      SCRI triage {packet.eventReviewRiskCount} · exposure {packet.exposureLinkageRiskCount} · Twin {packet.twinScenarioRiskCount} · mitigation{" "}
                      {packet.mitigationRecommendationRiskCount} · coordination {packet.coordinationEscalationRiskCount} · credibility {packet.credibilityRiskCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"}
                      onClick={() =>
                        void post("queue_external_risk_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "External risk review queued.")
                      }
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"}
                      onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "External risk packet approved.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Approve packet
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">SCRI triage</p>
                    <p className="mt-1">{reviewSignals.slice(0, 2).map((row) => row.title ?? "Event").join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Exposure gaps</p>
                    <p className="mt-1">{exposureGaps.slice(0, 2).map((row) => row.title ?? "Event").join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Coordination</p>
                    <p className="mt-1">{packet.coordinationEscalationRiskCount} escalation cue(s)</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{rollback[0] ?? "No silent SCRI mutation."}</p>
                  </div>
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional SCRI / Twin council note"
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 20 packets yet. Create the first durable External Risk packet from the live preview.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
