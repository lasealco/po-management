"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  warehouses: Array<{ id: string; code: string | null; name: string }>;
  plans: Array<{ id: string; title: string; status: string; capacityScore: number; warehouseId: string | null; recoveryPlanJson: unknown; updatedAt: string }>;
};

export function WarehouseCapacityClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [warehouseId, setWarehouseId] = useState(initialSnapshot.warehouses[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/warehouse-capacity", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load warehouse capacity."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>) {
    setBusy(action === "queue_recovery" ? String(body.planId ?? "") : action);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/warehouse-capacity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update warehouse capacity."));
      return;
    }
    setMessage(action === "create_plan" ? "Warehouse capacity plan created." : "Supervisor recovery work queued.");
    await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP15</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Warehouse Capacity Command</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Create labor/capacity recovery plans from WMS task backlog, held inventory, and released outbound pressure. The assistant queues supervisor approval and never completes tasks or moves stock silently.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm">
            {data.warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.code ? ` (${warehouse.code})` : ""}</option>
            ))}
          </select>
          <button type="button" disabled={!warehouseId || busy === "create_plan"} onClick={() => void post("create_plan", { warehouseId })} className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            Create capacity plan
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Warehouses</p>
          <p className="mt-1 text-2xl font-semibold">{data.warehouses.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Capacity plans</p>
          <p className="mt-1 text-2xl font-semibold">{data.plans.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Queued recovery</p>
          <p className="mt-1 text-2xl font-semibold">{data.plans.filter((plan) => plan.status === "RECOVERY_QUEUED").length}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">Recovery Plans</h3>
        <div className="mt-4 space-y-3">
          {data.plans.length === 0 ? <p className="text-sm text-zinc-500">No warehouse capacity plans yet.</p> : null}
          {data.plans.map((plan) => (
            <article key={plan.id} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{plan.status} · capacity {plan.capacityScore}/100</p>
                  <h4 className="mt-1 font-semibold text-zinc-900">{plan.title}</h4>
                  <p className="mt-1 text-sm text-zinc-500">Updated {new Date(plan.updatedAt).toLocaleString()}</p>
                </div>
                <button type="button" disabled={busy === plan.id || plan.status === "RECOVERY_QUEUED"} onClick={() => void post("queue_recovery", { planId: plan.id })} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">
                  Queue recovery
                </button>
              </div>
              <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-100">{JSON.stringify(plan.recoveryPlanJson, null, 2)}</pre>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
