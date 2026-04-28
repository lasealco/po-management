"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    transcripts: number;
    previewMeetingScore: number;
    previewActions: number;
    previewRisks: number;
    previewRedactions: number;
  };
  preview: {
    meetingScore: number;
    transcriptCount: number;
    extractedActionCount: number;
    riskCount: number;
    decisionCount: number;
    redactionCount: number;
    extractedActions: Array<{ action: string; ownerHint: string; priority: string; guardrail: string }>;
    risks: Array<{ risk: string; severity: string }>;
    decisions: Array<{ decision: string; confidence: string }>;
    minutes: { summary: string; guardrail: string; actionBullets: string[]; riskBullets: string[]; decisionBullets: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    meetingScore: number;
    transcriptCount: number;
    extractedActionCount: number;
    riskCount: number;
    decisionCount: number;
    redactionCount: number;
    transcriptDigestJson: unknown;
    extractedActionJson: unknown;
    riskJson: unknown;
    decisionJson: unknown;
    objectLinkJson: unknown;
    redactionJson: unknown;
    minutesJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    approvedAt: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key?: string): T[] {
  const next = key && value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function MeetingIntelligenceClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/meeting-intelligence", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load meeting intelligence."));
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
    const res = await fetch("/api/assistant/meeting-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update meeting intelligence."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP27</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Voice & Meeting Intelligence</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Turn call notes, meeting summaries, emails, CRM activity, shipment notes, and supplier follow-ups into draft
          minutes with extracted actions, risks, decisions, redactions, and object links. All follow-ups stay reviewed.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Ingest notes", "Meeting-style inputs from email, CRM, shipment, and supplier context."],
            ["Step 2", "Extract work", "Actions, risks, decisions, object links, and sensitive text redactions."],
            ["Step 3", "Approve minutes", "Queue follow-ups before tasks, replies, or source updates are created."],
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
          onClick={() => void post("create_packet", {}, "Meeting intelligence packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create meeting packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Transcripts", data.signals.transcripts],
          ["Actions", data.signals.previewActions],
          ["Risks", data.signals.previewRisks],
          ["Redactions", data.signals.previewRedactions],
          ["Meeting score", data.signals.previewMeetingScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Minutes Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.meetingScore}/100 · sources {data.preview.transcriptCount} · actions {data.preview.extractedActionCount} · risks {data.preview.riskCount} · decisions {data.preview.decisionCount}
        </p>
        <p className="mt-2 text-sm text-amber-700">{data.preview.minutes.guardrail}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.preview.extractedActions.slice(0, 3).map((action, index) => (
            <div key={`${action.action}-${index}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{action.priority} action</p>
              <p className="mt-1 text-sm text-zinc-700">{action.ownerHint}: {action.action}</p>
            </div>
          ))}
          {data.preview.risks.slice(0, 3).map((risk, index) => (
            <div key={`${risk.risk}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">{risk.severity} risk</p>
              <p className="mt-1 text-sm text-amber-800">{risk.risk}</p>
            </div>
          ))}
          {data.preview.decisions.slice(0, 3).map((decision, index) => (
            <div key={`${decision.decision}-${index}`} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-900">{decision.confidence} decision</p>
              <p className="mt-1 text-sm text-emerald-800">{decision.decision}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Meeting Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const actions = readArray<{ action: string; ownerHint: string; priority: string }>(packet.extractedActionJson);
            const risks = readArray<{ risk: string; severity: string }>(packet.riskJson);
            const decisions = readArray<{ decision: string; confidence: string }>(packet.decisionJson);
            const links = readArray<{ objectType: string; objectId: string }>(packet.objectLinkJson);
            const minutes = packet.minutesJson && typeof packet.minutesJson === "object" ? (packet.minutesJson as { summary?: string; guardrail?: string }) : {};
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.meetingScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Sources {packet.transcriptCount} · actions {packet.extractedActionCount} · risks {packet.riskCount} · decisions {packet.decisionCount} · redactions {packet.redactionCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_meeting_review", { packetId: packet.id, approvalNote: approvalNotes[packet.id] ?? "" }, "Meeting review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Actions</p>
                    <p className="mt-1">{actions.slice(0, 2).map((item) => `${item.priority} ${item.ownerHint}: ${item.action}`).join("; ") || "No actions"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Risks</p>
                    <p className="mt-1">{risks.slice(0, 2).map((item) => `${item.severity}: ${item.risk}`).join("; ") || "No risks"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Decisions</p>
                    <p className="mt-1">{decisions.slice(0, 2).map((item) => `${item.confidence}: ${item.decision}`).join("; ") || "No decisions"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Links</p>
                    <p className="mt-1">{links.slice(0, 3).map((item) => `${item.objectType}:${item.objectId.slice(0, 8)}`).join(", ") || "No links"}</p>
                  </div>
                </div>
                <p className="mt-3 rounded-xl bg-white p-3 text-sm text-zinc-700">{minutes.summary ?? "No minutes summary."}</p>
                <textarea
                  value={approvalNotes[packet.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional meeting review note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No meeting intelligence packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
