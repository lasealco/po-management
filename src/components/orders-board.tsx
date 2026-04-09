"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type OrderStatus = {
  id: string;
  code: string;
  label: string;
};

type OrderAction = {
  actionCode: string;
  label: string;
  requiresComment: boolean;
  toStatus: OrderStatus;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  title: string | null;
  buyerReference: string | null;
  requestedDeliveryDate: string | null;
  totalAmount: string;
  currency: string;
  status: OrderStatus;
  supplier: { id: string; name: string } | null;
  requester: { id: string; name: string; email: string };
  workflow: { id: string; name: string };
  allowedActions: OrderAction[];
  createdAt: string;
};

type OrdersResponse = {
  tenant: { id: string; name: string; slug: string };
  orders: OrderRow[];
};

export function OrdersBoard({
  initialData,
  canTransitionOrders = true,
}: {
  initialData: OrdersResponse;
  /** When false, workflow action buttons are hidden (org.orders → transition). */
  canTransitionOrders?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orderCount = useMemo(() => data.orders.length, [data.orders.length]);
  const queueSummary = useMemo(() => {
    let awaitingSupplier = 0;
    let splitPendingBuyer = 0;
    for (const order of data.orders) {
      if (order.status.code === "SENT") awaitingSupplier += 1;
      if (order.status.code === "SPLIT_PENDING_BUYER") splitPendingBuyer += 1;
    }
    return { awaitingSupplier, splitPendingBuyer };
  }, [data.orders]);

  async function applyAction(order: OrderRow, action: OrderAction) {
    setBusyOrderId(order.id);
    setErrorMessage(null);

    let comment: string | undefined;
    if (action.requiresComment) {
      const value = window.prompt(
        `Comment required for '${action.label}'. Please add a note:`,
      );
      if (!value || !value.trim()) {
        setBusyOrderId(null);
        setErrorMessage("This action requires a comment.");
        return;
      }
      comment = value.trim();
    }

    const response = await fetch(`/api/orders/${order.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionCode: action.actionCode, comment }),
    });

    const payload = (await response.json()) as
      | { error: string }
      | { ok: true; order: { id: string } };

    if (!response.ok) {
      setBusyOrderId(null);
      setErrorMessage("error" in payload ? payload.error : "Transition failed.");
      return;
    }

    const refreshed = await fetch("/api/orders", { cache: "no-store" });
    const refreshedPayload = (await refreshed.json()) as OrdersResponse;

    setData(refreshedPayload);
    setBusyOrderId(null);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-zinc-900">
          PO Workflow Playground
        </h1>
        <p className="mt-2 text-zinc-600">
          Tenant: <span className="font-medium">{data.tenant.name}</span> ({orderCount} orders)
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-900">
            Awaiting supplier response: {queueSummary.awaitingSupplier}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
            Split pending buyer decision: {queueSummary.splitPendingBuyer}
          </span>
        </div>
      </header>

      {errorMessage ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Ref</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Workflow</th>
              <th className="px-4 py-3">Queue</th>
              <th className="px-4 py-3">Allowed Actions</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm">
            {data.orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-4">
                  <p className="font-medium text-zinc-900">{order.orderNumber}</p>
                  <p className="text-zinc-600">{order.title || "Untitled PO"}</p>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {order.buyerReference ?? "—"}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {order.requestedDeliveryDate
                    ? new Date(order.requestedDeliveryDate).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-4 text-zinc-700">
                  {order.supplier?.name ?? "No supplier"}
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {order.status.label}
                  </span>
                </td>
                <td className="px-4 py-4 text-zinc-700">
                  {order.currency} {order.totalAmount}
                </td>
                <td className="px-4 py-4 text-zinc-700">{order.workflow.name}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {order.status.code === "SENT" ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900">
                        Awaiting supplier response
                      </span>
                    ) : null}
                    {order.status.code === "SPLIT_PENDING_BUYER" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                        Split pending buyer decision
                      </span>
                    ) : null}
                    {order.status.code !== "SENT" &&
                    order.status.code !== "SPLIT_PENDING_BUYER" ? (
                      <span className="text-xs text-zinc-400">—</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {!canTransitionOrders ? (
                      <span className="text-xs text-zinc-500">View only</span>
                    ) : order.allowedActions.length === 0 ? (
                      <span className="text-xs text-zinc-400">No actions</span>
                    ) : (
                      order.allowedActions.map((action) => (
                        <button
                          key={`${order.id}-${action.actionCode}`}
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => applyAction(order, action)}
                          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {action.label}
                        </button>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-sm font-medium text-zinc-800 underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
