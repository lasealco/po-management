"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Packet = {
  id: string;
  title: string;
  status: string;
  readinessScore: number;
  templateAssetCount: number;
  roleGrantGapCount: number;
  moduleGapCount: number;
  seedGapCount: number;
  rollbackStepCount: number;
  templateInventoryJson: unknown;
  roleGrantPlanJson: unknown;
  moduleFlagPlanJson: unknown;
  demoDataPlanJson: unknown;
  readinessCheckJson: unknown;
  rollbackPlanJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Snapshot = {
  signals: {
    assets: number;
    roleGrants: number;
    modules: number;
    previewReadinessScore: number;
    previewGaps: number;
  };
  targetTenant: { name: string; slug: string };
  preview: {
    readinessScore: number;
    templateAssetCount: number;
    roleGrantGapCount: number;
    moduleGapCount: number;
    seedGapCount: number;
    templateInventory: { copyableCount: number; metadataOnlyCount: number; copyPlan: Array<{ assetType: string; label: string; copyMode: string }> };
    roleGrantPlan: { gaps: Array<{ resource: string; action: string; label: string; severity: string }> };
    moduleFlagPlan: { gaps: Array<{ moduleKey: string; severity: string; recommendation: string }> };
    demoDataPlan: { gaps: Array<{ script: string; label: string }> };
    readinessChecks: { status: string; checks: Array<{ key: string; label: string; passed: boolean; detail: string }> };
    rollbackPlan: { steps: string[] };
    leadershipSummary: string;
  };
  packets: Packet[];
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function RolloutFactoryClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [targetSlug, setTargetSlug] = useState(initialSnapshot.targetTenant.slug);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/assistant/rollout-factory?targetSlug=${encodeURIComponent(targetSlug)}`, { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load rollout factory."));
      return;
    }
    setData(raw as Snapshot);
  }, [targetSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.packetId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/rollout-factory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetSlug, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update rollout factory."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP30</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Multi-Tenant Rollout & Implementation Factory</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Package template prompts, playbooks, automation policies, connector metadata, grants, module flags, seed packs, and
          acceptance scenarios into a customer launch packet. The assistant drafts the plan; humans approve the rollout.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Choose pilot", "Name the target tenant slug and inspect source template assets."],
            ["Step 2", "Validate readiness", "Check grants, module flags, demo packs, connector secret handling, and scenarios."],
            ["Step 3", "Queue launch", "Review onboarding and rollback steps before any copy or enablement work."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm font-medium text-zinc-800">
            Target tenant slug
            <input
              value={targetSlug}
              onChange={(event) => setTargetSlug(event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
              placeholder="new-customer-pilot"
            />
          </label>
          <button
            type="button"
            disabled={busy === "refresh"}
            onClick={() => void load()}
            className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
          >
            Refresh preview
          </button>
          <button
            type="button"
            disabled={busy === "create_packet"}
            onClick={() => void post("create_packet", {}, "Rollout factory packet created.")}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create rollout packet
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Assets", data.signals.assets],
          ["Role grants", data.signals.roleGrants],
          ["Modules", data.signals.modules],
          ["Readiness", data.signals.previewReadinessScore],
          ["Gaps", data.signals.previewGaps],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Rollout Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Target {data.targetTenant.name} · score {data.preview.readinessScore}/100 · {data.preview.readinessChecks.status} · copyable assets {data.preview.templateInventory.copyableCount} · secret metadata {data.preview.templateInventory.metadataOnlyCount}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Template copy</p>
            <p className="mt-1 text-sm text-zinc-700">
              {data.preview.templateInventory.copyPlan.slice(0, 3).map((item) => `${item.assetType}: ${item.copyMode}`).join("; ") || "No assets"}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Grant gaps</p>
            <p className="mt-1 text-sm text-amber-800">
              {data.preview.roleGrantPlan.gaps.slice(0, 3).map((item) => `${item.severity} ${item.resource}:${item.action}`).join("; ") || "No grant gaps"}
            </p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-900">Module gaps</p>
            <p className="mt-1 text-sm text-red-800">
              {data.preview.moduleFlagPlan.gaps.slice(0, 3).map((item) => `${item.severity} ${item.moduleKey}`).join("; ") || "No module gaps"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Rollback</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.rollbackPlan.steps.slice(0, 2).join("; ")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Rollout Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const copyPlan = readArray<{ assetType: string; copyMode: string }>(packet.templateInventoryJson, "copyPlan");
            const grantGaps = readArray<{ resource: string; action: string; severity: string }>(packet.roleGrantPlanJson, "gaps");
            const moduleGaps = readArray<{ moduleKey: string; severity: string }>(packet.moduleFlagPlanJson, "gaps");
            const seedGaps = readArray<{ script: string; label: string }>(packet.demoDataPlanJson, "gaps");
            const rollbackSteps = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.readinessScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Assets {packet.templateAssetCount} · grant gaps {packet.roleGrantGapCount} · module gaps {packet.moduleGapCount} · seed gaps {packet.seedGapCount} · rollback steps {packet.rollbackStepCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_rollout_review", { packetId: packet.id, approvalNote: notes[packet.id] ?? "" }, "Rollout launch review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue launch review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  {[
                    ["Copy", copyPlan.slice(0, 2).map((item) => `${item.assetType} ${item.copyMode}`).join("; ") || "None"],
                    ["Grants", grantGaps.slice(0, 2).map((item) => `${item.severity} ${item.resource}:${item.action}`).join("; ") || "No gaps"],
                    ["Modules", moduleGaps.slice(0, 2).map((item) => `${item.severity} ${item.moduleKey}`).join("; ") || "No gaps"],
                    ["Seeds", seedGaps.slice(0, 2).map((item) => item.script).join("; ") || "No gaps"],
                    ["Rollback", rollbackSteps.slice(0, 2).join("; ") || "No steps"],
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
                  placeholder="Optional launch approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No rollout packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
