"use client";

import { useEffect, useMemo, useState } from "react";

type WmsData = {
  warehouses: Array<{ id: string; code: string | null; name: string; type: "CFS" | "WAREHOUSE" }>;
  zones: Array<{
    id: string;
    code: string;
    name: string;
    zoneType: "RECEIVING" | "PICKING" | "RESERVE" | "QUARANTINE" | "STAGING" | "SHIPPING";
    warehouse: { id: string; code: string | null; name: string };
  }>;
  bins: Array<{
    id: string;
    code: string;
    name: string;
    storageType: "PALLET" | "FLOOR" | "SHELF" | "QUARANTINE" | "STAGING";
    isPickFace: boolean;
    maxPallets: number | null;
    warehouse: { id: string; code: string | null; name: string };
    zone: { id: string; code: string; name: string; zoneType: string } | null;
  }>;
  replenishmentRules: Array<{
    id: string;
    warehouse: { id: string; code: string | null; name: string };
    product: { id: string; productCode: string | null; sku: string | null; name: string };
    sourceZone: { id: string; code: string; name: string } | null;
    targetZone: { id: string; code: string; name: string } | null;
    minPickQty: string;
    maxPickQty: string;
    replenishQty: string;
    isActive: boolean;
  }>;
  outboundOrders: Array<{
    id: string;
    outboundNo: string;
    customerRef: string | null;
    shipToName: string | null;
    shipToCity: string | null;
    shipToCountryCode: string | null;
    status: "DRAFT" | "RELEASED" | "PICKING" | "PACKED" | "SHIPPED" | "CANCELLED";
    warehouse: { id: string; code: string | null; name: string };
    lines: Array<{
      id: string;
      lineNo: number;
      product: { id: string; productCode: string | null; sku: string | null; name: string };
      quantity: string;
      pickedQty: string;
      packedQty: string;
      shippedQty: string;
    }>;
  }>;
  balances: Array<{
    id: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string };
    product: { id: string; productCode: string | null; sku: string | null; name: string };
    onHandQty: string;
    allocatedQty: string;
    availableQty: string;
    onHold: boolean;
    holdReason: string | null;
  }>;
  openTasks: Array<{
    id: string;
    taskType: "PUTAWAY" | "PICK" | "REPLENISH" | "CYCLE_COUNT";
    quantity: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string } | null;
    product: { id: string; productCode: string | null; sku: string | null; name: string } | null;
    shipment: { id: string; shipmentNo: string | null; status: string } | null;
    order: { id: string; orderNumber: string } | null;
    wave: { id: string; waveNo: string; status: string } | null;
    note: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: string;
  }>;
  waves: Array<{
    id: string;
    waveNo: string;
    status: "OPEN" | "RELEASED" | "DONE" | "CANCELLED";
    warehouse: { id: string; code: string | null; name: string };
    taskCount: number;
    openTaskCount: number;
    totalQty: string;
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
    outboundOrderId: string;
    outboundNo: string;
    outboundLineId: string;
    lineNo: number;
    description: string;
    product: { id: string; productCode: string | null; sku: string | null; name: string };
    remainingQty: string;
  }>;
  recentMovements: Array<{
    id: string;
    movementType: "RECEIPT" | "PUTAWAY" | "PICK" | "ADJUSTMENT" | "SHIPMENT";
    quantity: string;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    createdAt: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string } | null;
    product: { id: string; productCode: string | null; sku: string | null; name: string };
    createdBy: { id: string; name: string; email: string };
  }>;
};

export type WmsSection = "setup" | "operations" | "stock";

