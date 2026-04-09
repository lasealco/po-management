"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type OrderDetailResponse = {
  order: {
    id: string;
    orderNumber: string;
    title: string | null;
    currency: string;
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
    status: { code: string; label: string };
    workflow: {
      id: string;
      name: string;
      allowSplitOrders: boolean;
      supplierPortalOn: boolean;
    };
    supplier: { id: string; name: string } | null;
    requester: { id: string; name: string; email: string };
    splitParentId: string | null;
    splitIndex: number | null;
  };
  items: Array<{
    id: string;
    lineNo: number;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  splitChildren: Array<{
    id: string;
    orderNumber: string;
    splitIndex: number | null;
    status: { code: string; label: string };
    totalAmount: string;
  }>;
  pendingProposal: null | {
    id: string;
    status: string;
    comment: string | null;
    lines: Array<{
      id: string;
      childIndex: number;
      quantity: string;
      plannedShipDate: string;
      sourceLineId: string;
      sourceDescription: string;
    }>;
  };
  allowedActions: Array<{
    actionCode: string;
    label: string;
    requiresComment: boolean;
    toStatus: { code: string; label: string };
  }>;
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export function OrderDetail({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [childCount, setChildCount] = useState(2);
  const [allocations, setAllocations] = useState<
    Record<string, Record<number, { quantity: string; plannedShipDate: string }>>
  >({});

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    const payload = (await response.json()) as OrderDetailResponse & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to load order.");
      setData(null);
      return;
    }
    setData(payload);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.items.length) return;
    setAllocations((previous) => {
      const next: typeof previous = { ...previous };
      for (const item of data.items) {
        if (!next[item.id]) next[item.id] = {};
        for (let i = 1; i <= childCount; i += 1) {
          if (!next[item.id][i]) {
            next[item.id][i] = {
              quantity: "",
              plannedShipDate: todayIsoDate(),
            };
          }
        }
        Object.keys(next[item.id]).forEach((key) => {
          const idx = Number(key);
          if (idx > childCount) delete next[item.id][idx];
        });
      }
      return next;
    });
  }, [data?.items, childCount]);

  const canProposeSplit = useMemo(() => {
    if (!data) return false;
    return (
      data.order.status.code === "SENT" &&
      data.order.workflow.allowSplitOrders &&
      !data.pendingProposal &&
      !data.order.splitParentId
    );
  }, [data]);

  async function runTransition(actionCode: string) {
    if (!data) return;
    setBusy(true);
    setError(null);
    let comment: string | undefined;
    const action = data.allowedActions.find((a) => a.actionCode === actionCode);
    if (action?.requiresComment) {
      const value = window.prompt("Comment required:");
      if (!value?.trim()) {
        setBusy(false);
        setError("This action requires a comment.");
        return;
      }
      comment = value.trim();
    }
    const response = await fetch(`/api/orders/${data.order.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionCode, comment }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Action failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function submitSplit() {
    if (!data?.items.length) return;
    setBusy(true);
    setError(null);
    const lines = data.items.map((item) => {
      const row = allocations[item.id] ?? {};
      const allocationList = [];
      for (let i = 1; i <= childCount; i += 1) {
        const cell = row[i];
        if (!cell?.quantity?.trim()) continue;
        allocationList.push({
          childIndex: i,
          quantity: cell.quantity.trim(),
          plannedShipDate: new Date(
            `${cell.plannedShipDate}T12:00:00.000Z`,
          ).toISOString(),
        });
      }
      return { sourceLineId: item.id, allocations: allocationList };
    });

    const response = await fetch(`/api/orders/${data.order.id}/split-proposal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Split proposal failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function acceptSplit(proposalId: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/split-proposals/${proposalId}/accept`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Accept failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function rejectSplit(proposalId: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/split-proposals/${proposalId}/reject`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Reject failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  if (!data && !error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10 text-zinc-600">
        Loading…
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-zinc-700 underline">
          Back
        </Link>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Orders
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            {data.order.orderNumber}
          </h1>
          <p className="text-zinc-600">{data.order.title ?? "Untitled PO"}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
          {data.order.status.label}
        </span>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <p className="font-medium text-zinc-900">Summary</p>
        <p className="mt-2 text-zinc-600">
          Workflow: {data.order.workflow.name} · Supplier:{" "}
          {data.order.supplier?.name ?? "—"} · Requester:{" "}
          {data.order.requester.name}
        </p>
        <p className="mt-2 text-zinc-800">
          {data.order.currency} {data.order.totalAmount}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Lines</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-zinc-500"
                  >
                    No line items on this order. If this is production demo data,
                    run <code className="rounded bg-zinc-100 px-1">npm run db:seed</code>{" "}
                    against the same database so demo lines are created.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.lineNo}</td>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">{item.unitPrice}</td>
                    <td className="px-3 py-2">{item.lineTotal}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.splitChildren.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-zinc-900">
            Split children
          </h2>
          <ul className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            {data.splitChildren.map((child) => (
              <li key={child.id} className="flex justify-between gap-4">
                <span className="font-medium">{child.orderNumber}</span>
                <span className="text-zinc-600">{child.status.label}</span>
                <span>
                  {data.order.currency} {child.totalAmount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.pendingProposal ? (
        <section className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-medium text-zinc-900">
            Pending split proposal
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Buyer must accept or reject. Allocations:
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {data.pendingProposal.lines.map((line) => (
              <li key={line.id}>
                {line.sourceDescription}: qty {line.quantity} → child{" "}
                {line.childIndex} · ship{" "}
                {new Date(line.plannedShipDate).toLocaleDateString()}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => acceptSplit(data.pendingProposal!.id)}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Accept split
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => rejectSplit(data.pendingProposal!.id)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-50"
            >
              Reject split
            </button>
          </div>
        </section>
      ) : null}

      {canProposeSplit ? (
        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-lg font-medium text-zinc-900">Propose split</h2>
          <p className="mt-1 text-sm text-zinc-600">
            For each line, totals per child must sum exactly to the ordered
            quantity. At least two child orders required.
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            Child orders
            <input
              type="number"
              min={2}
              max={5}
              value={childCount}
              onChange={(event) =>
                setChildCount(Math.max(2, Number(event.target.value) || 2))
              }
              className="w-16 rounded border border-zinc-300 px-2 py-1"
            />
          </label>

          <div className="mt-4 space-y-6">
            {data.items.map((item) => (
              <div key={item.id} className="rounded-md border border-zinc-100 p-3">
                <p className="text-sm font-medium">
                  Line {item.lineNo}: {item.description} (order {item.quantity})
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: childCount }, (_, index) => index + 1).map(
                    (childIndex) => (
                      <div
                        key={`${item.id}-${childIndex}`}
                        className="rounded border border-zinc-100 p-2"
                      >
                        <p className="text-xs font-medium text-zinc-500">
                          Child {childIndex}
                        </p>
                        <label className="mt-1 block text-xs text-zinc-600">
                          Qty
                          <input
                            type="text"
                            value={allocations[item.id]?.[childIndex]?.quantity ?? ""}
                            onChange={(event) =>
                              setAllocations((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...previous[item.id],
                                  [childIndex]: {
                                    quantity: event.target.value,
                                    plannedShipDate:
                                      previous[item.id]?.[childIndex]
                                        ?.plannedShipDate ?? todayIsoDate(),
                                  },
                                },
                              }))
                            }
                            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="mt-2 block text-xs text-zinc-600">
                          Ship date
                          <input
                            type="date"
                            value={
                              allocations[item.id]?.[childIndex]
                                ?.plannedShipDate ?? todayIsoDate()
                            }
                            onChange={(event) =>
                              setAllocations((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...previous[item.id],
                                  [childIndex]: {
                                    quantity:
                                      previous[item.id]?.[childIndex]
                                        ?.quantity ?? "",
                                    plannedShipDate: event.target.value,
                                  },
                                },
                              }))
                            }
                            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void submitSplit()}
            className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Submit split proposal
          </button>
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-medium text-zinc-900">Actions</h2>
        {(() => {
          const actions = data.allowedActions.filter(
            (action) =>
              action.actionCode !== "propose_split" &&
              action.actionCode !== "buyer_accept_split" &&
              action.actionCode !== "buyer_reject_proposal",
          );
          if (actions.length === 0) {
            return (
              <p className="mt-3 text-sm text-zinc-500">
                No workflow actions from the current status. For supplier
                orders after seeding, &ldquo;Confirmed&rdquo; includes{" "}
                <span className="font-medium text-zinc-700">Mark fulfilled</span>
                .
              </p>
            );
          }
          return (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.actionCode}
                  type="button"
                  disabled={busy}
                  onClick={() => void runTransition(action.actionCode)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          );
        })()}
      </section>
    </main>
  );
}
