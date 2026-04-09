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
  conversationSla: {
    awaitingReplyFrom: "buyer" | "supplier" | null;
    daysSinceLastShared: number | null;
    lastSharedAt: string | null;
  };
  createdAt: string;
};

type OrdersResponse = {
  viewerMode: "buyer" | "supplier";
  tenant: { id: string; name: string; slug: string };
  orders: OrderRow[];
};

type QueueFilter =
  | "all"
  | "needs_my_action"
  | "waiting_on_me"
  | "awaiting_supplier"
  | "overdue"
  | "split_pending_buyer";

export function OrdersBoard({
  initialData,
  canTransitionOrders = true,
  defaultQueueFilter = "all",
}: {
  initialData: OrdersResponse;
  /** When false, workflow action buttons are hidden (org.orders → transition). */
  canTransitionOrders?: boolean;
  defaultQueueFilter?: QueueFilter;
}) {
  const [data, setData] = useState(initialData);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>(defaultQueueFilter);

  const orderCount = useMemo(() => data.orders.length, [data.orders.length]);
  const queueSummary = useMemo(() => {
    let awaitingSupplier = 0;
    let splitPendingBuyer = 0;
    let needsMyAction = 0;
    let waitingOnMe = 0;
    let waitingOnMeWarn = 0;
    let waitingOnMeCritical = 0;
    let overdue = 0;
    const now = Date.now();
    for (const order of data.orders) {
      if (order.status.code === "SENT") awaitingSupplier += 1;
      if (order.status.code === "SPLIT_PENDING_BUYER") splitPendingBuyer += 1;
      if (order.allowedActions.length > 0) needsMyAction += 1;
      if (order.conversationSla.awaitingReplyFrom === data.viewerMode) {
        waitingOnMe += 1;
        const days = order.conversationSla.daysSinceLastShared ?? 0;
        if (days >= 5) waitingOnMeCritical += 1;
        else if (days >= 2) waitingOnMeWarn += 1;
      }
      if (order.requestedDeliveryDate) {
        const dueMs = new Date(order.requestedDeliveryDate).getTime();
        if (!Number.isNaN(dueMs) && dueMs < now) overdue += 1;
      }
    }
    return {
      awaitingSupplier,
      splitPendingBuyer,
      needsMyAction,
      waitingOnMe,
      waitingOnMeWarn,
      waitingOnMeCritical,
      overdue,
    };
  }, [data.orders, data.viewerMode]);
  const filteredOrders = useMemo(() => {
    if (queueFilter === "needs_my_action") {
      return data.orders.filter((o) => o.allowedActions.length > 0);
    }
    if (queueFilter === "waiting_on_me") {
      return data.orders.filter(
        (o) => o.conversationSla.awaitingReplyFrom === data.viewerMode,
      );
    }
    if (queueFilter === "awaiting_supplier") {
      return data.orders.filter((o) => o.status.code === "SENT");
    }
    if (queueFilter === "overdue") {
      const now = Date.now();
      return data.orders.filter((o) => {
        if (!o.requestedDeliveryDate) return false;
        const dueMs = new Date(o.requestedDeliveryDate).getTime();
        return !Number.isNaN(dueMs) && dueMs < now;
      });
    }
    if (queueFilter === "split_pending_buyer") {
      return data.orders.filter((o) => o.status.code === "SPLIT_PENDING_BUYER");
    }
    return data.orders;
  }, [data.orders, queueFilter]);

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
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-900">
            Needs my action: {queueSummary.needsMyAction}
          </span>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 font-medium text-violet-900">
            Waiting on me: {queueSummary.waitingOnMe}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
            SLA warning (2+d): {queueSummary.waitingOnMeWarn}
          </span>
          <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-900">
            SLA critical (5+d): {queueSummary.waitingOnMeCritical}
          </span>
          <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-900">
            Awaiting supplier response: {queueSummary.awaitingSupplier}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
            Split pending buyer decision: {queueSummary.splitPendingBuyer}
          </span>
          <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-900">
            Overdue: {queueSummary.overdue}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setQueueFilter("all")}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              queueFilter === "all"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            All ({orderCount})
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter("needs_my_action")}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              queueFilter === "needs_my_action"
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
            }`}
          >
            Needs My Action ({queueSummary.needsMyAction})
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter("waiting_on_me")}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              queueFilter === "waiting_on_me"
                ? "border-violet-700 bg-violet-700 text-white"
                : "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
            }`}
          >
            Waiting on Me ({queueSummary.waitingOnMe})
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter("awaiting_supplier")}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              queueFilter === "awaiting_supplier"
                ? "border-sky-700 bg-sky-700 text-white"
                : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
            }`}
          >
            Awaiting Supplier ({queueSummary.awaitingSupplier})
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter("split_pending_buyer")}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              queueFilter === "split_pending_buyer"
                ? "border-amber-700 bg-amber-700 text-white"
                : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
            }`}
          >
            Split Pending ({queueSummary.splitPendingBuyer})
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter("overdue")}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              queueFilter === "overdue"
                ? "border-rose-700 bg-rose-700 text-white"
                : "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
            }`}
          >
            Overdue ({queueSummary.overdue})
          </button>
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
              <th className="px-4 py-3">Aging</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Workflow</th>
              <th className="px-4 py-3">Queue</th>
              <th className="px-4 py-3">Comms SLA</th>
              <th className="px-4 py-3">Allowed Actions</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm">
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-4">
                  <p className="font-medium text-zinc-900">{order.orderNumber}</p>
                  <p className="text-zinc-600">{order.title || "Untitled PO"}</p>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {order.buyerReference ?? "—"}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {(() => {
                    if (!order.requestedDeliveryDate) return "—";
                    const due = new Date(order.requestedDeliveryDate);
                    const dueMs = due.getTime();
                    const overdue =
                      !Number.isNaN(dueMs) && dueMs < Date.now();
                    return (
                      <span
                        className={
                          overdue
                            ? "font-medium text-rose-700"
                            : "text-zinc-600"
                        }
                      >
                        {due.toLocaleDateString()}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {Math.max(
                    0,
                    Math.floor(
                      (Date.now() - new Date(order.createdAt).getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  )}{" "}
                  d
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
                <td className="px-4 py-4 text-xs">
                  {order.conversationSla.awaitingReplyFrom ? (
                    <div className="space-y-1">
                      {(() => {
                        const days = order.conversationSla.daysSinceLastShared ?? 0;
                        const isWaitingOnMe =
                          order.conversationSla.awaitingReplyFrom === data.viewerMode;
                        const tone =
                          isWaitingOnMe && days >= 5
                            ? "bg-rose-100 text-rose-900"
                            : isWaitingOnMe && days >= 2
                              ? "bg-amber-100 text-amber-900"
                              : isWaitingOnMe
                                ? "bg-violet-100 text-violet-900"
                                : "bg-zinc-100 text-zinc-700";
                        return (
                          <div className={`inline-flex rounded-full px-2 py-0.5 font-medium ${tone}`}>
                            Waiting on {order.conversationSla.awaitingReplyFrom}
                          </div>
                        );
                      })()}
                      {order.conversationSla.daysSinceLastShared != null ? (
                        <div
                          className={`${
                            order.conversationSla.awaitingReplyFrom === data.viewerMode &&
                            order.conversationSla.daysSinceLastShared >= 5
                              ? "font-medium text-rose-700"
                              : order.conversationSla.awaitingReplyFrom === data.viewerMode &&
                                  order.conversationSla.daysSinceLastShared >= 2
                                ? "font-medium text-amber-700"
                                : "text-zinc-500"
                          }`}
                        >
                          Last shared msg {order.conversationSla.daysSinceLastShared}d ago
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-zinc-400">No shared messages yet</span>
                  )}
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
            {filteredOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-10 text-center text-sm text-zinc-500"
                >
                  No orders in this queue.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
