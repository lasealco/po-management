"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    auditEvents: number;
    actions: number;
    automations: number;
    previewHealthScore: number;
    previewIncidentSignals: number;
  };
  preview: {
    severity: string;
    healthScore: number;
    failureCount: number;
    driftSignalCount: number;
    evidenceGapCount: number;
    automationRiskCount: number;
    healthSnapshot: { evidenceCoveragePct: number; negativeFeedbackRatePct: number; pendingActionCount: number; shadowMatchRatePct: number; releaseGateStatus: string };
    failureSignals: Array<{ type: string; severity: string; detail: string }>;
    driftSignals: Array<{ surface: string; weakRatePct: number; detail: string }>;
    automationRisks: Array<{ actionKind: string; severity: string; risk: string }>;
    degradedMode: { status: string; message: string; allowedActions: string[] };
    rollbackPlan: { steps: string[] };
    postmortem: { summary: string; rootCauseHypotheses: string[]; followUp: string };
  };
  incidents: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    healthScore: number;
    auditEventCount: number;
    failureCount: number;
    driftSignalCount: number;
    evidenceGapCount: number;
    automationRiskCount: number;
    failureSignalJson: unknown;
    driftSignalJson: unknown;
    automationRiskJson: unknown;
    degradedModeJson: unknown;
    rollbackPlanJson: unknown;
    postmortemJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    resolvedAt: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key?: string): T[] {
  const next = key && value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function ObservabilityClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/observability", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load observability."));
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
    const res = await fetch("/api/assistant/observability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update observability."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP28</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">AI Observability & Incident Response</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Monitor assistant health, evidence coverage, feedback drift, action backlog, release gates, and automation safety.
          Incidents draft degraded mode, rollback, and postmortem plans for human approval.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Observe health", "Audit events, evidence coverage, feedback, queues, release gates, and shadow runs."],
            ["Step 2", "Create incident", "Detect failures, drift, automation risk, degraded mode, and rollback steps."],
            ["Step 3", "Review recovery", "Queue incident review before automation or release controls are changed."],
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
          disabled={busy === "create_incident"}
          onClick={() => void post("create_incident", {}, "Observability incident created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create incident
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Audit events", data.signals.auditEvents],
          ["Actions", data.signals.actions],
          ["Automations", data.signals.automations],
          ["Signals", data.signals.previewIncidentSignals],
          ["Health score", data.signals.previewHealthScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Health Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.healthScore}/100 · severity {data.preview.severity} · evidence {data.preview.healthSnapshot.evidenceCoveragePct}% · negative feedback {data.preview.healthSnapshot.negativeFeedbackRatePct}% · release gate {data.preview.healthSnapshot.releaseGateStatus}
        </p>
        <p className="mt-2 text-sm text-amber-700">{data.preview.degradedMode.status}: {data.preview.degradedMode.message}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.preview.failureSignals.slice(0, 3).map((failure) => (
            <div key={failure.type} className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-900">{failure.severity} {failure.type}</p>
              <p className="mt-1 text-sm text-red-800">{failure.detail}</p>
            </div>
          ))}
          {data.preview.driftSignals.slice(0, 3).map((drift) => (
            <div key={drift.surface} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">{drift.surface} drift</p>
              <p className="mt-1 text-sm text-amber-800">{drift.detail}</p>
            </div>
          ))}
          {data.preview.automationRisks.slice(0, 3).map((risk) => (
            <div key={risk.actionKind} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">{risk.severity} automation</p>
              <p className="mt-1 text-sm text-zinc-700">{risk.actionKind}: {risk.risk}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Observability Incidents</h3>
        <div className="mt-4 space-y-4">
          {data.incidents.map((incident) => {
            const failures = readArray<{ type: string; severity: string; detail: string }>(incident.failureSignalJson);
            const drift = readArray<{ surface: string; weakRatePct: number }>(incident.driftSignalJson);
            const risks = readArray<{ actionKind: string; severity: string }>(incident.automationRiskJson);
            const steps = readArray<string>(incident.rollbackPlanJson, "steps");
            const postmortem = incident.postmortemJson && typeof incident.postmortemJson === "object" ? (incident.postmortemJson as { summary?: string; followUp?: string }) : {};
            return (
              <article key={incident.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {incident.status} · {incident.severity} · score {incident.healthScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{incident.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Failures {incident.failureCount} · drift {incident.driftSignalCount} · evidence gaps {incident.evidenceGapCount} · automation risks {incident.automationRiskCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(incident.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === incident.id || incident.status === "REVIEW_QUEUED" || incident.status === "RESOLVED"}
                      onClick={() => void post("queue_incident_review", { incidentId: incident.id, note: notes[incident.id] ?? "" }, "Incident review queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={busy === incident.id || incident.status === "RESOLVED"}
                      onClick={() => void post("resolve_incident", { incidentId: incident.id, resolutionNote: notes[incident.id] ?? "" }, "Incident resolved.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{incident.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Failures</p>
                    <p className="mt-1">{failures.slice(0, 2).map((item) => `${item.severity} ${item.type}`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Drift</p>
                    <p className="mt-1">{drift.slice(0, 2).map((item) => `${item.surface} ${item.weakRatePct}%`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Automation</p>
                    <p className="mt-1">{risks.slice(0, 2).map((item) => `${item.severity} ${item.actionKind}`).join("; ") || "No risks"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{steps.slice(0, 2).join("; ") || "No steps"}</p>
                  </div>
                </div>
                <p className="mt-3 rounded-xl bg-white p-3 text-sm text-zinc-700">{postmortem.summary ?? "No postmortem summary."}</p>
                <textarea
                  value={notes[incident.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [incident.id]: event.target.value }))}
                  placeholder="Optional incident review or resolution note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.incidents.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No observability incidents yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
