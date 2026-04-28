"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    workItems: number;
    evidenceItems: number;
    actionReadyRoles: number;
    previewReadinessScore: number;
    previewEvidenceGaps: number;
  };
  preview: {
    readinessScore: number;
    frontlineTaskCount: number;
    exceptionCount: number;
    quickActionCount: number;
    evidenceGapCount: number;
    offlineRiskCount: number;
    frontlineQueue: Array<{ id: string; mobileLabel: string; priority: string; urgencyScore: number; nextStep: string; objectHref: string }>;
    quickActions: Array<{ label: string; role: string; enabled: boolean; guardrail: string }>;
    evidenceChecklist: { items: Array<{ title: string; status: string; requiredEvidence: string }> };
    offlineRisks: Array<{ title: string; severity: string; risk: string; mitigation: string }>;
    permissionScope: { roles: Array<{ role: string; state: string; canView: boolean; canAct: boolean }> };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    readinessScore: number;
    frontlineTaskCount: number;
    exceptionCount: number;
    quickActionCount: number;
    evidenceGapCount: number;
    offlineRiskCount: number;
    frontlineQueueJson: unknown;
    quickActionJson: unknown;
    evidenceChecklistJson: unknown;
    offlineRiskJson: unknown;
    permissionScopeJson: unknown;
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

export function FrontlineClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/frontline", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load frontline workspace."));
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
    const res = await fetch("/api/assistant/frontline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update frontline workspace."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP26</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Mobile & Frontline Assistant</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Convert WMS tasks, shipment exceptions, supplier onboarding work, and field evidence into short mobile workflows.
          Quick actions stay reviewed before task completion, exception closure, supplier updates, or evidence changes.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Build mobile queue", "Warehouse tasks, delivery exceptions, supplier tasks, and priorities."],
            ["Step 2", "Capture evidence", "Photo/document/note requirements and poor-network reconciliation risks."],
            ["Step 3", "Approve quick action", "Human review before source-system changes or external updates."],
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
          onClick={() => void post("create_packet", {}, "Frontline packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create frontline packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Work items", data.signals.workItems],
          ["Evidence items", data.signals.evidenceItems],
          ["Action-ready roles", data.signals.actionReadyRoles],
          ["Evidence gaps", data.signals.previewEvidenceGaps],
          ["Readiness score", data.signals.previewReadinessScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Mobile Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.readinessScore}/100 · work {data.preview.frontlineTaskCount} · exceptions {data.preview.exceptionCount} · quick actions {data.preview.quickActionCount} · offline risks {data.preview.offlineRiskCount}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.preview.frontlineQueue.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{item.priority} · urgency {item.urgencyScore}</p>
              <p className="mt-1 font-semibold text-zinc-950">{item.mobileLabel}</p>
              <p className="mt-1 text-sm text-zinc-600">{item.nextStep}</p>
            </div>
          ))}
          {data.preview.offlineRisks.slice(0, 4).map((risk, index) => (
            <div key={`${risk.title}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">{risk.severity} offline risk</p>
              <p className="mt-1 text-sm text-amber-800">{risk.title}: {risk.risk}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Frontline Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const queue = readArray<{ mobileLabel: string; priority: string; urgencyScore: number }>(packet.frontlineQueueJson);
            const actions = readArray<{ label: string; role: string; enabled: boolean }>(packet.quickActionJson);
            const gaps = readArray<{ title: string; status: string; requiredEvidence: string }>(packet.evidenceChecklistJson, "items").filter((item) => item.status === "MISSING");
            const roles = readArray<{ role: string; state: string }>(packet.permissionScopeJson, "roles");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.readinessScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Work {packet.frontlineTaskCount} · exceptions {packet.exceptionCount} · actions {packet.quickActionCount} · gaps {packet.evidenceGapCount} · offline {packet.offlineRiskCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_frontline_review", { packetId: packet.id, approvalNote: approvalNotes[packet.id] ?? "" }, "Frontline review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Top queue</p>
                    <p className="mt-1">{queue.slice(0, 2).map((item) => `${item.priority} ${item.mobileLabel}`).join("; ") || "No work"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Quick actions</p>
                    <p className="mt-1">{actions.slice(0, 2).map((item) => `${item.role}: ${item.label}${item.enabled ? "" : " (view only)"}`).join("; ") || "No actions"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Evidence gaps</p>
                    <p className="mt-1">{gaps.slice(0, 2).map((item) => `${item.title}: ${item.requiredEvidence}`).join("; ") || "No gaps"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Roles</p>
                    <p className="mt-1">{roles.map((item) => `${item.role}: ${item.state}`).join("; ") || "No roles"}</p>
                  </div>
                </div>
                <textarea
                  value={approvalNotes[packet.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional frontline approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No frontline packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
