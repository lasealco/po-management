"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Packet = {
  id: string;
  ampNumber: number;
  programKey: string;
  programTitle: string;
  title: string;
  status: string;
  programScore: number;
  signalCount: number;
  riskCount: number;
  recommendationCount: number;
  approvalStepCount: number;
  sourceSummaryJson: unknown;
  assessmentJson: unknown;
  recommendationJson: unknown;
  approvalPlanJson: unknown;
  artifactJson: unknown;
  rollbackPlanJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Snapshot = {
  config: { ampNumber: number; key: string; slug: string; title: string; surfaceTitle: string; navLabel: string };
  preview: Packet & {
    sourceSummary: { sources: Array<{ metric: string; value: number }> };
    assessment: { risks: Array<{ key: string; label: string; severity: string; value: number }> };
    recommendation: { recommendations: Array<{ text: string; priority: string; guardrail: string }> };
    approvalPlan: { steps: Array<{ owner: string; action: string }>; guardrail: string };
    artifact: { label: string; sections: string[]; noMutation: string };
    rollbackPlan: { steps: string[] };
  };
  packets: Packet[];
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function AdvancedProgramClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/assistant/advanced-programs/${data.config.slug}`, { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load advanced program."));
      return;
    }
    setData(raw as Snapshot);
  }, [data.config.slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.packetId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/assistant/advanced-programs/${data.config.slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update advanced program."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP{data.config.ampNumber}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{data.config.surfaceTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Durable assistant workflow for {data.config.title}. Create an evidence packet, review risks and recommendations,
          then queue approval before downstream records are changed.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Step 1", "Gather", "Read relevant product, supplier, inventory, shipment, finance, planning, and contract signals."],
            ["Step 2", "Assess", "Score risks and source evidence for this AMP workflow."],
            ["Step 3", "Recommend", "Draft review-safe recommendations and packet artifact."],
            ["Step 4", "Approve", "Queue human review before downstream execution."],
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
          onClick={() => void post("create_packet", {}, `AMP${data.config.ampNumber} packet created.`)}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create AMP{data.config.ampNumber} packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Score", data.preview.programScore],
          ["Signals", data.preview.signalCount],
          ["Risks", data.preview.riskCount],
          ["Recommendations", data.preview.recommendationCount],
          ["Approvals", data.preview.approvalStepCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Program Preview</h3>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Sources</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.sourceSummary.sources.slice(0, 4).map((item) => `${item.metric}: ${item.value}`).join("; ")}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Risks</p>
            <p className="mt-1 text-sm text-amber-800">{data.preview.assessment.risks.slice(0, 3).map((risk) => `${risk.severity} ${risk.key}`).join("; ") || "No active risks"}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Artifact</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.artifact.label}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Approvals</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.approvalPlan.steps.map((step) => step.owner).join(", ")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">AMP{data.config.ampNumber} Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const risks = readArray<{ key: string; severity: string }>(packet.assessmentJson, "risks");
            const recommendations = readArray<{ text: string; priority: string }>(packet.recommendationJson, "recommendations");
            const approvals = readArray<{ owner: string }>(packet.approvalPlanJson, "steps");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.programScore}/100 · risks {packet.riskCount}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Signals {packet.signalCount} · recommendations {packet.recommendationCount} · approvals {packet.approvalStepCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_review", { packetId: packet.id, approvalNote: notes[packet.id] ?? "" }, `AMP${data.config.ampNumber} review queued.`)}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {[
                    ["Risks", risks.slice(0, 2).map((risk) => `${risk.severity} ${risk.key}`).join("; ") || "None"],
                    ["Recommendations", recommendations.slice(0, 2).map((item) => `${item.priority}: ${item.text}`).join("; ") || "None"],
                    ["Approvals", approvals.slice(0, 3).map((item) => item.owner).join(", ") || "None"],
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
                  placeholder="Optional review note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No AMP{data.config.ampNumber} packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
