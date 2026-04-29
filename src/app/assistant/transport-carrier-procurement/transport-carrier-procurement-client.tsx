"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    procurementScore: number;
    leadershipSummary: string;
    rfqTariff: { rfqRiskCount: number; guardrail: string };
    bookingPricing: { tariffBookingRiskCount: number; guardrail: string };
    laneExecution: { laneRiskCount: number; guardrail: string };
    tenderAllocation: { tenderRiskCount: number; guardrail: string };
    invoiceFeedback: { invoiceVarianceCount: number; guardrail: string };
    executionRisk: { executionRiskCount: number; guardrail: string };
    carrierPerformance: { carrierRiskWatchCount: number; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[]; guardrail: string };
    rollbackPlan: { steps: string[]; guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    procurementScore: number;
    rfqRiskCount: number;
    tariffBookingRiskCount: number;
    laneRiskCount: number;
    tenderRiskCount: number;
    invoiceVarianceCount: number;
    executionRiskCount: number;
    rfqTariffJson: unknown;
    bookingPricingJson: unknown;
    laneExecutionJson: unknown;
    rollbackPlanJson: unknown;
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

export function TransportCarrierProcurementClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/transport-carrier-procurement", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Transportation & Carrier Procurement."));
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
    const res = await fetch("/api/assistant/transport-carrier-procurement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Transportation & Carrier Procurement."));
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
      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view Sprint 16, but packet creation and procurement review actions require edit access.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 16</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Transportation &amp; Carrier Procurement Command</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Consolidate RFQs, tariff/booking snapshots, lane execution, procurement plans, carrier-facing variance, and Control Tower exceptions before tenders or settlements — review-only, no silent
              logistics mutation.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview procurement score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.procurementScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Gather transport signals", "Pull RFQs, tariff versions, booking snapshots, shipments, procurement plans, invoice audits, and lane exceptions."],
            ["Step 2", "Create procurement packet", "Persist RFQ/tariff, lane, tender, invoice feedback, carrier overlay, response plan, and rollback evidence."],
            ["Step 3", "Human-led carriers & settlements", "Queue or approve review — carriers, bookings, tariffs, invoices, and awards stay human-approved."],
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
          disabled={!canEdit || busy === "create_packet"}
          onClick={() => void post("create_packet", {}, "Transportation & Carrier Procurement packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 16 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {[
          ["RFQs", data.signals.quoteRequests],
          ["Tariffs", data.signals.tariffContractHeaders],
          ["Snapshots", data.signals.bookingPricingSnapshots],
          ["Shipments", data.signals.shipments],
          ["Plans", data.signals.transportationProcurementPlans],
          ["Invoices", data.signals.invoiceIntakes],
          ["Exceptions", data.signals.ctExceptionsOpen],
          ["Score", data.signals.previewProcurementScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live procurement preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">RFQ / tariff</p>
              <p className="mt-1 text-sm text-zinc-600">
                {data.preview.rfqTariff.rfqRiskCount} RFQ risk signal(s); tariff/booking gaps {data.preview.bookingPricing.tariffBookingRiskCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Lanes &amp; tenders</p>
              <p className="mt-1 text-sm text-zinc-600">
                Lane risks {data.preview.laneExecution.laneRiskCount}; tender spread/advisory risks {data.preview.tenderAllocation.tenderRiskCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Invoices &amp; execution</p>
              <p className="mt-1 text-sm text-zinc-600">
                Invoice variance signals {data.preview.invoiceFeedback.invoiceVarianceCount}; execution backlog signals {data.preview.executionRisk.executionRiskCount}; carrier watch lanes{" "}
                {data.preview.carrierPerformance.carrierRiskWatchCount}.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Guardrails</h3>
          <div className="mt-4 grid gap-3 text-sm text-zinc-700">
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.rfqTariff.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.bookingPricing.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.invoiceFeedback.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.responsePlan.guardrail}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const staleRfqs = readArray<{ title: string }>(packet.rfqTariffJson, "staleOpenRfqs");
            const tariffRisk = readArray<{ title: string; pendingVersions: number }>(packet.bookingPricingJson, "tariffVersionRisk");
            const slaBreaches = readArray<{ shipmentNo: string | null }>(packet.laneExecutionJson, "bookingSlaBreaches");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.procurementScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      RFQ {packet.rfqRiskCount} · tariff/booking {packet.tariffBookingRiskCount} · lanes {packet.laneRiskCount} · tender {packet.tenderRiskCount} · invoices {packet.invoiceVarianceCount} ·
                      execution {packet.executionRiskCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"}
                      onClick={() => void post("queue_procurement_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Carrier procurement review queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"}
                      onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Transportation & Carrier Procurement packet approved.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Approve packet
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Stale RFQs</p>
                    <p className="mt-1">{staleRfqs.slice(0, 2).map((item) => item.title).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Tariff versions</p>
                    <p className="mt-1">{tariffRisk.slice(0, 2).map((item) => `${item.title} (${item.pendingVersions} pending)`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Booking SLA</p>
                    <p className="mt-1">{slaBreaches.slice(0, 2).map((item) => item.shipmentNo ?? "Shipment").join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{rollback[0] ?? "No silent mutation."}</p>
                  </div>
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional procurement review note"
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">
              No Sprint 16 packets yet. Create the first durable Transportation &amp; Carrier Procurement packet from the live preview.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
