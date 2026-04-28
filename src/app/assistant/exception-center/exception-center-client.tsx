"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Signal = {
  id: string;
  module: string;
  objectType: string;
  objectId: string;
  title: string;
  detail: string | null;
  severity: string;
  status: string;
  href: string | null;
  customerLabel: string | null;
  ownerLabel: string | null;
  occurredAt: string;
  dedupeKey: string;
};

type Incident = {
  id: string;
  title: string;
  status: string;
  severity: string;
  severityScore: number;
  sourceSummaryJson: unknown;
  blastRadiusJson: unknown;
  communicationDraftJson: unknown;
  customerImpact: string | null;
  rootCauseNote: string | null;
  updatedAt: string;
};

type Snapshot = {
  signals: Signal[];
  grantModules: string[];
  incidents: Incident[];
};

function readArray(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== "object") return [];
  const next = (value as Record<string, unknown>)[key];
  return Array.isArray(next) ? next : [];
}

function readDraft(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "string" ? next : null;
}

export function ExceptionCenterClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSnapshot.signals.slice(0, 4).map((signal) => signal.id));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rootCauseNotes, setRootCauseNotes] = useState<Record<string, string>>({});

  const selectedSignals = useMemo(() => data.signals.filter((signal) => selectedIds.includes(signal.id)), [data.signals, selectedIds]);
  const moduleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const signal of data.signals) map.set(signal.module, (map.get(signal.module) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [data.signals]);

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/exception-center", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load exception center."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.incidentId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/exception-center", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update exception center."));
      return;
    }
    setMessage(success);
    await load();
  }

  function toggleSignal(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP17</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Exception Nerve Center</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Deduplicate exceptions across Control Tower, WMS, suppliers, orders, invoice audit, API Hub, and Twin risks into
          incident rooms with blast radius, timelines, playbooks, customer-safe drafts, and root-cause closure.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Select signals", "Choose related exceptions from permission-filtered evidence."],
            ["Step 2", "Create room", "Build severity, blast radius, timeline, playbook, and drafts."],
            ["Step 3", "Approve and close", "Queue recovery actions and close only with root cause."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Accessible modules</p>
          <p className="mt-1 text-2xl font-semibold">{data.grantModules.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Open signals</p>
          <p className="mt-1 text-2xl font-semibold">{data.signals.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Incident rooms</p>
          <p className="mt-1 text-2xl font-semibold">{data.incidents.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Selected signals</p>
          <p className="mt-1 text-2xl font-semibold">{selectedSignals.length}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-950">Exception Signals</h3>
              <p className="mt-1 text-sm text-zinc-600">Grouped by existing permissions: {data.grantModules.join(", ") || "none"}.</p>
            </div>
            <button
              type="button"
              disabled={selectedIds.length === 0 || busy === "create_incident"}
              onClick={() => void post("create_incident", { signalIds: selectedIds }, "Incident room created.")}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Create incident room
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {moduleCounts.map(([module, count]) => (
              <span key={module} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                {module}: {count}
              </span>
            ))}
          </div>
          <div className="mt-4 max-h-[34rem] space-y-3 overflow-auto pr-1">
            {data.signals.map((signal) => (
              <label key={signal.id} className="block cursor-pointer rounded-xl border border-zinc-200 p-4 hover:border-[var(--arscmp-primary)]">
                <div className="flex gap-3">
                  <input type="checkbox" checked={selectedIds.includes(signal.id)} onChange={() => toggleSignal(signal.id)} className="mt-1 h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {signal.module} · {signal.severity} · {signal.status}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{signal.title}</h4>
                    {signal.detail ? <p className="mt-1 text-sm text-zinc-600">{signal.detail}</p> : null}
                    <p className="mt-2 text-xs text-zinc-500">
                      Dedupe: {signal.dedupeKey} · {new Date(signal.occurredAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </label>
            ))}
            {data.signals.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No open exception signals are visible for your grants.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Incident Rooms</h3>
          <div className="mt-4 space-y-4">
            {data.incidents.map((incident) => {
              const modules = readArray(incident.blastRadiusJson, "modules").filter((item): item is string => typeof item === "string");
              const customerDraft = readDraft(incident.communicationDraftJson, "customer");
              return (
                <article key={incident.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                        {incident.status} · {incident.severity} · {incident.severityScore}/100
                      </p>
                      <h4 className="mt-1 font-semibold text-zinc-950">{incident.title}</h4>
                      <p className="mt-1 text-sm text-zinc-600">Modules: {modules.join(", ") || "none"} · Updated {new Date(incident.updatedAt).toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy === incident.id || incident.status === "ACTION_QUEUED" || incident.status === "CLOSED"}
                      onClick={() => void post("queue_playbook", { incidentId: incident.id }, "Incident playbook queued for approval.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue playbook
                    </button>
                  </div>
                  {incident.customerImpact ? <p className="mt-3 text-sm text-zinc-700">{incident.customerImpact}</p> : null}
                  {customerDraft ? <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-zinc-700">{customerDraft}</pre> : null}
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      value={rootCauseNotes[incident.id] ?? ""}
                      onChange={(event) => setRootCauseNotes((current) => ({ ...current, [incident.id]: event.target.value }))}
                      placeholder="Root-cause notes required before close..."
                      className="min-h-20 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy === incident.id || incident.status === "CLOSED" || !(rootCauseNotes[incident.id] ?? "").trim()}
                      onClick={() => void post("close_incident", { incidentId: incident.id, rootCauseNote: rootCauseNotes[incident.id] }, "Incident closed with root-cause notes.")}
                      className="self-start rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Close incident
                    </button>
                  </div>
                </article>
              );
            })}
            {data.incidents.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No incident rooms yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
