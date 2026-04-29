"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number | string>;
  preview: {
    knowledgeScore: number;
    leadershipSummary: string;
    citationEvidenceJson: { evidenceCitationRiskCount: number; guardrail: string };
    promptGovernanceJson: { promptGovernanceRiskCount: number; guardrail: string };
    reviewPipelineJson: { reviewPipelineGapCount: number; guardrail: string };
    releaseGateJson: { releaseGateRiskCount: number; guardrail: string };
    responsePlan: { status: string; guardrail: string };
    rollbackPlan: { guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    knowledgeScore: number;
    evidenceCitationRiskCount: number;
    promptGovernanceRiskCount: number;
    reviewPipelineGapCount: number;
    releaseGateRiskCount: number;
    citationEvidenceJson: unknown;
    promptGovernanceJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    approvedAt: string | null;
    approvalNote: string | null;
    updatedAt: string;
  }>;
};

export function EnterpriseKnowledgeDocumentIntelligenceClient({
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
    const res = await fetch("/api/assistant/enterprise-knowledge-document-intelligence", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Enterprise Knowledge."));
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
    const res = await fetch("/api/assistant/enterprise-knowledge-document-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Enterprise Knowledge."));
      return;
    }
    setMessage(success);
    if (raw && typeof raw === "object" && "snapshot" in raw) setData((raw as { snapshot: Snapshot }).snapshot);
    else await load();
  }

  const previewScore =
    typeof data.signals.previewKnowledgeScore === "number" ? data.signals.previewKnowledgeScore : data.preview.knowledgeScore;

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view Sprint 25, but packet creation and governance actions require edit access.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 25</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Enterprise Knowledge &amp; Document Intelligence</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Citation-grounded evidence, prompt-library posture, training-review backlog, and release gate friction — steward-approved publications and prompt promotions only.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview knowledge score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{previewScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Aggregate AMP7 posture", "Evidence ledger, prompts, review examples, release gates."],
            ["Step 2", "Create governance packet", "Dimensional JSON, stewardship narrative, response and rollback notes."],
            ["Step 3", "Knowledge steward review", "Queue or approve — publications stay workflow-owned."],
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
          onClick={() => void post("create_packet", {}, "Enterprise Knowledge packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 25 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Evidence", data.signals.evidenceRecordsSampled],
          ["Prompts", data.signals.promptLibrarySampled],
          ["Reviews", data.signals.reviewExamplesSampled],
          ["Gates", data.signals.releaseGatesSampled],
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
          <h3 className="text-lg font-semibold text-zinc-950">Live knowledge preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Evidence &amp; prompts</p>
              <p className="mt-1 text-sm text-zinc-600">
                Citation risks {data.preview.citationEvidenceJson.evidenceCitationRiskCount}; prompt drafts {data.preview.promptGovernanceJson.promptGovernanceRiskCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Pipeline &amp; gates</p>
              <p className="mt-1 text-sm text-zinc-600">
                Training gaps {data.preview.reviewPipelineJson.reviewPipelineGapCount}; gate risks {data.preview.releaseGateJson.releaseGateRiskCount}.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Guardrails</h3>
          <div className="mt-4 grid gap-3 text-sm text-zinc-700">
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.citationEvidenceJson.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.promptGovernanceJson.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.responsePlan.guardrail}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => (
            <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                    {packet.status} · score {packet.knowledgeScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                  </p>
                  <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                  <p className="mt-1 text-sm text-zinc-600">
                    Evidence {packet.evidenceCitationRiskCount} · prompts {packet.promptGovernanceRiskCount} · reviews {packet.reviewPipelineGapCount} · gates{" "}
                    {packet.releaseGateRiskCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"}
                    onClick={() =>
                      void post("queue_knowledge_governance_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Knowledge governance review queued.")
                    }
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"}
                    onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Enterprise Knowledge packet approved.")}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                  >
                    Approve packet
                  </button>
                </div>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
              <textarea
                value={notes[packet.id] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                placeholder="Optional knowledge steward note"
                className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              />
            </article>
          ))}
          {data.packets.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">
              No Sprint 25 packets yet. Create the first Enterprise Knowledge packet from the live preview.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
