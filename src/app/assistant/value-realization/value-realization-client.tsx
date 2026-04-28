"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Packet = {
  id: string;
  title: string;
  status: string;
  valueScore: number;
  adoptionScore: number;
  totalEstimatedValue: number;
  automationSavings: number;
  recoveredValue: number;
  avoidedCost: number;
  roiPct: number;
  adoptionFunnelJson: unknown;
  valueAttributionJson: unknown;
  savingsJson: unknown;
  serviceImpactJson: unknown;
  cohortJson: unknown;
  roiAssumptionJson: unknown;
  exportReportJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Snapshot = {
  signals: {
    interactions: number;
    actions: number;
    financeSignals: number;
    serviceSignals: number;
    previewValueScore: number;
    previewEstimatedValue: number;
  };
  preview: {
    valueScore: number;
    adoptionScore: number;
    totalEstimatedValue: number;
    automationSavings: number;
    recoveredValue: number;
    avoidedCost: number;
    roiPct: number;
    adoptionFunnel: { interactionCount: number; activeUserCount: number; surfaceCount: number; helpfulRatePct: number; surfaces: Record<string, number> };
    valueAttribution: { entries: Array<{ domain: string; completed: number; estimatedValue: number }> };
    savings: { completedActions: number; enabledAutomations: number; actionHoursSaved: number; automationHoursSaved: number };
    serviceImpact: { customerBriefs: number; resolvedExceptions: number; highSeverityOpen: number; averageServiceScore: number };
    cohorts: { cohorts: Array<{ surface: string; interactions: number; activeUsers: number }> };
    roiAssumptions: { monthlyProgramCost: number; paybackStatus: string; guardrail: string };
    exportReport: { audience: string[]; redactionMode: string; guardrails: string[] };
    leadershipSummary: string;
  };
  packets: Packet[];
};

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function ValueRealizationClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/value-realization", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load value realization."));
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
    const res = await fetch("/api/assistant/value-realization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update value realization."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP31</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">AI Product Analytics & Value Realization</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Measure assistant adoption, completed work, recovered finance value, service impact, automation savings, ROI assumptions,
          and role-safe board/customer report exports from live operating signals.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Measure adoption", "Track interactions, users, surfaces, feedback, cohorts, and completed work."],
            ["Step 2", "Attribute value", "Estimate avoided cost, automation savings, recovered finance value, and service impact."],
            ["Step 3", "Review reporting", "Queue role-safe ROI and board/customer summaries before external sharing."],
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
          onClick={() => void post("create_packet", {}, "Value realization packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create value packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-6">
        {[
          ["Interactions", data.signals.interactions],
          ["Actions", data.signals.actions],
          ["Finance", data.signals.financeSignals],
          ["Service", data.signals.serviceSignals],
          ["Score", data.signals.previewValueScore],
          ["Value", money(data.signals.previewEstimatedValue)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Value Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.valueScore}/100 · adoption {data.preview.adoptionScore}/100 · ROI {data.preview.roiPct}% · value {money(data.preview.totalEstimatedValue)} · service score {data.preview.serviceImpact.averageServiceScore}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Adoption</p>
            <p className="mt-1 text-sm text-zinc-700">
              {data.preview.adoptionFunnel.activeUserCount} users · {data.preview.adoptionFunnel.surfaceCount} surfaces · helpful {data.preview.adoptionFunnel.helpfulRatePct}%
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">Savings</p>
            <p className="mt-1 text-sm text-emerald-800">
              {money(data.preview.avoidedCost)} avoided · {money(data.preview.automationSavings)} automation · {money(data.preview.recoveredValue)} recovered
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Attribution</p>
            <p className="mt-1 text-sm text-amber-800">
              {data.preview.valueAttribution.entries.slice(0, 3).map((item) => `${item.domain}: ${money(item.estimatedValue)}`).join("; ") || "No attribution yet"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Export guardrail</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.exportReport.redactionMode}: {data.preview.exportReport.guardrails[0]}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Value Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const attribution = readArray<{ domain: string; estimatedValue: number }>(packet.valueAttributionJson, "entries");
            const cohorts = readArray<{ surface: string; interactions: number; activeUsers: number }>(packet.cohortJson, "cohorts");
            const guardrails = readArray<string>(packet.exportReportJson, "guardrails");
            const roi = packet.roiAssumptionJson && typeof packet.roiAssumptionJson === "object" ? (packet.roiAssumptionJson as { paybackStatus?: string; guardrail?: string }) : {};
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.valueScore}/100 · ROI {packet.roiPct}%
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Value {money(packet.totalEstimatedValue)} · avoided {money(packet.avoidedCost)} · automation {money(packet.automationSavings)} · recovered {money(packet.recoveredValue)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_value_review", { packetId: packet.id, approvalNote: notes[packet.id] ?? "" }, "Value review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue value review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {[
                    ["Attribution", attribution.slice(0, 2).map((item) => `${item.domain}: ${money(item.estimatedValue)}`).join("; ") || "None"],
                    ["Cohorts", cohorts.slice(0, 2).map((item) => `${item.surface}: ${item.interactions}`).join("; ") || "None"],
                    ["ROI", `${roi.paybackStatus ?? "UNKNOWN"} · ${roi.guardrail ?? "Review assumptions."}`],
                    ["Export", guardrails.slice(0, 2).join("; ") || "Role-safe summary"],
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
                  placeholder="Optional value review note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No value realization packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
