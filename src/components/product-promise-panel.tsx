"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useEffect, useState } from "react";

type PromiseSnapshot = {
  product: {
    id: string;
    label: string;
    name: string;
    unit: string | null;
    assistantPromiseStatus: string;
    assistantPromiseSummary: string | null;
    assistantRecoveryProposal: string | null;
  };
  permissions: { canViewWms: boolean; canViewOrders: boolean };
  metrics: {
    onHandQty: number;
    allocatedQty: number;
    onHoldQty: number;
    openSalesDemandQty: number;
    inboundQty: number;
    openWmsTaskQty: number;
    availableNow: number;
    shortageQty: number;
    blockedQty: number;
    status: string;
  };
  generated: { promiseSummary: string; recoveryProposal: string };
  balances: Array<{
    id: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string };
    onHandQty: string;
    allocatedQty: string;
    availableQty: string;
    onHold: boolean;
    holdReason: string | null;
  }>;
  blockers: Array<{
    id: string;
    taskType: string;
    status: string;
    quantity: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string } | null;
    note: string | null;
  }>;
  demand: Array<{ id: string; quantity: string; salesOrder: { id: string; soNumber: string; customerName: string; status: string } }>;
  inbound: Array<{ id: string; quantity: string; order: { id: string; orderNumber: string; requestedDeliveryDate: string | null; status: { code: string; label: string } } }>;
};

export function ProductPromisePanel({ productId, canEdit }: { productId: string; canEdit: boolean }) {
  const [snapshot, setSnapshot] = useState<PromiseSnapshot | null>(null);
  const [summary, setSummary] = useState("");
  const [proposal, setProposal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch(`/api/products/${productId}/promise`);
    const parsed: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not load availability promise."));
      return;
    }
    const payload = parsed as PromiseSnapshot;
    setSnapshot(payload);
    setSummary(payload.product.assistantPromiseSummary ?? payload.generated.promiseSummary);
    setProposal(payload.product.assistantRecoveryProposal ?? payload.generated.recoveryProposal);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- productId owns this workspace
  }, [productId]);

  async function save(status?: "REVIEWED" | "PROMISE_READY") {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/products/${productId}/promise`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantPromiseSummary: summary,
        assistantRecoveryProposal: proposal,
        ...(status ? { assistantPromiseStatus: status } : {}),
      }),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not save promise review."));
      return;
    }
    setNotice(status ? `Saved and marked ${status}.` : "Saved promise review.");
    await load();
  }

  async function queueRecovery() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/products/${productId}/promise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "queue_inventory_recovery", proposal }),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not queue recovery proposal."));
      return;
    }
    setNotice("Inventory recovery proposal queued for human review.");
    await load();
  }

  const metric = (label: string, value: string | number) => (
    <div className="rounded-xl border border-violet-100 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-950">{value}</p>
    </div>
  );

  return (
    <section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">AMP4 Availability Promise</p>
          <h2 className="mt-1 text-base font-semibold text-zinc-950">ATP and inventory recovery</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Explain stock, allocations, holds, inbound supply, and WMS blockers before promising this product.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-900">
          {snapshot?.product.assistantPromiseStatus ?? "Loading"}
        </span>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p> : null}

      {!snapshot ? (
        <p className="mt-4 text-sm text-zinc-600">Loading promise signals...</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {metric("ATP now", snapshot.metrics.availableNow)}
            {metric("Open demand", snapshot.metrics.openSalesDemandQty)}
            {metric("Shortage", snapshot.metrics.shortageQty)}
            {metric("Inbound", snapshot.metrics.inboundQty)}
            {metric("On hold", snapshot.metrics.onHoldQty)}
            {metric("WMS blocked", snapshot.metrics.openWmsTaskQty)}
          </div>

          {!snapshot.permissions.canViewWms || !snapshot.permissions.canViewOrders ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Some promise signals are hidden by permissions. WMS view unlocks stock/task blockers; Orders view unlocks demand and inbound PO evidence.
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-700">
              Promise summary
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                disabled={!canEdit}
                className="mt-1 min-h-40 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Recovery proposal
              <textarea
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
                disabled={!canEdit}
                className="mt-1 min-h-40 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-violet-100 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-950">Stock evidence</p>
              <div className="mt-2 max-h-44 space-y-2 overflow-auto text-xs text-zinc-700">
                {snapshot.balances.length === 0 ? <p>No visible stock balances.</p> : null}
                {snapshot.balances.map((row) => (
                  <div key={row.id} className="rounded border border-zinc-100 p-2">
                    <p className="font-semibold">{row.warehouse.code || row.warehouse.name} · {row.bin.code}</p>
                    <p>On hand {row.onHandQty}, allocated {row.allocatedQty}, available {row.availableQty}</p>
                    {row.onHold ? <p className="text-amber-800">Hold: {row.holdReason || "No reason"}</p> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-violet-100 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-950">Demand / inbound</p>
              <div className="mt-2 max-h-44 space-y-2 overflow-auto text-xs text-zinc-700">
                {snapshot.demand.slice(0, 5).map((row) => (
                  <p key={row.id}>
                    Demand {row.quantity} from{" "}
                    <Link href={`/sales-orders/${row.salesOrder.id}`} className="text-[var(--arscmp-primary)] hover:underline">
                      {row.salesOrder.soNumber}
                    </Link>
                  </p>
                ))}
                {snapshot.inbound.slice(0, 5).map((row) => (
                  <p key={row.id}>
                    Inbound {row.quantity} on{" "}
                    <Link href={`/orders/${row.order.id}`} className="text-[var(--arscmp-primary)] hover:underline">
                      {row.order.orderNumber}
                    </Link>
                  </p>
                ))}
                {snapshot.demand.length === 0 && snapshot.inbound.length === 0 ? <p>No visible demand or inbound PO lines.</p> : null}
              </div>
            </div>
            <div className="rounded-xl border border-violet-100 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-950">WMS blockers</p>
              <div className="mt-2 max-h-44 space-y-2 overflow-auto text-xs text-zinc-700">
                {snapshot.blockers.length === 0 ? <p>No open WMS blockers for this SKU.</p> : null}
                {snapshot.blockers.map((task) => (
                  <div key={task.id} className="rounded border border-zinc-100 p-2">
                    <p className="font-semibold">{task.taskType} · {task.status} · qty {task.quantity}</p>
                    <p>{task.warehouse.code || task.warehouse.name}{task.bin ? ` · ${task.bin.code}` : ""}</p>
                    {task.note ? <p className="text-zinc-500">{task.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
              >
                Save promise
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save("REVIEWED")}
                className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Mark reviewed
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void queueRecovery()}
                className="rounded-xl border border-violet-300 bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-950 disabled:opacity-50"
              >
                Queue recovery proposal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save("PROMISE_READY")}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50"
              >
                Mark promise ready
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
