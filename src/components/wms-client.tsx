"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { InventoryMovementType, WmsReceiveStatus } from "@prisma/client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment } from "react";

import { ActionButton } from "@/components/action-button";
import { WorkflowHeader } from "@/components/workflow-header";
import { printOutboundPackSlip } from "@/lib/wms/pack-slip-print";
import { WMS_DEMO_WAREHOUSE_CODE } from "@/lib/wms/demo-warehouse-code";
import {
  isoToDatetimeLocalValue,
  mergeStockLedgerSearchParams,
  normalizeMovementLedgerQueryString,
  readStockLedgerUrlState,
} from "@/lib/wms/stock-ledger-url";
import { WMS_RECEIVE_STATUS_LABEL } from "@/lib/wms/wms-receive-status";

type WmsData = {
  warehouses: Array<{
    id: string;
    code: string | null;
    name: string;
    type: "CFS" | "WAREHOUSE";
    pickAllocationStrategy:
      | "MAX_AVAILABLE_FIRST"
      | "FIFO_BY_BIN_CODE"
      | "FEFO_BY_LOT_EXPIRY"
      | "MANUAL_ONLY";
  }>;
  zones: Array<{
    id: string;
    code: string;
    name: string;
    zoneType: "RECEIVING" | "PICKING" | "RESERVE" | "QUARANTINE" | "STAGING" | "SHIPPING";
    parentZoneId: string | null;
    parentZone: { id: string; code: string; name: string } | null;
    warehouse: { id: string; code: string | null; name: string };
  }>;
  bins: Array<{
    id: string;
    code: string;
    name: string;
    storageType: "PALLET" | "FLOOR" | "SHELF" | "QUARANTINE" | "STAGING";
    isPickFace: boolean;
    maxPallets: number | null;
    rackCode: string | null;
    aisle: string | null;
    bay: string | null;
    level: number | null;
    positionIndex: number | null;
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
  crmAccountOptions: Array<{ id: string; name: string; legalName: string | null }>;
  outboundOrders: Array<{
    id: string;
    outboundNo: string;
    customerRef: string | null;
    asnReference: string | null;
    requestedShipDate: string | null;
    shipToName: string | null;
    shipToCity: string | null;
    shipToCountryCode: string | null;
    status: "DRAFT" | "RELEASED" | "PICKING" | "PACKED" | "SHIPPED" | "CANCELLED";
    warehouse: { id: string; code: string | null; name: string };
    crmAccount: { id: string; name: string; legalName: string | null } | null;
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
    /** Batch bucket; empty string = fungible / legacy stock. */
    lotCode: string;
    /** BF-02 — attributes when a `WmsLotBatch` exists for product + lotCode. */
    lotBatchProfile?: {
      expiryDate: string | null;
      countryOfOrigin: string | null;
      notes: string | null;
    } | null;
    onHandQty: string;
    allocatedQty: string;
    availableQty: string;
    onHold: boolean;
    holdReason: string | null;
  }>;
  openTasks: Array<{
    id: string;
    taskType: "PUTAWAY" | "PICK" | "REPLENISH" | "CYCLE_COUNT" | "VALUE_ADD";
    quantity: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string } | null;
    /** For REPLENISH: reserve / bulk `referenceId` bin (source). */
    sourceBin: { id: string; code: string; name: string } | null;
    product: { id: string; productCode: string | null; sku: string | null; name: string } | null;
    shipment: { id: string; shipmentNo: string | null; status: string } | null;
    order: { id: string; orderNumber: string } | null;
    wave: { id: string; waveNo: string; status: string } | null;
    note: string | null;
    referenceType: string | null;
    referenceId: string | null;
    lotCode: string;
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
  inboundShipments: Array<{
    id: string;
    shipmentNo: string | null;
    status: string;
    asnReference: string | null;
    expectedReceiveAt: string | null;
    shippedAt: string;
    receivedAt: string | null;
    orderNumber: string;
    itemCount: number;
    wmsReceiveStatus: WmsReceiveStatus;
    wmsReceiveNote: string | null;
    wmsReceiveUpdatedAt: string | null;
    wmsReceiveUpdatedBy: { id: string; name: string } | null;
    allowedReceiveActions: WmsReceiveStatus[];
    latestMilestone: {
      code: string;
      source: string;
      actualAt: string | null;
      createdAt: string;
      note: string | null;
    } | null;
    receiveLines: Array<{
      shipmentItemId: string;
      lineNo: number;
      description: string | null;
      quantityShipped: string;
      quantityReceived: string;
      wmsVarianceDisposition:
        | "UNSET"
        | "MATCH"
        | "SHORT"
        | "OVER"
        | "DAMAGED"
        | "OTHER";
      wmsVarianceNote: string | null;
    }>;
  }>;
  putawayCandidates: Array<{
    shipmentItemId: string;
    shipmentId: string;
    shipmentNo: string | null;
    orderNumber: string;
    lineNo: number;
    description: string;
    productId: string;
    remainingQty: string;
    shipmentStatus: string;
    asnReference: string | null;
    expectedReceiveAt: string | null;
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
  recentMovementsMeta: { limit: number; matchedCount: number; truncated: boolean };
  dockAppointments: Array<{
    id: string;
    warehouseId: string;
    warehouse: { id: string; code: string | null; name: string };
    dockCode: string;
    windowStart: string;
    windowEnd: string;
    direction: "INBOUND" | "OUTBOUND";
    status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
    note: string | null;
    shipmentId: string | null;
    outboundOrderId: string | null;
    shipment: { id: string; shipmentNo: string | null; orderNumber: string } | null;
    outboundNo: string | null;
    createdBy: { id: string; name: string };
  }>;
  workOrders: Array<{
    id: string;
    workOrderNo: string;
    title: string;
    description: string | null;
    status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";
    completedAt: string | null;
    createdAt: string;
    warehouse: { id: string; code: string | null; name: string };
    createdBy: { id: string; name: string };
  }>;
  /** BF-02 — tenant lot/batch master registry (expiry / origin / notes per product + lotCode). */
  lotBatches?: Array<{
    id: string;
    productId: string;
    lotCode: string;
    product: { id: string; productCode: string | null; sku: string | null; name: string };
    expiryDate: string | null;
    countryOfOrigin: string | null;
    notes: string | null;
    updatedAt: string;
  }>;
};

type SavedLedgerView = {
  id: string;
  name: string;
  filters: {
    warehouseId?: string | null;
    movementType?: string | null;
    sinceIso?: string | null;
    untilIso?: string | null;
    limit?: string | null;
    sortBy?: string | null;
    sortDir?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type WmsSection = "setup" | "operations" | "stock";

const STOCK_LEDGER_MV_TYPE_PRESETS: Array<{ label: string; value: "" | InventoryMovementType }> = [
  { label: "All types", value: "" },
  { label: "Receipt", value: "RECEIPT" },
  { label: "Putaway", value: "PUTAWAY" },
  { label: "Pick", value: "PICK" },
  { label: "Adjustment", value: "ADJUSTMENT" },
  { label: "Shipment", value: "SHIPMENT" },
];

const INBOUND_MILESTONE_LOG_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ASN_SUBMITTED", label: "ASN submitted" },
  { value: "ASN_VALIDATED", label: "ASN validated" },
  { value: "BOOKING_CONFIRMED", label: "Booking confirmed" },
  { value: "DEPARTED", label: "Departed" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "RECEIVED", label: "Received" },
];

const RECEIPT_LINE_VARIANCE_LABEL: Record<
  "UNSET" | "MATCH" | "SHORT" | "OVER" | "DAMAGED" | "OTHER",
  string
> = {
  UNSET: "Not reviewed",
  MATCH: "Match",
  SHORT: "Short",
  OVER: "Over",
  DAMAGED: "Damaged",
  OTHER: "Other",
};

function downloadMovementLedgerCsv(
  rows: WmsData["recentMovements"],
  filenameBase = "wms-ledger",
) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "createdAt",
    "movementType",
    "quantity",
    "productCode",
    "sku",
    "productName",
    "warehouse",
    "bin",
    "referenceType",
    "referenceId",
    "note",
    "createdBy",
  ];
  const lines = [header.join(",")];
  for (const m of rows) {
    lines.push(
      [
        esc(m.createdAt),
        esc(m.movementType),
        esc(m.quantity),
        esc(m.product.productCode ?? ""),
        esc(m.product.sku ?? ""),
        esc(m.product.name),
        esc(m.warehouse.code || m.warehouse.name),
        esc(m.bin ? m.bin.code : ""),
        esc(m.referenceType ?? ""),
        esc(m.referenceId ?? ""),
        esc(m.note ?? ""),
        esc(m.createdBy.name),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function WmsClient({ canEdit, section }: { canEdit: boolean; section: WmsSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /** Stock: once user picks "All warehouses", do not auto-select demo DC again on refetch. */
  const stockWarehouseDefaultApplied = useRef(false);
  const pushingLedgerUrl = useRef(false);
  const lastLedgerUrlNormalized = useRef("");
  const [data, setData] = useState<WmsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");
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
  const [newBinRackCode, setNewBinRackCode] = useState("");
  const [newBinAisle, setNewBinAisle] = useState("");
  const [newBinBay, setNewBinBay] = useState("");
  const [newBinLevel, setNewBinLevel] = useState("");
  const [newBinPosition, setNewBinPosition] = useState("");
  const [rackVizCode, setRackVizCode] = useState("");

  const [putawayShipmentItemId, setPutawayShipmentItemId] = useState("");
  const [putawayQty, setPutawayQty] = useState("");
  const [putawayBinId, setPutawayBinId] = useState("");

  const [pickOutboundLineId, setPickOutboundLineId] = useState("");
  const [pickQty, setPickQty] = useState("");
  const [pickBinId, setPickBinId] = useState("");
  const [pickLotCode, setPickLotCode] = useState("");
  const [putawayLotByTaskId, setPutawayLotByTaskId] = useState<Record<string, string>>({});
  const [replProductId, setReplProductId] = useState("");
  const [replSourceZoneId, setReplSourceZoneId] = useState("");
  const [replTargetZoneId, setReplTargetZoneId] = useState("");
  const [replMin, setReplMin] = useState("");
  const [replMax, setReplMax] = useState("");
  const [replQty, setReplQty] = useState("");
  const [outboundRef, setOutboundRef] = useState("");
  const [outboundProductId, setOutboundProductId] = useState("");
  const [outboundLineQty, setOutboundLineQty] = useState("");
  const [outboundCrmAccountId, setOutboundCrmAccountId] = useState("");
  const [inboundEdits, setInboundEdits] = useState<
    Record<string, { asn: string; expectedReceiveAt: string }>
  >({});
  const [outboundAsnEdits, setOutboundAsnEdits] = useState<
    Record<string, { asn: string; requestedShip: string }>
  >({});
  const [outboundCreateAsn, setOutboundCreateAsn] = useState("");
  const [outboundCreateRequestedShip, setOutboundCreateRequestedShip] = useState("");
  const [dockShipmentLink, setDockShipmentLink] = useState("");
  const [dockOutboundLink, setDockOutboundLink] = useState("");
  const [dockDir, setDockDir] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const [dockCodeInput, setDockCodeInput] = useState("DOCK-A");
  const [dockWinStart, setDockWinStart] = useState("");
  const [dockWinEnd, setDockWinEnd] = useState("");
  const [vasWoTitle, setVasWoTitle] = useState("");
  const [vasWoDesc, setVasWoDesc] = useState("");
  const [vasTaskWoId, setVasTaskWoId] = useState("");
  const [vasBalanceLineId, setVasBalanceLineId] = useState("");
  const [vasTaskQty, setVasTaskQty] = useState("");
  const [cycleBalanceId, setCycleBalanceId] = useState("");
  const [cycleCountQtyByTask, setCycleCountQtyByTask] = useState<Record<string, string>>({});
  const [ledgerSince, setLedgerSince] = useState("");
  const [ledgerUntil, setLedgerUntil] = useState("");
  const [ledgerLimit, setLedgerLimit] = useState("");
  const [ledgerDraftSince, setLedgerDraftSince] = useState("");
  const [ledgerDraftUntil, setLedgerDraftUntil] = useState("");
  const [ledgerDraftLimit, setLedgerDraftLimit] = useState("");
  const [openTaskTypeFilter, setOpenTaskTypeFilter] = useState<
    "" | "PUTAWAY" | "PICK" | "REPLENISH" | "CYCLE_COUNT" | "VALUE_ADD"
  >("");
  const [balanceTextFilter, setBalanceTextFilter] = useState("");
  const [movementSort, setMovementSort] = useState<
    "newest" | "oldest" | "type" | "qtyDesc" | "qtyAsc"
  >("newest");
  const [balanceSort, setBalanceSort] = useState<
    "bin" | "product" | "availableDesc" | "availableAsc"
  >("bin");
  const [lotBatchProductId, setLotBatchProductId] = useState("");
  const [lotBatchCode, setLotBatchCode] = useState("");
  const [lotBatchExpiry, setLotBatchExpiry] = useState("");
  const [lotBatchCountry, setLotBatchCountry] = useState("");
  const [lotBatchNotes, setLotBatchNotes] = useState("");
  const [savedViews, setSavedViews] = useState<SavedLedgerView[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(false);
  const [savedViewsError, setSavedViewsError] = useState<string | null>(null);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("");
  const [newSavedViewName, setNewSavedViewName] = useState("");
  const onHoldOnly = searchParams.get("onHold") === "1";

  useEffect(() => {
    const taskType = (searchParams.get("taskType") || "").toUpperCase();
    if (
      taskType === "PUTAWAY" ||
      taskType === "PICK" ||
      taskType === "REPLENISH" ||
      taskType === "CYCLE_COUNT" ||
      taskType === "VALUE_ADD"
    ) {
      startTransition(() => {
        setOpenTaskTypeFilter(taskType);
      });
    }
  }, [searchParams]);

  useLayoutEffect(() => {
    if (section !== "stock") return;
    if (pushingLedgerUrl.current) {
      const n = normalizeMovementLedgerQueryString(searchParams);
      if (n === lastLedgerUrlNormalized.current) pushingLedgerUrl.current = false;
      return;
    }
    const from = readStockLedgerUrlState(searchParams);
    startTransition(() => {
      if (from.warehouseId) stockWarehouseDefaultApplied.current = true;
      setSelectedWarehouseId(from.warehouseId);
      setMovementTypeFilter(from.movementType);
      if (from.sortBy === "quantity" && from.sortDir === "asc") {
        setMovementSort("qtyAsc");
      } else if (from.sortBy === "quantity" && from.sortDir === "desc") {
        setMovementSort("qtyDesc");
      } else if (from.sortBy === "createdAt" && from.sortDir === "asc") {
        setMovementSort("oldest");
      } else if (from.sortBy === "createdAt" && from.sortDir === "desc") {
        setMovementSort("newest");
      }
      setLedgerSince(from.sinceIso);
      setLedgerUntil(from.untilIso);
      setLedgerLimit(from.limit);
      setLedgerDraftSince(from.sinceIso ? isoToDatetimeLocalValue(from.sinceIso) : "");
      setLedgerDraftUntil(from.untilIso ? isoToDatetimeLocalValue(from.untilIso) : "");
      setLedgerDraftLimit(from.limit);
    });
    lastLedgerUrlNormalized.current = normalizeMovementLedgerQueryString(searchParams);
  }, [section, searchParams]);

  useEffect(() => {
    if (section !== "stock") return;
    const urlSort =
      movementSort === "qtyAsc"
        ? { sortBy: "quantity" as const, sortDir: "asc" as const }
        : movementSort === "qtyDesc"
          ? { sortBy: "quantity" as const, sortDir: "desc" as const }
          : movementSort === "oldest"
            ? { sortBy: "createdAt" as const, sortDir: "asc" as const }
            : movementSort === "newest"
              ? { sortBy: "createdAt" as const, sortDir: "desc" as const }
              : { sortBy: "" as const, sortDir: "" as const };
    const ledgerState = {
      warehouseId: selectedWarehouseId,
      movementType: movementTypeFilter,
      sinceIso: ledgerSince,
      untilIso: ledgerUntil,
      limit: ledgerLimit,
      sortBy: urlSort.sortBy,
      sortDir: urlSort.sortDir,
    };
    const desiredNorm = normalizeMovementLedgerQueryString(
      mergeStockLedgerSearchParams(new URLSearchParams(), ledgerState),
    );
    const currentNorm = normalizeMovementLedgerQueryString(searchParams);
    if (desiredNorm === currentNorm) {
      lastLedgerUrlNormalized.current = currentNorm;
      return;
    }
    pushingLedgerUrl.current = true;
    lastLedgerUrlNormalized.current = desiredNorm;
    const merged = mergeStockLedgerSearchParams(new URLSearchParams(searchParams.toString()), ledgerState);
    const qs = merged.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    section,
    pathname,
    router,
    searchParams,
    selectedWarehouseId,
    movementTypeFilter,
    movementSort,
    ledgerSince,
    ledgerUntil,
    ledgerLimit,
  ]);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (section === "stock") {
        if (selectedWarehouseId) params.set("mvWarehouse", selectedWarehouseId);
        if (movementTypeFilter) params.set("mvType", movementTypeFilter);
        if (ledgerSince) params.set("mvSince", ledgerSince);
        if (ledgerUntil) params.set("mvUntil", ledgerUntil);
        if (ledgerLimit) params.set("mvLimit", ledgerLimit);
        if (movementSort === "qtyAsc") {
          params.set("mvSort", "quantity");
          params.set("mvDir", "asc");
        } else if (movementSort === "qtyDesc") {
          params.set("mvSort", "quantity");
          params.set("mvDir", "desc");
        } else if (movementSort === "oldest") {
          params.set("mvSort", "createdAt");
          params.set("mvDir", "asc");
        } else if (movementSort === "newest") {
          params.set("mvSort", "createdAt");
          params.set("mvDir", "desc");
        }
      }
      const url = params.toString() ? `/api/wms?${params.toString()}` : "/api/wms";
      const res = await fetch(url, { cache: "no-store" });
      const parsed: unknown = await res.json();
      if (!res.ok) {
        setError(apiClientErrorMessage(parsed, "Could not load WMS."));
        return;
      }
      const payload = parsed as WmsData;
      setData(payload);
      setLastRefreshedAt(new Date().toISOString());
      setSelectedWarehouseId((prev) => {
        if (section === "stock") {
          if (prev) return prev;
          if (stockWarehouseDefaultApplied.current) return prev;
          const demoWh = payload.warehouses.find((w) => w.code === WMS_DEMO_WAREHOUSE_CODE);
          if (!demoWh) return prev;
          stockWarehouseDefaultApplied.current = true;
          return demoWh.id;
        }
        if (!prev && payload.warehouses[0]) {
          return payload.warehouses[0].id;
        }
        return prev;
      });
    } catch {
      setError("Could not load WMS.");
    } finally {
      setIsRefreshing(false);
    }
  }, [
    section,
    selectedWarehouseId,
    movementTypeFilter,
    movementSort,
    ledgerSince,
    ledgerUntil,
    ledgerLimit,
  ]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!data) return;
    startTransition(() => {
      const next: Record<string, { asn: string; expectedReceiveAt: string }> = {};
      for (const s of data.inboundShipments) {
        next[s.id] = {
          asn: s.asnReference ?? "",
          expectedReceiveAt: s.expectedReceiveAt
            ? s.expectedReceiveAt.slice(0, 16)
            : "",
        };
      }
      setInboundEdits(next);
    });
  }, [data]);

  useEffect(() => {
    if (!data) return;
    startTransition(() => {
      const next: Record<string, { asn: string; requestedShip: string }> = {};
      for (const o of data.outboundOrders) {
        next[o.id] = {
          asn: o.asnReference ?? "",
          requestedShip: o.requestedShipDate ? o.requestedShipDate.slice(0, 16) : "",
        };
      }
      setOutboundAsnEdits(next);
    });
  }, [data]);

  const binsForWarehouse = useMemo(
    () => (data?.bins ?? []).filter((b) => b.warehouse.id === selectedWarehouseId),
    [data?.bins, selectedWarehouseId],
  );
  const zonesForWarehouse = useMemo(
    () => (data?.zones ?? []).filter((z) => z.warehouse.id === selectedWarehouseId),
    [data?.zones, selectedWarehouseId],
  );
  const replenishmentRulesForWarehouse = useMemo(
    () =>
      (data?.replenishmentRules ?? []).filter((r) => r.warehouse.id === selectedWarehouseId),
    [data?.replenishmentRules, selectedWarehouseId],
  );

  const rackCodesForSetup = useMemo(() => {
    const s = new Set<string>();
    for (const b of binsForWarehouse) {
      const c = b.rackCode?.trim();
      if (c) s.add(c);
    }
    return [...s].sort();
  }, [binsForWarehouse]);

  const balancesForWarehouseOps = useMemo(
    () =>
      (data?.balances ?? []).filter(
        (b) => !selectedWarehouseId || b.warehouse.id === selectedWarehouseId,
      ),
    [data?.balances, selectedWarehouseId],
  );

  const workOrdersForWarehouse = useMemo(
    () =>
      (data?.workOrders ?? []).filter(
        (wo) => !selectedWarehouseId || wo.warehouse.id === selectedWarehouseId,
      ),
    [data?.workOrders, selectedWarehouseId],
  );

  const balanceLinesByBinId = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const row of balancesForWarehouseOps) {
      if (Number(row.onHandQty) <= 0) continue;
      const id = row.bin.id;
      const line = `${row.product.sku || row.product.productCode || "?"}: ${row.onHandQty}`;
      const arr = m.get(id) ?? [];
      arr.push(line);
      m.set(id, arr);
    }
    return m;
  }, [balancesForWarehouseOps]);

  const rackMapModel = useMemo(() => {
    const code = rackVizCode.trim();
    if (!code) return null;
    const inRack = binsForWarehouse.filter((b) => (b.rackCode?.trim() || "") === code);
    const placed = inRack.filter((b) => b.level != null && b.positionIndex != null);
    const unplaced = inRack.filter((b) => b.level == null || b.positionIndex == null);
    if (placed.length === 0) {
      return { code, grid: null as { levels: number; positions: number; cellByKey: Map<string, (typeof binsForWarehouse)[0]> } | null, unplaced };
    }
    const levels = Math.max(...placed.map((b) => b.level!));
    const positions = Math.max(...placed.map((b) => b.positionIndex!));
    const cellByKey = new Map<string, (typeof binsForWarehouse)[0]>();
    for (const b of placed) {
      cellByKey.set(`${b.level}-${b.positionIndex}`, b);
    }
    return { code, grid: { levels, positions, cellByKey }, unplaced };
  }, [rackVizCode, binsForWarehouse]);

  const balancesShown = useMemo(() => {
    const rows = data?.balances ?? [];
    const byWarehouse =
      section !== "stock" || !selectedWarehouseId ? rows : rows.filter((b) => b.warehouse.id === selectedWarehouseId);
    return onHoldOnly ? byWarehouse.filter((b) => b.onHold) : byWarehouse;
  }, [data?.balances, onHoldOnly, section, selectedWarehouseId]);

  const lotBatchProductOptions = useMemo(() => {
    const rows = data?.balances ?? [];
    return Array.from(new Map(rows.map((b) => [b.product.id, b.product] as const)).values());
  }, [data?.balances]);

  const tasksShown = useMemo(() => {
    const rows = data?.openTasks ?? [];
    if (!openTaskTypeFilter) return rows;
    return rows.filter((t) => t.taskType === openTaskTypeFilter);
  }, [data?.openTasks, openTaskTypeFilter]);

  const balancesTableRows = useMemo(() => {
    const q = balanceTextFilter.trim().toLowerCase();
    if (!q) return balancesShown;
    return balancesShown.filter((b) => {
      const pcode = (b.product.productCode || "").toLowerCase();
      const sku = (b.product.sku || "").toLowerCase();
      const name = b.product.name.toLowerCase();
      const bin = b.bin.code.toLowerCase();
      const lot = (b.lotCode || "").toLowerCase();
      return pcode.includes(q) || sku.includes(q) || name.includes(q) || bin.includes(q) || lot.includes(q);
    });
  }, [balancesShown, balanceTextFilter]);

  const sortedMovementsShown = useMemo(() => {
    const rows = [...(data?.recentMovements ?? [])];
    if (movementSort === "newest") {
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (movementSort === "oldest") {
      rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (movementSort === "type") {
      rows.sort((a, b) => a.movementType.localeCompare(b.movementType));
    } else if (movementSort === "qtyAsc") {
      rows.sort((a, b) => Number(a.quantity) - Number(b.quantity));
    } else {
      rows.sort((a, b) => Number(b.quantity) - Number(a.quantity));
    }
    return rows;
  }, [data?.recentMovements, movementSort]);

  const sortedBalancesTableRows = useMemo(() => {
    const rows = [...balancesTableRows];
    if (balanceSort === "product") {
      rows.sort((a, b) =>
        `${a.product.productCode || a.product.sku || ""}${a.product.name}`.localeCompare(
          `${b.product.productCode || b.product.sku || ""}${b.product.name}`,
        ),
      );
    } else if (balanceSort === "availableAsc") {
      rows.sort((a, b) => Number(a.availableQty) - Number(b.availableQty));
    } else if (balanceSort === "availableDesc") {
      rows.sort((a, b) => Number(b.availableQty) - Number(a.availableQty));
    } else {
      rows.sort((a, b) => a.bin.code.localeCompare(b.bin.code));
    }
    return rows;
  }, [balanceSort, balancesTableRows]);

  const loadSavedViews = useCallback(async () => {
    if (section !== "stock") return;
    setSavedViewsLoading(true);
    setSavedViewsError(null);
    try {
      const res = await fetch("/api/wms/saved-ledger-views", { cache: "no-store" });
      const payload = (await res.json()) as
        | { items?: SavedLedgerView[]; views?: SavedLedgerView[]; error?: string }
        | SavedLedgerView[];
      if (!res.ok) {
        setSavedViewsError(
          (typeof payload === "object" && payload && "error" in payload && payload.error) ||
            "Could not load saved views.",
        );
        return;
      }
      if (Array.isArray(payload)) {
        setSavedViews(payload);
      } else {
        setSavedViews(payload.items ?? payload.views ?? []);
      }
    } catch {
      setSavedViewsError("Could not load saved views.");
    } finally {
      setSavedViewsLoading(false);
    }
  }, [section]);

  useEffect(() => {
    if (section !== "stock") return;
    startTransition(() => {
      void loadSavedViews();
    });
  }, [section, loadSavedViews]);

  function applySavedView(view: SavedLedgerView) {
    const filters = view.filters ?? {};
    const warehouseId = typeof filters.warehouseId === "string" ? filters.warehouseId : "";
    const movementType = typeof filters.movementType === "string" ? filters.movementType : "";
    const sinceIso = typeof filters.sinceIso === "string" ? filters.sinceIso : "";
    const untilIso = typeof filters.untilIso === "string" ? filters.untilIso : "";
    const limit = typeof filters.limit === "string" ? filters.limit : "";
    const sortBy = filters.sortBy;
    const sortDir = filters.sortDir;
    if (!warehouseId) stockWarehouseDefaultApplied.current = true;
    setSelectedWarehouseId(warehouseId);
    setMovementTypeFilter(
      movementType as "" | "RECEIPT" | "PUTAWAY" | "PICK" | "ADJUSTMENT" | "SHIPMENT",
    );
    setLedgerSince(sinceIso);
    setLedgerUntil(untilIso);
    setLedgerLimit(limit);
    setLedgerDraftSince(sinceIso ? isoToDatetimeLocalValue(sinceIso) : "");
    setLedgerDraftUntil(untilIso ? isoToDatetimeLocalValue(untilIso) : "");
    setLedgerDraftLimit(limit);
    if (sortBy === "quantity" && sortDir === "asc") {
      setMovementSort("qtyAsc");
    } else if (sortBy === "quantity" && sortDir === "desc") {
      setMovementSort("qtyDesc");
    } else if (sortBy === "createdAt" && sortDir === "asc") {
      setMovementSort("oldest");
    } else {
      setMovementSort("newest");
    }
  }

  async function createSavedView() {
    const trimmed = newSavedViewName.trim();
    if (!trimmed) return;
    setSavedViewsError(null);
    try {
      const urlSort =
        movementSort === "qtyAsc"
          ? { sortBy: "quantity", sortDir: "asc" }
          : movementSort === "qtyDesc"
            ? { sortBy: "quantity", sortDir: "desc" }
            : movementSort === "oldest"
              ? { sortBy: "createdAt", sortDir: "asc" }
              : { sortBy: "createdAt", sortDir: "desc" };
      const body = {
        name: trimmed,
        filters: {
          warehouseId: selectedWarehouseId || null,
          movementType: movementTypeFilter || null,
          sinceIso: ledgerSince || null,
          untilIso: ledgerUntil || null,
          limit: ledgerLimit || null,
          sortBy: urlSort.sortBy,
          sortDir: urlSort.sortDir,
        },
      };
      const res = await fetch("/api/wms/saved-ledger-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed: unknown = await res.json();
      if (!res.ok) {
        setSavedViewsError(apiClientErrorMessage(parsed, "Could not create saved view."));
        return;
      }
      const payload = parsed as { item?: SavedLedgerView };
      setNewSavedViewName("");
      await loadSavedViews();
      if (payload.item?.id) setSelectedSavedViewId(payload.item.id);
    } catch {
      setSavedViewsError("Could not create saved view.");
    }
  }

  async function deleteSavedView(viewId: string) {
    setSavedViewsError(null);
    try {
      const res = await fetch(`/api/wms/saved-ledger-views/${encodeURIComponent(viewId)}`, {
        method: "DELETE",
      });
      const parsed: unknown = await res.json();
      if (!res.ok) {
        setSavedViewsError(apiClientErrorMessage(parsed, "Could not delete saved view."));
        return;
      }
      if (selectedSavedViewId === viewId) setSelectedSavedViewId("");
      await loadSavedViews();
    } catch {
      setSavedViewsError("Could not delete saved view.");
    }
  }

  async function runAction(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed: unknown = await res.json();
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "WMS action failed."));
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

  const wmsDemoDatasetMissing = !data.warehouses.some((w) => w.code === WMS_DEMO_WAREHOUSE_CODE);

  const movementsShown = sortedMovementsShown;
  const movementsMeta = data.recentMovementsMeta;
  const ledgerScopeActive = Boolean(
    selectedWarehouseId || movementTypeFilter || ledgerSince || ledgerUntil || ledgerLimit,
  );
  const ledgerEmptyNoMatch =
    movementsShown.length === 0 && movementsMeta.matchedCount === 0 && ledgerScopeActive;
  const ledgerFilterCount =
    (selectedWarehouseId ? 1 : 0) +
    (movementTypeFilter ? 1 : 0) +
    (ledgerSince ? 1 : 0) +
    (ledgerUntil ? 1 : 0) +
    (ledgerLimit ? 1 : 0);

  const headerTitle =
    section === "setup"
      ? "Warehouse setup"
      : section === "operations"
        ? "Floor operations"
        : "Stock & ledger";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-5">
        <WorkflowHeader
          eyebrow="WMS workspace"
          title={headerTitle}
          description={`${
            section === "setup"
              ? "Zones, bins, and replenishment rules for the selected warehouse."
              : section === "operations"
                ? "Putaway, picking, outbound orders, waves, and open tasks."
                : "On-hand balances and recent inventory ledger rows."
          } Blueprint coverage: docs/wms/GAP_MAP.md.`}
          steps={
            section === "setup"
              ? ["Step 1: Review current layout", "Step 2: Configure zones and bins", "Step 3: Save replenishment rules"]
              : section === "operations"
                ? ["Step 1: Manage inbound/ASN", "Step 2: Execute tasks and waves", "Step 3: Confirm stock updates"]
                : ["Step 1: Filter ledger scope", "Step 2: Review balances", "Step 3: Export stock evidence"]
          }
        />
      </header>
      {error ? (
        <p
          className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}{" "}
          <button
            type="button"
            className="ml-2 inline-flex rounded border border-rose-300 px-2 py-0.5 text-xs font-medium text-rose-800"
            onClick={() => {
              startTransition(() => {
                void load();
              });
            }}
          >
            Retry load
          </button>
        </p>
      ) : null}
      {wmsDemoDatasetMissing ? (
        <p
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          This environment does not have the WMS demo warehouse ({WMS_DEMO_WAREHOUSE_CODE}), so stock and
          operations stay empty even when purchase orders look fine. Run{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">
            USE_DOTENV_LOCAL=1 npm run db:seed:wms-demo
          </code>{" "}
          against the same <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">DATABASE_URL</code>{" "}
          the deployed app uses (for example, match Vercel production env to the Neon branch you seed). Base
          tenant and roles require{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">npm run db:seed</code> first.
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
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") stockWarehouseDefaultApplied.current = true;
                setSelectedWarehouseId(v);
              }}
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
          <p className="w-full text-xs text-zinc-500">
            WMS demo inventory (balances and most ledger rows) lives in{" "}
            <span className="font-medium text-zinc-700">{WMS_DEMO_WAREHOUSE_CODE}</span>. CFS rows in this list
            are mostly empty for stock unless you create balances there. Ledger filters (warehouse, type, dates, row
            cap) sync to the URL so you can bookmark or share an exact view.
          </p>
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
          <div className="w-full">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Quick filters</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {STOCK_LEDGER_MV_TYPE_PRESETS.map((p) => {
                const active = movementTypeFilter === p.value;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      setMovementTypeFilter(
                        p.value as "" | "RECEIPT" | "PUTAWAY" | "PICK" | "ADJUSTMENT" | "SHIPMENT",
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] text-white"
                        : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">From</span>
            <input
              type="datetime-local"
              value={ledgerDraftSince}
              onChange={(e) => setLedgerDraftSince(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">To</span>
            <input
              type="datetime-local"
              value={ledgerDraftUntil}
              onChange={(e) => setLedgerDraftUntil(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">Row cap</span>
            <select
              value={ledgerDraftLimit}
              onChange={(e) => setLedgerDraftLimit(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="">80 (default)</option>
              <option value="120">120</option>
              <option value="200">200</option>
              <option value="300">300</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded border border-arscmp-primary bg-arscmp-primary px-3 py-2 text-sm font-medium text-white"
            onClick={() => {
              const s = ledgerDraftSince.trim();
              const u = ledgerDraftUntil.trim();
              setLedgerSince(s ? new Date(s).toISOString() : "");
              setLedgerUntil(u ? new Date(u).toISOString() : "");
              setLedgerLimit(ledgerDraftLimit.trim());
            }}
          >
            Apply date / cap
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
            onClick={() => {
              setLedgerDraftSince("");
              setLedgerDraftUntil("");
              setLedgerDraftLimit("");
              setLedgerSince("");
              setLedgerUntil("");
              setLedgerLimit("");
            }}
          >
            Clear dates
          </button>
        </div>
      )}

      {section === "setup" ? (
        <>
      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Pick allocation policy</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Controls how <span className="font-medium text-zinc-800">Create pick wave</span> orders bins and
          increments <span className="font-medium">allocatedQty</span>. Individual{" "}
          <span className="font-medium">Create pick task</span> actions always require an explicit bin choice.
          See <span className="font-medium">docs/wms/WMS_ALLOCATION_STRATEGIES.md</span>.
        </p>
        {!selectedWarehouseId ? (
          <p className="mt-3 text-sm text-zinc-500">Select a warehouse above to review or change strategy.</p>
        ) : (
          <div className="mt-3 max-w-xl">
            <label className="block text-xs font-medium text-zinc-600">
              Strategy for{" "}
              <span className="font-semibold text-zinc-800">
                {data.warehouses.find((w) => w.id === selectedWarehouseId)?.code ??
                  data.warehouses.find((w) => w.id === selectedWarehouseId)?.name ??
                  "warehouse"}
              </span>
              <select
                disabled={!canEdit || busy}
                value={
                  data.warehouses.find((w) => w.id === selectedWarehouseId)?.pickAllocationStrategy ??
                  "MAX_AVAILABLE_FIRST"
                }
                onChange={(e) => {
                  const pickAllocationStrategy = e.target.value as
                    | "MAX_AVAILABLE_FIRST"
                    | "FIFO_BY_BIN_CODE"
                    | "FEFO_BY_LOT_EXPIRY"
                    | "MANUAL_ONLY";
                  void runAction({
                    action: "set_warehouse_pick_allocation_strategy",
                    warehouseId: selectedWarehouseId,
                    pickAllocationStrategy,
                  });
                }}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="MAX_AVAILABLE_FIRST">Max available first — prefer bins with most free stock</option>
                <option value="FIFO_BY_BIN_CODE">FIFO by bin code — consume in bin code order</option>
                <option value="FEFO_BY_LOT_EXPIRY">
                  FEFO by lot expiry — automated waves use dated lots first (needs WmsLotBatch + non-fungible balances)
                </option>
                <option value="MANUAL_ONLY">Manual only — automated waves disabled</option>
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Current layout</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Read-only view of zones, bins, and replenishment rules. Bins can carry optional{" "}
          <span className="font-medium text-zinc-700">rack / aisle / bay / level / position</span> for pallet
          racking and pick shelves; use the rack map below once those coordinates are set.
        </p>
        {!selectedWarehouseId ? (
          <p className="mt-3 text-sm text-zinc-500">Select a warehouse above to see its layout.</p>
        ) : (
          <div className="mt-4 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Zones</h3>
              <p className="mt-1 text-xs text-zinc-600">
                BF-04: optional <span className="font-medium">parent zone</span> for hierarchy (same warehouse). Backend rejects cycles.
              </p>
              <div className="mt-2 max-h-48 overflow-auto rounded border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-100 text-left text-xs uppercase text-zinc-700">
                    <tr>
                      <th className="px-2 py-1">Code</th>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Parent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {zonesForWarehouse.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-2 text-zinc-500">
                          No zones for this warehouse.
                        </td>
                      </tr>
                    ) : (
                      [...zonesForWarehouse]
                        .sort((a, b) => a.code.localeCompare(b.code))
                        .map((z) => (
                          <tr key={z.id}>
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-xs">{z.code}</td>
                            <td className="px-2 py-1 text-zinc-800">{z.name}</td>
                            <td className="px-2 py-1 text-zinc-600">{z.zoneType}</td>
                            <td className="px-2 py-1">
                              {canEdit ? (
                                <select
                                  disabled={busy}
                                  value={z.parentZone?.id ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    void runAction({
                                      action: "set_zone_parent",
                                      zoneId: z.id,
                                      parentZoneId: v === "" ? null : v,
                                    });
                                  }}
                                  className="max-w-[11rem] rounded border border-zinc-300 px-1 py-0.5 text-xs"
                                >
                                  <option value="">No parent</option>
                                  {zonesForWarehouse
                                    .filter((c) => c.id !== z.id)
                                    .sort((a, b) => a.code.localeCompare(b.code))
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.code}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <span className="text-xs text-zinc-600">
                                  {z.parentZone ? `${z.parentZone.code}` : "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Bins ({binsForWarehouse.length})
              </h3>
              <div className="mt-2 max-h-72 overflow-auto rounded border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-100 text-left text-xs uppercase text-zinc-700">
                    <tr>
                      <th className="px-2 py-1">Code</th>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Zone</th>
                      <th className="px-2 py-1">Storage</th>
                      <th className="px-2 py-1">Pick face</th>
                      <th className="px-2 py-1">Max pal.</th>
                      <th className="px-2 py-1">Rack</th>
                      <th className="px-2 py-1">Aisle</th>
                      <th className="px-2 py-1">Bay</th>
                      <th className="px-2 py-1">Lvl</th>
                      <th className="px-2 py-1">Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {binsForWarehouse.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-2 py-2 text-zinc-500">
                          No bins for this warehouse.
                        </td>
                      </tr>
                    ) : (
                      [...binsForWarehouse]
                        .sort((a, b) => a.code.localeCompare(b.code))
                        .map((b) => (
                          <tr key={b.id}>
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-xs">{b.code}</td>
                            <td className="px-2 py-1 text-zinc-800">{b.name}</td>
                            <td className="px-2 py-1 text-zinc-600">
                              {b.zone ? `${b.zone.code} · ${b.zone.name}` : "—"}
                            </td>
                            <td className="px-2 py-1 text-zinc-600">{b.storageType}</td>
                            <td className="px-2 py-1 text-zinc-600">{b.isPickFace ? "Yes" : "—"}</td>
                            <td className="px-2 py-1 text-zinc-600">
                              {b.maxPallets != null ? String(b.maxPallets) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-xs text-zinc-700">
                              {b.rackCode ?? "—"}
                            </td>
                            <td className="px-2 py-1 text-zinc-600">{b.aisle ?? "—"}</td>
                            <td className="px-2 py-1 text-zinc-600">{b.bay ?? "—"}</td>
                            <td className="px-2 py-1 text-zinc-600">{b.level ?? "—"}</td>
                            <td className="px-2 py-1 text-zinc-600">{b.positionIndex ?? "—"}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rack front map</h3>
              <p className="mt-1 text-xs text-zinc-600">
                Rows are shelf <span className="font-medium">levels</span> (1 = lowest), columns are{" "}
                <span className="font-medium">positions</span> along the rack. Each cell shows the bin and
                on-hand SKUs for this warehouse. Overall rack width/height in metres is not stored yet—use
                zone/bin names or external drawings until we add a dedicated rack record.
              </p>
              {!selectedWarehouseId ? (
                <p className="mt-2 text-sm text-zinc-500">Select a warehouse to use the map.</p>
              ) : rackCodesForSetup.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  No bins have a <span className="font-mono">rackCode</span> yet. Set it (and level + position)
                  when creating bins, or extend the seed later.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                    Rack
                    <select
                      value={rackVizCode}
                      onChange={(e) => setRackVizCode(e.target.value)}
                      className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Choose rack…</option>
                      {rackCodesForSetup.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  {rackMapModel?.grid != null ? (
                    <div className="overflow-auto rounded border border-zinc-200 bg-zinc-50/50 p-2">
                      {(() => {
                        const g = rackMapModel.grid;
                        return (
                      <table className="border-collapse text-left text-xs">
                        <thead>
                          <tr>
                            <th className="border border-zinc-200 bg-zinc-100 px-1.5 py-1 font-normal text-zinc-600">
                              Lvl \ Pos
                            </th>
                            {Array.from({ length: g.positions }, (_, pi) => (
                              <th
                                key={pi}
                                className="min-w-[6.5rem] border border-zinc-200 bg-zinc-100 px-1.5 py-1 text-center font-normal text-zinc-600"
                              >
                                {pi + 1}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: g.levels }, (_, li) => {
                            const level = li + 1;
                            return (
                              <tr key={level}>
                                <td className="border border-zinc-200 bg-zinc-100 px-1.5 py-1 text-center font-medium text-zinc-700">
                                  {level}
                                </td>
                                {Array.from({ length: g.positions }, (_, pi) => {
                                  const pos = pi + 1;
                                  const bin = g.cellByKey.get(`${level}-${pos}`);
                                  const lines = bin ? balanceLinesByBinId.get(bin.id) : undefined;
                                  return (
                                    <td
                                      key={pos}
                                      className="align-top border border-zinc-200 bg-white px-1.5 py-1.5 text-zinc-800"
                                    >
                                      {bin ? (
                                        <>
                                          <div className="font-mono text-[11px] font-semibold text-zinc-900">
                                            {bin.code}
                                          </div>
                                          <div className="mt-0.5 text-[11px] leading-snug text-zinc-600">
                                            {lines?.length
                                              ? lines.slice(0, 4).map((t, i) => (
                                                  <div key={i}>{t}</div>
                                                ))
                                              : "Empty"}
                                          </div>
                                        </>
                                      ) : (
                                        <span className="text-zinc-300">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                        );
                      })()}
                    </div>
                  ) : rackMapModel ? (
                    <p className="text-sm text-amber-900">
                      Rack <span className="font-mono">{rackMapModel.code}</span> has bins, but none define both{" "}
                      <span className="font-medium">level</span> and <span className="font-medium">position</span>{" "}
                      yet—add those on each bin to fill the grid.
                    </p>
                  ) : null}
                  {rackMapModel && rackMapModel.unplaced.length > 0 ? (
                    <p className="text-xs text-zinc-600">
                      Bins on this rack without level/position:{" "}
                      {rackMapModel.unplaced.map((b) => b.code).join(", ")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Replenishment rules ({replenishmentRulesForWarehouse.length})
              </h3>
              <div className="mt-2 max-h-48 overflow-auto rounded border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-100 text-left text-xs uppercase text-zinc-700">
                    <tr>
                      <th className="px-2 py-1">Product</th>
                      <th className="px-2 py-1">Source</th>
                      <th className="px-2 py-1">Target</th>
                      <th className="px-2 py-1">Min / max pick</th>
                      <th className="px-2 py-1">Replenish qty</th>
                      <th className="px-2 py-1">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {replenishmentRulesForWarehouse.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-2 text-zinc-500">
                          No replenishment rules for this warehouse.
                        </td>
                      </tr>
                    ) : (
                      replenishmentRulesForWarehouse.map((r) => (
                        <tr key={r.id} className={r.isActive ? undefined : "bg-zinc-50 text-zinc-500"}>
                          <td className="px-2 py-1">
                            {r.product.productCode || r.product.sku || "—"} · {r.product.name}
                          </td>
                          <td className="px-2 py-1 text-zinc-600">
                            {r.sourceZone ? `${r.sourceZone.code}` : "—"}
                          </td>
                          <td className="px-2 py-1 text-zinc-600">
                            {r.targetZone ? `${r.targetZone.code}` : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 text-zinc-600">
                            {r.minPickQty} / {r.maxPickQty}
                          </td>
                          <td className="px-2 py-1 text-zinc-600">{r.replenishQty}</td>
                          <td className="px-2 py-1 text-zinc-600">{r.isActive ? "Yes" : "No"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

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
          <ActionButton
            variant="secondary"
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
          >
            Create zone
          </ActionButton>
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
          <ActionButton
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() => {
              const levelRaw = newBinLevel.trim();
              const posRaw = newBinPosition.trim();
              const levelNum = levelRaw === "" ? undefined : Number(levelRaw);
              const posNum = posRaw === "" ? undefined : Number(posRaw);
              void runAction({
                action: "create_bin",
                warehouseId: selectedWarehouseId,
                targetZoneId: newBinZoneId || null,
                code: newBinCode,
                name: newBinName,
                storageType: newBinStorageType,
                isPickFace: newBinPickFace,
                rackCode: newBinRackCode.trim() || undefined,
                aisle: newBinAisle.trim() || undefined,
                bay: newBinBay.trim() || undefined,
                level: Number.isFinite(levelNum) ? levelNum : undefined,
                positionIndex: Number.isFinite(posNum) ? posNum : undefined,
              });
            }}
          >
            Create bin
          </ActionButton>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Optional rack addressing (same <span className="font-mono">rackCode</span> on many bins = one
          physical rack). Use positive integers for <span className="font-medium">level</span> and{" "}
          <span className="font-medium">position</span> so the map can place the bin.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          <input
            value={newBinRackCode}
            onChange={(e) => setNewBinRackCode(e.target.value)}
            placeholder="Rack code (e.g. R-A01)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newBinAisle}
            onChange={(e) => setNewBinAisle(e.target.value)}
            placeholder="Aisle"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newBinBay}
            onChange={(e) => setNewBinBay(e.target.value)}
            placeholder="Bay"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newBinLevel}
            onChange={(e) => setNewBinLevel(e.target.value)}
            placeholder="Level (1=…)"
            inputMode="numeric"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newBinPosition}
            onChange={(e) => setNewBinPosition(e.target.value)}
            placeholder="Position (column)"
            inputMode="numeric"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
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
          <ActionButton
            variant="secondary"
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
          >
            Save rule
          </ActionButton>
        </div>
        <div className="mt-2">
          <ActionButton
            variant="secondary"
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() =>
              void runAction({
                action: "create_replenishment_tasks",
                warehouseId: selectedWarehouseId,
              })
            }
          >
            Generate replenishment tasks
          </ActionButton>
          <p className="mt-1 text-xs text-zinc-500">
            <span className="font-medium text-zinc-600">Open tasks</span> labels each REPLENISH as{" "}
            <span className="whitespace-nowrap">source bin → target (pick) bin</span> so the move
            direction is obvious before you complete the task.
          </p>
        </div>
      </section>
        </>
      ) : null}

      {section === "operations" ? (
        <>
      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Inbound / ASN</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Lightweight receiving header on purchase-order shipments: ASN reference, expected receive time,
          WMS receiving workflow states before putaway, and{" "}
          <span className="font-medium">line-level received qty vs shipped (variance disposition)</span> per ASN line.
          Putaway still runs per shipment line below.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Order</th>
                <th className="px-2 py-1">Shipment</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">WMS receiving</th>
                <th className="px-2 py-1">Last milestone</th>
                <th className="px-2 py-1">ASN ref</th>
                <th className="px-2 py-1">Expected</th>
                <th className="px-2 py-1">Lines</th>
                {canEdit ? <th className="px-2 py-1">Dock</th> : null}
                {canEdit ? <th className="px-2 py-1">Log</th> : null}
                {canEdit ? <th className="px-2 py-1">Save</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.inboundShipments.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 11 : 8} className="px-2 py-3 text-zinc-500">
                    No shipments for this tenant yet.
                  </td>
                </tr>
              ) : (
                data.inboundShipments.map((s) => {
                  const draft = inboundEdits[s.id] ?? { asn: "", expectedReceiveAt: "" };
                  const lineColSpan = canEdit ? 11 : 8;
                  return (
                    <Fragment key={s.id}>
                      <tr>
                      <td className="px-2 py-1 font-medium text-zinc-900">{s.orderNumber}</td>
                      <td className="px-2 py-1 text-zinc-700">{s.shipmentNo || s.id.slice(0, 8)}</td>
                      <td className="px-2 py-1 text-zinc-600">{s.status}</td>
                      <td className="px-2 py-1 align-top">
                        <div className="flex min-w-[9rem] flex-col gap-1">
                          <span className="text-xs font-medium text-zinc-800">
                            {WMS_RECEIVE_STATUS_LABEL[s.wmsReceiveStatus]}
                          </span>
                          {s.wmsReceiveUpdatedAt ? (
                            <span className="text-[10px] leading-snug text-zinc-500">
                              {s.wmsReceiveUpdatedBy?.name ?? "—"} ·{" "}
                              {new Date(s.wmsReceiveUpdatedAt).toLocaleString()}
                            </span>
                          ) : null}
                          {s.wmsReceiveNote ? (
                            <span className="text-[10px] leading-snug text-zinc-600" title={s.wmsReceiveNote}>
                              {s.wmsReceiveNote.length > 80
                                ? `${s.wmsReceiveNote.slice(0, 80)}…`
                                : s.wmsReceiveNote}
                            </span>
                          ) : null}
                          {canEdit && s.allowedReceiveActions.length > 0 ? (
                            <select
                              defaultValue=""
                              disabled={busy}
                              onChange={(e) => {
                                const toStatus = e.target.value as WmsReceiveStatus;
                                e.target.value = "";
                                if (!toStatus) return;
                                void runAction({
                                  action: "set_wms_receiving_status",
                                  shipmentId: s.id,
                                  toStatus,
                                });
                              }}
                              className="rounded border border-zinc-300 px-1 py-1 text-[11px]"
                            >
                              <option value="">Advance receiving…</option>
                              {s.allowedReceiveActions.map((code) => (
                                <option key={code} value={code}>
                                  → {WMS_RECEIVE_STATUS_LABEL[code]}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </td>
                      <td className="max-w-[10rem] truncate px-2 py-1 text-xs text-zinc-600" title={s.latestMilestone?.code ?? ""}>
                        {s.latestMilestone
                          ? `${s.latestMilestone.code}${s.latestMilestone.actualAt ? " ✓" : ""}`
                          : "—"}
                      </td>
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <input
                            value={draft.asn}
                            onChange={(e) =>
                              setInboundEdits((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, asn: e.target.value },
                              }))
                            }
                            className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs"
                            placeholder="ASN / notice #"
                          />
                        ) : (
                          <span className="text-zinc-700">{s.asnReference || "—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <input
                            type="datetime-local"
                            value={draft.expectedReceiveAt}
                            onChange={(e) =>
                              setInboundEdits((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, expectedReceiveAt: e.target.value },
                              }))
                            }
                            className="rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        ) : (
                          <span className="text-zinc-600">
                            {s.expectedReceiveAt
                              ? new Date(s.expectedReceiveAt).toLocaleString()
                              : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-zinc-600">{s.itemCount}</td>
                      {canEdit ? (
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            disabled={busy || !selectedWarehouseId}
                            title={
                              !selectedWarehouseId
                                ? "Choose an operations warehouse in the toolbar first."
                                : "Prefill dock form for this inbound shipment"
                            }
                            onClick={() => {
                              setDockShipmentLink(s.id);
                              setDockOutboundLink("");
                              setDockDir("INBOUND");
                            }}
                            className="whitespace-nowrap rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
                          >
                            Schedule dock
                          </button>
                        </td>
                      ) : null}
                      {canEdit ? (
                        <td className="px-2 py-1">
                          <select
                            defaultValue=""
                            disabled={busy}
                            onChange={(e) => {
                              const code = e.target.value;
                              e.target.value = "";
                              if (!code) return;
                              void runAction({
                                action: "record_shipment_milestone",
                                shipmentId: s.id,
                                milestoneCode: code,
                              });
                            }}
                            className="max-w-[11rem] rounded border border-zinc-300 px-1 py-1 text-xs"
                          >
                            <option value="">Log milestone…</option>
                            {INBOUND_MILESTONE_LOG_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      {canEdit ? (
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runAction({
                                action: "set_shipment_inbound_fields",
                                shipmentId: s.id,
                                asnReference: draft.asn.trim() || null,
                                expectedReceiveAt: draft.expectedReceiveAt.trim()
                                  ? new Date(draft.expectedReceiveAt).toISOString()
                                  : null,
                              })
                            }
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                          >
                            Save
                          </button>
                        </td>
                      ) : null}
                    </tr>
                    {s.receiveLines.length > 0 ? (
                      <tr className="bg-zinc-50/90">
                        <td colSpan={lineColSpan} className="px-2 py-3 align-top">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            Line receiving / variance (BF-01)
                          </p>
                          <p className="mt-0.5 max-w-3xl text-[11px] text-zinc-600">
                            <span className="font-medium">Expected</span> = shipped qty on the shipment line;
                            record physical <span className="font-medium">received</span>. Leave disposition on{" "}
                            <span className="font-medium">Auto</span> to derive Match / Short / Over vs expected.
                          </p>
                          <div className="mt-2 overflow-x-auto">
                            <table className="min-w-[720px] w-full border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-zinc-200 bg-zinc-100 text-left text-[10px] uppercase text-zinc-600">
                                  <th className="px-2 py-1">Ln</th>
                                  <th className="px-2 py-1">Description</th>
                                  <th className="px-2 py-1">Expected</th>
                                  <th className="px-2 py-1">Received</th>
                                  <th className="px-2 py-1">Recorded</th>
                                  <th className="px-2 py-1">Disposition</th>
                                  <th className="px-2 py-1">Note</th>
                                  {canEdit ? <th className="px-2 py-1"> </th> : null}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {s.receiveLines.map((line) => (
                                  <tr key={line.shipmentItemId}>
                                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-zinc-800">
                                      {line.lineNo}
                                    </td>
                                    <td className="max-w-[10rem] truncate px-2 py-1.5 text-zinc-700" title={line.description ?? ""}>
                                      {line.description ?? "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-zinc-800">
                                      {line.quantityShipped}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {canEdit ? (
                                        <input
                                          key={`recv-${line.shipmentItemId}-${line.quantityReceived}`}
                                          id={`inbound-recv-${line.shipmentItemId}`}
                                          type="number"
                                          min={0}
                                          step="0.001"
                                          defaultValue={line.quantityReceived}
                                          disabled={busy}
                                          className="w-24 rounded border border-zinc-300 px-1.5 py-1 tabular-nums"
                                        />
                                      ) : (
                                        <span className="tabular-nums text-zinc-800">{line.quantityReceived}</span>
                                      )}
                                    </td>
                                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700">
                                      {RECEIPT_LINE_VARIANCE_LABEL[line.wmsVarianceDisposition]}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {canEdit ? (
                                        <select
                                          key={`disp-${line.shipmentItemId}-${line.wmsVarianceDisposition}`}
                                          id={`inbound-disp-${line.shipmentItemId}`}
                                          defaultValue={
                                            line.wmsVarianceDisposition === "UNSET" ? "" : line.wmsVarianceDisposition
                                          }
                                          disabled={busy}
                                          className="max-w-[9rem] rounded border border-zinc-300 px-1 py-1 text-[11px]"
                                        >
                                          <option value="">Auto</option>
                                          <option value="MATCH">Match</option>
                                          <option value="SHORT">Short</option>
                                          <option value="OVER">Over</option>
                                          <option value="DAMAGED">Damaged</option>
                                          <option value="OTHER">Other</option>
                                        </select>
                                      ) : (
                                        <span className="text-zinc-600">
                                          {line.wmsVarianceDisposition === "UNSET"
                                            ? "—"
                                            : RECEIPT_LINE_VARIANCE_LABEL[line.wmsVarianceDisposition]}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {canEdit ? (
                                        <input
                                          key={`note-${line.shipmentItemId}-${line.wmsVarianceNote ?? ""}`}
                                          id={`inbound-note-${line.shipmentItemId}`}
                                          type="text"
                                          defaultValue={line.wmsVarianceNote ?? ""}
                                          disabled={busy}
                                          placeholder="Variance note"
                                          className="w-full min-w-[8rem] max-w-[14rem] rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                                        />
                                      ) : (
                                        <span className="text-zinc-600">{line.wmsVarianceNote || "—"}</span>
                                      )}
                                    </td>
                                    {canEdit ? (
                                      <td className="whitespace-nowrap px-2 py-1.5">
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => {
                                            const recvEl = document.getElementById(
                                              `inbound-recv-${line.shipmentItemId}`,
                                            ) as HTMLInputElement | null;
                                            const dispEl = document.getElementById(
                                              `inbound-disp-${line.shipmentItemId}`,
                                            ) as HTMLSelectElement | null;
                                            const noteEl = document.getElementById(
                                              `inbound-note-${line.shipmentItemId}`,
                                            ) as HTMLInputElement | null;
                                            const rawRecv = recvEl?.value?.trim() ?? "";
                                            const receivedQty = Number.parseFloat(rawRecv);
                                            if (!Number.isFinite(receivedQty) || receivedQty < 0) {
                                              return;
                                            }
                                            const vd = dispEl?.value?.trim() ?? "";
                                            void runAction({
                                              action: "set_shipment_item_receive_line",
                                              shipmentItemId: line.shipmentItemId,
                                              receivedQty,
                                              varianceDisposition: vd === "" ? undefined : vd,
                                              varianceNote: noteEl?.value ?? "",
                                            });
                                          }}
                                          className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                                        >
                                          Save line
                                        </button>
                                      </td>
                                    ) : null}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Dock appointments</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Book a dock window per warehouse and dock code. Conflicts are blocked when another{" "}
          <span className="font-medium">SCHEDULED</span> appointment overlaps the same dock. This is an
          ops calendar slice — not full TMS or carrier routing.
        </p>
        <div className="mt-3 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-medium text-zinc-600">
            Dock code
            <input
              value={dockCodeInput}
              onChange={(e) => setDockCodeInput(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. DOCK-A"
              disabled={!canEdit}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Direction
            <select
              value={dockDir}
              onChange={(e) => setDockDir(e.target.value as "INBOUND" | "OUTBOUND")}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              disabled={!canEdit}
            >
              <option value="INBOUND">Inbound (PO shipment)</option>
              <option value="OUTBOUND">Outbound order</option>
            </select>
          </label>
          <p className="text-xs text-zinc-600 sm:col-span-2 lg:col-span-1">
            <span className="font-medium text-zinc-700">Linked:</span>{" "}
            {dockDir === "INBOUND"
              ? dockShipmentLink
                ? `Shipment row prefilled (${dockShipmentLink.slice(0, 8)}…)`
                : "Use “Schedule dock” on an inbound row or paste flow manually."
              : dockOutboundLink
                ? `Outbound prefilled (${dockOutboundLink.slice(0, 8)}…)`
                : "Use “Dock window” on an outbound order."}
          </p>
          <label className="block text-xs font-medium text-zinc-600">
            Window start
            <input
              type="datetime-local"
              value={dockWinStart}
              onChange={(e) => setDockWinStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              disabled={!canEdit}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Window end
            <input
              type="datetime-local"
              value={dockWinEnd}
              onChange={(e) => setDockWinEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              disabled={!canEdit}
            />
          </label>
          <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              disabled={
                !canEdit ||
                busy ||
                !selectedWarehouseId ||
                !dockWinStart.trim() ||
                !dockWinEnd.trim() ||
                (dockDir === "INBOUND" && !dockShipmentLink) ||
                (dockDir === "OUTBOUND" && !dockOutboundLink)
              }
              onClick={() => {
                if (!selectedWarehouseId || !dockWinStart.trim() || !dockWinEnd.trim()) return;
                const body: Record<string, unknown> = {
                  action: "create_dock_appointment",
                  warehouseId: selectedWarehouseId,
                  dockCode: dockCodeInput || "DOCK-A",
                  dockDirection: dockDir,
                  dockWindowStart: new Date(dockWinStart).toISOString(),
                  dockWindowEnd: new Date(dockWinEnd).toISOString(),
                };
                if (dockDir === "INBOUND") body.shipmentId = dockShipmentLink;
                if (dockDir === "OUTBOUND") body.outboundOrderId = dockOutboundLink;
                void runAction(body);
              }}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Schedule dock window
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Warehouse</th>
                <th className="px-2 py-1">Dock</th>
                <th className="px-2 py-1">Window</th>
                <th className="px-2 py-1">Dir</th>
                <th className="px-2 py-1">Ref</th>
                <th className="px-2 py-1">Status</th>
                {canEdit ? <th className="px-2 py-1"> </th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {(data.dockAppointments ?? []).filter(
                (a) => !selectedWarehouseId || a.warehouse.id === selectedWarehouseId,
              ).length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-2 py-3 text-zinc-500">
                    No dock appointments
                    {selectedWarehouseId ? " for this warehouse" : ""} yet.
                  </td>
                </tr>
              ) : (
                (data.dockAppointments ?? [])
                  .filter((a) => !selectedWarehouseId || a.warehouse.id === selectedWarehouseId)
                  .map((a) => (
                    <tr key={a.id}>
                      <td className="px-2 py-1 text-zinc-800">
                        {a.warehouse.code || a.warehouse.name}
                      </td>
                      <td className="px-2 py-1 font-mono text-xs text-zinc-700">{a.dockCode}</td>
                      <td className="px-2 py-1 text-xs text-zinc-700">
                        {new Date(a.windowStart).toLocaleString()} →{" "}
                        {new Date(a.windowEnd).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-zinc-600">{a.direction}</td>
                      <td className="px-2 py-1 text-xs text-zinc-700">
                        {a.shipment
                          ? `${a.shipment.orderNumber} · ${a.shipment.shipmentNo ?? a.shipment.id.slice(0, 8)}`
                          : a.outboundNo
                            ? `Outbound ${a.outboundNo}`
                            : "—"}
                      </td>
                      <td className="px-2 py-1 text-zinc-600">{a.status}</td>
                      {canEdit && a.status === "SCHEDULED" ? (
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runAction({
                                action: "cancel_dock_appointment",
                                dockAppointmentId: a.id,
                              })
                            }
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        </td>
                      ) : canEdit ? (
                        <td className="px-2 py-1 text-zinc-400">—</td>
                      ) : null}
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Create putaway task</h2>
        <p className="mt-1 text-xs text-zinc-600">
          When completing putaway, optionally set a <span className="font-medium">lot/batch</span> code to segment stock
          beyond the default fungible bucket (waves still consume fungible stock only).
        </p>
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
        <p className="mt-1 text-xs text-zinc-600">
          Optional <span className="font-medium">lot/batch</span> matches a specific balance row (waves still allocate
          fungible stock only).
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
          <input
            value={pickLotCode}
            onChange={(e) => setPickLotCode(e.target.value)}
            placeholder="Lot/batch (optional)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
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
                lotCode: pickLotCode.trim() ? pickLotCode.trim() : null,
              });
            }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Create pick task
          </button>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h2 className="mt-2 text-sm font-semibold text-zinc-900">Outbound & ship station</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Ship notice (ASN) + CRM mirror inbound patterns; packing gate requires full picks before{" "}
          <span className="font-medium text-zinc-800">Mark packed</span>, then{" "}
          <span className="font-medium text-zinc-800">Mark shipped</span>. Evidence print + audit:{" "}
          <span className="font-medium text-zinc-800">docs/wms/WMS_PACKING_LABELS.md</span>.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 p-3 text-xs text-zinc-700">
            <p className="font-semibold text-zinc-900">Step 1 · Pick</p>
            <p className="mt-1 leading-snug text-zinc-600">
              Waves / explicit pick tasks until each line shows picked qty ≥ order qty.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 p-3 text-xs text-zinc-700">
            <p className="font-semibold text-zinc-900">Step 2 · Pack</p>
            <p className="mt-1 leading-snug text-zinc-600">
              Mark packed copies picked → packed and locks CRM link. Use Print pack slip before carrier handoff.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 p-3 text-xs text-zinc-700">
            <p className="font-semibold text-zinc-900">Step 3 · Ship</p>
            <p className="mt-1 leading-snug text-zinc-600">
              Mark shipped posts shipment movements and closes the order for billing hooks.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Commercial handoff
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-700">
            Phase B billing resolves movements using the outbound&apos;s{" "}
            <span className="font-medium text-zinc-900">crmAccountId</span> (bill-to). Align quotes and accounts in CRM (
            <Link href="/crm/accounts" className="font-medium text-[var(--arscmp-primary)] underline">
              accounts
            </Link>
            ,{" "}
            <Link href="/crm/quotes" className="font-medium text-[var(--arscmp-primary)] underline">
              quotes
            </Link>
            ). Full quote→outbound automation is deferred —{" "}
            <span className="font-medium text-zinc-900">docs/wms/WMS_COMMERCIAL_HANDOFF.md</span>.
          </p>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
          Create / edit outbound
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-6">
          <input value={outboundRef} onChange={(e) => setOutboundRef(e.target.value)} placeholder="Customer ref" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <select value={outboundProductId} onChange={(e)=>setOutboundProductId(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Product</option>
            {Array.from(new Map(data.balances.map((b)=>[b.product.id,b.product] as const)).values()).map((p)=>(
              <option key={p.id} value={p.id}>{p.productCode || p.sku || "SKU"} · {p.name}</option>
            ))}
          </select>
          <input value={outboundLineQty} onChange={(e)=>setOutboundLineQty(e.target.value)} placeholder="Qty" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          <input
            value={outboundCreateAsn}
            onChange={(e) => setOutboundCreateAsn(e.target.value)}
            placeholder="ASN / notice # (opt)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={outboundCreateRequestedShip}
            onChange={(e) => setOutboundCreateRequestedShip(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            title="Requested ship (optional)"
          />
        </div>
        {data.crmAccountOptions.length > 0 ? (
          <div className="mt-2">
            <label className="block text-xs font-medium text-zinc-600">CRM account (optional)</label>
            <select
              value={outboundCrmAccountId}
              onChange={(e) => setOutboundCrmAccountId(e.target.value)}
              className="mt-1 w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm sm:w-auto"
            >
              <option value="">None</option>
              {data.crmAccountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.legalName && a.legalName !== a.name ? ` (${a.legalName})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="mt-2">
          <button
            type="button"
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() => {
              const body: Record<string, unknown> = {
                action: "create_outbound_order",
                warehouseId: selectedWarehouseId,
                customerRef: outboundRef,
                crmAccountId: outboundCrmAccountId.trim() || null,
                lines: outboundProductId
                  ? [{ productId: outboundProductId, quantity: Number(outboundLineQty) }]
                  : [],
              };
              if (outboundCreateAsn.trim()) body.asnReference = outboundCreateAsn.trim();
              if (outboundCreateRequestedShip.trim()) {
                body.requestedShipDate = new Date(outboundCreateRequestedShip).toISOString();
              }
              void runAction(body);
            }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Create outbound order
          </button>
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Open orders</p>
        <div className="mt-2 space-y-2">
          {data.outboundOrders.map((o) => {
            const showCrmPicker =
              canEdit &&
              data.crmAccountOptions.length > 0 &&
              o.status !== "SHIPPED" &&
              o.status !== "CANCELLED" &&
              o.status !== "PACKED";
            const showOutboundAsnEditor =
              canEdit &&
              o.status !== "SHIPPED" &&
              o.status !== "CANCELLED" &&
              o.status !== "PACKED";
            const asnDraft = outboundAsnEdits[o.id] ?? { asn: "", requestedShip: "" };
            const allPicked = o.lines.every((l) => Number(l.pickedQty) >= Number(l.quantity));
            const allPacked = o.lines.every((l) => Number(l.packedQty) >= Number(l.quantity));
            const canPrintPackSlip =
              allPicked &&
              o.lines.length > 0 &&
              o.status !== "DRAFT" &&
              o.status !== "CANCELLED";
            return (
            <div key={o.id} className="rounded border border-zinc-200 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">{o.outboundNo}</span>
                <span className="text-zinc-600">{o.status}</span>
                <span className="text-zinc-500">{o.customerRef || "No ref"}</span>
                {o.crmAccount && !showCrmPicker ? (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                    CRM: {o.crmAccount.name}
                  </span>
                ) : null}
                {showCrmPicker ? (
                  <select
                    value={o.crmAccount?.id ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      const v = e.target.value;
                      void runAction({
                        action: "set_outbound_crm_account",
                        outboundOrderId: o.id,
                        crmAccountId: v.trim() ? v : null,
                      });
                    }}
                    className="ml-auto min-w-[10rem] rounded border border-zinc-300 px-2 py-1 text-xs"
                  >
                    <option value="">CRM: none</option>
                    {data.crmAccountOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {canPrintPackSlip ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      printOutboundPackSlip({
                        outboundNo: o.outboundNo,
                        warehouseLabel: o.warehouse.code || o.warehouse.name,
                        customerRef: o.customerRef,
                        asnReference: o.asnReference,
                        requestedShipDate: o.requestedShipDate,
                        shipToName: o.shipToName,
                        shipToCity: o.shipToCity,
                        shipToCountryCode: o.shipToCountryCode,
                        status: o.status,
                        lines: o.lines.map((l) => ({
                          lineNo: l.lineNo,
                          productCode: l.product.productCode,
                          sku: l.product.sku,
                          name: l.product.name,
                          quantity: l.quantity,
                          pickedQty: l.pickedQty,
                          packedQty: l.packedQty,
                        })),
                      })
                    }
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Print pack slip
                  </button>
                ) : null}
                {canEdit && o.status !== "SHIPPED" && o.status !== "CANCELLED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDockOutboundLink(o.id);
                      setDockShipmentLink("");
                      setDockDir("OUTBOUND");
                      setSelectedWarehouseId(o.warehouse.id);
                    }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Dock window
                  </button>
                ) : null}
                {canEdit && o.status === "DRAFT" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction({ action: "release_outbound_order", outboundOrderId: o.id })}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Release
                  </button>
                ) : null}
                {canEdit && (o.status === "RELEASED" || o.status === "PICKING") && allPicked ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction({ action: "mark_outbound_packed", outboundOrderId: o.id })
                    }
                    className="rounded border border-amber-600 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 disabled:opacity-40"
                  >
                    Mark packed
                  </button>
                ) : null}
                {canEdit && o.status === "PACKED" && allPacked ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction({ action: "mark_outbound_shipped", outboundOrderId: o.id })
                    }
                    className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Mark shipped
                  </button>
                ) : null}
              </div>
              {showOutboundAsnEditor ? (
                <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-2">
                  <div className="min-w-[8rem]">
                    <p className="text-[10px] font-medium uppercase text-zinc-500">ASN ref</p>
                    <input
                      value={asnDraft.asn}
                      onChange={(e) =>
                        setOutboundAsnEdits((prev) => ({
                          ...prev,
                          [o.id]: { ...asnDraft, asn: e.target.value },
                        }))
                      }
                      placeholder="Ship notice / ASN"
                      className="mt-0.5 w-full min-w-[10rem] rounded border border-zinc-300 px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase text-zinc-500">Requested ship</p>
                    <input
                      type="datetime-local"
                      value={asnDraft.requestedShip}
                      onChange={(e) =>
                        setOutboundAsnEdits((prev) => ({
                          ...prev,
                          [o.id]: { ...asnDraft, requestedShip: e.target.value },
                        }))
                      }
                      className="mt-0.5 rounded border border-zinc-300 px-2 py-1 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction({
                        action: "set_outbound_order_asn_fields",
                        outboundOrderId: o.id,
                        asnReference: asnDraft.asn.trim() || null,
                        requestedShipDate: asnDraft.requestedShip.trim()
                          ? new Date(asnDraft.requestedShip).toISOString()
                          : null,
                      })
                    }
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Save ASN
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">
                  ASN: {o.asnReference || "—"}
                  {o.requestedShipDate
                    ? ` · Req. ship: ${new Date(o.requestedShipDate).toLocaleString()}`
                    : null}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-600">
                {o.lines.map((l) => (
                  <span key={l.id}>
                    L{l.lineNo}: pick {l.pickedQty}/{l.quantity} · pack {l.packedQty}/{l.quantity} · ship{" "}
                    {l.shippedQty}/{l.quantity}
                  </span>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h2 className="mt-2 text-sm font-semibold text-zinc-900">Value-add / work orders</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Warehouse-scoped tickets with <span className="font-medium text-zinc-800">VALUE_ADD</span> tasks.
          Completing a task with material consumption posts an{" "}
          <span className="font-medium text-zinc-800">ADJUSTMENT</span> movement (billing linkage notes in{" "}
          <span className="font-medium text-zinc-800">docs/wms/WMS_VAS_WORK_ORDERS.md</span>).
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Step 1 · Create work order
            </p>
            <label className="mt-2 block">
              <span className="text-[10px] font-medium uppercase text-zinc-500">Title</span>
              <input
                value={vasWoTitle}
                onChange={(e) => setVasWoTitle(e.target.value)}
                placeholder="e.g. Relabel pallet · SKU swap"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-2 block">
              <span className="text-[10px] font-medium uppercase text-zinc-500">Description (optional)</span>
              <input
                value={vasWoDesc}
                onChange={(e) => setVasWoDesc(e.target.value)}
                placeholder="Instructions for the floor"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={!canEdit || busy || !selectedWarehouseId || !vasWoTitle.trim()}
              onClick={() =>
                void runAction({
                  action: "create_work_order",
                  warehouseId: selectedWarehouseId,
                  workOrderTitle: vasWoTitle.trim(),
                  workOrderDescription: vasWoDesc.trim() ? vasWoDesc.trim() : null,
                })
              }
              className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Create work order
            </button>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Step 2 · Add VALUE_ADD step
            </p>
            <label className="mt-2 block">
              <span className="text-[10px] font-medium uppercase text-zinc-500">Work order</span>
              <select
                value={vasTaskWoId}
                onChange={(e) => setVasTaskWoId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Select OPEN / IN_PROGRESS work order</option>
                {workOrdersForWarehouse
                  .filter((wo) => wo.status === "OPEN" || wo.status === "IN_PROGRESS")
                  .map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.workOrderNo} · {wo.title} ({wo.status})
                    </option>
                  ))}
              </select>
            </label>
            <label className="mt-2 block">
              <span className="text-[10px] font-medium uppercase text-zinc-500">
                Consume from balance (optional — omit for labor-only)
              </span>
              <select
                value={vasBalanceLineId}
                onChange={(e) => {
                  setVasBalanceLineId(e.target.value);
                  if (!e.target.value) setVasTaskQty("");
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Labor-only (no stock consumption)</option>
                {balancesForWarehouseOps.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bin.code} · {(b.product.productCode || b.product.sku || "SKU").slice(0, 14)} · on-hand{" "}
                    {b.onHandQty}
                    {b.lotCode ? ` · lot ${b.lotCode}` : ""}
                    {b.onHold ? " · HOLD" : ""}
                  </option>
                ))}
              </select>
            </label>
            {vasBalanceLineId ? (
              <label className="mt-2 block">
                <span className="text-[10px] font-medium uppercase text-zinc-500">Quantity to consume</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={vasTaskQty}
                  onChange={(e) => setVasTaskQty(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
            ) : null}
            <button
              type="button"
              disabled={
                !canEdit ||
                busy ||
                !selectedWarehouseId ||
                !vasTaskWoId ||
                Boolean(vasBalanceLineId && (!vasTaskQty.trim() || Number(vasTaskQty) <= 0))
              }
              onClick={() => {
                const base: Record<string, unknown> = {
                  action: "create_value_add_task",
                  workOrderId: vasTaskWoId,
                };
                if (vasBalanceLineId) {
                  const bal = balancesForWarehouseOps.find((b) => b.id === vasBalanceLineId);
                  if (!bal) return;
                  base.productId = bal.product.id;
                  base.binId = bal.bin.id;
                  base.quantity = Number(vasTaskQty);
                  base.lotCode = bal.lotCode;
                }
                void runAction(base);
              }}
              className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Create VALUE_ADD task
            </button>
          </div>
        </div>
        {workOrdersForWarehouse.length > 0 ? (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Work orders (this warehouse)
            </p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-700">
              {workOrdersForWarehouse.map((wo) => (
                <li key={wo.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="font-medium text-zinc-900">{wo.workOrderNo}</span>
                  <span>{wo.title}</span>
                  <span className="text-zinc-500">{wo.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Wave picking</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Auto-build pick waves from open order demand and current available stock in the selected warehouse,
          using the warehouse&apos;s{" "}
          <span className="font-medium text-zinc-800">pick allocation strategy</span> (Warehouse setup → Pick
          allocation policy).
        </p>
        {selectedWarehouseId &&
        data.warehouses.find((w) => w.id === selectedWarehouseId)?.pickAllocationStrategy === "MANUAL_ONLY" ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            This warehouse is set to <span className="font-semibold">MANUAL_ONLY</span>: automated waves are
            disabled. Use <span className="font-medium">Create pick task</span> with explicit bins instead.
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              !canEdit ||
              busy ||
              !selectedWarehouseId ||
              data.warehouses.find((w) => w.id === selectedWarehouseId)?.pickAllocationStrategy === "MANUAL_ONLY"
            }
            onClick={() =>
              void runAction({
                action: "create_pick_wave",
                warehouseId: selectedWarehouseId,
              })
            }
            className="rounded border border-arscmp-primary bg-arscmp-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
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
                {b.lotCode ? ` · ${b.lotCode}` : ""}
                {Boolean(b.onHold) ? " · HOLD" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canEdit || busy || !selectedWarehouseId || !cycleBalanceId}
            onClick={() => void runAction({ action: "create_cycle_count_task", balanceId: cycleBalanceId })}
            className="rounded border border-arscmp-primary bg-arscmp-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Create cycle count task
          </button>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Open tasks</h2>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            Type
            <select
              value={openTaskTypeFilter}
              onChange={(e) =>
                setOpenTaskTypeFilter(
                  e.target.value as
                    | ""
                    | "PUTAWAY"
                    | "PICK"
                    | "REPLENISH"
                    | "CYCLE_COUNT"
                    | "VALUE_ADD",
                )
              }
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            >
              <option value="">All ({data.openTasks.length})</option>
              <option value="PUTAWAY">
                Putaway ({data.openTasks.filter((t) => t.taskType === "PUTAWAY").length})
              </option>
              <option value="PICK">Pick ({data.openTasks.filter((t) => t.taskType === "PICK").length})</option>
              <option value="REPLENISH">
                Replenish ({data.openTasks.filter((t) => t.taskType === "REPLENISH").length})
              </option>
              <option value="CYCLE_COUNT">
                Cycle count ({data.openTasks.filter((t) => t.taskType === "CYCLE_COUNT").length})
              </option>
              <option value="VALUE_ADD">
                Value-add ({data.openTasks.filter((t) => t.taskType === "VALUE_ADD").length})
              </option>
            </select>
          </label>
        </div>
        <div className="space-y-2 text-sm">
          {data.openTasks.length === 0 ? (
            <p className="text-zinc-500">No open tasks.</p>
          ) : tasksShown.length === 0 ? (
            <p className="text-zinc-500">No tasks match this type filter.</p>
          ) : (
            tasksShown.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 p-2">
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800">
                  {t.taskType}
                </span>
                <span className="text-zinc-700">{t.quantity}</span>
                <span className="text-zinc-700">
                  {t.product?.name ?? (t.taskType === "VALUE_ADD" ? "Labor-only" : "—")}
                </span>
                <span className="text-zinc-500">{t.warehouse.code || t.warehouse.name}</span>
                {t.taskType === "REPLENISH" ? (
                  <span className="text-zinc-500">
                    {t.sourceBin || t.referenceId ? (
                      <>
                        From {t.sourceBin?.code ?? t.referenceId?.slice(0, 8) ?? "?"}
                        {" → "}
                      </>
                    ) : null}
                    To {t.bin?.code ?? "—"}
                  </span>
                ) : t.bin ? (
                  <span className="text-zinc-500">Bin {t.bin.code}</span>
                ) : null}
                {t.taskType === "PICK" && t.lotCode ? (
                  <span className="text-zinc-500">Lot {t.lotCode}</span>
                ) : null}
                {t.taskType === "PUTAWAY" ? (
                  <label className="flex items-center gap-1 text-xs text-zinc-600">
                    Lot (optional)
                    <input
                      value={putawayLotByTaskId[t.id] ?? ""}
                      onChange={(e) =>
                        setPutawayLotByTaskId((m) => ({ ...m, [t.id]: e.target.value }))
                      }
                      placeholder="Batch code"
                      className="w-28 rounded border border-zinc-300 px-1 py-0.5 text-sm"
                    />
                  </label>
                ) : null}
                {t.taskType === "VALUE_ADD" && t.referenceId ? (
                  <span className="text-zinc-500">
                    WO{" "}
                    {data.workOrders.find((w) => w.id === t.referenceId)?.workOrderNo ??
                      t.referenceId.slice(0, 8)}
                  </span>
                ) : null}
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
                  t.taskType === "CYCLE_COUNT" ||
                  t.taskType === "VALUE_ADD") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (t.taskType === "PUTAWAY") {
                        void runAction({
                          action: "complete_putaway_task",
                          taskId: t.id,
                          binId: t.bin?.id ?? null,
                          lotCode:
                            putawayLotByTaskId[t.id]?.trim() ? putawayLotByTaskId[t.id].trim() : null,
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
                      if (t.taskType === "VALUE_ADD") {
                        void runAction({ action: "complete_value_add_task", taskId: t.id });
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
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <h2 className="text-sm font-semibold text-zinc-900">Saved views</h2>
            <p className="mt-1 text-xs text-zinc-600">
              Save ledger filter combinations for faster operational review and repeatable stakeholder walkthroughs.
              {!canEdit ? " Saving and deleting views requires WMS edit access." : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                void loadSavedViews();
              });
            }}
            disabled={savedViewsLoading}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40"
          >
            Refresh list
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto_auto]">
          <select
            value={selectedSavedViewId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedSavedViewId(id);
              if (!id) return;
              const found = savedViews.find((v) => v.id === id);
              if (found) applySavedView(found);
            }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select saved view</option>
            {savedViews.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedSavedViewId}
            onClick={() => {
              const found = savedViews.find((v) => v.id === selectedSavedViewId);
              if (found) applySavedView(found);
            }}
            className="rounded border border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Apply
          </button>
          <button
            type="button"
            disabled={!canEdit || !selectedSavedViewId}
            onClick={() => {
              if (!selectedSavedViewId) return;
              void deleteSavedView(selectedSavedViewId);
            }}
            className="rounded border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto]">
          <input
            value={newSavedViewName}
            onChange={(e) => setNewSavedViewName(e.target.value)}
            placeholder="New view name (e.g. Daily receiving snapshot)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!canEdit || !newSavedViewName.trim()}
            onClick={() => void createSavedView()}
            className="rounded border border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save current filters
          </button>
        </div>
        {savedViewsLoading ? (
          <p className="mt-2 text-xs text-zinc-500">Loading saved views…</p>
        ) : null}
        {savedViews.length === 0 && !savedViewsLoading ? (
          <p className="mt-2 text-xs text-zinc-500">No saved views yet. Save your current filter scope to create one.</p>
        ) : null}
        {savedViewsError ? (
          <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
            {savedViewsError}
          </p>
        ) : null}
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Recent stock movements</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Showing {movementsShown.length} ledger row{movementsShown.length === 1 ? "" : "s"}
              {selectedWarehouseId || movementTypeFilter ? " for the warehouse / type filters above" : ""} (
              {movementsMeta.matchedCount} match{movementsMeta.matchedCount === 1 ? "" : "es"} in the database for this
              scope). Date range and row cap apply after you click{" "}
              <span className="font-medium">Apply date / cap</span>; warehouse and movement type refetch automatically.
              CSV export downloads exactly the rows in the table below.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Active filters: {ledgerFilterCount > 0 ? ledgerFilterCount : "none"} · Sort: {movementSort}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-zinc-600">
              Sort
              <select
                value={movementSort}
                onChange={(e) =>
                  setMovementSort(
                    e.target.value as "newest" | "oldest" | "type" | "qtyDesc" | "qtyAsc",
                  )
                }
                className="ml-1 rounded border border-zinc-300 px-2 py-1 text-xs"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="type">Type A-Z</option>
                <option value="qtyDesc">Qty high-low</option>
                <option value="qtyAsc">Qty low-high</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                stockWarehouseDefaultApplied.current = true;
                setSelectedWarehouseId("");
                setMovementTypeFilter("");
                setMovementSort("newest");
                setLedgerDraftSince("");
                setLedgerDraftUntil("");
                setLedgerDraftLimit("");
                setLedgerSince("");
                setLedgerUntil("");
                setLedgerLimit("");
              }}
              className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800"
              disabled={isRefreshing}
            >
              Reset filters
            </button>
            <button
              type="button"
              disabled={movementsShown.length === 0}
              title="Exports the same rows as the ledger table (current filters and row cap)."
              onClick={() => downloadMovementLedgerCsv(movementsShown)}
              className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40"
            >
              Export CSV
            </button>
          </div>
        </div>
        {lastRefreshedAt ? (
          <p className="mb-2 text-xs text-zinc-500">
            Last refreshed: {new Date(lastRefreshedAt).toLocaleString()}
          </p>
        ) : null}
        {isRefreshing ? (
          <p className="mb-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900" role="status">
            Refreshing stock ledger view…
          </p>
        ) : null}
        {movementsMeta.truncated ? (
          <p
            className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
            role="status"
          >
            Results are capped at {movementsMeta.limit} rows; {movementsMeta.matchedCount} movements match this scope.
            Narrow the date range, add filters, or raise the row cap to reduce truncation.
          </p>
        ) : null}
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
                    {ledgerEmptyNoMatch
                      ? "No movements match these filters. Reset filters or broaden date range."
                      : "No movements yet in this view."}
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

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Workflow</p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-900">Lot / batch master (BF-02)</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Register expiry, country of origin, and notes per SKU + batch code. Uses the same{" "}
            <span className="font-medium">lotCode</span> string as putaway / picks. Per-unit serial genealogy remains
            backlog.
          </p>
        </div>
        <div className="grid gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Product
            <select
              value={lotBatchProductId}
              onChange={(e) => setLotBatchProductId(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
            >
              <option value="">Select SKU…</option>
              {lotBatchProductOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productCode || p.sku || "SKU"} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Lot / batch code
            <input
              value={lotBatchCode}
              onChange={(e) => setLotBatchCode(e.target.value)}
              placeholder="Non-empty batch id"
              className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Expiry date
            <input
              type="date"
              value={lotBatchExpiry}
              onChange={(e) => setLotBatchExpiry(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Country / region
            <input
              value={lotBatchCountry}
              onChange={(e) => setLotBatchCountry(e.target.value)}
              placeholder="e.g. US, CN"
              className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600 sm:col-span-2 lg:col-span-3">
            Notes
            <input
              value={lotBatchNotes}
              onChange={(e) => setLotBatchNotes(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {canEdit ? (
            <button
              type="button"
              disabled={busy || !lotBatchProductId || !lotBatchCode.trim()}
              onClick={() =>
                void runAction({
                  action: "set_wms_lot_batch",
                  productId: lotBatchProductId,
                  lotCode: lotBatchCode.trim(),
                  batchExpiryDate: lotBatchExpiry.trim() || null,
                  batchCountryOfOrigin: lotBatchCountry.trim() || null,
                  batchNotes: lotBatchNotes.trim() || null,
                })
              }
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Save lot batch
            </button>
          ) : (
            <p className="text-xs text-zinc-500">WMS edit access required to save lot batches.</p>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1">Lot</th>
                <th className="px-2 py-1">Expiry</th>
                <th className="px-2 py-1">Origin</th>
                <th className="px-2 py-1">Notes</th>
                <th className="px-2 py-1">Updated</th>
                <th className="px-2 py-1"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {(data?.lotBatches ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-xs text-zinc-500">
                    No lot batches registered yet. Saving above creates or updates a row for that SKU + lot code.
                  </td>
                </tr>
              ) : (
                (data?.lotBatches ?? []).map((lb) => (
                  <tr key={lb.id}>
                    <td className="px-2 py-1">
                      {lb.product.productCode || lb.product.sku || "—"} · {lb.product.name}
                    </td>
                    <td className="px-2 py-1 font-mono text-xs">{lb.lotCode}</td>
                    <td className="px-2 py-1 text-xs">{lb.expiryDate ?? "—"}</td>
                    <td className="px-2 py-1 text-xs">{lb.countryOfOrigin ?? "—"}</td>
                    <td className="max-w-[12rem] truncate px-2 py-1 text-xs text-zinc-600" title={lb.notes ?? ""}>
                      {lb.notes ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-xs text-zinc-500">
                      {new Date(lb.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800"
                          onClick={() => {
                            setLotBatchProductId(lb.productId);
                            setLotBatchCode(lb.lotCode);
                            setLotBatchExpiry(lb.expiryDate ?? "");
                            setLotBatchCountry(lb.countryOfOrigin ?? "");
                            setLotBatchNotes(lb.notes ?? "");
                          }}
                        >
                          Edit
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

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Stock balances</h2>
          <div className="flex min-w-[12rem] flex-1 flex-wrap items-end justify-end gap-2 sm:max-w-2xl">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-zinc-600 sm:max-w-sm">
              Filter by product or bin
              <input
                type="search"
                value={balanceTextFilter}
                onChange={(e) => setBalanceTextFilter(e.target.value)}
                placeholder="Code, SKU, name, bin…"
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-600">
              Sort
              <select
                value={balanceSort}
                onChange={(e) =>
                  setBalanceSort(
                    e.target.value as "bin" | "product" | "availableDesc" | "availableAsc",
                  )
                }
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              >
                <option value="bin">Bin A-Z</option>
                <option value="product">Product A-Z</option>
                <option value="availableDesc">Available high-low</option>
                <option value="availableAsc">Available low-high</option>
              </select>
            </label>
          </div>
        </div>
        {onHoldOnly ? (
          <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
            Filtered view: on-hold inventory only ·{" "}
            <a className="underline" href="/wms/stock">
              clear
            </a>
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Warehouse</th>
                <th className="px-2 py-1">Bin</th>
                <th className="px-2 py-1">Lot</th>
                <th className="px-2 py-1">Expiry</th>
                <th className="px-2 py-1">COO</th>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1">On hand</th>
                <th className="px-2 py-1">Allocated</th>
                <th className="px-2 py-1">Available</th>
                <th className="px-2 py-1">Hold</th>
                <th className="px-2 py-1">QC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {balancesTableRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-2 py-3 text-zinc-500">
                    {balancesShown.length === 0
                      ? "No balances in this view."
                      : `No balances match this filter${balanceTextFilter.trim() ? `: "${balanceTextFilter.trim()}"` : "."}`}
                  </td>
                </tr>
              ) : (
                sortedBalancesTableRows.map((b) => (
                  <tr key={b.id} className={Boolean(b.onHold) ? "bg-amber-50/80" : undefined}>
                    <td className="px-2 py-1">{b.warehouse.code || b.warehouse.name}</td>
                    <td className="px-2 py-1">
                      {b.bin.code} · {b.bin.name}
                    </td>
                    <td className="px-2 py-1 text-xs text-zinc-600">{b.lotCode || "—"}</td>
                    <td className="px-2 py-1 text-xs text-zinc-600">
                      {b.lotBatchProfile?.expiryDate ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-xs text-zinc-600">
                      {b.lotBatchProfile?.countryOfOrigin ?? "—"}
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
