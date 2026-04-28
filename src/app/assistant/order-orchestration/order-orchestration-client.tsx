"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  customers: Array<{ id: string; name: string; accountType: string }>;
  products: Array<{ id: string; name: string; sku: string | null; productCode: string | null }>;
  warehouses: Array<{ id: string; name: string; code: string | null }>;
  plans: Array<{
    id: string;
    title: string;
    status: string;
    sourceKind: string;
    sourceText: string;
    proposalJson: unknown;
    updatedAt: string;
  }>;
};

export function OrderOrchestrationClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [sourceText, setSourceText] = useState("Customer needs qty 24 units for delivery next week. Check ATP and propose split if needed.");
  const [customerCrmAccountId, setCustomerCrmAccountId] = useState(initialSnapshot.customers[0]?.id ?? "");
  const [productId, setProductId] = useState(initialSnapshot.products[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/order-orchestration", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load order orchestration."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createPlan() {
    setBusy("create");
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/order-orchestration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_plan", sourceText, customerCrmAccountId, productId, sourceKind: "manual_prompt" }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not create orchestration plan."));
      return;
    }
    setMessage("Order orchestration plan created.");
    await load();
  }

  async function approvePlan(planId: string) {
    setBusy(planId);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/order-orchestration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_plan", planId, note: "Reviewed from AMP13 orchestration workspace." }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not queue approval."));
      return;
    }
    setMessage("Approval work queued. Inventory and shipments were not mutated.");
    await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP13</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">AI-Native Order Orchestration</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Turn customer demand into a governed promise plan with customer/product matching, ATP evidence, split or recovery proposals, and human approval before reservations or stock moves.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Customers</p>
            <p className="mt-1 text-2xl font-semibold">{data.customers.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Products</p>
            <p className="mt-1 text-2xl font-semibold">{data.products.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Plans</p>
            <p className="mt-1 text-2xl font-semibold">{data.plans.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">Create Demand-To-Promise Plan</h3>
        <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={4} className="mt-4 w-full rounded-xl border border-zinc-300 p-3 text-sm" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select value={customerCrmAccountId} onChange={(event) => setCustomerCrmAccountId(event.target.value)} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Unmatched customer</option>
            {data.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Unmatched product</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} {product.sku ? `(${product.sku})` : ""}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => void createPlan()} disabled={busy === "create" || !sourceText.trim()} className="mt-4 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create orchestration plan
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">Orchestration Plans</h3>
        <div className="mt-4 space-y-3">
          {data.plans.length === 0 ? <p className="text-sm text-zinc-500">No orchestration plans yet.</p> : null}
          {data.plans.map((plan) => (
            <article key={plan.id} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{plan.status} · {plan.sourceKind}</p>
                  <h4 className="mt-1 font-semibold text-zinc-900">{plan.title}</h4>
                  <p className="mt-2 text-sm text-zinc-600">{plan.sourceText}</p>
                </div>
                <button type="button" onClick={() => void approvePlan(plan.id)} disabled={busy === plan.id || plan.status === "APPROVAL_QUEUED"} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">
                  Queue approval
                </button>
              </div>
              <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-100">{JSON.stringify(plan.proposalJson, null, 2)}</pre>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
