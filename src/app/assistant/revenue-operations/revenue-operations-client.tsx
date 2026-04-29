"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type RevenuePacket = {
  id: string;
  title: string;
  status: string;
  revenueScore: number;
  quoteCount: number;
  opportunityCount: number;
  feasibilityRiskCount: number;
  pricingRiskCount: number;
  approvalStepCount: number;
  selectedQuoteId: string | null;
  commercialSnapshotJson: unknown;
  feasibilityJson: unknown;
  pricingEvidenceJson: unknown;
  approvalRouteJson: unknown;
  customerDraftJson: unknown;
  contractHandoffJson: unknown;
  rollbackPlanJson: unknown;
  leadershipSummary: string;
  updatedAt: string;
};

type Snapshot = {
  signals: {
    revenueScore: number;
    quoteCount: number;
    opportunityCount: number;
    feasibilityRisks: number;
    pricingRisks: number;
    approvalSteps: number;
    selectedQuoteId: string | null;
  };
  preview: {
    revenueScore: number;
    quoteCount: number;
    opportunityCount: number;
    feasibilityRiskCount: number;
    pricingRiskCount: number;
    approvalStepCount: number;
    selectedQuoteId: string | null;
    commercialSnapshot: { selectedQuote: { title: string; accountName: string; subtotal: number; currency: string } | null };
    feasibility: { risks: Array<{ key: string; severity: string; detail: string }>; guardrail: string };
    pricingEvidence: { risks: Array<{ key: string; severity: string; detail: string }>; guardrail: string };
    approvalRoute: { steps: Array<{ owner: string; action: string }>; guardrail: string };
    customerDraft: { subject: string; body: string; guardrail: string };
    contractHandoff: { readyForHandoff: boolean; blockers: string[]; guardrail: string };
    rollbackPlan: { steps: string[] };
    leadershipSummary: string;
  };
  packets: RevenuePacket[];
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function RevenueOperationsClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/revenue-operations", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load revenue operations."));
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
    const res = await fetch("/api/assistant/revenue-operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update revenue operations."));
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP36</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Quote-to-Contract Revenue Operations</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Review CRM quotes and opportunities with pricing evidence, fulfillment feasibility, commercial approvals,
          customer-ready draft language, and contract handoff controls before anything is sent or mutated.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Step 1", "Select", "Choose the highest-priority quote by value, status, and strategic account context."],
            ["Step 2", "Feasibility", "Check plan health, inventory coverage, transport risk, and quote completeness."],
            ["Step 3", "Approval", "Route commercial, finance, operations, and legal reviews."],
            ["Step 4", "Handoff", "Prepare customer draft and contract package without auto-send or auto-sign."],
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
          onClick={() => void post("create_packet", {}, "Revenue operations packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create revenue packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {[
          ["Score", data.signals.revenueScore],
          ["Quotes", data.signals.quoteCount],
          ["Opportunities", data.signals.opportunityCount],
          ["Feasibility", data.signals.feasibilityRisks],
          ["Pricing", data.signals.pricingRisks],
          ["Approvals", data.signals.approvalSteps],
          ["Quote", data.signals.selectedQuoteId ?? "none"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 break-words text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Revenue Preview</h3>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{data.preview.leadershipSummary}</pre>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Selected quote</p>
            <p className="mt-1 text-sm text-zinc-700">
              {data.preview.commercialSnapshot.selectedQuote
                ? `${data.preview.commercialSnapshot.selectedQuote.title} · ${data.preview.commercialSnapshot.selectedQuote.accountName}`
                : "No quote selected"}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Feasibility</p>
            <p className="mt-1 text-sm text-amber-800">
              {data.preview.feasibility.risks.slice(0, 2).map((risk) => `${risk.severity} ${risk.key}`).join("; ") || "No feasibility risks"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Approval route</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.approvalRoute.steps.map((step) => step.owner).join(", ") || "No approvals"}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-950">Handoff</p>
            <p className="mt-1 text-sm text-zinc-700">{data.preview.contractHandoff.readyForHandoff ? "Ready" : data.preview.contractHandoff.blockers.join("; ") || "Blocked"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Revenue Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const feasibilityRisks = readArray<{ key: string; severity: string; detail: string }>(packet.feasibilityJson, "risks");
            const pricingRisks = readArray<{ key: string; severity: string; detail: string }>(packet.pricingEvidenceJson, "risks");
            const approvalSteps = readArray<{ owner: string; action: string }>(packet.approvalRouteJson, "steps");
            const blockers = readArray<string>(packet.contractHandoffJson, "blockers");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.revenueScore}/100 · quote {packet.selectedQuoteId ?? "none"}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Quotes {packet.quoteCount} · opportunities {packet.opportunityCount} · feasibility {packet.feasibilityRiskCount} · pricing {packet.pricingRiskCount} · approvals {packet.approvalStepCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_revenue_review", { packetId: packet.id, approvalNote: notes[packet.id] ?? "" }, "Revenue review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue revenue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  {[
                    ["Feasibility", feasibilityRisks.slice(0, 2).map((item) => `${item.severity} ${item.key}`).join("; ") || "None"],
                    ["Pricing", pricingRisks.slice(0, 2).map((item) => `${item.severity} ${item.key}`).join("; ") || "None"],
                    ["Approvals", approvalSteps.slice(0, 2).map((item) => item.owner).join("; ") || "None"],
                    ["Handoff", blockers.slice(0, 2).join("; ") || "Ready"],
                    ["Rollback", rollback.slice(0, 2).join("; ") || "No rollback steps"],
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
                  placeholder="Optional revenue review note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No revenue packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
