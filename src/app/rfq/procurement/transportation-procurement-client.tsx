"use client";

import { useCallback, useMemo, useState } from "react";

type QuoteRequestOption = {
  id: string;
  title: string;
  status: string;
  transportMode: string;
  originLabel: string;
  destinationLabel: string;
  updatedAt: string;
};

type PricingSnapshotRow = {
  id: string;
  sourceType: string;
  sourceRecordId: string;
  sourceSummary: string | null;
  currency: string;
  totalEstimatedCost: string;
  frozenAt: string;
};

type ProcurementPlan = {
  id: string;
  title: string;
  status: string;
  quoteRequestId: string | null;
  recommendedCarrier: string | null;
  allocationScore: number;
  allocationPlanJson: unknown;
  tenderDraftJson: unknown;
  updatedAt: string;
};

type Snapshot = {
  quoteRequests: QuoteRequestOption[];
  snapshots: PricingSnapshotRow[];
  plans: ProcurementPlan[];
};

function readJsonString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  const v = (value as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function readJsonStringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== "object") return [];
  const v = (value as Record<string, unknown>)[key];
  return Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : [];
}

export function TransportationProcurementClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedQuoteRequestId, setSelectedQuoteRequestId] = useState(initialSnapshot.quoteRequests[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedQuote = useMemo(
    () => snapshot.quoteRequests.find((rfq) => rfq.id === selectedQuoteRequestId) ?? null,
    [selectedQuoteRequestId, snapshot.quoteRequests],
  );

  const reload = useCallback(async () => {
    const res = await fetch("/api/rfq/procurement", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not reload procurement workspace.");
    setSnapshot((await res.json()) as Snapshot);
  }, []);

  async function createPlan() {
    if (!selectedQuoteRequestId) return;
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/rfq/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_plan", quoteRequestId: selectedQuoteRequestId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not create transportation procurement plan.");
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create transportation procurement plan.");
    } finally {
      setBusy(null);
    }
  }

  async function queueAllocation(planId: string) {
    setBusy(planId);
    setError(null);
    try {
      const res = await fetch("/api/rfq/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue_allocation", planId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not queue allocation approval.");
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not queue allocation approval.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP16 Transportation Procurement</p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {[
            ["Step 1", "Select an RFQ", "Use submitted carrier responses as the procurement basis."],
            ["Step 2", "Score evidence", "Blend cost, service, snapshot, and invoice audit feedback."],
            ["Step 3", "Approve allocation", "Queue tender/recovery work before carrier communication."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h2 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h2>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Carrier Allocation Builder</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Create a durable recommendation from RFQ outcomes, frozen booking/pricing snapshots, shipment execution,
            and invoice feedback. The assistant never books, tenders, or emails silently.
          </p>

          <label className="mt-5 block text-sm font-semibold text-zinc-800" htmlFor="rfq-id">
            RFQ
          </label>
          <select
            id="rfq-id"
            value={selectedQuoteRequestId}
            onChange={(event) => setSelectedQuoteRequestId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
          >
            {snapshot.quoteRequests.map((rfq) => (
              <option key={rfq.id} value={rfq.id}>
                {rfq.title} · {rfq.status}
              </option>
            ))}
          </select>

          {selectedQuote ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-950">{selectedQuote.originLabel} → {selectedQuote.destinationLabel}</p>
              <p className="mt-1">{selectedQuote.transportMode} · Updated {new Date(selectedQuote.updatedAt).toLocaleString()}</p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No RFQ is available yet. Create an RFQ request first.
            </p>
          )}

          <button
            type="button"
            onClick={() => void createPlan()}
            disabled={!selectedQuoteRequestId || busy === "create"}
            className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "create" ? "Creating..." : "Create allocation plan"}
          </button>
          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Evidence Coverage</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-2xl font-semibold text-zinc-950">{snapshot.quoteRequests.length}</p>
              <p className="text-xs uppercase tracking-wide text-zinc-500">RFQs</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-2xl font-semibold text-zinc-950">{snapshot.snapshots.length}</p>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Pricing snapshots</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-2xl font-semibold text-zinc-950">{snapshot.plans.length}</p>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Procurement plans</p>
            </div>
          </div>
          <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-zinc-200">
            {snapshot.snapshots.slice(0, 8).map((row) => (
              <div key={row.id} className="border-b border-zinc-100 p-3 text-sm last:border-b-0">
                <p className="font-medium text-zinc-900">{row.sourceSummary ?? row.sourceType}</p>
                <p className="text-zinc-600">{row.currency} {Number(row.totalEstimatedCost).toLocaleString()} · frozen {new Date(row.frozenAt).toLocaleDateString()}</p>
              </div>
            ))}
            {snapshot.snapshots.length === 0 ? <p className="p-3 text-sm text-zinc-600">No frozen pricing snapshots found yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">Procurement Plans</h2>
        <div className="mt-4 grid gap-4">
          {snapshot.plans.map((plan) => {
            const rationale = readJsonStringArray(plan.allocationPlanJson, "rationale");
            const body = readJsonString(plan.tenderDraftJson, "body");
            return (
              <article key={plan.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{plan.status}</p>
                    <h3 className="mt-1 text-base font-semibold text-zinc-950">{plan.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      Recommended: {plan.recommendedCarrier ?? "Needs more evidence"} · Score {plan.allocationScore}/100
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void queueAllocation(plan.id)}
                    disabled={busy === plan.id || plan.status === "ALLOCATION_QUEUED"}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:border-[var(--arscmp-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === plan.id ? "Queueing..." : plan.status === "ALLOCATION_QUEUED" ? "Queued" : "Queue approval"}
                  </button>
                </div>
                {rationale.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-zinc-700">
                    {rationale.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {body ? (
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700">{body}</pre>
                ) : null}
              </article>
            );
          })}
          {snapshot.plans.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No transportation procurement plans yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
