"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    commercialScore: number;
    leadershipSummary: string;
    quoteToCash: { quoteRiskCount: number; quoteCount: number; openSalesOrderCount: number; pipelineValue: number; salesOrderValue: number; expiringQuotes: Array<{ title: string; accountName: string; daysUntilExpiry: number | null }>; quoteGaps: Array<{ title: string; gaps: string[] }>; guardrail: string };
    pricingDiscipline: { pricingRiskCount: number; pricingSnapshotCount: number; averageRevenueScore: number; riskyRevenuePackets: Array<{ title: string; revenueScore: number }>; snapshotGaps: Array<{ sourceType: string; missing: string[] }>; guardrail: string };
    marginLeakage: { marginLeakageCount: number; totalVariance: number; disputeAmount: number; accrualAmount: number; riskyFinancePackets: Array<{ title: string; riskScore: number }> };
    invoiceAudit: { invoiceRiskCount: number; invoiceCount: number; failedInvoiceCount: number; unapprovedAccountingCount: number; riskyIntakes: Array<{ externalInvoiceNo: string | null; vendorLabel: string | null; rollupOutcome: string; redLineCount: number }> };
    customerCommercial: { customerRiskCount: number; customerBriefCount: number; weakCustomers: Array<{ title: string; serviceScore: number }>; customerSafeDraft: string; guardrail: string };
    contractHandoff: { contractRiskCount: number; contractPacketCount: number; obligationCount: number; riskyContracts: Array<{ title: string; complianceScore: number; complianceGapCount: number }>; handoffChecklist: string[]; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    commercialScore: number;
    quoteRiskCount: number;
    pricingRiskCount: number;
    invoiceRiskCount: number;
    marginLeakageCount: number;
    contractRiskCount: number;
    customerRiskCount: number;
    quoteToCashJson: unknown;
    pricingDisciplineJson: unknown;
    invoiceAuditJson: unknown;
    contractHandoffJson: unknown;
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

function money(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function CommercialRevenueControlClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/commercial-revenue-control", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Commercial & Revenue Control."));
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
    const res = await fetch("/api/assistant/commercial-revenue-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Commercial & Revenue Control."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 6, but packet creation and review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 6</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Commercial & Revenue Control Plane</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Govern quote-to-cash, pricing evidence, margin leakage, invoice audit, customer-safe updates, and contract handoff in one review-gated commercial workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview commercial score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.commercialScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Gather commercial evidence", "Pull revenue packets, finance packets, contract packets, quotes, orders, pricing snapshots, invoice audit, and customer briefs."],
            ["Step 2", "Create durable control packet", "Persist quote-to-cash, pricing, invoice, margin, customer, contract, response, and rollback evidence."],
            ["Step 3", "Review before execution", "Queue or approve review without changing prices, quotes, invoices, contracts, orders, or customer messages."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Commercial & Revenue Control packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 6 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {[
          ["Revenue", data.signals.revenuePackets],
          ["Finance", data.signals.financePackets],
          ["Contracts", data.signals.contractPackets],
          ["Customers", data.signals.customerBriefs],
          ["Quotes", data.signals.quotes],
          ["Orders", data.signals.salesOrders],
          ["Pricing", data.signals.pricingSnapshots],
          ["Invoices", data.signals.invoiceIntakes],
          ["Score", data.signals.previewCommercialScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Commercial Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Quote-to-cash</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.quoteToCash.quoteRiskCount} risk(s), {data.preview.quoteToCash.quoteCount} quote(s), pipeline {money(data.preview.quoteToCash.pipelineValue)}.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Pricing discipline</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.pricingDiscipline.pricingRiskCount} pricing risk(s), {data.preview.pricingDiscipline.pricingSnapshotCount} snapshot(s), average revenue score {data.preview.pricingDiscipline.averageRevenueScore}.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Invoice and margin</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.invoiceAudit.invoiceRiskCount} invoice risk(s), dispute {money(data.preview.marginLeakage.disputeAmount)}, accrual {money(data.preview.marginLeakage.accrualAmount)}.</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Customer and Contract Controls</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Customer-commercial risk</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.customerCommercial.customerRiskCount} risk(s) across {data.preview.customerCommercial.customerBriefCount} customer brief(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Contract handoff</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.contractHandoff.contractRiskCount} handoff risk(s), {data.preview.contractHandoff.obligationCount} obligation(s) in evidence.</p>
            </div>
            <pre className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{data.preview.customerCommercial.customerSafeDraft}</pre>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const quoteGaps = readArray<{ title: string; gaps: string[] }>(packet.quoteToCashJson, "quoteGaps");
            const snapshotGaps = readArray<{ sourceType: string; missing: string[] }>(packet.pricingDisciplineJson, "snapshotGaps");
            const riskyInvoices = readArray<{ externalInvoiceNo: string | null; rollupOutcome: string; redLineCount: number }>(packet.invoiceAuditJson, "riskyIntakes");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.commercialScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">Quotes {packet.quoteRiskCount} · pricing {packet.pricingRiskCount} · invoices {packet.invoiceRiskCount} · margin {packet.marginLeakageCount} · contracts {packet.contractRiskCount} · customers {packet.customerRiskCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_commercial_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Commercial review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Commercial & Revenue Control packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Quote gaps</p><p className="mt-1">{quoteGaps.slice(0, 2).map((item) => `${item.title}: ${item.gaps.join("/")}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Pricing gaps</p><p className="mt-1">{snapshotGaps.slice(0, 2).map((item) => `${item.sourceType}: ${item.missing.join("/")}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Invoice risk</p><p className="mt-1">{riskyInvoices.slice(0, 2).map((item) => `${item.externalInvoiceNo ?? "Invoice"} ${item.rollupOutcome}/${item.redLineCount} red`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No source mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional commercial review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 6 packets yet. Create the first durable Commercial & Revenue Control packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
