"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    financeScore: number;
    currency: string;
    leadershipSummary: string;
    cashPosture: { cashExposureAmount: number; openSalesOrderValue: number; pendingBilling: number; unapprovedAccrual: number; cashRiskCount: number; guardrail: string };
    receivables: { receivableRiskAmount: number; unbilledOrderCount: number; expiringQuoteCount: number; riskyRevenuePacketCount: number; guardrail: string };
    payables: { payableRiskAmount: number; openVendorCostAmount: number; riskyInvoiceCount: number; disputedFinancePacketCount: number; guardrail: string };
    accountingHandoff: { accountingBlockerCount: number; approvedForAccountingCount: number; handoffApprovedCount: number; blockers: Array<{ externalInvoiceNo: string | null; vendorLabel: string | null; blockers: string[] }>; guardrail: string };
    marginLeakage: { marginLeakageAmount: number; negativeMarginCount: number; lowMarginCount: number; commercialMarginRiskCount: number; guardrail: string };
    warehouseBilling: { invoiceRunCount: number; billingExceptionCount: number; pendingBillingAmount: number; guardrail: string };
    closeControl: { closeControlGapCount: number; passedCount: number; checkCount: number; gaps: Array<{ key: string; label: string; severity: string }>; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[]; guardrail: string };
    rollbackPlan: { steps: string[]; guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    financeScore: number;
    currency: string;
    cashExposureAmount: number;
    receivableRiskAmount: number;
    payableRiskAmount: number;
    marginLeakageAmount: number;
    accountingBlockerCount: number;
    billingExceptionCount: number;
    closeControlGapCount: number;
    cashPostureJson: unknown;
    receivablesJson: unknown;
    payablesJson: unknown;
    accountingHandoffJson: unknown;
    marginLeakageJson: unknown;
    warehouseBillingJson: unknown;
    closeControlJson: unknown;
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

function money(currency: string, value: number) {
  return `${currency} ${Math.round(value).toLocaleString("en-US")}`;
}

export function FinanceCashControlsClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/finance-cash-controls", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Finance Cash Controls."));
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
    const res = await fetch("/api/assistant/finance-cash-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Finance Cash Controls."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 12, but packet creation and controller review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 12</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Finance, Cash & Accounting Controls</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Review cash exposure, receivables, payables, accounting handoff, margin leakage, WMS billing, and close controls before financial execution.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview finance</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.financeScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Consolidate controls", "Load finance packets, revenue packets, commercial controls, invoices, shipment financials, cost lines, WMS billing, quotes, orders, and review queue evidence."],
            ["Step 2", "Freeze close evidence", "Persist cash posture, AR/AP risk, accounting handoff, margin leakage, warehouse billing, close controls, response plan, and rollback evidence."],
            ["Step 3", "Approve before posting", "Queue controller review before accounting approvals, journals, exports, vendor payments, customer billing, or period close."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Finance Cash Control packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 12 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-10">
        {[
          ["Finance", data.signals.financePackets],
          ["Revenue", data.signals.revenuePackets],
          ["Commercial", data.signals.commercialPackets],
          ["Invoices", data.signals.invoiceIntakes],
          ["Snapshots", data.signals.financialSnapshots],
          ["Cost lines", data.signals.shipmentCostLines],
          ["WMS bills", data.signals.wmsInvoiceRuns],
          ["Quotes", data.signals.quotes],
          ["Orders", data.signals.salesOrders],
          ["Score", data.signals.previewFinanceScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Finance Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Cash posture</p>
              <p className="mt-1 text-sm text-zinc-600">{money(data.preview.currency, data.preview.cashPosture.cashExposureAmount)} exposure, {data.preview.cashPosture.cashRiskCount} risk(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Receivables and payables</p>
              <p className="mt-1 text-sm text-zinc-600">{money(data.preview.currency, data.preview.receivables.receivableRiskAmount)} AR risk, {money(data.preview.currency, data.preview.payables.payableRiskAmount)} AP risk.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Close controls</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.closeControl.passedCount}/{data.preview.closeControl.checkCount} checks passed, {data.preview.closeControl.closeControlGapCount} gap(s).</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Accounting and Billing</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Accounting handoff</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.accountingHandoff.accountingBlockerCount} blocker(s), {data.preview.accountingHandoff.approvedForAccountingCount} invoice(s) approved for accounting.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">WMS billing</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.warehouseBilling.invoiceRunCount} run(s), {data.preview.warehouseBilling.billingExceptionCount} exception(s), {money(data.preview.currency, data.preview.warehouseBilling.pendingBillingAmount)} pending.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Margin leakage</p>
              <p className="mt-1 text-sm text-zinc-600">{money(data.preview.currency, data.preview.marginLeakage.marginLeakageAmount)} leakage, {data.preview.marginLeakage.negativeMarginCount} negative-margin shipment(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const handoffBlockers = readArray<{ externalInvoiceNo: string | null; vendorLabel: string | null; blockers: string[] }>(packet.accountingHandoffJson, "blockers");
            const closeGaps = readArray<{ key: string; label: string; severity: string }>(packet.closeControlJson, "gaps");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.financeScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Cash {money(packet.currency, packet.cashExposureAmount)} · AR {money(packet.currency, packet.receivableRiskAmount)} · AP {money(packet.currency, packet.payableRiskAmount)} · leakage {money(packet.currency, packet.marginLeakageAmount)} · accounting {packet.accountingBlockerCount} · billing {packet.billingExceptionCount} · close {packet.closeControlGapCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "CONTROLLER_REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_controller_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Controller review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Finance Cash Control packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Accounting</p><p className="mt-1">{handoffBlockers.slice(0, 2).map((item) => `${item.externalInvoiceNo ?? item.vendorLabel ?? "Invoice"}: ${item.blockers.join(", ")}`).join("; ") || "No blockers"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Close</p><p className="mt-1">{closeGaps.slice(0, 2).map((item) => `${item.label}: ${item.severity}`).join("; ") || "Ready"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No finance mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional controller review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 12 packets yet. Create the first durable Finance Cash Control packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