export function WmsClient({ canEdit, section }: { canEdit: boolean; section: WmsSection }) {
  const [data, setData] = useState<WmsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<
    "" | "RECEIPT" | "PUTAWAY" | "PICK" | "ADJUSTMENT" | "SHIPMENT"
  >("");
  const [newZoneCode, setNewZoneCode] = useState("");
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneType, setNewZoneType] = useState<
    "RECEIVING" | "PICKING" | "RESERVE" | "QUARANTINE" | "STAGING" | "SHIPPING"
  >("PICKING");
  const [newBinCode, setNewBinCode] = useState("");
  const [newBinName, setNewBinName] = useState("");
  const [newBinZoneId, setNewBinZoneId] = useState("");
  const [newBinStorageType, setNewBinStorageType] = useState<
    "PALLET" | "FLOOR" | "SHELF" | "QUARANTINE" | "STAGING"
  >("PALLET");
  const [newBinPickFace, setNewBinPickFace] = useState(false);

  const [putawayShipmentItemId, setPutawayShipmentItemId] = useState("");
  const [putawayQty, setPutawayQty] = useState("");
  const [putawayBinId, setPutawayBinId] = useState("");

  const [pickOutboundLineId, setPickOutboundLineId] = useState("");
  const [pickQty, setPickQty] = useState("");
  const [pickBinId, setPickBinId] = useState("");
  const [replProductId, setReplProductId] = useState("");
  const [replSourceZoneId, setReplSourceZoneId] = useState("");
  const [replTargetZoneId, setReplTargetZoneId] = useState("");
  const [replMin, setReplMin] = useState("");
  const [replMax, setReplMax] = useState("");
  const [replQty, setReplQty] = useState("");
  const [outboundRef, setOutboundRef] = useState("");
  const [outboundShipTo, setOutboundShipTo] = useState("");
  const [outboundCity, setOutboundCity] = useState("");
  const [outboundCountry, setOutboundCountry] = useState("");
  const [outboundProductId, setOutboundProductId] = useState("");
  const [outboundLineQty, setOutboundLineQty] = useState("");
  const [cycleBalanceId, setCycleBalanceId] = useState("");
  const [cycleCountQtyByTask, setCycleCountQtyByTask] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/wms", { cache: "no-store" });
    const payload = (await res.json()) as WmsData & { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not load WMS.");
      return;
    }
    setData(payload);
    setSelectedWarehouseId((prev) => {
      if (section === "stock") {
        return prev;
      }
      if (!prev && payload.warehouses[0]) {
        return payload.warehouses[0].id;
      }
      return prev;
    });
  }

  useEffect(() => {
    void load();
  }, [section]);

  const binsForWarehouse = useMemo(
    () => (data?.bins ?? []).filter((b) => b.warehouse.id === selectedWarehouseId),
    [data?.bins, selectedWarehouseId],
  );
  const zonesForWarehouse = useMemo(
    () => (data?.zones ?? []).filter((z) => z.warehouse.id === selectedWarehouseId),
    [data?.zones, selectedWarehouseId],
  );

  const balancesForWarehouseOps = useMemo(
    () =>
      (data?.balances ?? []).filter(
        (b) => !selectedWarehouseId || b.warehouse.id === selectedWarehouseId,
      ),
    [data?.balances, selectedWarehouseId],
  );

  const balancesShown = useMemo(() => {
    const rows = data?.balances ?? [];
    if (section !== "stock" || !selectedWarehouseId) {
      return rows;
    }
    return rows.filter((b) => b.warehouse.id === selectedWarehouseId);
  }, [data?.balances, section, selectedWarehouseId]);

  const movementsShown = useMemo(() => {
    let rows = data?.recentMovements ?? [];
    if (section === "stock" && selectedWarehouseId) {
      rows = rows.filter((m) => m.warehouse.id === selectedWarehouseId);
    }
    if (section === "stock" && movementTypeFilter) {
      rows = rows.filter((m) => m.movementType === movementTypeFilter);
    }
    return rows;
  }, [data?.recentMovements, section, selectedWarehouseId, movementTypeFilter]);

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

  const headerTitle =
    section === "setup"
      ? "Warehouse setup"
      : section === "operations"
        ? "Floor operations"
        : "Stock & ledger";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-zinc-900">{headerTitle}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {section === "setup"
            ? "Zones, bins, and replenishment rules for the selected warehouse."
            : section === "operations"
              ? "Putaway, picking, outbound orders, waves, and open tasks."
              : "On-hand balances and recent inventory ledger rows."}{" "}
          Blueprint coverage:{" "}
          <code className="rounded bg-zinc-100 px-1">docs/wms/GAP_MAP.md</code>.
        </p>
      </header>
      {error ? (
        <p className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {section === "setup" || section === "operations" ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <span className="text-sm font-medium text-zinc-700">Active warehouse</span>
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
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">Warehouse</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All warehouses</option>
              {data.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code ? `${w.code} · ` : ""}
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">Movement type</span>
            <select
              value={movementTypeFilter}
              onChange={(e) =>
                setMovementTypeFilter(
                  e.target.value as "" | "RECEIPT" | "PUTAWAY" | "PICK" | "ADJUSTMENT" | "SHIPMENT",
                )
              }
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="RECEIPT">RECEIPT</option>
              <option value="PUTAWAY">PUTAWAY</option>
              <option value="PICK">PICK</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="SHIPMENT">SHIPMENT</option>
            </select>
          </label>
        </div>
      )}

      {section === "setup" ? (
        <>
      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Warehouse setup</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <input
            value={newZoneCode}
            onChange={(e) => setNewZoneCode(e.target.value.toUpperCase())}
            placeholder="Zone code"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            placeholder="Zone name"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            value={newZoneType}
            onChange={(e) =>
              setNewZoneType(
                e.target.value as
                  | "RECEIVING"
                  | "PICKING"
                  | "RESERVE"
                  | "QUARANTINE"
                  | "STAGING"
                  | "SHIPPING",
              )
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="RECEIVING">Receiving</option>
            <option value="PICKING">Picking</option>
            <option value="RESERVE">Reserve</option>
            <option value="QUARANTINE">Quarantine</option>
            <option value="STAGING">Staging</option>
            <option value="SHIPPING">Shipping</option>
          </select>
          <button
            type="button"
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() =>
              void runAction({
                action: "create_zone",
                warehouseId: selectedWarehouseId,
                code: newZoneCode,
                name: newZoneName,
                zoneType: newZoneType,
              })
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Create zone
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-6">
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
          <select
            value={newBinZoneId}
            onChange={(e) => setNewBinZoneId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Zone (optional)</option>
            {zonesForWarehouse.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code} · {z.name}
              </option>
            ))}
          </select>
          <select
            value={newBinStorageType}
            onChange={(e) =>
              setNewBinStorageType(
                e.target.value as "PALLET" | "FLOOR" | "SHELF" | "QUARANTINE" | "STAGING",
              )
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="PALLET">Pallet</option>
            <option value="FLOOR">Floor</option>
            <option value="SHELF">Shelf</option>
            <option value="QUARANTINE">Quarantine</option>
            <option value="STAGING">Staging</option>
          </select>
          <label className="flex items-center gap-2 rounded border border-zinc-300 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={newBinPickFace}
              onChange={(e) => setNewBinPickFace(e.target.checked)}
            />
            Pick face
          </label>
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() =>
              void runAction({
                action: "create_bin",
                warehouseId: selectedWarehouseId,
                targetZoneId: newBinZoneId || null,
                code: newBinCode,
                name: newBinName,
                storageType: newBinStorageType,
                isPickFace: newBinPickFace,
              })
            }
            className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Create bin
          </button>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Replenishment setup</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-7">
          <select
            value={replProductId}
            onChange={(e) => setReplProductId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Product</option>
            {Array.from(
              new Map(
                data.balances.map((b) => [b.product.id, b.product] as const),
              ).values(),
            ).map((p) => (
              <option key={p.id} value={p.id}>
                {p.productCode || p.sku || "SKU"} · {p.name}
              </option>
            ))}
          </select>
          <select
            value={replSourceZoneId}
            onChange={(e) => setReplSourceZoneId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Source zone</option>
            {zonesForWarehouse.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code} · {z.name}
              </option>
            ))}
          </select>
          <select
            value={replTargetZoneId}
            onChange={(e) => setReplTargetZoneId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Target zone</option>
            {zonesForWarehouse.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code} · {z.name}
              </option>
            ))}
          </select>
          <input value={replMin} onChange={(e) => setReplMin(e.target.value)} placeholder="Min pick" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <input value={replMax} onChange={(e) => setReplMax(e.target.value)} placeholder="Max pick" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <input value={replQty} onChange={(e) => setReplQty(e.target.value)} placeholder="Replenish qty" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() =>
              void runAction({
                action: "set_replenishment_rule",
                warehouseId: selectedWarehouseId,
                productId: replProductId,
                sourceZoneId: replSourceZoneId || null,
                targetZoneId: replTargetZoneId || null,
                minPickQty: Number(replMin),
                maxPickQty: Number(replMax),
                replenishQty: Number(replQty),
              })
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Save rule
          </button>
        </div>
        <div className="mt-2">
          <button
            type="button"
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() =>
              void runAction({
                action: "create_replenishment_tasks",
                warehouseId: selectedWarehouseId,
              })
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Generate replenishment tasks
          </button>
        </div>
      </section>
        </>
      ) : null}

      {section === "operations" ? (
        <>
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
            value={pickOutboundLineId}
            onChange={(e) => {
              const id = e.target.value;
              setPickOutboundLineId(id);
              const c = data.pickCandidates.find((x) => x.outboundLineId === id);
              setPickQty(c?.remainingQty ?? "");
            }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select order line</option>
            {data.pickCandidates.map((c) => (
              <option key={c.outboundLineId} value={c.outboundLineId}>
                {c.outboundNo} · L{c.lineNo} · {c.product.productCode || c.product.sku || "SKU"} ·{" "}
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
              const c = data.pickCandidates.find((x) => x.outboundLineId === pickOutboundLineId);
              if (!c) return;
              void runAction({
                action: "create_pick_task",
                warehouseId: selectedWarehouseId,
                outboundLineId: pickOutboundLineId,
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
        <h2 className="text-sm font-semibold text-zinc-900">Outbound flow</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-6">
          <input value={outboundRef} onChange={(e) => setOutboundRef(e.target.value)} placeholder="Customer ref" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <input value={outboundShipTo} onChange={(e) => setOutboundShipTo(e.target.value)} placeholder="Ship-to name" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <input value={outboundCity} onChange={(e) => setOutboundCity(e.target.value)} placeholder="City" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <input value={outboundCountry} onChange={(e) => setOutboundCountry(e.target.value.toUpperCase())} placeholder="Country" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <select value={outboundProductId} onChange={(e)=>setOutboundProductId(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Product</option>
            {Array.from(new Map(data.balances.map((b)=>[b.product.id,b.product] as const)).values()).map((p)=>(
              <option key={p.id} value={p.id}>{p.productCode || p.sku || "SKU"} · {p.name}</option>
            ))}
          </select>
          <input value={outboundLineQty} onChange={(e)=>setOutboundLineQty(e.target.value)} placeholder="Qty" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div className="mt-2">
          <button
            type="button"
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() =>
              void runAction({
                action: "create_outbound_order",
                warehouseId: selectedWarehouseId,
                customerRef: outboundRef,
                shipToName: outboundShipTo,
                shipToCity: outboundCity,
                shipToCountryCode: outboundCountry,
                lines: outboundProductId
                  ? [{ productId: outboundProductId, quantity: Number(outboundLineQty) }]
                  : [],
              })
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Create outbound order
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {data.outboundOrders.map((o) => (
            <div key={o.id} className="rounded border border-zinc-200 p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900">{o.outboundNo}</span>
                <span className="text-zinc-600">{o.status}</span>
                <span className="text-zinc-500">{o.customerRef || "No ref"}</span>
                {canEdit && o.status === "DRAFT" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction({ action: "release_outbound_order", outboundOrderId: o.id })}
                    className="ml-auto rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Release
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Wave picking</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Auto-build pick waves from open order demand and current available stock in selected
          warehouse bins.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() =>
              void runAction({
                action: "create_pick_wave",
                warehouseId: selectedWarehouseId,
              })
            }
            className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Create pick wave
          </button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {data.waves.length === 0 ? (
            <p className="text-zinc-500">No active waves.</p>
          ) : (
            data.waves.map((wave) => (
              <div key={wave.id} className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 p-2">
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800">
                  {wave.waveNo}
                </span>
                <span className="text-zinc-700">{wave.status}</span>
                <span className="text-zinc-500">{wave.warehouse.code || wave.warehouse.name}</span>
                <span className="text-zinc-500">
                  tasks {wave.taskCount} · open {wave.openTaskCount} · qty {wave.totalQty}
                </span>
                {canEdit && wave.status === "OPEN" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction({ action: "release_wave", waveId: wave.id })}
                    className="ml-auto rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Release
                  </button>
                ) : null}
                {canEdit && (wave.status === "OPEN" || wave.status === "RELEASED") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction({ action: "complete_wave", waveId: wave.id })}
                    className="rounded border border-emerald-700 bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Complete wave
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Cycle count</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Opens a <span className="font-medium">CYCLE_COUNT</span> task against a balance row (book qty is frozen on
          the task). Complete it with the physical count to post an ADJUSTMENT if there is variance.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <select
            value={cycleBalanceId}
            onChange={(e) => setCycleBalanceId(e.target.value)}
            className="min-w-[14rem] rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select balance (warehouse filter above)</option>
            {balancesForWarehouseOps.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bin.code} · {(b.product.productCode || b.product.sku || "SKU").slice(0, 12)} · book {b.onHandQty}
                {Boolean(b.onHold) ? " · HOLD" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canEdit || busy || !selectedWarehouseId || !cycleBalanceId}
            onClick={() => void runAction({ action: "create_cycle_count_task", balanceId: cycleBalanceId })}
            className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Create cycle count task
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
                {t.wave ? <span className="text-zinc-500">Wave {t.wave.waveNo}</span> : null}
                {t.taskType === "CYCLE_COUNT" ? (
                  <label className="ml-auto flex items-center gap-1 text-xs text-zinc-600">
                    Count
                    <input
                      type="number"
                      step="any"
                      value={cycleCountQtyByTask[t.id] ?? t.quantity}
                      onChange={(e) =>
                        setCycleCountQtyByTask((m) => ({ ...m, [t.id]: e.target.value }))
                      }
                      className="w-24 rounded border border-zinc-300 px-1 py-0.5 text-sm"
                    />
                  </label>
                ) : null}
                {canEdit &&
                (t.taskType === "PUTAWAY" ||
                  t.taskType === "PICK" ||
                  t.taskType === "REPLENISH" ||
                  t.taskType === "CYCLE_COUNT") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (t.taskType === "PUTAWAY") {
                        void runAction({
                          action: "complete_putaway_task",
                          taskId: t.id,
                          binId: t.bin?.id ?? null,
                        });
                        return;
                      }
                      if (t.taskType === "PICK") {
                        void runAction({ action: "complete_pick_task", taskId: t.id });
                        return;
                      }
                      if (t.taskType === "REPLENISH") {
                        void runAction({ action: "complete_replenish_task", taskId: t.id });
                        return;
                      }
                      const raw = cycleCountQtyByTask[t.id] ?? t.quantity;
                      void runAction({
                        action: "complete_cycle_count_task",
                        taskId: t.id,
                        countedQty: Number(raw),
                      });
                    }}
                    className={`rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40 ${
                      t.taskType === "CYCLE_COUNT" ? "" : "ml-auto"
                    }`}
                  >
                    Complete
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
        </>
      ) : null}

      {section === "stock" ? (
        <>
      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Recent stock movements</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Last {movementsShown.length} ledger rows shown
          {selectedWarehouseId ? " (filtered)" : ""} (PUTAWAY, PICK, etc.). Full filters and exports come in a later
          increment.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">When</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Qty</th>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1">Bin</th>
                <th className="px-2 py-1">Ref</th>
                <th className="px-2 py-1">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {movementsShown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-zinc-500">
                    No movements yet.
                  </td>
                </tr>
              ) : (
                movementsShown.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-2 py-1 text-xs text-zinc-600">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 font-medium">{m.movementType}</td>
                    <td className="px-2 py-1">{m.quantity}</td>
                    <td className="px-2 py-1">
                      {m.product.productCode || m.product.sku || "—"} · {m.product.name}
                    </td>
                    <td className="px-2 py-1 text-zinc-600">
                      {m.bin ? `${m.bin.code}` : "—"}
                    </td>
                    <td className="max-w-[10rem] truncate px-2 py-1 text-xs text-zinc-500" title={m.referenceId ?? ""}>
                      {m.referenceType ?? "—"}
                      {m.referenceId ? ` · ${m.referenceId.slice(0, 8)}…` : ""}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-xs text-zinc-600">{m.createdBy.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                <th className="px-2 py-1">Hold</th>
                <th className="px-2 py-1">QC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {balancesShown.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-3 text-zinc-500">
                    No balances in this view.
                  </td>
                </tr>
              ) : (
                balancesShown.map((b) => (
                  <tr key={b.id} className={Boolean(b.onHold) ? "bg-amber-50/80" : undefined}>
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
                    <td className="px-2 py-1 text-xs text-zinc-600">
                      {b.onHold ? (
                        <span title={b.holdReason ?? ""}>Yes</span>
                      ) : (
                        "No"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">
                      {canEdit && !Boolean(b.onHold) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const reason =
                              typeof window !== "undefined"
                                ? window.prompt("Hold reason (optional):", "QC hold")
                                : null;
                            if (reason === null) return;
                            void runAction({
                              action: "set_balance_hold",
                              balanceId: b.id,
                              holdReason: reason.trim() || "On hold",
                            });
                          }}
                          className="rounded border border-amber-600 px-2 py-0.5 text-xs font-medium text-amber-900 disabled:opacity-40"
                        >
                          Set hold
                        </button>
                      ) : null}
                      {canEdit && b.onHold ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runAction({ action: "clear_balance_hold", balanceId: b.id })}
                          className="ml-1 rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800 disabled:opacity-40"
                        >
                          Clear
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      ) : null}
    </main>
  );
}
