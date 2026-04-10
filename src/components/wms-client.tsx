"use client";

import { useEffect, useMemo, useState } from "react";

type WmsData = {
  warehouses: Array<{ id: string; code: string | null; name: string; type: "CFS" | "WAREHOUSE" }>;
  bins: Array<{ id: string; code: string; name: string; warehouse: { id: string; code: string | null; name: string } }>;
  balances: Array<{
    id: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string };
    product: { id: string; productCode: string | null; sku: string | null; name: string };
    onHandQty: string;
    allocatedQty: string;
    availableQty: string;
  }>;
  openTasks: Array<{
    id: string;
    taskType: "PUTAWAY" | "PICK" | "CYCLE_COUNT";
    quantity: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string } | null;
    product: { id: string; productCode: string | null; sku: string | null; name: string } | null;
    shipment: { id: string; shipmentNo: string | null; status: string } | null;
    order: { id: string; orderNumber: string } | null;
    note: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: string;
  }>;
  putawayCandidates: Array<{
    shipmentItemId: string;
    shipmentNo: string | null;
    orderNumber: string;
    lineNo: number;
    description: string;
    productId: string;
    remainingQty: string;
    shipmentStatus: string;
  }>;
  pickCandidates: Array<{
    orderItemId: string;
    orderNumber: string;
    lineNo: number;
    description: string;
    product: { id: string; productCode: string | null; sku: string | null; name: string };
    remainingQty: string;
  }>;
};

