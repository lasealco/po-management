"use client";

import { useEffect, useMemo, useState } from "react";

type AvailableShipmentRow = {
  shipmentId: string;
  shipmentNo: string;
  orderId: string;
  orderNumber: string;
  supplierName: string;
  carrier: string | null;
  shippedAt: string;
  transportMode: "OCEAN" | "AIR" | "ROAD" | "RAIL" | null;
  estimatedVolumeCbm: string;
  remainingUnits: number;
  lineCount: number;
};

type WarehouseRow = {
  id: string;
  code: string | null;
  name: string;
  type: "CFS" | "WAREHOUSE";
};

type LoadPlanSummary = {
  id: string;
  reference: string;
  status: "DRAFT" | "FINALIZED" | "CANCELLED";
  transportMode: "OCEAN" | "AIR" | "ROAD" | "RAIL";
  containerSize: "LCL" | "FCL_20" | "FCL_40" | "FCL_40HC" | "TRUCK_13_6" | "AIR_ULD";
  plannedEta: string | null;
  notes: string | null;
  warehouse: WarehouseRow;
  shipmentCount: number;
  unitCount: number;
  volumeCbm: number;
};

type FilterPreset = {
  id: string;
  name: string;
  supplierName: string | null;
  shippedFrom: string | null;
  shippedTo: string | null;
};

const CONTAINER_CAPACITY_CBM: Record<
  "LCL" | "FCL_20" | "FCL_40" | "FCL_40HC" | "TRUCK_13_6" | "AIR_ULD",
  number
> = {
  LCL: 15,
  FCL_20: 33,
  FCL_40: 67,
  FCL_40HC: 76,
  TRUCK_13_6: 90,
  AIR_ULD: 20,
};

