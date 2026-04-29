"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number | string>;
  preview: {
    accountScore: number;
    leadershipSummary: string;
    briefSignals: { briefRiskCount: number; guardrail: string };
    promiseExecution: { promiseRiskCount: number; guardrail: string };
    crmPipeline: { pipelineRiskCount: number; guardrail: string };
    exceptionExposure: { exceptionExposureCount: number; guardrail: string };
    disputeFinance: { disputeFinanceRiskCount: number; guardrail: string };
    replyGovernance: { governanceGapCount: number; guardrail: string };
    responsePlan: { status: string; guardrail: string };
    rollbackPlan: { guardrail: string };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    accountScore: number;
    briefRiskCount: number;
    promiseRiskCount: number;
    pipelineRiskCount: number;
    exceptionExposureCount: number;
    disputeFinanceRiskCount: number;
    governanceGapCount: number;
    briefSignalsJson: unknown;
    promiseExecutionJson: unknown;
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

export function CustomerSuccessAccountIntelligenceClient({
  initialSnapshot,
  canEdit,
}: {
  initialSnapshot: Snapshot;
  canEdit: boolean;
}) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/customer-success-account-intelligence", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Customer Success."));
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
    const res = await fetch("/api/assistant/customer-success-account-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Customer Success."));
      return;
    }
    setMessage(success);
    if (raw && typeof raw === "object" && "snapshot" in raw) setData((raw as { snapshot: Snapshot }).snapshot);
    else await load();
  }

  const previewScore = typeof data.signals.previewAccountScore === "number" ? data.signals.previewAccountScore : data.preview.accountScore;

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view Sprint 18, but packet creation and command actions require edit access.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 18</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Customer Success &amp; Account Intelligence</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Compose CRM brief health, promise execution, pipeline hygiene, customer-linked exceptions, dispute cues, and governed reply gaps — CRM-safe,
              review-first; no outbound posts from this workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview account score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{previewScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Aggregate cross-functional signals", "Briefs, orders, shipments, quotes, opportunities, CT exceptions, invoices, and finance dispute cues."],
            ["Step 2", "Create CS intelligence packet", "Persist dimensional JSON, leadership narrative, response plan, and rollback notes."],
            ["Step 3", "Govern review first", "Queue or approve review — CRM posts and customer sends stay manual."],
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
          onClick={() => void post("create_packet", {}, "Customer Success packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 18 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {[
          ["Briefs", data.signals.customerBriefs],
          ["Quotes", data.signals.quotes],
          ["Opportunities", data.signals.opportunities],
          ["Sales orders", data.signals.salesOrders],
          ["Cust. shipments", data.signals.shipmentsWithCustomers],
          ["CT exceptions", data.signals.customerFacingCtExceptions],
          ["Invoices", data.signals.invoiceIntakes],
          ["Score", previewScore],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{typeof value === "number" ? value : Number(value ?? 0)}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live account-intelligence preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Brief &amp; pipeline</p>
              <p className="mt-1 text-sm text-zinc-600">
                Brief health cues {data.preview.briefSignals.briefRiskCount}; CRM pipeline cues {data.preview.crmPipeline.pipelineRiskCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Promise &amp; exceptions</p>
              <p className="mt-1 text-sm text-zinc-600">
                Promise execution cues {data.preview.promiseExecution.promiseRiskCount}; customer-facing CT overlays {data.preview.exceptionExposure.exceptionExposureCount}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Finance &amp; governance</p>
              <p className="mt-1 text-sm text-zinc-600">
                Dispute/finance cues {data.preview.disputeFinance.disputeFinanceRiskCount}; governed reply gaps {data.preview.replyGovernance.governanceGapCount}.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Guardrails</h3>
          <div className="mt-4 grid gap-3 text-sm text-zinc-700">
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.briefSignals.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.promiseExecution.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.replyGovernance.guardrail}</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">{data.preview.responsePlan.guardrail}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const weakBriefs = readArray<{ title?: string }>(packet.briefSignalsJson, "weakBriefs");
            const lateOrders = readArray<{ soNumber?: string }>(packet.promiseExecutionJson, "lateOrders");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.accountScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Brief {packet.briefRiskCount} · promise {packet.promiseRiskCount} · pipeline {packet.pipelineRiskCount} · CT exposure {packet.exceptionExposureCount} · dispute/finance{" "}
                      {packet.disputeFinanceRiskCount} · governance {packet.governanceGapCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"}
                      onClick={() => void post("queue_success_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Customer success review queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"}
                      onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Customer Success packet approved.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Approve packet
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Brief cues</p>
                    <p className="mt-1">{weakBriefs.slice(0, 2).map((row) => row.title ?? "Brief").join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Late promises</p>
                    <p className="mt-1">{lateOrders.slice(0, 2).map((row) => row.soNumber ?? "SO").join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Governance gaps</p>
                    <p className="mt-1">{packet.governanceGapCount} draft(s) pending approval</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{rollback[0] ?? "No silent CRM mutation."}</p>
                  </div>
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional customer success command note"
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 18 packets yet. Create the first durable Customer Success packet from the live preview.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
