"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Packet = {
  id: string;
  title: string;
  status: string;
  riskScore: number;
  currency: string;
  totalVariance: string;
  disputeAmount: string;
  accrualAmount: string;
  boardSummary: string;
  varianceSummaryJson: unknown;
  leakageJson: unknown;
  accrualRiskJson: unknown;
  updatedAt: string;
};

type Snapshot = {
  signals: {
    invoices: number;
    shipmentCosts: number;
    procurementPlans: number;
    customerBriefs: number;
  };
  packets: Packet[];
};

function readNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "number" ? next : null;
}

function readFlags(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const next = (value as Record<string, unknown>).riskFlags;
  return Array.isArray(next) ? next.filter((item): item is string => typeof item === "string") : [];
}

export function FinanceControlClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/finance-control", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load finance control tower."));
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
    const res = await fetch("/api/assistant/finance-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update finance control tower."));
      return;
    }
    setMessage(success);
    await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP19</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Finance Control Tower</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Turn invoice variances, margin leakage, accrual exposure, procurement status, and accounting handoff signals
          into board-ready finance packets. The assistant queues disputes and accounting review, but never exports or
          mutates accounting automatically.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Aggregate evidence", "Invoice audit, snapshots, shipment cost, RFQ, and customer risk."],
            ["Step 2", "Generate packet", "Compute variance, leakage, dispute, accrual, and cash-risk metrics."],
            ["Step 3", "Approve review", "Queue finance actions before dispute or accounting handoff."],
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
          onClick={() => void post("create_packet", {}, "Finance control packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create finance packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Invoice signals</p>
          <p className="mt-1 text-2xl font-semibold">{data.signals.invoices}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Shipment finance</p>
          <p className="mt-1 text-2xl font-semibold">{data.signals.shipmentCosts}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Procurement plans</p>
          <p className="mt-1 text-2xl font-semibold">{data.signals.procurementPlans}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Customer risk briefs</p>
          <p className="mt-1 text-2xl font-semibold">{data.signals.customerBriefs}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Finance Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const redLineCount = readNumber(packet.varianceSummaryJson, "redLineCount") ?? 0;
            const negativeMarginCount = readNumber(packet.leakageJson, "negativeMarginCount") ?? 0;
            const riskFlags = readFlags(packet.accrualRiskJson);
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · risk {packet.riskScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Variance {Number(packet.totalVariance).toLocaleString()} {packet.currency} · dispute {Number(packet.disputeAmount).toLocaleString()} · accrual {Number(packet.accrualAmount).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Red lines {redLineCount} · negative-margin shipments {negativeMarginCount} · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_finance_review", { packetId: packet.id, approvalNote: approvalNotes[packet.id] ?? "" }, "Finance review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue finance review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.boardSummary}</pre>
                {riskFlags.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-amber-700">
                    {riskFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                ) : null}
                <textarea
                  value={approvalNotes[packet.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional finance approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No finance control packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