export function ConsolidationPlanner({
  initialAvailable,
  initialWarehouses,
  initialLoadPlans,
}: {
  initialAvailable: AvailableShipmentRow[];
  initialWarehouses: WarehouseRow[];
  initialLoadPlans: LoadPlanSummary[];
}) {
  const [available, setAvailable] = useState(initialAvailable);
  const [warehouses, setWarehouses] = useState(initialWarehouses);
  const [loadPlans, setLoadPlans] = useState(initialLoadPlans);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(
    initialLoadPlans[0]?.id ?? null,
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    initialLoadPlans[0]?.warehouse.id ?? initialWarehouses[0]?.id ?? "",
  );
  const [transportMode, setTransportMode] = useState<
    "OCEAN" | "AIR" | "ROAD" | "RAIL"
  >(initialLoadPlans[0]?.transportMode ?? "OCEAN");
  const [containerSize, setContainerSize] = useState<
    "LCL" | "FCL_20" | "FCL_40" | "FCL_40HC" | "TRUCK_13_6" | "AIR_ULD"
  >(initialLoadPlans[0]?.containerSize ?? "LCL");
  const [etaDate, setEtaDate] = useState<string>(
    initialLoadPlans[0]?.plannedEta?.slice(0, 10) ?? "",
  );
  const [loadRef, setLoadRef] = useState("");
  const [notes, setNotes] = useState(initialLoadPlans[0]?.notes ?? "");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [shippedFrom, setShippedFrom] = useState("");
  const [shippedTo, setShippedTo] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("none");
  const [inLoad, setInLoad] = useState<AvailableShipmentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedLoad = loadPlans.find((row) => row.id === selectedLoadId) ?? null;
  const isDraft = selectedLoad?.status === "DRAFT";

  const filteredAvailable = useMemo(
    () =>
      available.filter((row) => {
        if (row.transportMode != null && row.transportMode !== transportMode) return false;
        if (supplierFilter !== "all" && row.supplierName !== supplierFilter) return false;
        if (shippedFrom) {
          const from = new Date(`${shippedFrom}T00:00:00.000Z`).getTime();
          if (!Number.isNaN(from) && new Date(row.shippedAt).getTime() < from) return false;
        }
        if (shippedTo) {
          const to = new Date(`${shippedTo}T23:59:59.999Z`).getTime();
          if (!Number.isNaN(to) && new Date(row.shippedAt).getTime() > to) return false;
        }
        return true;
      }),
    [available, transportMode, supplierFilter, shippedFrom, shippedTo],
  );
  const supplierOptions = useMemo(
    () => ["all", ...new Set(available.map((r) => r.supplierName).sort())],
    [available],
  );
  const totals = useMemo(
    () => ({
      availableShipments: filteredAvailable.length,
      availableUnits: filteredAvailable.reduce((sum, row) => sum + row.remainingUnits, 0),
      loadShipments: inLoad.length,
      loadUnits: inLoad.reduce((sum, row) => sum + row.remainingUnits, 0),
      loadVolumeCbm: inLoad.reduce((sum, row) => sum + Number(row.estimatedVolumeCbm), 0),
    }),
    [filteredAvailable, inLoad],
  );
  const loadFactorPct = Math.min(
    999,
    (totals.loadVolumeCbm / CONTAINER_CAPACITY_CBM[containerSize]) * 100 || 0,
  );

  async function refreshMeta() {
    const response = await fetch("/api/consolidation/load-plans", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      warehouses: WarehouseRow[];
      loadPlans: LoadPlanSummary[];
    };
    setWarehouses(payload.warehouses);
    setLoadPlans(payload.loadPlans);
  }

  async function loadPresets() {
    const response = await fetch("/api/consolidation/filter-presets", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { presets: FilterPreset[] };
    setPresets(payload.presets ?? []);
  }

  async function loadPlanDetails(id: string) {
    const response = await fetch(`/api/consolidation/load-plans/${id}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setError("Could not load selected draft.");
      return;
    }
    const payload = (await response.json()) as {
      id: string;
      reference: string;
      status: "DRAFT" | "FINALIZED" | "CANCELLED";
      transportMode: "OCEAN" | "AIR" | "ROAD" | "RAIL";
      containerSize: "LCL" | "FCL_20" | "FCL_40" | "FCL_40HC" | "TRUCK_13_6" | "AIR_ULD";
      plannedEta: string | null;
      notes: string | null;
      warehouse: WarehouseRow;
      shipments: AvailableShipmentRow[];
    };
    setSelectedLoadId(payload.id);
    setSelectedWarehouseId(payload.warehouse.id);
    setTransportMode(payload.transportMode);
    setContainerSize(payload.containerSize);
    setEtaDate(payload.plannedEta?.slice(0, 10) ?? "");
    setNotes(payload.notes ?? "");
    setInLoad(payload.shipments);
  }

  async function createLoadPlan() {
    if (!loadRef.trim()) {
      setError("Enter a load reference first.");
      return;
    }
    if (!selectedWarehouseId) {
      setError("Select a CFS / warehouse.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/consolidation/load-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: loadRef.trim(),
        warehouseId: selectedWarehouseId,
        transportMode,
        containerSize,
        plannedEta: etaDate || null,
        notes: notes || null,
      }),
    });
    const payload = (await response.json()) as { ok?: true; id?: string; error?: string };
    if (!response.ok || !payload.id) {
      setError(payload.error ?? "Could not create load plan.");
      setBusy(false);
      return;
    }
    await refreshMeta();
    await loadPlanDetails(payload.id);
    setLoadRef("");
    setBusy(false);
  }

  async function saveSelectedPlan() {
    if (!selectedLoadId) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/consolidation/load-plans/${selectedLoadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId: selectedWarehouseId,
        transportMode,
        containerSize,
        plannedEta: etaDate || null,
        notes: notes || null,
      }),
    });
    const payload = (await response.json()) as { ok?: true; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not save draft metadata.");
      setBusy(false);
      return;
    }
    await refreshMeta();
    setBusy(false);
  }

  async function addToLoad(row: AvailableShipmentRow) {
    if (!selectedLoadId) {
      setError("Create or select a draft load first.");
      return;
    }
    if (!isDraft) {
      setError("Load is locked. Reopen it to DRAFT first.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/consolidation/load-plans/${selectedLoadId}/shipments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: row.shipmentId }),
      },
    );
    const payload = (await response.json()) as { ok?: true; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not add shipment to draft.");
      setBusy(false);
      return;
    }
    setAvailable((prev) => prev.filter((r) => r.shipmentId !== row.shipmentId));
    setInLoad((prev) => [...prev, row]);
    await refreshMeta();
    setBusy(false);
  }

  async function removeFromLoad(row: AvailableShipmentRow) {
    if (!selectedLoadId) return;
    if (!isDraft) {
      setError("Load is locked. Reopen it to DRAFT first.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/consolidation/load-plans/${selectedLoadId}/shipments/${row.shipmentId}`,
      { method: "DELETE" },
    );
    const payload = (await response.json()) as { ok?: true; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not remove shipment from draft.");
      setBusy(false);
      return;
    }
    setInLoad((prev) => prev.filter((r) => r.shipmentId !== row.shipmentId));
    setAvailable((prev) => [...prev, row]);
    await refreshMeta();
    setBusy(false);
  }

  useEffect(() => {
    if (!selectedLoadId) return;
    void loadPlanDetails(selectedLoadId);
    // only run on initial selected id change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLoadId]);

  useEffect(() => {
    void loadPresets();
  }, []);

  async function saveCurrentFilterPreset() {
    if (!presetName.trim()) {
      setError("Enter a name for the filter preset.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/consolidation/filter-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: presetName.trim(),
        supplierName: supplierFilter === "all" ? null : supplierFilter,
        shippedFrom: shippedFrom || null,
        shippedTo: shippedTo || null,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not save preset.");
      setBusy(false);
      return;
    }
    setPresetName("");
    await loadPresets();
    setBusy(false);
  }

  async function deleteSelectedPreset() {
    if (selectedPresetId === "none") return;
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/consolidation/filter-presets/${selectedPresetId}`,
      { method: "DELETE" },
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not delete preset.");
      setBusy(false);
      return;
    }
    setSelectedPresetId("none");
    await loadPresets();
    setBusy(false);
  }

  function applyPreset(id: string) {
    setSelectedPresetId(id);
    if (id === "none") return;
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setSupplierFilter(preset.supplierName ?? "all");
    setShippedFrom(preset.shippedFrom ?? "");
    setShippedTo(preset.shippedTo ?? "");
  }

  async function changeStatus(status: "DRAFT" | "FINALIZED" | "CANCELLED") {
    if (!selectedLoadId) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/consolidation/load-plans/${selectedLoadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not change status.");
      setBusy(false);
      return;
    }
    await refreshMeta();
    await loadPlanDetails(selectedLoadId);
    setBusy(false);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-zinc-900">Buyer Consolidation Planner</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Build persistent load drafts from open ASN quantities by CFS / warehouse.
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Draft load</span>
          <select
            value={selectedLoadId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              void loadPlanDetails(id);
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          >
            {loadPlans.length === 0 ? (
              <option value="">No drafts yet</option>
            ) : (
              loadPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.reference} ({plan.warehouse.name})
                </option>
              ))
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Transport mode</span>
          <select
            value={transportMode}
            onChange={(e) =>
              setTransportMode(e.target.value as "OCEAN" | "AIR" | "ROAD" | "RAIL")
            }
            disabled={Boolean(selectedLoadId) && !isDraft}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          >
            <option value="OCEAN">Ocean</option>
            <option value="AIR">Air</option>
            <option value="ROAD">Road</option>
            <option value="RAIL">Rail</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Container size</span>
          <select
            value={containerSize}
            onChange={(e) =>
              setContainerSize(
                e.target.value as
                  | "LCL"
                  | "FCL_20"
                  | "FCL_40"
                  | "FCL_40HC"
                  | "TRUCK_13_6"
                  | "AIR_ULD",
              )
            }
            disabled={Boolean(selectedLoadId) && !isDraft}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          >
            <option value="LCL">LCL</option>
            <option value="FCL_20">FCL 20</option>
            <option value="FCL_40">FCL 40</option>
            <option value="FCL_40HC">FCL 40HC</option>
            <option value="TRUCK_13_6">Truck 13.6m</option>
            <option value="AIR_ULD">Air ULD</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">CFS / Warehouse</span>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            disabled={Boolean(selectedLoadId) && !isDraft}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.type})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Target load ETA</span>
          <input
            type="date"
            value={etaDate}
            onChange={(e) => setEtaDate(e.target.value)}
            disabled={Boolean(selectedLoadId) && !isDraft}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Load reference</span>
          <input
            value={loadRef}
            onChange={(e) => setLoadRef(e.target.value)}
            placeholder="LOAD-2026-001"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createLoadPlan()}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Create draft
          </button>
          <button
            type="button"
            disabled={busy || !selectedLoadId || !isDraft}
            onClick={() => void saveSelectedPlan()}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </section>
      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Draft notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={Boolean(selectedLoadId) && !isDraft}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        {selectedLoad ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            <span>
              Active draft: <span className="font-medium">{selectedLoad.reference}</span> ·{" "}
              {selectedLoad.status}
            </span>
            {selectedLoad.status === "DRAFT" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void changeStatus("FINALIZED")}
                className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-800 disabled:opacity-50"
              >
                Finalize
              </button>
            ) : null}
            {selectedLoad.status !== "CANCELLED" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void changeStatus("CANCELLED")}
                className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-800 disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
            {selectedLoad.status !== "DRAFT" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void changeStatus("DRAFT")}
                className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-violet-800 disabled:opacity-50"
              >
                Reopen Draft
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-600">
            Create a draft to start assigning shipments.
          </p>
        )}
      </section>
      <section className="mb-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Supplier filter</span>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          >
            {supplierOptions.map((name) => (
              <option key={name} value={name}>
                {name === "all" ? "All suppliers" : name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Shipped from</span>
          <input
            type="date"
            value={shippedFrom}
            onChange={(e) => setShippedFrom(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Shipped to</span>
          <input
            type="date"
            value={shippedTo}
            onChange={(e) => setShippedTo(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
      </section>
      <section className="mb-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Saved filter presets</span>
          <select
            value={selectedPresetId}
            onChange={(e) => applyPreset(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          >
            <option value="none">None</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">New preset name</span>
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Ocean West Coast"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveCurrentFilterPreset()}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
          >
            Save preset
          </button>
          <button
            type="button"
            disabled={busy || selectedPresetId === "none"}
            onClick={() => void deleteSelectedPreset()}
            className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 disabled:opacity-50"
          >
            Delete preset
          </button>
        </div>
      </section>

      <section className="mb-6 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-900">
          Available shipments: {totals.availableShipments}
        </span>
        <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-900">
          Available units: {totals.availableUnits}
        </span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-900">
          In load: {totals.loadShipments}
        </span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-900">
          Load units: {totals.loadUnits}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${
            loadFactorPct > 100
              ? "bg-rose-100 text-rose-900"
              : loadFactorPct >= 95
                ? "bg-amber-100 text-amber-900"
                : "bg-violet-100 text-violet-900"
          }`}
        >
          Load factor: {loadFactorPct.toFixed(1)}%
        </span>
        {loadFactorPct > 100 ? (
          <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-900">
            Overfilled by {(loadFactorPct - 100).toFixed(1)}%
          </span>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white">
          <header className="border-b border-zinc-100 px-4 py-3">
            <h2 className="text-base font-medium text-zinc-900">Available Shipments</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Shipment</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Volume (cbm)</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredAvailable.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                      No available shipments.
                    </td>
                  </tr>
                ) : (
                  filteredAvailable.map((row) => (
                    <tr key={row.shipmentId}>
                      <td className="px-3 py-2 text-zinc-800">
                        <p className="font-medium">{row.shipmentNo}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(row.shippedAt).toLocaleDateString()} · {row.carrier || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-zinc-700">{row.orderNumber}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.supplierName}</td>
                      <td className="px-3 py-2 text-zinc-800">{row.remainingUnits}</td>
                      <td className="px-3 py-2 text-zinc-800">
                        {Number(row.estimatedVolumeCbm).toFixed(3)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={busy || !isDraft}
                          onClick={() => addToLoad(row)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                        >
                          Add to load
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white">
          <header className="border-b border-zinc-100 px-4 py-3">
            <h2 className="text-base font-medium text-zinc-900">Draft Load</h2>
            <p className="mt-1 text-xs text-zinc-600">
              {selectedLoad?.reference ?? "No draft selected"}
              {selectedLoad?.warehouse?.name ? ` · ${selectedLoad.warehouse.name}` : ""}
              {etaDate ? ` · ETA ${new Date(etaDate).toLocaleDateString()}` : ""}
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Shipment</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Units</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {inLoad.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                      Add shipments from the left panel.
                    </td>
                  </tr>
                ) : (
                  inLoad.map((row) => (
                    <tr key={row.shipmentId}>
                      <td className="px-3 py-2 text-zinc-800">{row.shipmentNo}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.orderNumber}</td>
                      <td className="px-3 py-2 text-zinc-800">{row.remainingUnits}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={busy || !isDraft}
                          onClick={() => removeFromLoad(row)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
