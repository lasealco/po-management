"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  generatedAt: string;
  control: {
    rolloutMode: string;
    pilotRoles: string[];
    pilotSites: string[];
    thresholds: Record<string, number>;
    flags: unknown;
    packetStatus: string;
    packet: unknown;
    updatedAt: string | null;
  };
  roles: Array<{ id: string; name: string }>;
  permissionMatrix: Array<{ resource: string; action: string; label: string; description: string; grantedRoleCount: number }>;
  releaseGate: { status: string; score: number; threshold: number; evaluatedAt: string } | null;
  policies: Array<{ id: string; actionKind: string; label: string; status: string; readinessScore: number; threshold: number; updatedAt: string }>;
  signals: Record<string, number | string | null>;
  readiness: {
    score: number;
    status: string;
    checks: Array<{ key: string; label: string; passed: boolean; detail: string }>;
  };
};

export function AssistantAdminConsoleClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [rolloutMode, setRolloutMode] = useState(initialSnapshot.control.rolloutMode);
  const [pilotRoleIds, setPilotRoleIds] = useState(initialSnapshot.control.pilotRoles);
  const [pilotSitesText, setPilotSitesText] = useState(initialSnapshot.control.pilotSites.join("\n"));
  const [thresholds, setThresholds] = useState(initialSnapshot.control.thresholds);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/admin-console", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load assistant admin console."));
      return;
    }
    const next = raw as Snapshot;
    setData(next);
    setRolloutMode(next.control.rolloutMode);
    setPilotRoleIds(next.control.pilotRoles);
    setPilotSitesText(next.control.pilotSites.join("\n"));
    setThresholds(next.control.thresholds);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown> = {}) {
    if (!canEdit) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/admin-console", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update assistant admin console."));
      return;
    }
    setMessage(action === "export_packet" ? "Compliance packet exported." : "Assistant admin controls saved.");
    await load();
  }

  const setThreshold = (key: string, value: string) =>
    setThresholds((current) => ({ ...current, [key]: Number.parseInt(value, 10) || 0 }));

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view this console, but saving rollout controls and packet exports requires org.settings edit.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP11</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Assistant Admin Console</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Manage rollout mode, pilot scope, thresholds, permissions visibility, automation readiness, and compliance packet export from one operator surface.
            </p>
          </div>
          <div className={`rounded-2xl border px-5 py-4 text-center ${data.readiness.status === "READY" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">Readiness</p>
            <p className="mt-1 text-3xl font-semibold">{data.readiness.score}</p>
            <p className="text-sm">{data.readiness.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {Object.entries(data.signals).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{key.replaceAll(/([A-Z])/g, " $1")}</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900">{value ?? "none"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Rollout Control</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700">
              Rollout mode
              <select value={rolloutMode} onChange={(event) => setRolloutMode(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2">
                <option value="PILOT">Pilot</option>
                <option value="SHADOW">Shadow only</option>
                <option value="CONTROLLED">Controlled rollout</option>
                <option value="PAUSED">Paused</option>
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Pilot sites
              <textarea value={pilotSitesText} onChange={(event) => setPilotSitesText(event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2" />
            </label>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-zinc-700">Pilot roles</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {data.roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={pilotRoleIds.includes(role.id)}
                    onChange={(event) =>
                      setPilotRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))
                    }
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(thresholds).map(([key, value]) => (
              <label key={key} className="text-sm font-medium text-zinc-700">
                {key.replaceAll(/([A-Z])/g, " $1")}
                <input type="number" value={value} onChange={(event) => setThreshold(key, event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2" />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!canEdit || busy === "save_control"}
            onClick={() => void post("save_control", {
              rolloutMode,
              pilotRoles: pilotRoleIds,
              pilotSites: pilotSitesText.split("\n"),
              thresholds,
              flags: data.control.flags,
            })}
            className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save rollout control
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Compliance Packet</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Export a point-in-time packet with rollout settings, permission coverage, readiness checks, and control notes.
          </p>
          <button
            type="button"
            disabled={!canEdit || busy === "export_packet"}
            onClick={() => void post("export_packet")}
            className="mt-4 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Export packet
          </button>
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Latest packet</p>
            <p className="mt-1 text-sm text-zinc-700">Status: {data.control.packetStatus}</p>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
              {JSON.stringify(data.control.packet ?? { message: "No packet exported yet." }, null, 2)}
            </pre>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Readiness Checks</h3>
          <div className="mt-4 space-y-3">
            {data.readiness.checks.map((check) => (
              <div key={check.key} className={`rounded-xl border p-4 ${check.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <p className="font-semibold text-zinc-900">{check.passed ? "Passed" : "Blocked"} · {check.label}</p>
                <p className="mt-1 text-sm text-zinc-700">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Automation Policies</h3>
          <div className="mt-4 space-y-3">
            {data.policies.length === 0 ? <p className="text-sm text-zinc-500">No governed automation policies yet.</p> : null}
            {data.policies.map((policy) => (
              <article key={policy.id} className="rounded-xl border border-zinc-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{policy.status} · readiness {policy.readinessScore}/{policy.threshold}</p>
                <h4 className="mt-1 font-semibold text-zinc-900">{policy.label}</h4>
                <p className="mt-1 text-sm text-zinc-600">{policy.actionKind}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">Permissions Visibility</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 pr-4">Permission</th>
                <th className="py-2 pr-4">Resource</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Roles granted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.permissionMatrix.map((row) => (
                <tr key={`${row.resource}:${row.action}`}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-zinc-900">{row.label}</p>
                    <p className="text-xs text-zinc-500">{row.description}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-zinc-600">{row.resource}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-zinc-600">{row.action}</td>
                  <td className="py-3 pr-4 text-zinc-700">{row.grantedRoleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
