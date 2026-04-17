"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableSelectField } from "@/components/searchable-select-field";

type TransportMode = "OCEAN" | "AIR" | "ROAD" | "RAIL";
type ContainerSize = "LCL" | "FCL_20" | "FCL_40" | "FCL_40HC" | "TRUCK_13_6" | "AIR_ULD";

type AvailableShipmentRow = {
  shipmentId: string;
  shipmentNo: string;
  orderId: string;
  orderNumber: string;
  supplierName: string;
  carrier: string | null;
  shippedAt: string;
  transportMode: TransportMode | null;
  estimatedVolumeCbm: string;
  estimatedWeightKg: string | null;
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
  transportMode: TransportMode;
  containerSize: ContainerSize;
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
  ContainerSize,
  number
> = {
  LCL: 15,
  FCL_20: 33,
  FCL_40: 67,
  FCL_40HC: 76,
  TRUCK_13_6: 90,
  AIR_ULD: 20,
};

const CONTAINER_CAPACITY_KG: Record<
  ContainerSize,
  number
> = {
  LCL: 12_000,
  FCL_20: 28_000,
  FCL_40: 30_000,
  FCL_40HC: 30_000,
  TRUCK_13_6: 24_000,
  AIR_ULD: 6_500,
};

const WEIGHT_WARNING_PCT_BY_MODE: Record<TransportMode, number> = {
  OCEAN: 95,
  AIR: 85,
  ROAD: 92,
  RAIL: 94,
};

const MODE_WEIGHT_PENALTY_BY_MODE: Record<TransportMode, number> = {
  OCEAN: 140,
  AIR: 190,
  ROAD: 165,
  RAIL: 150,
};

const MODE_VOLUME_PENALTY_BY_MODE: Record<TransportMode, number> = {
  OCEAN: 120,
  AIR: 95,
  ROAD: 130,
  RAIL: 120,
};

type OptimizedBin = {
  size: ContainerSize;
  shipments: AvailableShipmentRow[];
  usedVolume: number;
  usedWeight: number;
};

type OptimizationResult = {
  bins: OptimizedBin[];
  unassigned: AvailableShipmentRow[];
};

function sizeOptionsForMode(mode: TransportMode): ContainerSize[] {
  if (mode === "AIR") return ["AIR_ULD"];
  if (mode === "ROAD") return ["TRUCK_13_6"];
  if (mode === "RAIL") return ["TRUCK_13_6", "FCL_40", "FCL_20"];
  return ["FCL_40HC", "FCL_40", "FCL_20", "LCL"];
}

function shipmentWeight(row: AvailableShipmentRow): number {
  return Number(row.estimatedWeightKg ?? row.remainingUnits * 18);
}

function optimizeContainers(
  rows: AvailableShipmentRow[],
  mode: TransportMode,
): OptimizationResult {
  const candidates = sizeOptionsForMode(mode);
  const bins: OptimizedBin[] = [];
  const unassigned: AvailableShipmentRow[] = [];
  const sorted = [...rows].sort((a, b) => {
    const av = Number(a.estimatedVolumeCbm);
    const bv = Number(b.estimatedVolumeCbm);
    const aw = shipmentWeight(a);
    const bw = shipmentWeight(b);
    return Math.max(bv / 67, bw / 30_000) - Math.max(av / 67, aw / 30_000);
  });

  for (const row of sorted) {
    const vol = Number(row.estimatedVolumeCbm);
    const wt = shipmentWeight(row);
    let bestBinIdx = -1;
    let bestResidual = Number.POSITIVE_INFINITY;

    for (let i = 0; i < bins.length; i += 1) {
      const b = bins[i];
      const vCap = CONTAINER_CAPACITY_CBM[b.size];
      const wCap = CONTAINER_CAPACITY_KG[b.size];
      if (b.usedVolume + vol > vCap || b.usedWeight + wt > wCap) continue;
      const residual =
        (vCap - (b.usedVolume + vol)) / vCap + (wCap - (b.usedWeight + wt)) / wCap;
      if (residual < bestResidual) {
        bestResidual = residual;
        bestBinIdx = i;
      }
    }

    if (bestBinIdx >= 0) {
      const b = bins[bestBinIdx];
      b.shipments.push(row);
      b.usedVolume += vol;
      b.usedWeight += wt;
      continue;
    }

    let bestNewSize: ContainerSize | null = null;
    let bestNewWaste = Number.POSITIVE_INFINITY;
    for (const size of candidates) {
      const vCap = CONTAINER_CAPACITY_CBM[size];
      const wCap = CONTAINER_CAPACITY_KG[size];
      if (vol > vCap || wt > wCap) continue;
      const waste = (vCap - vol) / vCap + (wCap - wt) / wCap;
      if (waste < bestNewWaste) {
        bestNewWaste = waste;
        bestNewSize = size;
      }
    }
    if (!bestNewSize) {
      unassigned.push(row);
      continue;
    }
    bins.push({ size: bestNewSize, shipments: [row], usedVolume: vol, usedWeight: wt });
  }

  return { bins, unassigned };
}

export function ConsolidationPlanner({
  initialAvailable,
  initialWarehouses,
  initialLoadPlans,
}: {
  initialAvailable: AvailableShipmentRow[];
  initialWarehouses: WarehouseRow[];
  initialLoadPlans: LoadPlanSummary[];
}) {
  const [planningMode, setPlanningMode] = useState<"container" | "demand">("container");
  const [available, setAvailable] = useState(initialAvailable);
  const [warehouses, setWarehouses] = useState(initialWarehouses);
  const [loadPlans, setLoadPlans] = useState(initialLoadPlans);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(
    initialLoadPlans[0]?.id ?? null,
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    initialLoadPlans[0]?.warehouse.id ?? initialWarehouses[0]?.id ?? "",
  );
  const [transportMode, setTransportMode] = useState<TransportMode>(
    initialLoadPlans[0]?.transportMode ?? "OCEAN",
  );
  const [containerSize, setContainerSize] = useState<ContainerSize>(
    initialLoadPlans[0]?.containerSize ?? "LCL",
  );
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
  const [selectedDemandIds, setSelectedDemandIds] = useState<string[]>([]);
  const [optimizedPlan, setOptimizedPlan] = useState<OptimizationResult | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [autoPlay, setAutoPlay] = useState(false);
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
  const supplierFilterOptions = useMemo(
    () => supplierOptions.map((name) => ({ value: name, label: name === "all" ? "All suppliers" : name })),
    [supplierOptions],
  );
  const presetFilterOptions = useMemo(
    () => presets.map((preset) => ({ value: preset.id, label: preset.name })),
    [presets],
  );
  const totals = useMemo(
    () => ({
      availableShipments: filteredAvailable.length,
      availableUnits: filteredAvailable.reduce((sum, row) => sum + row.remainingUnits, 0),
      loadShipments: inLoad.length,
      loadUnits: inLoad.reduce((sum, row) => sum + row.remainingUnits, 0),
      loadVolumeCbm: inLoad.reduce((sum, row) => sum + Number(row.estimatedVolumeCbm), 0),
      loadWeightKg: inLoad.reduce(
        (sum, row) => sum + Number(row.estimatedWeightKg ?? row.remainingUnits * 18),
        0,
      ),
    }),
    [filteredAvailable, inLoad],
  );
  const loadFactorPct = Math.min(
    999,
    (totals.loadVolumeCbm / CONTAINER_CAPACITY_CBM[containerSize]) * 100 || 0,
  );
  const containerCapacity = CONTAINER_CAPACITY_CBM[containerSize];
  const weightCapacityKg = CONTAINER_CAPACITY_KG[containerSize];
  const remainingCbm = Math.max(containerCapacity - totals.loadVolumeCbm, 0);
  const overfillCbm = Math.max(totals.loadVolumeCbm - containerCapacity, 0);
  const remainingWeightKg = Math.max(weightCapacityKg - totals.loadWeightKg, 0);
  const overweightKg = Math.max(totals.loadWeightKg - weightCapacityKg, 0);
  const weightLoadPct = (totals.loadWeightKg / weightCapacityKg) * 100 || 0;
  const weightWarningPct = WEIGHT_WARNING_PCT_BY_MODE[transportMode];
  const modeWeightPenalty = MODE_WEIGHT_PENALTY_BY_MODE[transportMode];
  const modeVolumePenalty = MODE_VOLUME_PENALTY_BY_MODE[transportMode];
  const usageLabel =
    loadFactorPct > 100 ? "Overfilled" : loadFactorPct >= 95 ? "Near capacity" : "Healthy";
  const usageTone =
    loadFactorPct > 100
      ? "text-rose-700 bg-rose-50 border-rose-200"
      : loadFactorPct >= 95
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-emerald-700 bg-emerald-50 border-emerald-200";
  const sequence = useMemo(
    () =>
      [...inLoad].sort(
        (a, b) => Number(b.estimatedVolumeCbm) - Number(a.estimatedVolumeCbm),
      ),
    [inLoad],
  );
  const mixedModeCount = useMemo(
    () => inLoad.filter((row) => row.transportMode != null && row.transportMode !== transportMode).length,
    [inLoad, transportMode],
  );
  const sequenceSteps = useMemo(
    () =>
      sequence.map((row, idx) => {
      const rowVolume = Number(row.estimatedVolumeCbm);
      const rowWeight = Number(row.estimatedWeightKg ?? row.remainingUnits * 18);
      const prefix = sequence.slice(0, idx + 1);
      const cumulativeVolume = prefix.reduce((sum, item) => sum + Number(item.estimatedVolumeCbm), 0);
      const cumulativeWeight = prefix.reduce(
        (sum, item) => sum + Number(item.estimatedWeightKg ?? item.remainingUnits * 18),
        0,
      );
      const overVolRatio = Math.max(0, cumulativeVolume - containerCapacity) / containerCapacity;
      const overWtRatio = Math.max(0, cumulativeWeight - weightCapacityKg) / weightCapacityKg;
      const modePenalty = row.transportMode && row.transportMode !== transportMode ? 15 : 0;
      const fitScore = Math.max(
        0,
        Math.round(
          100 - overVolRatio * modeVolumePenalty - overWtRatio * modeWeightPenalty - modePenalty,
        ),
      );
      return { row, step: idx + 1, rowVolume, rowWeight, fitScore };
    }),
    [
      containerCapacity,
      modeVolumePenalty,
      modeWeightPenalty,
      sequence,
      transportMode,
      weightCapacityKg,
    ],
  );
  const playbackCursor =
    playbackIndex < 0 ? sequence.length : Math.min(sequence.length, playbackIndex);
  const sequenceWindow = useMemo(() => sequence.slice(0, playbackCursor), [playbackCursor, sequence]);
  const visualBlocks = useMemo(() => {
    if (sequenceWindow.length === 0) return [];
    return sequenceWindow.slice(0, 14).map((row) => {
      const pct = Math.max(
        2,
        Math.min(100, (Number(row.estimatedVolumeCbm) / containerCapacity) * 100),
      );
      return {
        id: row.shipmentId,
        label: row.shipmentNo,
        pct,
      };
    });
  }, [containerCapacity, sequenceWindow]);
  const selectedDemandRows = useMemo(
    () => filteredAvailable.filter((row) => selectedDemandIds.includes(row.shipmentId)),
    [filteredAvailable, selectedDemandIds],
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
      transportMode: TransportMode;
      containerSize: ContainerSize;
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
    setSelectedDemandIds((prev) => prev.filter((id) => id !== row.shipmentId));
    setOptimizedPlan(null);
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
    setOptimizedPlan(null);
    await refreshMeta();
    setBusy(false);
  }

  useEffect(() => {
    if (!selectedLoadId) return;
    void loadPlanDetails(selectedLoadId);
  }, [selectedLoadId]);

  useEffect(() => {
    void loadPresets();
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    if (playbackCursor >= sequence.length) return;
    const id = window.setTimeout(() => {
      setPlaybackIndex((prev) => {
        const next = Math.min(sequence.length, Math.max(0, prev) + 1);
        if (next >= sequence.length) setAutoPlay(false);
        return next;
      });
    }, 450);
    return () => window.clearTimeout(id);
  }, [autoPlay, playbackCursor, sequence.length]);

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

  function toggleDemandSelection(shipmentId: string, checked: boolean) {
    setOptimizedPlan(null);
    setSelectedDemandIds((prev) => {
      if (checked) return prev.includes(shipmentId) ? prev : [...prev, shipmentId];
      return prev.filter((id) => id !== shipmentId);
    });
  }

  function runDemandOptimization() {
    const selectedRows = filteredAvailable.filter((row) => selectedDemandIds.includes(row.shipmentId));
    if (selectedRows.length === 0) {
      setError("Select at least one shipment for demand-first optimization.");
      return;
    }
    setError(null);
    setOptimizedPlan(optimizeContainers(selectedRows, transportMode));
  }

  async function applyOptimizedPlan() {
    if (!optimizedPlan || optimizedPlan.bins.length === 0) return;
    if (!selectedWarehouseId) {
      setError("Select a CFS / warehouse before applying optimized plan.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const createdLoadIds: string[] = [];
      const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
      for (let i = 0; i < optimizedPlan.bins.length; i += 1) {
        const bin = optimizedPlan.bins[i];
        const createRes = await fetch("/api/consolidation/load-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: `LOAD-AUTO-${stamp}-${String(i + 1).padStart(2, "0")}`,
            warehouseId: selectedWarehouseId,
            transportMode,
            containerSize: bin.size,
            plannedEta: etaDate || null,
            notes:
              `Auto-optimized (${transportMode}) · ${bin.usedVolume.toFixed(2)} cbm · ${bin.usedWeight.toFixed(0)} kg`,
          }),
        });
        const createPayload = (await createRes.json()) as { id?: string; error?: string };
        if (!createRes.ok || !createPayload.id) {
          throw new Error(createPayload.error ?? "Could not create one of the optimized loads.");
        }
        createdLoadIds.push(createPayload.id);
        for (const shipment of bin.shipments) {
          const assignRes = await fetch(
            `/api/consolidation/load-plans/${createPayload.id}/shipments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shipmentId: shipment.shipmentId }),
            },
          );
          if (!assignRes.ok) {
            const assignPayload = (await assignRes.json()) as { error?: string };
            throw new Error(
              assignPayload.error ??
                `Could not assign ${shipment.shipmentNo} to ${createPayload.id}.`,
            );
          }
        }
      }
      setAvailable((prev) => {
        const assigned = new Set(
          optimizedPlan.bins.flatMap((b) => b.shipments.map((s) => s.shipmentId)),
        );
        return prev.filter((row) => !assigned.has(row.shipmentId));
      });
      setSelectedDemandIds([]);
      setOptimizedPlan(null);
      await refreshMeta();
      if (createdLoadIds[0]) await loadPlanDetails(createdLoadIds[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply optimized plan.");
    } finally {
      setBusy(false);
    }
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

      <section className="mb-6 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Planning mode
        </span>
        <button
          type="button"
          onClick={() => setPlanningMode("container")}
          className={`rounded px-3 py-1.5 text-sm ${
            planningMode === "container"
              ? "bg-arscmp-primary text-white"
              : "border border-zinc-300 text-zinc-700"
          }`}
        >
          Container-first
        </button>
        <button
          type="button"
          onClick={() => setPlanningMode("demand")}
          className={`rounded px-3 py-1.5 text-sm ${
            planningMode === "demand"
              ? "bg-arscmp-primary text-white"
              : "border border-zinc-300 text-zinc-700"
          }`}
        >
          Demand-first optimizer
        </button>
      </section>

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
            className="rounded-md bg-arscmp-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
          <SearchableSelectField
            value={supplierFilter}
            onChange={setSupplierFilter}
            options={supplierFilterOptions}
            placeholder="Type to filter supplier..."
            emptyLabel="All suppliers"
            inputClassName="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
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
          <SearchableSelectField
            value={selectedPresetId}
            onChange={applyPreset}
            options={presetFilterOptions}
            placeholder="Type to filter preset..."
            emptyLabel="None"
            inputClassName="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
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

      {planningMode === "demand" ? (
        <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Demand-first optimization</h2>
              <p className="text-xs text-zinc-600">
                Select required shipments first, then auto-pack into an optimized container mix.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || selectedDemandRows.length === 0}
                onClick={runDemandOptimization}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-50"
              >
                Optimize loads
              </button>
              <button
                type="button"
                disabled={busy || !optimizedPlan || optimizedPlan.bins.length === 0}
                onClick={() => void applyOptimizedPlan()}
                className="rounded bg-arscmp-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Create optimized drafts
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Selected: {selectedDemandRows.length} shipment(s) ·{" "}
            {selectedDemandRows.reduce((s, r) => s + Number(r.estimatedVolumeCbm), 0).toFixed(2)} cbm ·{" "}
            {selectedDemandRows
              .reduce((s, r) => s + Number(r.estimatedWeightKg ?? r.remainingUnits * 18), 0)
              .toFixed(0)} kg
          </p>
          {optimizedPlan ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {optimizedPlan.bins.map((bin, idx) => (
                <article key={`${bin.size}-${idx}`} className="rounded-md border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    Container {idx + 1} · {bin.size}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {bin.shipments.length} shipments · {bin.usedVolume.toFixed(2)} cbm ·{" "}
                    {bin.usedWeight.toFixed(0)} kg
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                    {bin.shipments.slice(0, 4).map((s) => (
                      <li key={s.shipmentId}>{s.shipmentNo} · {s.orderNumber}</li>
                    ))}
                    {bin.shipments.length > 4 ? (
                      <li className="text-zinc-500">+{bin.shipments.length - 4} more…</li>
                    ) : null}
                  </ul>
                </article>
              ))}
              {optimizedPlan.unassigned.length > 0 ? (
                <article className="rounded-md border border-rose-200 bg-rose-50 p-3">
                  <p className="text-sm font-semibold text-rose-800">Unassigned shipments</p>
                  <p className="text-xs text-rose-700">
                    {optimizedPlan.unassigned.length} shipment(s) exceed current container options.
                  </p>
                </article>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Available</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">{totals.availableShipments}</p>
          <p className="text-xs text-zinc-600">shipments, {totals.availableUnits.toFixed(1)} units</p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">In draft</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">{totals.loadShipments}</p>
          <p className="text-xs text-zinc-600">{totals.loadUnits.toFixed(1)} units assigned</p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Volume used</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {totals.loadVolumeCbm.toFixed(2)} / {containerCapacity.toFixed(2)} cbm
          </p>
          <p className="text-xs text-zinc-600">
            {remainingCbm.toFixed(2)} cbm free
          </p>
        </article>
        <article className={`rounded-lg border p-3 ${usageTone}`}>
          <p className="text-xs uppercase tracking-wide">Load state</p>
          <p className="mt-1 text-lg font-semibold">{loadFactorPct.toFixed(1)}%</p>
          <p className="text-xs">
            {usageLabel}
            {overfillCbm > 0 ? ` · +${overfillCbm.toFixed(2)} cbm` : ""}
          </p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Weight used</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {totals.loadWeightKg.toFixed(0)} / {weightCapacityKg.toFixed(0)} kg
          </p>
          <p className="text-xs text-zinc-600">
            {overweightKg > 0
              ? `Over by ${overweightKg.toFixed(0)} kg`
              : `${remainingWeightKg.toFixed(0)} kg free`}
          </p>
        </article>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-3">
        <article className="rounded-lg border border-zinc-200 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-medium text-zinc-900">Container fill simulation</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${usageTone}`}>
              {usageLabel}
            </span>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sequence.length === 0}
              onClick={() => {
                setAutoPlay(false);
                setPlaybackIndex(Math.max(0, playbackCursor - 1));
              }}
              className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={sequence.length === 0}
              onClick={() => {
                setAutoPlay(false);
                setPlaybackIndex(Math.min(sequence.length, playbackCursor + 1));
              }}
              className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50"
            >
              Next
            </button>
            <button
              type="button"
              disabled={sequence.length === 0}
              onClick={() => {
                if (playbackCursor >= sequence.length) setPlaybackIndex(0);
                setAutoPlay((v) => !v);
              }}
              className="rounded border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 disabled:opacity-50"
            >
              {autoPlay ? "Pause" : "Auto-play"}
            </button>
            <span className="text-xs text-zinc-600">
              Step {playbackCursor} / {sequence.length}
            </span>
          </div>
          <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full transition-all duration-500 ${
                loadFactorPct > 100
                  ? "bg-rose-500"
                  : loadFactorPct >= 95
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(loadFactorPct, 100)}%` }}
            />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex h-36 items-end gap-1 overflow-hidden rounded-lg border border-zinc-200 bg-white p-2">
              {visualBlocks.length === 0 ? (
                <p className="m-auto text-sm text-zinc-500">Add shipments to visualize stuffing order.</p>
              ) : (
                visualBlocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className="group relative min-w-3 flex-1 rounded-sm bg-violet-300/80 transition-all duration-500 hover:bg-violet-400"
                    style={{
                      height: `${block.pct}%`,
                      opacity: 0.45 + (idx % 6) * 0.08,
                    }}
                    title={`${block.label} · ${block.pct.toFixed(1)}% of container volume`}
                  >
                    <span className="absolute -top-5 left-0 hidden text-[10px] text-zinc-700 group-hover:block">
                      {block.label}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Visual blocks animate through the stuffing sequence. Use Prev/Next/Auto-play to preview
            loading order.
          </p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-base font-medium text-zinc-900">Suggested stuffing sequence</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Start with higher-volume shipments, then add smaller remainder loads.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                overfillCbm > 0
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {overfillCbm > 0 ? `Capacity breach +${overfillCbm.toFixed(2)} cbm` : "Capacity OK"}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                overweightKg > 0
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : weightLoadPct >= weightWarningPct
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {overweightKg > 0
                ? `Weight breach +${overweightKg.toFixed(0)} kg`
                : `Weight ${weightLoadPct.toFixed(1)}% (${transportMode})`}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                mixedModeCount > 0
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {mixedModeCount > 0
                ? `${mixedModeCount} shipment(s) mode mismatch`
                : "Mode alignment OK"}
            </span>
          </div>
          <ol className="mt-3 space-y-2">
            {sequence.length === 0 ? (
              <li className="rounded-md border border-dashed border-zinc-200 px-3 py-2 text-sm text-zinc-500">
                No shipments in draft.
              </li>
            ) : (
              sequenceSteps.slice(0, 8).map(({ row, step, rowVolume, rowWeight, fitScore }) => (
                <li
                  key={row.shipmentId}
                  className={`rounded-md border px-3 py-2 ${
                    step === playbackCursor
                      ? "border-violet-300 bg-violet-50"
                      : "border-zinc-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500">Step {step}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        fitScore >= 85
                          ? "bg-emerald-100 text-emerald-700"
                          : fitScore >= 60
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      Fit {fitScore}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-900">{row.shipmentNo}</p>
                  <p className="text-xs text-zinc-600">
                    {row.orderNumber} · {rowVolume.toFixed(3)} cbm · {rowWeight.toFixed(0)} kg ·{" "}
                    {row.remainingUnits.toFixed(1)} units
                  </p>
                </li>
              ))
            )}
          </ol>
        </article>
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
                  <th className="px-3 py-2">Pick</th>
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
                    <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                      No available shipments.
                    </td>
                  </tr>
                ) : (
                  filteredAvailable.map((row) => (
                    <tr key={row.shipmentId}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedDemandIds.includes(row.shipmentId)}
                          onChange={(e) => toggleDemandSelection(row.shipmentId, e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                      </td>
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
