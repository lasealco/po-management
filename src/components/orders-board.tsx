"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultBoardQueue,
  type BoardQueueFilter,
  type BoardSortMode,
} from "@/lib/orders-board-prefs";

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
  logisticsStatus: "NONE" | "SHIPPED" | "PARTIALLY_RECEIVED" | "RECEIVED";
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

export function OrdersBoard({
  initialData,
  canTransitionOrders = true,
  canCreateOrders = false,
  defaultQueueFilter = defaultBoardQueue(),
  defaultSortMode = "priority",
  persistBoardPrefs = false,
}: {
  initialData: OrdersResponse;
  /** When false, workflow action buttons are hidden (org.orders → transition). */
  canTransitionOrders?: boolean;
  canCreateOrders?: boolean;
  defaultQueueFilter?: BoardQueueFilter;
  defaultSortMode?: BoardSortMode;
  /** Save queue + sort to user preferences (requires org.orders → view). */
  persistBoardPrefs?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] =
    useState<BoardQueueFilter>(defaultQueueFilter);
  const [sortMode, setSortMode] = useState<BoardSortMode>(defaultSortMode);
  const skipNextBoardPrefsPersist = useRef(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    startTransition(() => {
      setNowMs(Date.now());
    });
    const id = window.setInterval(() => {
      startTransition(() => {
        setNowMs(Date.now());
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!persistBoardPrefs) return;
    if (skipNextBoardPrefsPersist.current) {
      skipNextBoardPrefsPersist.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void fetch("/api/orders/board-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueFilter, sortMode }),
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [queueFilter, sortMode, persistBoardPrefs]);
  const isNeedsMyActionRow = useCallback(
    (order: OrderRow) => {
      if (order.allowedActions.length > 0) return true;
      // buyer split decisions are intentionally detail-only actions (hidden on board),
      // but they should still appear in "Needs My Action" queues.
      return data.viewerMode === "buyer" && order.status.code === "SPLIT_PENDING_BUYER";
    },
    [data.viewerMode],
  );

  const orderCount = useMemo(() => data.orders.length, [data.orders.length]);
  const queueSummary = useMemo(() => {
    let awaitingSupplier = 0;
    let splitPendingBuyer = 0;
    let needsMyAction = 0;
    let waitingOnMe = 0;
    let waitingOnMeWarn = 0;
    let waitingOnMeCritical = 0;
    let overdue = 0;
    const now = nowMs;
    for (const order of data.orders) {
      if (order.status.code === "SENT") awaitingSupplier += 1;
      if (order.status.code === "SPLIT_PENDING_BUYER") splitPendingBuyer += 1;
      if (isNeedsMyActionRow(order)) needsMyAction += 1;
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
  }, [data.orders, data.viewerMode, nowMs, isNeedsMyActionRow]);
  const filteredOrders = useMemo(() => {
    if (queueFilter === "needs_my_action") {
      return data.orders.filter((o) => isNeedsMyActionRow(o));
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
      const now = nowMs;
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
  }, [data.orders, data.viewerMode, queueFilter, nowMs, isNeedsMyActionRow]);
  const displayedOrders = useMemo(() => {
    if (sortMode === "newest") return filteredOrders;
    const rows = [...filteredOrders];
    const now = nowMs;
    const score = (order: OrderRow) => {
      let s = 0;
      const waitingOnMe = order.conversationSla.awaitingReplyFrom === data.viewerMode;
      const daysSinceMsg = order.conversationSla.daysSinceLastShared ?? 0;
      if (waitingOnMe && daysSinceMsg >= 5) s += 120;
      else if (waitingOnMe && daysSinceMsg >= 2) s += 80;
      else if (waitingOnMe) s += 40;
      if (isNeedsMyActionRow(order)) s += 60;
      if (order.status.code === "SPLIT_PENDING_BUYER") s += 30;
      if (order.status.code === "SENT") s += 20;
      if (order.requestedDeliveryDate) {
        const dueMs = new Date(order.requestedDeliveryDate).getTime();
        if (!Number.isNaN(dueMs) && dueMs < now) s += 50;
      }
      return s;
    };
    rows.sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [filteredOrders, sortMode, data.viewerMode, nowMs, isNeedsMyActionRow]);

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
    <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
      <header className="mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Orders
            </h1>
            <span className="text-zinc-300 select-none" aria-hidden>
              ·
            </span>
            <p className="text-sm text-zinc-600">
              <span className="font-medium text-zinc-800">{data.tenant.name}</span>
              <span className="tabular-nums text-zinc-500">
                {" "}
                · {orderCount} {orderCount === 1 ? "order" : "orders"}
              </span>
            </p>
          </div>
          <p className="text-[11px] text-zinc-400 sm:text-right">
            <span className="text-zinc-500">Quick jump</span>{" "}
            <kbd className="rounded border border-zinc-200 bg-white px-1 font-mono text-[10px] text-zinc-600">
              ⌘K
            </kbd>{" "}
            /{" "}
            <kbd className="rounded border border-zinc-200 bg-white px-1 font-mono text-[10px] text-zinc-600">
              Ctrl K
            </kbd>
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {canCreateOrders ? (
            <Link
              href="/orders/new"
              className="rounded-full bg-arscmp-primary px-2.5 py-1 font-medium text-white"
            >
              + New order
            </Link>
          ) : null}
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
                ? "border-arscmp-primary bg-arscmp-primary text-white"
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
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Sort</span>
          <button
            type="button"
            onClick={() => setSortMode("priority")}
            className={`rounded-md border px-2.5 py-1 font-medium ${
              sortMode === "priority"
                ? "border-arscmp-primary bg-arscmp-primary text-white"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Priority
          </button>
          <button
            type="button"
            onClick={() => setSortMode("newest")}
            className={`rounded-md border px-2.5 py-1 font-medium ${
              sortMode === "newest"
                ? "border-arscmp-primary bg-arscmp-primary text-white"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Newest
          </button>
        </div>
      </header>

      {errorMessage ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm">
        <div className="max-h-[min(78vh,calc(100dvh-9rem))] overflow-auto">
          <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="sticky left-0 z-30 w-[200px] min-w-[180px] bg-zinc-50/95 px-2.5 py-2 pl-3 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:w-[220px]">
                  PO
                </th>
                <th className="w-[72px] px-2 py-2">Ref</th>
                <th className="w-[76px] px-2 py-2">Due</th>
                <th className="w-[44px] px-1 py-2 text-right">Age</th>
                <th className="w-[min(140px,12vw)] px-2 py-2">Supplier</th>
                <th className="w-[120px] px-2 py-2">Status</th>
                <th className="w-[88px] px-2 py-2">Ship</th>
                <th className="w-[88px] px-2 py-2 text-right">Total</th>
                <th className="min-w-[140px] px-2 py-2">Activity</th>
                <th className="min-w-[160px] px-2 py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-[12px] leading-snug text-zinc-700">
            {displayedOrders.map((order) => (
              <tr
                key={order.id}
                className="group transition-colors hover:bg-zinc-50/90"
              >
                <td className="sticky left-0 z-10 bg-white px-2.5 py-2 pl-3 align-top shadow-[4px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-zinc-50/90">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <Link
                      href={`/orders/${order.id}`}
                      className="min-w-0 flex-1 text-zinc-900"
                    >
                      <span className="block truncate font-medium underline-offset-2 group-hover:underline">
                        {order.orderNumber}
                      </span>
                      <span
                        className="mt-0.5 block truncate text-[11px] font-normal text-zinc-500"
                        title={order.title || "Untitled PO"}
                      >
                        {order.title || "Untitled PO"}
                      </span>
                    </Link>
                    <Link
                      href={`/orders/${order.id}`}
                      className="shrink-0 pt-0.5 text-[11px] font-medium text-amber-800 underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </td>
                <td className="px-2 py-2 align-top text-[11px] text-zinc-600">
                  <span className="line-clamp-2 break-words" title={order.buyerReference ?? ""}>
                    {order.buyerReference ?? "—"}
                  </span>
                </td>
                <td className="px-2 py-2 align-top tabular-nums text-[11px] text-zinc-600">
                  {(() => {
                    if (!order.requestedDeliveryDate) return "—";
                    const due = new Date(order.requestedDeliveryDate);
                    const dueMs = due.getTime();
                    const overdue = !Number.isNaN(dueMs) && dueMs < nowMs;
                    return (
                      <span
                        className={
                          overdue ? "font-medium text-rose-700" : "text-zinc-600"
                        }
                      >
                        {due.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-1 py-2 text-right align-top tabular-nums text-[11px] text-zinc-500">
                  {Math.max(
                    0,
                    Math.floor(
                      (nowMs - new Date(order.createdAt).getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  )}
                  d
                </td>
                <td className="px-2 py-2 align-top text-[11px] text-zinc-700">
                  <span
                    className="line-clamp-2 break-words"
                    title={order.supplier?.name ?? "No supplier"}
                  >
                    {order.supplier?.name ?? "—"}
                  </span>
                </td>
                <td className="px-2 py-2 align-top">
                  <span className="inline-block max-w-full truncate rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-800">
                    {order.status.label}
                  </span>
                  <p
                    className="mt-1 line-clamp-2 text-[10px] leading-tight text-zinc-500"
                    title={order.workflow.name}
                  >
                    {order.workflow.name}
                  </p>
                </td>
                <td className="px-2 py-2 align-top">
                  <span
                    className={`inline-block max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      order.logisticsStatus === "RECEIVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : order.logisticsStatus === "PARTIALLY_RECEIVED"
                          ? "bg-amber-100 text-amber-800"
                          : order.logisticsStatus === "SHIPPED"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {order.logisticsStatus === "NONE"
                      ? "No ASN"
                      : order.logisticsStatus === "SHIPPED"
                        ? "Shipped"
                        : order.logisticsStatus === "PARTIALLY_RECEIVED"
                          ? "Partial"
                          : "Rcvd"}
                  </span>
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums text-[11px] text-zinc-800">
                  {order.currency} {order.totalAmount}
                </td>
                <td className="px-2 py-2 align-top text-[10px] text-zinc-600">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap gap-1">
                      {order.status.code === "SENT" ? (
                        <span className="rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-900">
                          Awaiting supplier
                        </span>
                      ) : null}
                      {order.status.code === "SPLIT_PENDING_BUYER" ? (
                        <span className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-900">
                          Split review
                        </span>
                      ) : null}
                      {order.status.code !== "SENT" &&
                      order.status.code !== "SPLIT_PENDING_BUYER" ? (
                        <span className="text-zinc-400">—</span>
                      ) : null}
                    </div>
                    {order.conversationSla.awaitingReplyFrom ? (
                      <div className="space-y-0.5">
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
                            <span
                              className={`inline-block rounded px-1 py-0.5 font-medium ${tone}`}
                            >
                              Reply: {order.conversationSla.awaitingReplyFrom}
                            </span>
                          );
                        })()}
                        {order.conversationSla.daysSinceLastShared != null ? (
                          <div
                            className={`tabular-nums ${
                              order.conversationSla.awaitingReplyFrom === data.viewerMode &&
                              order.conversationSla.daysSinceLastShared >= 5
                                ? "font-medium text-rose-700"
                                : order.conversationSla.awaitingReplyFrom === data.viewerMode &&
                                    order.conversationSla.daysSinceLastShared >= 2
                                  ? "font-medium text-amber-700"
                                  : "text-zinc-500"
                            }`}
                          >
                            Last msg {order.conversationSla.daysSinceLastShared}d ago
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-zinc-400">No shared thread</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 pr-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {!canTransitionOrders ? (
                      <span className="text-[11px] text-zinc-500">View only</span>
                    ) : order.allowedActions.length === 0 ? (
                      <span className="text-[11px] text-zinc-400">—</span>
                    ) : (
                      order.allowedActions.map((action) => (
                        <button
                          key={`${order.id}-${action.actionCode}`}
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => applyAction(order, action)}
                          className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {action.label}
                        </button>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {displayedOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-sm text-zinc-500"
                >
                  No orders in this queue.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>
    </main>
  );
}
