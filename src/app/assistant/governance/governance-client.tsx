"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Packet = {
  id: string;
  title: string;
  status: string;
  governanceScore: number;
  retentionCandidateCount: number;
  exportRecordCount: number;
  deletionRequestCount: number;
  legalHoldBlockCount: number;
  privacyRiskCount: number;
  retentionPlanJson: unknown;
  exportManifestJson: unknown;
  deletionRequestJson: unknown;
  legalHoldJson: unknown;
  auditPlanJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Snapshot = {
  signals: {
    records: number;
    previewGovernanceScore: number;
    retentionCandidates: number;
    privacyRisks: number;
    legalHoldBlocks: number;
  };
  preview: {
    governanceScore: number;
    exportRecordCount: number;
    deletionRequestCount: number;
    retentionPlan: { candidates: Array<{ sourceType: string; recommendedAction: string }> };
    privacyReview: { risks: Array<{ sourceType: string; displayTitle: string }> };
    legalHoldReview: { holds: Array<{ sourceType: string; reason: string }> };
    auditPlan: { steps: string[]; reviewLoad: number };
    leadershipSummary: string;
  };
  packets: Packet[];
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function GovernanceClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/governance", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load governance workspace."));
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
    const res = await fetch("/api/assistant/governance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update governance workspace."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP29</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Enterprise Data Governance & Retention</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Review assistant audit, evidence, prompts, training examples, emails, and operating reports for retention, legal hold,
          export, deletion, and privacy-safe display. Every action remains approval-gated.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Inventory records", "Summarize assistant-governed records and archive state."],
            ["Step 2", "Dry-run controls", "Find retention candidates, legal-hold blockers, privacy risks, and export coverage."],
            ["Step 3", "Queue review", "Route decisions to human approval before archive, export, or deletion changes."],
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
          onClick={() => void post("create_packet", {}, "Governance packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create governance packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Records", data.signals.records],
          ["Score", data.signals.previewGovernanceScore],
          ["Retention", data.signals.retentionCandidates],
          ["Privacy risks", data.signals.privacyRisks],
          ["Legal holds", data.signals.legalHoldBlocks],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Governance Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.governanceScore}/100 · export records {data.preview.exportRecordCount} · deletion requests {data.preview.deletionRequestCount} · review load {data.preview.auditPlan.reviewLoad}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Retention dry-run</p>
            <p className="mt-1 text-sm text-amber-800">
              {data.preview.retentionPlan.candidates.slice(0, 3).map((item) => `${item.sourceType}: ${item.recommendedAction}`).join("; ") || "No candidates"}
            </p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-900">Privacy-safe display</p>
            <p className="mt-1 text-sm text-red-800">
              {data.preview.privacyReview.risks.slice(0, 3).map((item) => `${item.sourceType}: ${item.displayTitle}`).join("; ") || "No privacy risks"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Legal-hold blockers</p>
            <p className="mt-1 text-sm text-zinc-700">
              {data.preview.legalHoldReview.holds.slice(0, 3).map((item) => `${item.sourceType}: ${item.reason}`).join("; ") || "No holds"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Governance Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const retention = readArray<{ sourceType: string; recommendedAction: string }>(packet.retentionPlanJson, "candidates");
            const manifest = readArray<{ sourceType: string; privacySafe: boolean }>(packet.exportManifestJson, "records");
            const deletions = readArray<{ sourceType: string; reason: string }>(packet.deletionRequestJson, "requests");
            const holds = readArray<{ sourceType: string; reason: string }>(packet.legalHoldJson, "holds");
            const steps = readArray<string>(packet.auditPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.governanceScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Retention {packet.retentionCandidateCount} · export {packet.exportRecordCount} · deletion {packet.deletionRequestCount} · legal holds {packet.legalHoldBlockCount} · privacy risks {packet.privacyRiskCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_governance_review", { packetId: packet.id, approvalNote: notes[packet.id] ?? "" }, "Governance review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  {[
                    ["Retention", retention.slice(0, 2).map((item) => `${item.sourceType} ${item.recommendedAction}`).join("; ") || "None"],
                    ["Exports", manifest.slice(0, 2).map((item) => `${item.sourceType}${item.privacySafe ? " redacted" : ""}`).join("; ") || "None"],
                    ["Deletion", deletions.slice(0, 2).map((item) => `${item.sourceType}: ${item.reason}`).join("; ") || "None"],
                    ["Holds", holds.slice(0, 2).map((item) => `${item.sourceType}: ${item.reason}`).join("; ") || "None"],
                    ["Audit plan", steps.slice(0, 2).join("; ") || "No steps"],
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
                  placeholder="Optional governance approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No governance packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