export function WmsClient({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<WmsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [newBinCode, setNewBinCode] = useState("");
  const [newBinName, setNewBinName] = useState("");

  const [putawayShipmentItemId, setPutawayShipmentItemId] = useState("");
  const [putawayQty, setPutawayQty] = useState("");
  const [putawayBinId, setPutawayBinId] = useState("");

  const [pickOrderItemId, setPickOrderItemId] = useState("");
  const [pickQty, setPickQty] = useState("");
  const [pickBinId, setPickBinId] = useState("");

  async function load() {
    const res = await fetch("/api/wms", { cache: "no-store" });
    const payload = (await res.json()) as WmsData & { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not load WMS.");
      return;
    }
    setData(payload);
    if (!selectedWarehouseId && payload.warehouses[0]) {
      setSelectedWarehouseId(payload.warehouses[0].id);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const binsForWarehouse = useMemo(
    () => (data?.bins ?? []).filter((b) => b.warehouse.id === selectedWarehouseId),
    [data?.bins, selectedWarehouseId],
  );

  async function runAction(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "WMS action failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-6 py-8 text-sm text-zinc-600">Loading WMS…</main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-zinc-900">Warehouse operations (WMS)</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Phase 1: bins, putaway/pick tasks, and live stock balances.
        </p>
      </header>
      {error ? (
        <p className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Warehouse setup</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select warehouse</option>
            {data.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code ? `${w.code} · ` : ""}
                {w.name}
              </option>
            ))}
          </select>
          <input
            value={newBinCode}
            onChange={(e) => setNewBinCode(e.target.value.toUpperCase())}
            placeholder="Bin code"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newBinName}
            onChange={(e) => setNewBinName(e.target.value)}
            placeholder="Bin name"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() =>
              void runAction({
                action: "create_bin",
                warehouseId: selectedWarehouseId,
                code: newBinCode,
                name: newBinName,
              })
            }
            className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Create bin
          </button>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Create putaway task</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <select
            value={putawayShipmentItemId}
            onChange={(e) => {
              const id = e.target.value;
              setPutawayShipmentItemId(id);
              const c = data.putawayCandidates.find((x) => x.shipmentItemId === id);
              setPutawayQty(c?.remainingQty ?? "");
            }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select inbound shipment line</option>
            {data.putawayCandidates.map((c) => (
              <option key={c.shipmentItemId} value={c.shipmentItemId}>
                {c.shipmentNo || "ASN"} · {c.orderNumber} · L{c.lineNo} · {c.remainingQty}
              </option>
            ))}
          </select>
          <input
            value={putawayQty}
            onChange={(e) => setPutawayQty(e.target.value)}
            placeholder="Qty"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            value={putawayBinId}
            onChange={(e) => setPutawayBinId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Default bin (optional)</option>
            {binsForWarehouse.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() =>
              void runAction({
                action: "create_putaway_task",
                warehouseId: selectedWarehouseId,
                shipmentItemId: putawayShipmentItemId,
                quantity: Number(putawayQty),
                binId: putawayBinId || null,
              })
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Create putaway task
          </button>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Create pick task</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <select
            value={pickOrderItemId}
            onChange={(e) => {
              const id = e.target.value;
              setPickOrderItemId(id);
              const c = data.pickCandidates.find((x) => x.orderItemId === id);
              setPickQty(c?.remainingQty ?? "");
            }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select order line</option>
            {data.pickCandidates.map((c) => (
              <option key={c.orderItemId} value={c.orderItemId}>
                {c.orderNumber} · L{c.lineNo} · {c.product.productCode || c.product.sku || "SKU"} ·{" "}
                {c.remainingQty}
              </option>
            ))}
          </select>
          <input
            value={pickQty}
            onChange={(e) => setPickQty(e.target.value)}
            placeholder="Qty"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            value={pickBinId}
            onChange={(e) => setPickBinId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Pick bin</option>
            {binsForWarehouse.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() => {
              const c = data.pickCandidates.find((x) => x.orderItemId === pickOrderItemId);
              if (!c) return;
              void runAction({
                action: "create_pick_task",
                warehouseId: selectedWarehouseId,
                orderItemId: pickOrderItemId,
                productId: c.product.id,
                binId: pickBinId,
                quantity: Number(pickQty),
              });
            }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Create pick task
          </button>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Open tasks</h2>
        <div className="space-y-2 text-sm">
          {data.openTasks.length === 0 ? (
            <p className="text-zinc-500">No open tasks.</p>
          ) : (
            data.openTasks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 p-2">
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800">
                  {t.taskType}
                </span>
                <span className="text-zinc-700">{t.quantity}</span>
                <span className="text-zinc-700">{t.product?.name ?? "—"}</span>
                <span className="text-zinc-500">{t.warehouse.code || t.warehouse.name}</span>
                {t.bin ? <span className="text-zinc-500">Bin {t.bin.code}</span> : null}
                {t.shipment ? <span className="text-zinc-500">Shipment {t.shipment.shipmentNo || t.shipment.id.slice(0, 6)}</span> : null}
                {t.order ? <span className="text-zinc-500">Order {t.order.orderNumber}</span> : null}
                {canEdit ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction({
                        action: t.taskType === "PUTAWAY" ? "complete_putaway_task" : "complete_pick_task",
                        taskId: t.id,
                        ...(t.taskType === "PUTAWAY" ? { binId: t.bin?.id ?? null } : {}),
                      })
                    }
                    className="ml-auto rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Complete
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Stock balances</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Warehouse</th>
                <th className="px-2 py-1">Bin</th>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1">On hand</th>
                <th className="px-2 py-1">Allocated</th>
                <th className="px-2 py-1">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {data.balances.map((b) => (
                <tr key={b.id}>
                  <td className="px-2 py-1">{b.warehouse.code || b.warehouse.name}</td>
                  <td className="px-2 py-1">
                    {b.bin.code} · {b.bin.name}
                  </td>
                  <td className="px-2 py-1">
                    {b.product.productCode || b.product.sku || "SKU"} · {b.product.name}
                  </td>
                  <td className="px-2 py-1">{b.onHandQty}</td>
                  <td className="px-2 py-1">{b.allocatedQty}</td>
                  <td className="px-2 py-1 font-medium">{b.availableQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
