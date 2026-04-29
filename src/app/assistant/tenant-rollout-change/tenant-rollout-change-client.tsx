"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    rolloutScore: number;
    leadershipSummary: string;
    tenantProfile: { activeUserCount: number; roleCount: number; orgUnitCount: number; rolloutMode: string; orgRoleCoveragePct: number; guardrail: string };
    stakeholderMap: { stakeholderGapCount: number; gaps: Array<{ role: string; severity: string; recommendation: string }>; guardrail: string };
    rolloutWaves: { waveCount: number; pilotUserCount: number; blockers: Array<{ type: string; key: string; severity: string; detail: string }>; guardrail: string };
    enablementPlan: { trainingModuleCount: number; trainingGapCount: number; modules: Array<{ module: string; audience: string; status: string }>; guardrail: string };
    communicationPlan: { channelCount: number; communicationGapCount: number; channels: Array<{ channel: string; audience: string; status: string }>; guardrail: string };
    adoptionTelemetry: { adoptionPct: number; adoptionRiskCount: number; auditEventCount: number; pendingActionCount: number; adoptionRisks: Array<{ type: string; severity: string; detail: string }>; guardrail: string };
    supportModel: { supportOwnerCount: number; supportRiskCount: number; escalationPaths: Array<{ tier: string; owner: string; scope: string }>; guardrail: string };
    cutoverChecklist: { cutoverBlockerCount: number; passedCount: number; checkCount: number; blockers: Array<{ key: string; label: string; severity: string }>; guardrail: string };
    rollbackPlan: { rollbackStepCount: number; steps: string[]; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[]; guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    rolloutScore: number;
    activeUserCount: number;
    stakeholderGapCount: number;
    trainingGapCount: number;
    communicationGapCount: number;
    supportRiskCount: number;
    adoptionRiskCount: number;
    cutoverBlockerCount: number;
    stakeholderMapJson: unknown;
    rolloutWaveJson: unknown;
    enablementPlanJson: unknown;
    communicationPlanJson: unknown;
    adoptionTelemetryJson: unknown;
    cutoverChecklistJson: unknown;
    rollbackPlanJson: unknown;
    responsePlanJson: unknown;
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

export function TenantRolloutChangeClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/tenant-rollout-change", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Tenant Rollout & Change Enablement."));
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
    const res = await fetch("/api/assistant/tenant-rollout-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Tenant Rollout & Change Enablement."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 11, but packet creation and change review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 11</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Tenant Rollout & Change Enablement</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Plan tenant rollout waves, stakeholder readiness, enablement, communications, adoption telemetry, support, cutover checks, and rollback before expanding access.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview rollout</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.rolloutScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Map stakeholders", "Review tenant users, roles, org units, admin controls, rollout factory, quality release, audit, and action queue signals."],
            ["Step 2", "Plan rollout", "Persist waves, enablement, communications, adoption telemetry, support model, cutover checks, and rollback evidence."],
            ["Step 3", "Approve change", "Queue change review before invitations, role grants, module flags, training, communications, seeds, or tenant setting changes."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Tenant Rollout packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 11 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {[
          ["Users", data.signals.activeUsers],
          ["Org units", data.signals.orgUnits],
          ["Roles", data.signals.roles],
          ["Controls", data.signals.adminControls],
          ["Rollouts", data.signals.rolloutFactoryPackets],
          ["Quality", data.signals.aiQualityReleasePackets],
          ["Audits", data.signals.auditEvents],
          ["Queue", data.signals.actionQueueItems],
          ["Score", data.signals.previewRolloutScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Rollout Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Tenant profile</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.tenantProfile.activeUserCount} active users, {data.preview.tenantProfile.roleCount} roles, {data.preview.tenantProfile.orgRoleCoveragePct}% org-role coverage.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Rollout waves</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.rolloutWaves.waveCount} wave(s), {data.preview.rolloutWaves.pilotUserCount} pilot user(s), {data.preview.rolloutWaves.blockers.length} blocker(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Cutover</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.cutoverChecklist.passedCount}/{data.preview.cutoverChecklist.checkCount} checks passed, {data.preview.cutoverChecklist.cutoverBlockerCount} blocker(s).</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Change Enablement</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Training</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.enablementPlan.trainingModuleCount} module(s), {data.preview.enablementPlan.trainingGapCount} gap(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Communications</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.communicationPlan.channelCount} channel(s), {data.preview.communicationPlan.communicationGapCount} draft blocker(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Support and adoption</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.supportModel.supportOwnerCount} owner(s), {data.preview.adoptionTelemetry.adoptionPct}% active adoption, {data.preview.adoptionTelemetry.adoptionRiskCount} risk(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const stakeholderGaps = readArray<{ role: string; severity: string; recommendation: string }>(packet.stakeholderMapJson, "gaps");
            const waveBlockers = readArray<{ type: string; key: string; severity: string; detail: string }>(packet.rolloutWaveJson, "blockers");
            const channels = readArray<{ channel: string; status: string }>(packet.communicationPlanJson, "channels");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.rolloutScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Users {packet.activeUserCount} · stakeholders {packet.stakeholderGapCount} · training {packet.trainingGapCount} · comms {packet.communicationGapCount} · support {packet.supportRiskCount} · adoption {packet.adoptionRiskCount} · blockers {packet.cutoverBlockerCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "CHANGE_REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_change_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Tenant rollout change review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Tenant Rollout packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Stakeholders</p><p className="mt-1">{stakeholderGaps.slice(0, 2).map((item) => `${item.role}: ${item.severity}`).join("; ") || "Ready"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Waves</p><p className="mt-1">{waveBlockers.slice(0, 2).map((item) => `${item.type}: ${item.detail}`).join("; ") || "No blockers"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Comms</p><p className="mt-1">{channels.slice(0, 2).map((item) => `${item.channel}: ${item.status}`).join("; ") || "No channels"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No tenant mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional tenant rollout review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 11 packets yet. Create the first durable Tenant Rollout packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
