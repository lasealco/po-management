"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { RefineTypeahead } from "@/components/refine-typeahead";
import {
  defaultBoardQueue,
  type BoardQueueFilter,
  type BoardSortMode,
} from "@/lib/orders-board-prefs";
import type { OrderBoardSerialized } from "@/lib/orders-board-serialize";

type OrdersResponse = {
  viewerMode: "buyer" | "supplier";
  tenant: { id: string; name: string; slug: string };
  orders: OrderBoardSerialized[];
};

function isDueToday(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function nextOwnerClass(owner: OrderBoardSerialized["workbench"]["nextOwner"]): string {
  switch (owner) {
    case "buyer":
      return "bg-violet-100 text-violet-900";
    case "supplier":
      return "bg-sky-100 text-sky-900";
    case "operations":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export function OrdersBoard({
  initialData,
  canTransitionOrders = true,
  canCreateOrders = false,
  defaultQueueFilter = defaultBoardQueue(),
  defaultSortMode = "priority",
  defaultFilterSupplierId = null,
  defaultFilterRequesterId = null,
  persistBoardPrefs = false,
}: {
  initialData: OrdersResponse;
  /** When false, workflow action buttons are hidden (org.orders → transition). */
  canTransitionOrders?: boolean;
  canCreateOrders?: boolean;
  defaultQueueFilter?: BoardQueueFilter;
  defaultSortMode?: BoardSortMode;
  defaultFilterSupplierId?: string | null;
  defaultFilterRequesterId?: string | null;
  /** Save queue + sort to user preferences (requires org.orders → view). */
  persistBoardPrefs?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] =
    useState<BoardQueueFilter>(defaultQueueFilter);
  const [sortMode, setSortMode] = useState<BoardSortMode>(defaultSortMode);
  const [filterSupplierId, setFilterSupplierId] = useState<string | null>(
    defaultFilterSupplierId ?? null,
  );
  const [filterRequesterId, setFilterRequesterId] = useState<string | null>(
    defaultFilterRequesterId ?? null,
  );
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
        body: JSON.stringify({
          queueFilter,
          sortMode,
          filterSupplierId,
          filterRequesterId,
        }),
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [
    queueFilter,
    sortMode,
    filterSupplierId,
    filterRequesterId,
    persistBoardPrefs,
  ]);

  const isNeedsMyActionRow = useCallback(
    (order: OrderBoardSerialized) => {
      if (order.allowedActions.length > 0) return true;
      return data.viewerMode === "buyer" && order.status.code === "SPLIT_PENDING_BUYER";
    },
    [data.viewerMode],
  );

  const supplierOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of data.orders) {
      if (o.supplier) m.set(o.supplier.id, o.supplier.name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.orders]);

  const requesterOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of data.orders) {
      m.set(o.requester.id, o.requester.name || o.requester.email);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.orders]);

  const supplierTypeaheadOptions = useMemo(
    () => supplierOptions.map(([id, label]) => ({ id, label })),
    [supplierOptions],
  );
  const requesterTypeaheadOptions = useMemo(
    () => requesterOptions.map(([id, label]) => ({ id, label })),
    [requesterOptions],
  );

  const orderCount = useMemo(() => data.orders.length, [data.orders.length]);
  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);

  const queueSummary = useMemo(() => {
    let awaitingSupplier = 0;
    let splitPendingBuyer = 0;
    let needsMyAction = 0;
    let waitingOnMe = 0;
    let waitingOnMeWarn = 0;
    let waitingOnMeCritical = 0;
    let overdue = 0;
    let dueToday = 0;
    let linkedSalesOrder = 0;
    let logisticsBlocked = 0;
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
        if (isDueToday(order.requestedDeliveryDate, nowDate)) dueToday += 1;
      }
      if (order.linkedToSalesOrder) linkedSalesOrder += 1;
      if (order.logisticsBlocked) logisticsBlocked += 1;
    }
    return {
      awaitingSupplier,
      splitPendingBuyer,
      needsMyAction,
      waitingOnMe,
      waitingOnMeWarn,
      waitingOnMeCritical,
      overdue,
      dueToday,
      linkedSalesOrder,
      logisticsBlocked,
    };
  }, [data.orders, data.viewerMode, nowMs, nowDate, isNeedsMyActionRow]);

  const queueFiltered = useMemo(() => {
    if (queueFilter === "needs_my_action") {
      return data.orders.filter((o) => isNeedsMyActionRow(o));
    }
    if (queueFilter === "waiting_on_me") {
      return data.orders.filter((o) => o.conversationSla.awaitingReplyFrom === data.viewerMode);
    }
    if (queueFilter === "sla_warning") {
      return data.orders.filter((o) => {
        if (o.conversationSla.awaitingReplyFrom !== data.viewerMode) return false;
        const days = o.conversationSla.daysSinceLastShared ?? 0;
        return days >= 2 && days < 5;
      });
    }
    if (queueFilter === "sla_critical") {
      return data.orders.filter((o) => {
        if (o.conversationSla.awaitingReplyFrom !== data.viewerMode) return false;
        const days = o.conversationSla.daysSinceLastShared ?? 0;
        return days >= 5;
      });
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
    if (queueFilter === "due_today") {
      return data.orders.filter((o) => isDueToday(o.requestedDeliveryDate, nowDate));
    }
    if (queueFilter === "split_pending_buyer") {
      return data.orders.filter((o) => o.status.code === "SPLIT_PENDING_BUYER");
    }
    if (queueFilter === "linked_sales_order") {
      return data.orders.filter((o) => o.linkedToSalesOrder);
    }
    if (queueFilter === "logistics_blocked") {
      return data.orders.filter((o) => o.logisticsBlocked);
    }
    return data.orders;
  }, [data.orders, data.viewerMode, queueFilter, nowMs, nowDate, isNeedsMyActionRow]);

  const filteredOrders = useMemo(() => {
    let rows = queueFiltered;
    if (filterSupplierId) {
      rows = rows.filter((o) => o.supplier?.id === filterSupplierId);
    }
    if (filterRequesterId) {
      rows = rows.filter((o) => o.requester.id === filterRequesterId);
    }
    return rows;
  }, [queueFiltered, filterSupplierId, filterRequesterId]);

  const displayedOrders = useMemo(() => {
    if (sortMode === "newest") return filteredOrders;
    const rows = [...filteredOrders];
    const now = nowMs;
    const score = (order: OrderBoardSerialized) => {
      let s = 0;
      const waitingOnMe = order.conversationSla.awaitingReplyFrom === data.viewerMode;
      const daysSinceMsg = order.conversationSla.daysSinceLastShared ?? 0;
      if (waitingOnMe && daysSinceMsg >= 5) s += 120;
      else if (waitingOnMe && daysSinceMsg >= 2) s += 80;
      else if (waitingOnMe) s += 40;
      if (isNeedsMyActionRow(order)) s += 60;
      if (order.status.code === "SPLIT_PENDING_BUYER") s += 30;
      if (order.status.code === "SENT") s += 20;
      if (order.logisticsBlocked) s += 28;
      if (order.linkedToSalesOrder) s += 12;
      if (order.requestedDeliveryDate) {
        const dueMs = new Date(order.requestedDeliveryDate).getTime();
        if (!Number.isNaN(dueMs) && dueMs < now) s += 50;
        else if (isDueToday(order.requestedDeliveryDate, new Date(now))) s += 22;
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

  async function applyAction(order: OrderBoardSerialized, action: OrderBoardSerialized["allowedActions"][number]) {
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

  const queuePill = (
    id: BoardQueueFilter,
    label: string,
    count: number,
    activeClass: string,
    idleClass: string,
  ) => (
    <button
      key={id}
      type="button"
      onClick={() => setQueueFilter(id)}
      aria-pressed={queueFilter === id}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        queueFilter === id ? `${activeClass} ring-2 ring-black/10` : idleClass
      }`}
    >
      {label}: {count}
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
      <header className="mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <PageTitleWithHint title="Orders" titleClassName="text-2xl font-semibold tracking-tight text-zinc-900" />
            <span className="text-zinc-300 select-none" aria-hidden>
              ·
            </span>
            <p className="text-sm text-zinc-600">
              <span className="font-medium text-zinc-800">{data.tenant.name}</span>
              <span className="tabular-nums text-zinc-500">
                {" "}
                · {orderCount} {orderCount === 1 ? "order" : "orders"}
              </span>
              {filteredOrders.length !== orderCount ? (
                <span className="tabular-nums text-zinc-500">
                  {" "}
                  · showing {filteredOrders.length}
                </span>
              ) : null}
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

        <section
          className="mt-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm"
          aria-label="Queue summary"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Summary</p>
          <p className="mt-1 text-xs text-zinc-700">
            <span className="tabular-nums font-medium text-zinc-900">{queueSummary.needsMyAction}</span> need
            action ·{" "}
            <span className="tabular-nums font-medium text-zinc-900">{queueSummary.waitingOnMe}</span> waiting on
            you ·{" "}
            <span className="tabular-nums text-amber-800">{queueSummary.waitingOnMeWarn}</span> SLA warning ·{" "}
            <span className="tabular-nums text-rose-800">{queueSummary.waitingOnMeCritical}</span> SLA critical ·{" "}
            <span className="tabular-nums text-sky-800">{queueSummary.awaitingSupplier}</span> awaiting supplier ·{" "}
            <span className="tabular-nums text-rose-700">{queueSummary.overdue}</span> overdue ·{" "}
            <span className="tabular-nums text-indigo-800">{queueSummary.dueToday}</span> due today ·{" "}
            <span className="tabular-nums text-emerald-800">{queueSummary.linkedSalesOrder}</span> SO-linked ·{" "}
            <span className="tabular-nums text-amber-900">{queueSummary.logisticsBlocked}</span> logistics blocked
          </p>
        </section>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {canCreateOrders ? (
            <Link
              href="/orders/new"
              className="rounded-full bg-[var(--arscmp-primary)] px-2.5 py-1 font-medium text-white"
            >
              + New order
            </Link>
          ) : null}
          {queuePill(
            "all",
            "All",
            orderCount,
            "bg-zinc-800 text-white",
            "bg-zinc-100 text-zinc-800 hover:bg-zinc-200",
          )}
          {queuePill(
            "needs_my_action",
            "Needs my action",
            queueSummary.needsMyAction,
            "bg-emerald-700 text-white",
            "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
          )}
          {queuePill(
            "waiting_on_me",
            "Waiting on me",
            queueSummary.waitingOnMe,
            "bg-violet-700 text-white",
            "bg-violet-100 text-violet-900 hover:bg-violet-200",
          )}
          {queuePill(
            "sla_warning",
            "SLA 2–4d",
            queueSummary.waitingOnMeWarn,
            "bg-amber-700 text-white",
            "bg-amber-100 text-amber-900 hover:bg-amber-200",
          )}
          {queuePill(
            "sla_critical",
            "SLA 5+d",
            queueSummary.waitingOnMeCritical,
            "bg-rose-700 text-white",
            "bg-rose-100 text-rose-900 hover:bg-rose-200",
          )}
          {queuePill(
            "awaiting_supplier",
            "Awaiting supplier",
            queueSummary.awaitingSupplier,
            "bg-sky-700 text-white",
            "bg-sky-100 text-sky-900 hover:bg-sky-200",
          )}
          {queuePill(
            "split_pending_buyer",
            "Split pending",
            queueSummary.splitPendingBuyer,
            "bg-amber-800 text-white",
            "bg-amber-100 text-amber-900 hover:bg-amber-200",
          )}
          {queuePill(
            "overdue",
            "Overdue",
            queueSummary.overdue,
            "bg-rose-700 text-white",
            "bg-rose-100 text-rose-900 hover:bg-rose-200",
          )}
          {queuePill(
            "due_today",
            "Due today",
            queueSummary.dueToday,
            "bg-indigo-700 text-white",
            "bg-indigo-100 text-indigo-900 hover:bg-indigo-200",
          )}
          {queuePill(
            "linked_sales_order",
            "SO linked",
            queueSummary.linkedSalesOrder,
            "bg-emerald-800 text-white",
            "bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
          )}
          {queuePill(
            "logistics_blocked",
            "Logistics blocked",
            queueSummary.logisticsBlocked,
            "bg-orange-800 text-white",
            "bg-orange-50 text-orange-950 hover:bg-orange-100",
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Refine</span>
          <RefineTypeahead
            label="Supplier filter"
            placeholder="Search supplier…"
            anyLabel="Any supplier"
            options={supplierTypeaheadOptions}
            valueId={filterSupplierId}
            onChange={setFilterSupplierId}
          />
          <RefineTypeahead
            label="Requester filter"
            placeholder="Search requester…"
            anyLabel="Any requester"
            options={requesterTypeaheadOptions}
            valueId={filterRequesterId}
            onChange={setFilterRequesterId}
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Sort</span>
          <button
            type="button"
            onClick={() => setSortMode("priority")}
            className={`rounded-md border px-2.5 py-1 font-medium ${
              sortMode === "priority"
                ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] text-white"
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
                ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] text-white"
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
          <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th
                  className="sticky left-0 z-30 w-[200px] min-w-[180px] bg-zinc-50/95 px-2.5 py-2 pl-3 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:w-[220px]"
                  title="Purchase order identity and next step hint"
                >
                  PO / next step
                </th>
                <th className="w-[72px] px-2 py-2" title="Buyer / internal ref">
                  Ref
                </th>
                <th
                  className="w-[min(120px,14vw)] px-2 py-2"
                  title="Org this PO is for (if set)"
                >
                  For org
                </th>
                <th className="w-[76px] px-2 py-2">Due</th>
                <th className="w-[44px] px-1 py-2 text-right">Age</th>
                <th className="w-[min(140px,12vw)] px-2 py-2" title="Supplier and SRM signals">
                  Supplier
                </th>
                <th className="w-[120px] px-2 py-2" title="Workflow stage (status)">
                  Stage
                </th>
                <th className="w-[100px] px-2 py-2" title="Shipment / receiving rollup">
                  Logistics
                </th>
                <th className="w-[88px] px-2 py-2 text-right">Total</th>
                <th className="min-w-[160px] px-2 py-2" title="Thread + situation chips">
                  Situation
                </th>
                <th className="min-w-[168px] px-2 py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-[12px] leading-snug text-zinc-700">
              {displayedOrders.map((order) => (
                <tr key={order.id} className="group transition-colors hover:bg-zinc-50/90">
                  <td className="sticky left-0 z-10 bg-white px-2.5 py-2 pl-3 align-top shadow-[4px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-zinc-50/90">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <Link href={`/orders/${order.id}`} className="min-w-0 flex-1 text-zinc-900">
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span
                        className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${nextOwnerClass(order.workbench.nextOwner)}`}
                        title="Who owns the next step"
                      >
                        {order.workbench.nextOwner}
                      </span>
                      <span className="text-[10px] font-medium text-zinc-800" title={order.workbench.nextActionDetail}>
                        {order.workbench.nextActionLabel}
                      </span>
                    </div>
                    {order.impactTags.length ? (
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {order.impactTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-zinc-100 px-1 py-0.5 text-[9px] font-medium text-zinc-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 align-top text-[11px] text-zinc-600">
                    <span className="line-clamp-2 break-words" title={order.buyerReference ?? ""}>
                      {order.buyerReference ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top text-[11px] text-zinc-600">
                    {order.servedOrg ? (
                      <span className="line-clamp-2 break-words" title={`${order.servedOrg.name} (${order.servedOrg.code})`}>
                        {order.servedOrg.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2 align-top tabular-nums text-[11px] text-zinc-600">
                    {(() => {
                      if (!order.requestedDeliveryDate) return "—";
                      const due = new Date(order.requestedDeliveryDate);
                      const dueMs = due.getTime();
                      const overdue = !Number.isNaN(dueMs) && dueMs < nowMs;
                      const today = isDueToday(order.requestedDeliveryDate, nowDate);
                      return (
                        <span
                          className={
                            overdue ? "font-medium text-rose-700" : today ? "font-medium text-indigo-800" : "text-zinc-600"
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
                      Math.floor((nowMs - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
                    )}
                    d
                  </td>
                  <td className="px-2 py-2 align-top text-[11px] text-zinc-700">
                    <span className="line-clamp-2 break-words" title={order.supplier?.name ?? "No supplier"}>
                      {order.supplier?.name ?? "—"}
                    </span>
                    {order.supplierSignals.length ? (
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {order.supplierSignals.map((sig) => (
                          <span
                            key={sig}
                            className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-[9px] text-zinc-600"
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <span className="inline-block max-w-full truncate rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-800">
                      {order.status.label}
                    </span>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-zinc-500" title={order.workflow.name}>
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
                        ? "No ship qty"
                        : order.logisticsStatus === "SHIPPED"
                          ? "Shipped"
                          : order.logisticsStatus === "PARTIALLY_RECEIVED"
                            ? "Partial"
                            : "Rcvd"}
                    </span>
                    {order.logisticsDetail ? (
                      <p className="mt-1 line-clamp-2 text-[9px] leading-tight text-zinc-500" title={order.logisticsDetail}>
                        {order.logisticsDetail}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-right align-top tabular-nums text-[11px] text-zinc-800">
                    {order.currency} {order.totalAmount}
                  </td>
                  <td className="px-2 py-2 align-top text-[10px] text-zinc-600">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap gap-1">
                        {order.status.code === "SENT" ? (
                          <span className="rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-900">Awaiting supplier</span>
                        ) : null}
                        {order.status.code === "SPLIT_PENDING_BUYER" ? (
                          <span className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-900">Split review</span>
                        ) : null}
                        {order.logisticsBlocked ? (
                          <span className="rounded bg-orange-100 px-1 py-0.5 font-medium text-orange-950">
                            Logistics hold
                          </span>
                        ) : null}
                        {order.status.code !== "SENT" &&
                        order.status.code !== "SPLIT_PENDING_BUYER" &&
                        !order.logisticsBlocked ? (
                          <span className="text-zinc-400">—</span>
                        ) : null}
                      </div>
                      {order.conversationSla.awaitingReplyFrom ? (
                        <div className="space-y-0.5">
                          {(() => {
                            const days = order.conversationSla.daysSinceLastShared ?? 0;
                            const isWaitingOnMe = order.conversationSla.awaitingReplyFrom === data.viewerMode;
                            const tone =
                              isWaitingOnMe && days >= 5
                                ? "bg-rose-100 text-rose-900"
                                : isWaitingOnMe && days >= 2
                                  ? "bg-amber-100 text-amber-900"
                                  : isWaitingOnMe
                                    ? "bg-violet-100 text-violet-900"
                                    : "bg-zinc-100 text-zinc-700";
                            return (
                              <span className={`inline-block rounded px-1 py-0.5 font-medium ${tone}`}>
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
                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
                      <Link href={`/orders/${order.id}#help-focus-chat`} className="text-amber-800 underline-offset-2 hover:underline">
                        Chat
                      </Link>
                      {order.supplier ? (
                        <Link href={`/suppliers/${order.supplier.id}`} className="text-zinc-600 underline-offset-2 hover:underline">
                          Supplier
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-zinc-500">
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
