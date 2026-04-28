"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    shipments: number;
    warehouseEvents: number;
    suppliers: number;
    previewSustainabilityScore: number;
    previewCo2eKg: number;
  };
  preview: {
    sustainabilityScore: number;
    estimatedCo2eKg: number;
    potentialSavingsKg: number;
    missingDataCount: number;
    recommendationCount: number;
    recommendations: Array<{ title: string; estimatedSavingsKg: number; guardrail: string }>;
    missingData: Array<{ sourceType: string; severity: string; gap: string }>;
    assumptions: { guardrail?: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    sustainabilityScore: number;
    estimatedCo2eKg: string;
    potentialSavingsKg: string;
    missingDataCount: number;
    recommendationCount: number;
    emissionsJson: unknown;
    missingDataJson: unknown;
    recommendationJson: unknown;
    assumptionsJson: unknown;
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

export function SustainabilityClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/sustainability", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load sustainability workspace."));
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
    const res = await fetch("/api/assistant/sustainability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update sustainability workspace."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP24</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Sustainability & ESG Operations</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Estimate shipment and warehouse emissions, expose missing ESG data, and compare greener execution options.
          The assistant keeps all ESG claims planning-grade until a reviewer approves assumptions and evidence.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Collect evidence", "Shipment modes, carriers, weights, lanes, WMS activity, and supplier regions."],
            ["Step 2", "Estimate and compare", "Mode factors, data gaps, and greener routing options with savings assumptions."],
            ["Step 3", "Approve ESG packet", "Queue review before route changes or customer/board ESG reporting."],
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
          onClick={() => void post("create_packet", {}, "Sustainability packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create ESG packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Shipments", data.signals.shipments],
          ["Warehouse events", data.signals.warehouseEvents],
          ["Suppliers", data.signals.suppliers],
          ["Preview kg CO2e", data.signals.previewCo2eKg],
          ["ESG score", data.signals.previewSustainabilityScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live ESG Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.sustainabilityScore}/100 · estimated {data.preview.estimatedCo2eKg} kg CO2e · possible savings {data.preview.potentialSavingsKg} kg · data gaps {data.preview.missingDataCount}
        </p>
        <p className="mt-2 text-sm text-amber-700">{data.preview.assumptions.guardrail}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.preview.recommendations.slice(0, 4).map((item) => (
            <div key={item.title} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-600">Savings estimate {item.estimatedSavingsKg} kg CO2e. {item.guardrail}</p>
            </div>
          ))}
          {data.preview.missingData.slice(0, 4).map((gap, index) => (
            <div key={`${gap.sourceType}-${gap.gap}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">{gap.severity} data gap</p>
              <p className="mt-1 text-sm text-amber-800">{gap.sourceType}: {gap.gap}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">ESG Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const recommendations = readArray<{ title: string; estimatedSavingsKg: number }>(packet.recommendationJson);
            const gaps = readArray<{ sourceType: string; severity: string; gap: string }>(packet.missingDataJson);
            const emissions = readArray<{ shipmentNo: string | null; mode: string; estimatedCo2eKg: number }>(packet.emissionsJson, "shipments");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.sustainabilityScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      {packet.estimatedCo2eKg} kg CO2e · savings {packet.potentialSavingsKg} kg · gaps {packet.missingDataCount} · recommendations {packet.recommendationCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_sustainability_review", { packetId: packet.id, approvalNote: approvalNotes[packet.id] ?? "" }, "Sustainability review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Largest estimates</p>
                    <p className="mt-1">{emissions.slice(0, 2).map((item) => `${item.shipmentNo ?? "Shipment"} ${item.mode}: ${item.estimatedCo2eKg} kg`).join("; ") || "No shipment estimates"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Recommendations</p>
                    <p className="mt-1">{recommendations.slice(0, 2).map((item) => `${item.title} (${item.estimatedSavingsKg} kg)`).join("; ") || "No recommendations"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Data gaps</p>
                    <p className="mt-1">{gaps.slice(0, 2).map((item) => `${item.severity} ${item.sourceType}: ${item.gap}`).join("; ") || "No gaps"}</p>
                  </div>
                </div>
                <textarea
                  value={approvalNotes[packet.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional ESG approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No sustainability packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
