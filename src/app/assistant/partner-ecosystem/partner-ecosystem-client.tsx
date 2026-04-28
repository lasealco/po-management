"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    connectors: number;
    partners: number;
    mappings: number;
    previewReadinessScore: number;
    previewOpenReviewCount: number;
  };
  preview: {
    readinessScore: number;
    connectorCount: number;
    partnerCount: number;
    mappingIssueCount: number;
    openReviewCount: number;
    connectorReadiness: Array<{ name: string; readinessScore: number; launchState: string; blockers: string[] }>;
    partnerScope: { gaps: Array<{ name: string; partnerType: string; gap: string; severity: string }> };
    onboardingPlan: { steps: Array<{ step: string; owner: string; action: string }> };
    launchChecklist: { guardrail?: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    readinessScore: number;
    connectorCount: number;
    partnerCount: number;
    mappingIssueCount: number;
    openReviewCount: number;
    connectorReadinessJson: unknown;
    partnerScopeJson: unknown;
    mappingReviewJson: unknown;
    onboardingPlanJson: unknown;
    launchChecklistJson: unknown;
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

export function PartnerEcosystemClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/partner-ecosystem", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load partner ecosystem."));
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
    const res = await fetch("/api/assistant/partner-ecosystem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update partner ecosystem."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP25</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Partner Ecosystem</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Validate API Hub connector readiness, partner portal scope, mapping evidence, and launch plans before external
          partner workflows go live. The assistant drafts the packet; operators approve every launch step.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Check connectors", "Auth state, active status, sync evidence, and health summaries."],
            ["Step 2", "Scope partners", "Supplier and customer portal links, regions, and onboarding gaps."],
            ["Step 3", "Approve launch", "Mapping review, staging evidence, and partner playbooks stay approval-gated."],
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
          onClick={() => void post("create_packet", {}, "Partner ecosystem packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create partner packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Connectors", data.signals.connectors],
          ["Partners", data.signals.partners],
          ["Mapping evidence", data.signals.mappings],
          ["Open reviews", data.signals.previewOpenReviewCount],
          ["Readiness score", data.signals.previewReadinessScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Launch Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.readinessScore}/100 · connectors {data.preview.connectorCount} · partners {data.preview.partnerCount} · mapping issues {data.preview.mappingIssueCount}
        </p>
        <p className="mt-2 text-sm text-amber-700">{data.preview.launchChecklist.guardrail}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.preview.connectorReadiness.slice(0, 4).map((connector) => (
            <div key={connector.name} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">{connector.name}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {connector.launchState} · score {connector.readinessScore}/100 · {connector.blockers.join("; ") || "No blockers"}
              </p>
            </div>
          ))}
          {data.preview.partnerScope.gaps.slice(0, 4).map((gap, index) => (
            <div key={`${gap.name}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">{gap.severity} partner gap</p>
              <p className="mt-1 text-sm text-amber-800">{gap.partnerType} {gap.name}: {gap.gap}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Partner Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const connectors = readArray<{ name: string; readinessScore: number; launchState: string }>(packet.connectorReadinessJson);
            const gaps = readArray<{ name: string; partnerType: string; gap: string }>(packet.partnerScopeJson, "gaps");
            const steps = readArray<{ step: string; owner: string; action: string }>(packet.onboardingPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.readinessScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Connectors {packet.connectorCount} · partners {packet.partnerCount} · issues {packet.mappingIssueCount} · reviews {packet.openReviewCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_launch_review", { packetId: packet.id, approvalNote: approvalNotes[packet.id] ?? "" }, "Partner launch review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Connectors</p>
                    <p className="mt-1">{connectors.slice(0, 2).map((item) => `${item.name}: ${item.launchState} ${item.readinessScore}/100`).join("; ") || "No connectors"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Partner gaps</p>
                    <p className="mt-1">{gaps.slice(0, 2).map((item) => `${item.partnerType} ${item.name}: ${item.gap}`).join("; ") || "No gaps"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Launch plan</p>
                    <p className="mt-1">{steps.slice(0, 2).map((item) => `${item.step}: ${item.owner}`).join("; ") || "No steps"}</p>
                  </div>
                </div>
                <textarea
                  value={approvalNotes[packet.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional partner launch approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No partner ecosystem packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
