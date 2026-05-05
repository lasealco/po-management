"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { Prisma, type InventoryMovementType, type WmsReceiveStatus } from "@prisma/client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment } from "react";

import { ActionButton } from "@/components/action-button";
import { WorkflowHeader } from "@/components/workflow-header";
import { buildSscc18DemoFromOutbound } from "@/lib/wms/gs1-sscc";
import { printOutboundPackSlip } from "@/lib/wms/pack-slip-print";
import { buildShipStationZpl, downloadZplTextFile } from "@/lib/wms/ship-station-zpl";
import { WMS_DEMO_WAREHOUSE_CODE } from "@/lib/wms/demo-warehouse-code";
import {
  buildMovementAuditChainBf82Url,
  isoToDatetimeLocalValue,
  mergeStockLedgerSearchParams,
  normalizeMovementLedgerQueryString,
  readStockLedgerUrlState,
} from "@/lib/wms/stock-ledger-url";
import {
  WMS_INVENTORY_FREEZE_REASON_CODES,
  WMS_INVENTORY_HOLD_RELEASE_GRANTS,
} from "@/lib/wms/inventory-freeze-matrix";
import { WMS_RECEIVE_STATUS_LABEL } from "@/lib/wms/wms-receive-status";
import {
  defaultTrailerChecklistPayload,
  type TrailerChecklistPayload,
} from "@/lib/wms/dock-trailer-checklist";
import { computeKitBuildLineDeltas, validateKitBuildLinePicks } from "@/lib/wms/kit-build";
import { FUNGIBLE_LOT_CODE } from "@/lib/wms/lot-code";
import { DG_CHECKLIST_ITEM_DEFS } from "@/lib/wms/dangerous-goods-bf72";

const BF51_VARIANCE_REASONS = ["SHRINK", "DAMAGE", "DATA_ENTRY", "FOUND", "OTHER"] as const;

/** BF-52 — `GET /api/wms/slotting-recommendations` JSON shape (preview panel). */
type Bf52SlottingPreview = {
  methodology: string;
  windowDays: number;
  summary: {
    balancesScanned: number;
    recommendationCount: number;
    pickFaceBins: number;
    bulkCandidateBins: number;
    productsWithPicks: number;
  };
  warnings: string[];
  recommendations: Array<{
    priorityScore: number;
    reasonCode: string;
    abcClass: string;
    productPickVolume: number;
    product: { productCode: string | null; sku: string | null; name: string };
    currentBin: { code: string; isPickFace: boolean; storageType: string };
    suggestedBin: { code: string; isPickFace: boolean; storageType: string } | null;
  }>;
};

/** BF-86 — `GET /api/wms/capacity-utilization-snapshot` JSON preview (subset). */
type Bf86CapacityPreview = {
  schemaVersion: string;
  methodology: string;
  warehouse: { id: string; code: string | null; name: string };
  windowDays: number;
  sort: string;
  cap: { requestedMaxBins: number; returnedBins: number; binsInWarehouseActive: number };
  warnings: string[];
  bins: Array<{
    binId: string;
    binCode: string;
    zoneCode: string | null;
    pickVelocityUnits: number;
    velocityHeatScore: number;
    cubeUtilizationRatio: number | null;
    balanceRowCount: number;
    estimatedOccupiedCubeMm: number | null;
    capacityCubeCubicMm: number | null;
  }>;
};

const WMS_LABOR_TASK_TYPES = ["PUTAWAY", "PICK", "REPLENISH", "CYCLE_COUNT", "VALUE_ADD", "KIT_BUILD"] as const;

/** Matches serialized product refs from `GET /api/wms` (including BF-33 carton hints). */
type WmsProductRef = {
  id: string;
  productCode: string | null;
  sku: string | null;
  name: string;
  cartonLengthMm: number | null;
  cartonWidthMm: number | null;
  cartonHeightMm: number | null;
  cartonUnitsPerMasterCarton: string | null;
  /** BF-89 — optional pick slice units vs warehouse wave cap. */
  wmsCartonUnitsBf89?: string | null;
  /** BF-89 — optional each-unit cube (cm³) for pick estimate fallback. */
  wmsUnitCubeCm3Bf89?: string | null;
  isCatchWeight: boolean;
  catchWeightLabelHint: string | null;
  /** BF-69 — grams CO₂e per kg·km planning factor (nullable). */
  wmsCo2eFactorGramsPerKgKm?: string | null;
  /** BF-72 — dangerous goods master data snapshot from catalog (informational on outbound lines). */
  isDangerousGoods?: boolean;
  dangerousGoodsClass?: string | null;
  unNumber?: string | null;
  properShippingName?: string | null;
  packingGroup?: string | null;
  msdsUrl?: string | null;
};

type WmsOutboundLuKindUi = "PALLET" | "CASE" | "INNER_PACK" | "EACH" | "UNKNOWN";

type WmsLuDraftBf43 = {
  logisticsUnitId: string;
  scanCode: string;
  kind: WmsOutboundLuKindUi;
  parentUnitId: string;
  outboundOrderLineId: string;
  containedQty: string;
};

const BF43_EMPTY_LU_DRAFT: WmsLuDraftBf43 = {
  logisticsUnitId: "",
  scanCode: "",
  kind: "UNKNOWN",
  parentUnitId: "",
  outboundOrderLineId: "",
  containedQty: "1",
};

function mergeBf43LuDraft(stored: Partial<WmsLuDraftBf43> | undefined): WmsLuDraftBf43 {
  return { ...BF43_EMPTY_LU_DRAFT, ...stored };
}

function emptyBf72DgDraft(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const d of DG_CHECKLIST_ITEM_DEFS) {
    out[d.code] = false;
  }
  return out;
}

function mergeBf72DgDraft(stored: Record<string, boolean> | undefined): Record<string, boolean> {
  return { ...emptyBf72DgDraft(), ...stored };
}

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
      | "GREEDY_MIN_BIN_TOUCHES"
      | "GREEDY_RESERVE_PICK_FACE"
      | "GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE"
      | "GREEDY_RESERVE_PICK_FACE_CUBE_AWARE"
      | "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES"
      | "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE"
      | "MANUAL_ONLY";
    pickWaveCartonUnits: string | null;
  }>;
  /** BF-53 — tenant engineered standard minutes per task type (optional until configured). */
  laborStandards?: Array<{
    taskType: (typeof WMS_LABOR_TASK_TYPES)[number];
    standardMinutes: number;
    updatedAt: string;
  }>;
  /** BF-54 — tenant yard detention thresholds (`set_wms_dock_detention_policy`). */
  dockDetentionPolicy?: {
    enabled: boolean;
    freeMinutesGateToDock: number;
    freeMinutesDockToDepart: number;
  };
  /** BF-54 — denormalized list (same info as per-row `detentionAlert`). */
  dockDetentionAlerts?: Array<{
    appointmentId: string;
    dockCode: string;
    warehouseId: string;
    phase: "GATE_TO_DOCK" | "DOCK_DWELL";
    minutesOver: number;
    limitMinutes: number;
    phaseStartedAt: string;
  }>;
  /** BF-77 — DONE tasks exceeding actual vs engineered standard (`Tenant.wmsLaborVariancePolicyJson`). */
  laborVarianceBf77?: {
    schemaVersion: string;
    evaluatedAt: string;
    policy: {
      schemaVersion: string;
      enabled: boolean;
      excessPercentThreshold: number;
      minActualMinutes: number;
      minStandardMinutes: number;
      lookbackDays: number;
      maxRows: number;
      taskTypes: string[] | null;
    };
    policyNotice: string | null;
    exceptions: Array<{
      taskId: string;
      taskType: string;
      warehouseCode: string | null;
      warehouseName: string;
      actualMinutes: number;
      standardMinutes: number;
      excessMinutes: number;
      variancePctVsStandard: number;
      completedAt: string;
      completedBy: { id: string; name: string | null } | null;
    }>;
  };
  /** BF-88 — ATP soft-reservation tiers + pick-allocation priority floor (`Tenant.wmsAtpReservationPolicyJsonBf88`). */
  atpReservationPolicyBf88?: {
    schemaVersion: string;
    evaluatedAt: string;
    policy: {
      schemaVersion: string;
      defaultTtlSeconds: number;
      defaultPriorityBf88: number;
      pickAllocationSoftReservationPriorityFloorBf88: number | null;
      tiers: Array<{
        ttlSeconds: number;
        priorityBf88: number;
        matchTierTag?: string | null;
        matchReferenceType?: string | null;
        matchReferenceTypePrefix?: string | null;
        matchReferenceIdPrefix?: string | null;
      }>;
    };
    policyNotice: string | null;
  };
  /** BF-81 — RFID commissioning bridge (`Tenant.wmsRfidEncodingTableJsonBf81`). */
  rfidEncodingBf81?: {
    schemaVersion: string;
    raw: unknown | null;
    parseNotice: string | null;
    enabled: boolean;
  };
  /** BF-55 — stock transfer orders (inter-warehouse). */
  stockTransfers?: Array<{
    id: string;
    referenceCode: string;
    status: "DRAFT" | "RELEASED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
    note: string | null;
    /** BF-78 — parsed `landedCostNotesBf78Json` (`bf78.v1`). */
    landedCostNotesBf78?: {
      schemaVersion: string;
      notes: string | null;
      fxBaseCurrency: string | null;
      fxQuoteCurrency: string | null;
      fxRate: string | null;
      fxRateSourceNarrative: string | null;
    } | null;
    landedCostNotesBf78Notice?: string | null;
    releasedAt: string | null;
    shippedAt: string | null;
    receivedAt: string | null;
    updatedAt: string;
    fromWarehouse: { id: string; code: string | null; name: string };
    toWarehouse: { id: string; code: string | null; name: string };
    lines: Array<{
      id: string;
      lineNo: number;
      product: WmsProductRef;
      lotCode: string;
      quantityOrdered: string;
      quantityShipped: string;
      quantityReceived: string;
      fromBin: { id: string; code: string; name: string };
      toBin: { id: string; code: string; name: string } | null;
    }>;
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
  aisles: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    zoneId: string | null;
    zone: { id: string; code: string; name: string } | null;
    lengthMm: number | null;
    widthMm: number | null;
    originXMm: number | null;
    originYMm: number | null;
    originZMm: number | null;
    warehouse: { id: string; code: string | null; name: string };
  }>;
  bins: Array<{
    id: string;
    code: string;
    name: string;
    storageType: "PALLET" | "FLOOR" | "SHELF" | "QUARANTINE" | "STAGING";
    isPickFace: boolean;
    isCrossDockStaging: boolean;
    maxPallets: number | null;
    rackCode: string | null;
    aisle: string | null;
    warehouseAisleId: string | null;
    warehouseAisle: { id: string; code: string } | null;
    bay: string | null;
    level: number | null;
    positionIndex: number | null;
    capacityCubeCubicMm: number | null;
    warehouse: { id: string; code: string | null; name: string };
    zone: { id: string; code: string; name: string; zoneType: string } | null;
  }>;
  replenishmentRules: Array<{
    id: string;
    warehouse: { id: string; code: string | null; name: string };
    product: WmsProductRef;
    sourceZone: { id: string; code: string; name: string } | null;
    targetZone: { id: string; code: string; name: string } | null;
    minPickQty: string;
    maxPickQty: string;
    replenishQty: string;
    isActive: boolean;
    priority: number;
    maxTasksPerRun: number | null;
    exceptionQueue: boolean;
  }>;
  /** BF-61 — persisted weekly demand stubs */
  demandForecastStubs?: Array<{
    id: string;
    warehouse: { id: string; code: string | null; name: string };
    product: WmsProductRef;
    weekStart: string;
    /** Stored administrative forecast qty (before BF-84 uplift). */
    forecastQty: string;
    /** BF-84 × BF-61 effective qty driving replenishment gap / hints. */
    forecastQtyEffective: string;
    promoUpliftBf84: {
      schemaVersion: "bf84.v1";
      upliftMultiplier: number;
      promoNote: string | null;
      parseNotice?: string;
    };
    note: string | null;
    updatedAt: string;
  }>;
  /** BF-61 — pick-face vs forecast gap hints for current UTC week (forecast qty is BF-84 effective when uplift present). */
  forecastGapHints?: Array<{
    replenishmentRuleId: string;
    warehouseId: string;
    warehouse: { id: string; code: string | null; name: string };
    product: WmsProductRef;
    weekStart: string;
    forecastQtyBase: string;
    promoUpliftMultiplier: number;
    promoUpliftParseNotice: string | null;
    forecastQty: string;
    pickFaceEffectiveQty: string;
    forecastGapQty: string;
    priorityBoost: number;
    rulePriority: number;
    effectiveSortPriority: number;
  }>;
  /** BF-42 — tenant receiving disposition note templates + suggested variance hints. */
  receivingDispositionTemplates?: Array<{
    id: string;
    code: string;
    title: string;
    noteTemplate: string;
    suggestedVarianceDisposition:
      | "UNSET"
      | "MATCH"
      | "SHORT"
      | "OVER"
      | "DAMAGED"
      | "OTHER"
      | null;
    updatedAt: string;
  }>;
  /** BF-85 — tenant rules bulk-applying return disposition (+ optional BF-42 template) on CUSTOMER_RETURN. */
  rmaDispositionRulesBf85?: Array<{
    id: string;
    priority: number;
    matchField: "ORDER_LINE_DESCRIPTION" | "PRODUCT_SKU" | "PRODUCT_CODE" | "SHIPMENT_RMA_REFERENCE";
    matchMode: "EXACT" | "PREFIX" | "CONTAINS";
    pattern: string;
    applyDisposition: "RESTOCK" | "SCRAP" | "QUARANTINE";
    receivingDispositionTemplateId: string | null;
    receivingDispositionTemplate: { id: string; code: string; title: string } | null;
    note: string | null;
    updatedAt: string;
  }>;
  /** BF-44 — tenant outbound webhooks (HMAC-signed POST bodies). */
  outboundWebhookSubscriptions?: Array<{
    id: string;
    url: string;
    eventTypes: string[];
    isActive: boolean;
    signingSecretSuffix: string;
    createdAt: string;
  }>;
  /** BF-45 — partner read API keys (`GET /api/wms/partner/v1/*`). */
  partnerApiKeys?: Array<{
    id: string;
    label: string;
    keyPrefix: string;
    scopes: string[];
    isActive: boolean;
    createdAt: string;
    lastUsedAt: string | null;
  }>;
  /** BF-73 — recall campaigns (scoped BF-58 freeze materialization). */
  recallCampaigns?: Array<{
    id: string;
    campaignCode: string;
    title: string;
    note: string | null;
    status: "DRAFT" | "MATERIALIZED" | "CLOSED";
    scopeJson: unknown;
    holdReasonCode: string;
    holdReleaseGrant: string | null;
    materializedAt: string | null;
    frozenBalanceCount: number | null;
    createdAt: string;
    updatedAt: string;
    createdBy: { id: string; name: string };
  }>;
  crmAccountOptions: Array<{ id: string; name: string; legalName: string | null }>;
  crmQuoteOptions: Array<{
    id: string;
    title: string;
    quoteNumber: string | null;
    status: string;
    accountId: string;
  }>;
  packShipScanPolicy?: {
    packScanRequired: boolean;
    shipScanRequired: boolean;
  };
  /** BF-69 — methodology string for movement / product CO₂e hint fields (indicative only). */
  movementCo2eHintMeta?: { schemaVersion: string; methodology: string };
  /** BF-70 — external HTTP PDP hook status (URL is not exposed). */
  externalPdpBf70?: {
    schemaVersion: string;
    enabled: boolean;
    timeoutMs: number;
    failOpen: boolean;
  };
  /** BF-92 — denied-party screening hook before mark_outbound_shipped (URL not exposed). */
  deniedPartyScreeningBf92?: {
    schemaVersion: string;
    enabled: boolean;
    timeoutMs: number;
    failOpen: boolean;
    bearerConfigured: boolean;
  };
  /** BF-93 — tenant toggle bundle on `Tenant.wmsFeatureFlagsJsonBf93`. */
  wmsFeatureFlagsBf93?: {
    schemaVersion: string;
    flags: Record<string, boolean | number | string | null>;
    parseError?: string;
  } | null;
  /** BF-79 — echo of balance ownership filter applied to `balances` (`GET /api/wms` query). */
  inventoryOwnershipBalanceFilterBf79?: {
    schemaVersion: string;
    mode: "all" | "company" | "vendor";
    supplierId: string | null;
  };
  /** BF-79 — supplier selector options for VMI / consignment tagging (active suppliers). */
  suppliersBf79?: Array<{ id: string; code: string | null; name: string }>;
  /** BF-36 — ATP aggregates per warehouse × SKU (soft reservations reduce ATP). */
  atpByWarehouseProduct?: Array<{
    warehouseId: string;
    warehouseLabel: string;
    productId: string;
    product: WmsProductRef;
    onHandQty: string;
    allocatedQty: string;
    softReservedQty: string;
    atpQty: string;
  }>;
  /** BF-36 — active (non-expired) soft reservations. */
  softReservations?: Array<{
    id: string;
    quantity: string;
    expiresAt: string;
    /** BF-88 — priority tier used for pick-allocation ATP floor filtering. */
    priorityBf88: number;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    inventoryBalanceId: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string };
    product: WmsProductRef;
  }>;
  outboundOrders: Array<{
    id: string;
    outboundNo: string;
    customerRef: string | null;
    asnReference: string | null;
    requestedShipDate: string | null;
    shipToName: string | null;
    shipToCity: string | null;
    shipToCountryCode: string | null;
    estimatedCubeCbm: string | null;
    carrierTrackingNo: string | null;
    carrierLabelAdapterId: string | null;
    carrierLabelPurchasedAt: string | null;
    /** BF-67 — additional parcel tracking ids (primary may be `carrierTrackingNo`). */
    manifestParcelIds: string[];
    /** BF-72 — any outbound line SKU flagged dangerous goods in master data. */
    dangerousGoodsChecklistRequired: boolean;
    /** BF-72 — checklist satisfied when required (or true when not required). */
    dangerousGoodsChecklistComplete: boolean;
    /** BF-72 — last submitted checklist snapshot (`wms.dg_checklist_state.bf72.v1`), when present. */
    dangerousGoodsChecklist: {
      schema: string;
      completedAt: string;
      actorUserId: string;
      items: Array<{ code: string; label: string; ok: boolean }>;
    } | null;
    /** BF-87 — outbound commercial terms snapshot (`bf87.v1`) for DESADV / ASN JSON. */
    commercialTermsBf87: {
      schemaVersion: string;
      incoterm: string | null;
      paymentTermsDays: number | null;
      paymentTermsLabel: string | null;
      billTo: {
        name: string | null;
        line1: string | null;
        city: string | null;
        region: string | null;
        postalCode: string | null;
        countryCode: string | null;
      } | null;
    } | null;
    status: "DRAFT" | "RELEASED" | "PICKING" | "PACKED" | "SHIPPED" | "CANCELLED";
    warehouse: { id: string; code: string | null; name: string };
    crmAccount: { id: string; name: string; legalName: string | null } | null;
    sourceQuote: {
      id: string;
      title: string;
      quoteNumber: string | null;
      status: string;
    } | null;
    lines: Array<{
      id: string;
      lineNo: number;
      product: WmsProductRef;
      quantity: string;
      pickedQty: string;
      packedQty: string;
      shippedQty: string;
      commercialUnitPrice: string | null;
      commercialListUnitPrice: string | null;
      commercialPriceTierLabel: string | null;
      commercialExtendedAmount: string | null;
    }>;
    logisticsUnits: Array<{
      id: string;
      scanCode: string;
      kind: WmsOutboundLuKindUi;
      parentUnitId: string | null;
      outboundOrderLineId: string | null;
      containedQty: string | null;
      luSerials: Array<{ serialId: string; serialNo: string; productId: string }>;
    }>;
    packScanPlan: Array<{ code: string; qty: number }>;
  }>;
  balances: Array<{
    id: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string; zoneId?: string | null; isPickFace?: boolean };
    product: WmsProductRef;
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
    softReservedQty?: string;
    availableQty: string;
    effectiveAvailableQty?: string;
    onHold: boolean;
    holdReason: string | null;
    /** BF-58 — structured freeze reason when set. */
    holdReasonCode?: string | null;
    holdAppliedAt?: string | null;
    /** BF-58 — delegated release grant resource or null. */
    holdReleaseGrant?: string | null;
    /** BF-79 — vendor/consignment owner supplier id; null = company-owned. */
    inventoryOwnershipSupplierIdBf79?: string | null;
    inventoryOwnershipSupplierBf79?: { id: string; code: string | null; name: string } | null;
  }>;
  openTasks: Array<{
    id: string;
    taskType: "PUTAWAY" | "PICK" | "REPLENISH" | "CYCLE_COUNT" | "VALUE_ADD" | "KIT_BUILD";
    quantity: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string } | null;
    /** For REPLENISH: reserve / bulk `referenceId` bin (source). */
    sourceBin: { id: string; code: string; name: string } | null;
    product: WmsProductRef | null;
    shipment: { id: string; shipmentNo: string | null; status: string } | null;
    order: { id: string; orderNumber: string } | null;
    wave: { id: string; waveNo: string; status: string; pickMode: "SINGLE_ORDER" | "BATCH" } | null;
    note: string | null;
    referenceType: string | null;
    referenceId: string | null;
    lotCode: string;
    replenishmentRuleId?: string | null;
    replenishmentPriority?: number | null;
    replenishmentException?: boolean | null;
    startedAt: string | null;
    standardMinutes: number | null;
    batchGroupKey: string | null;
    createdAt: string;
  }>;
  waves: Array<{
    id: string;
    waveNo: string;
    status: "OPEN" | "RELEASED" | "DONE" | "CANCELLED";
    pickMode: "SINGLE_ORDER" | "BATCH";
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
    asnQtyTolerancePct: string | null;
    catchWeightTolerancePct: string | null;
    custodySegmentJson: unknown | null;
    wmsCrossDock: boolean;
    wmsFlowThrough: boolean;
    wmsInboundSubtype: "STANDARD" | "CUSTOMER_RETURN";
    wmsRmaReference: string | null;
    returnSourceOutboundOrderId: string | null;
    returnSourceOutbound: { id: string; outboundNo: string } | null;
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
      productSku: string | null;
      cargoGrossWeightKg: string | null;
      catchWeightKg: string | null;
      isCatchWeightProduct: boolean;
      catchWeightLabelHint: string | null;
      productId: string;
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
      wmsReturnDisposition: "RESTOCK" | "SCRAP" | "QUARANTINE" | null;
      wmsQaSamplingSkipLot: boolean;
      wmsQaSamplingPct: string | null;
      wmsReceivingDispositionTemplateId: string | null;
      receivingDispositionTemplate: { id: string; code: string; title: string } | null;
    }>;
    /** BF-12 — at most one OPEN `WmsReceipt` per shipment (enforced server-side). */
    openWmsReceipt: {
      id: string;
      status: "OPEN";
      dockNote: string | null;
      dockReceivedAt: string | null;
      createdAt: string;
      lines: Array<{
        shipmentItemId: string;
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
    } | null;
    /** BF-21 — recent CLOSED dock receipts for audit/history (newest first). */
    closedWmsReceiptHistory: Array<{
      id: string;
      closedAt: string | null;
      closedBy: { id: string; name: string } | null;
      createdAt: string;
      dockReceivedAt: string | null;
      dockNote: string | null;
      grnReference: string | null;
      lineCount: number;
    }>;
  }>;
  /** BF-59 — idempotent ASN pre-advise rows (`POST /api/wms/inbound-asn-advise`). */
  inboundAsnAdvises: Array<{
    id: string;
    externalAsnId: string;
    asnPartnerId: string | null;
    asnReference: string | null;
    expectedReceiveAt: string | null;
    lineCount: number;
    shipmentId: string | null;
    purchaseOrderId: string | null;
    warehouseId: string | null;
    warehouse: { id: string; code: string | null; name: string } | null;
    purchaseOrder: { id: string; orderNumber: string } | null;
    shipment: { id: string; shipmentNo: string | null } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  /** BF-60 — recent offline scan batch replays (`POST /api/wms/scan-events/batch`). */
  scanEventBatches: Array<{
    id: string;
    clientBatchId: string;
    deviceClock: string;
    lastStatusCode: number;
    createdAt: string;
    createdBy: { id: string; name: string | null };
  }>;
  /** BF-65 — damage reports + carrier claim JSON (`GET /api/wms/damage-reports/[id]/claim-export`). */
  wmsDamageReports: Array<{
    id: string;
    context: string;
    status: string;
    damageCategory: string | null;
    shipmentId: string | null;
    outboundOrderId: string | null;
    createdAt: string;
    createdBy: { id: string; name: string | null };
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
    product: WmsProductRef;
    remainingQty: string;
  }>;
  recentMovements: Array<{
    id: string;
    movementType: InventoryMovementType;
    quantity: string;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    custodySegmentJson: unknown | null;
    co2eEstimateGrams?: string | null;
    co2eStubJson?: unknown | null;
    createdAt: string;
    warehouse: { id: string; code: string | null; name: string };
    bin: { id: string; code: string; name: string } | null;
    product: WmsProductRef;
    createdBy: { id: string; name: string; email: string };
  }>;
  recentMovementsMeta: { limit: number; matchedCount: number; truncated: boolean };
  dockAppointments: Array<{
    id: string;
    warehouseId: string;
    warehouse: { id: string; code: string | null; name: string };
    dockCode: string;
    doorCode: string | null;
    trailerChecklistJson: TrailerChecklistPayload | null;
    nextDockAppointmentWindowStart: string | null;
    windowStart: string;
    windowEnd: string;
    direction: "INBOUND" | "OUTBOUND";
    status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
    note: string | null;
    carrierName: string | null;
    carrierReference: string | null;
    trailerId: string | null;
    tmsLoadId: string | null;
    tmsCarrierBookingRef: string | null;
    tmsLastWebhookAt: string | null;
    gateCheckedInAt: string | null;
    atDockAt: string | null;
    departedAt: string | null;
    shipmentId: string | null;
    outboundOrderId: string | null;
    shipment: { id: string; shipmentNo: string | null; orderNumber: string } | null;
    outboundNo: string | null;
    createdBy: { id: string; name: string };
    /** BF-54 — live policy breach for this row, if any. */
    detentionAlert: {
      appointmentId: string;
      dockCode: string;
      warehouseId: string;
      phase: "GATE_TO_DOCK" | "DOCK_DWELL";
      minutesOver: number;
      limitMinutes: number;
      phaseStartedAt: string;
    } | null;
  }>;
  workOrders: Array<{
    id: string;
    workOrderNo: string;
    title: string;
    description: string | null;
    status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";
    intakeChannel: "OPS" | "CUSTOMER_PORTAL";
    estimatedMaterialsCents: number | null;
    estimatedLaborMinutes: number | null;
    crmQuoteLineId: string | null;
    engineeringBomSyncedRevision: string | null;
    engineeringBomSyncedAt: string | null;
    crmEngineeringBomRevision: string | null;
    crmEngineeringBomMaterialsCents: number | null;
    materialsEstimateVsEngineeringVarianceCents: number | null;
    completedAt: string | null;
    createdAt: string;
    warehouse: { id: string; code: string | null; name: string };
    createdBy: { id: string; name: string };
    crmAccount: { id: string; name: string } | null;
    bomLines?: Array<{
      id: string;
      lineNo: number;
      plannedQty: string;
      consumedQty: string;
      lineNote: string | null;
      componentProduct: WmsProductRef;
    }>;
  }>;
  /** BF-02 — tenant lot/batch master registry (expiry / origin / notes per product + lotCode). */
  lotBatches?: Array<{
    id: string;
    productId: string;
    lotCode: string;
    product: WmsProductRef;
    expiryDate: string | null;
    countryOfOrigin: string | null;
    notes: string | null;
    updatedAt: string;
  }>;
  /** BF-51 — structured cycle counts (`submit_cycle_count` → `approve_cycle_count_variance`). */
  cycleCountSessions?: Array<{
    id: string;
    referenceCode: string;
    status: "OPEN" | "SUBMITTED" | "CLOSED" | "CANCELLED";
    scopeNote: string | null;
    warehouseId: string;
    warehouse: { id: string; code: string | null; name: string };
    createdBy: { id: string; name: string };
    submittedAt: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
    lines: Array<{
      id: string;
      inventoryBalanceId: string;
      binId: string;
      bin: { id: string; code: string; name: string };
      product: WmsProductRef;
      lotCode: string;
      expectedQty: string;
      countedQty: string | null;
      varianceReasonCode: string | null;
      varianceNote: string | null;
      status: "PENDING_COUNT" | "MATCH_CLOSED" | "VARIANCE_PENDING" | "VARIANCE_POSTED";
      inventoryMovementId: string | null;
    }>;
  }>;
  /** BF-13 — present when `traceProductId` + `traceSerialNo` query params sent on stock fetch. */
  serialTrace?:
    | null
    | { status: "bad_serial"; message: string }
    | { status: "product_denied" }
    | { status: "not_found"; productId: string; serialNo: string }
    | {
        status: "ok";
        serial: {
          id: string;
          serialNo: string;
          note: string | null;
          createdAt: string;
          updatedAt: string;
        };
        product: WmsProductRef;
        currentBalance: null | {
          id: string;
          lotCode: string;
          onHandQty: string;
          allocatedQty: string;
          warehouse: { id: string; code: string | null; name: string };
          bin: { id: string; code: string; name: string };
        };
        movements: Array<{
          linkedAt: string;
          movement: {
            id: string;
            movementType: string;
            quantity: string;
            referenceType: string | null;
            referenceId: string | null;
            note: string | null;
            createdAt: string;
            warehouse: { id: string; code: string | null; name: string };
            bin: { id: string; code: string; name: string } | null;
            createdBy: { id: string; name: string; email: string };
          };
        }>;
      };
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

/** BF-14 / BF-22 — server preview payload from `explode_crm_quote_to_outbound`. */
type QuoteExplosionPreviewPayload = {
  outboundOrderId: string;
  outboundNo: string;
  sourceQuoteId: string;
  quoteLineCount: number;
  ready: boolean;
  rows: Array<{
    quoteLineId: string;
    description: string;
    quantity: string;
    inventorySku: string | null;
    status: string;
    productId: string | null;
    productLabel: string | null;
    contractUnitPrice: string;
    listUnitPrice: string | null;
    unitPriceDelta: string | null;
    extendedContract: string;
    extendedList: string | null;
    priceTierLabel: string | null;
  }>;
};

const STOCK_LEDGER_MV_TYPE_PRESETS: Array<{ label: string; value: "" | InventoryMovementType }> = [
  { label: "All types", value: "" },
  { label: "Receipt", value: "RECEIPT" },
  { label: "Putaway", value: "PUTAWAY" },
  { label: "Pick", value: "PICK" },
  { label: "Adjustment", value: "ADJUSTMENT" },
  { label: "Shipment", value: "SHIPMENT" },
  { label: "STO ship (BF-55)", value: "STO_SHIP" },
  { label: "STO receive (BF-55)", value: "STO_RECEIVE" },
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
    "custodySegmentJson",
    "co2eEstimateGrams",
    "co2eStubJson",
    "createdBy",
  ];
  const lines = [header.join(",")];
  for (const m of rows) {
    const custody =
      m.custodySegmentJson != null ? JSON.stringify(m.custodySegmentJson) : "";
    const co2eStub =
      m.co2eStubJson != null ? JSON.stringify(m.co2eStubJson) : "";
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
        esc(custody),
        esc(m.co2eEstimateGrams ?? ""),
        esc(co2eStub),
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

function downloadUtf8Blob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dockCarrierDisplayLine(a: {
  carrierName: string | null;
  carrierReference: string | null;
  trailerId: string | null;
}): string {
  const bits = [a.carrierName, a.carrierReference, a.trailerId].filter(Boolean) as string[];
  return bits.length ? bits.join(" · ") : "—";
}

function dockYardDisplayLine(a: {
  gateCheckedInAt: string | null;
  atDockAt: string | null;
  departedAt: string | null;
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const bits: string[] = [];
  if (a.gateCheckedInAt) bits.push(`Gate ${fmt(a.gateCheckedInAt)}`);
  if (a.atDockAt) bits.push(`Dock ${fmt(a.atDockAt)}`);
  if (a.departedAt) bits.push(`Out ${fmt(a.departedAt)}`);
  return bits.length ? bits.join(" · ") : "—";
}

function readSsccDemoCompanyPrefixDigits(): string | null {
  const raw = process.env.NEXT_PUBLIC_WMS_SSCC_COMPANY_PREFIX;
  if (typeof raw !== "string") return null;
  const d = raw.replace(/\D/g, "");
  return d.length >= 7 && d.length <= 10 ? d : null;
}

function splitRecallIdList(raw: string): string[] {
  return raw
    .split(/[\s,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

type StoLandedCostBf78Payload = {
  schemaVersion: string;
  notes: string | null;
  fxBaseCurrency: string | null;
  fxQuoteCurrency: string | null;
  fxRate: string | null;
  fxRateSourceNarrative: string | null;
} | null;

function StoLandedCostBf78Panel({
  transferId,
  landedCostNotesBf78,
  landedCostNotesBf78Notice,
  canEdit,
  busy,
  runAction,
}: {
  transferId: string;
  landedCostNotesBf78: StoLandedCostBf78Payload;
  landedCostNotesBf78Notice: string | null | undefined;
  canEdit: boolean;
  busy: boolean;
  runAction: (body: Record<string, unknown>) => void | Promise<unknown>;
}) {
  const lc = landedCostNotesBf78;
  const [notes, setNotes] = useState(() => lc?.notes ?? "");
  const [fxBase, setFxBase] = useState(() => lc?.fxBaseCurrency ?? "");
  const [fxQuote, setFxQuote] = useState(() => lc?.fxQuoteCurrency ?? "");
  const [fxRate, setFxRate] = useState(() => lc?.fxRate ?? "");
  const [fxSrc, setFxSrc] = useState(() => lc?.fxRateSourceNarrative ?? "");

  useEffect(() => {
    setNotes(lc?.notes ?? "");
    setFxBase(lc?.fxBaseCurrency ?? "");
    setFxQuote(lc?.fxQuoteCurrency ?? "");
    setFxRate(lc?.fxRate ?? "");
    setFxSrc(lc?.fxRateSourceNarrative ?? "");
  }, [transferId, lc?.notes, lc?.fxBaseCurrency, lc?.fxQuoteCurrency, lc?.fxRate, lc?.fxRateSourceNarrative]);

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        Landed cost / FX notes (BF-78)
      </p>
      {landedCostNotesBf78Notice ? (
        <p className="mt-2 text-[11px] text-amber-800">{landedCostNotesBf78Notice}</p>
      ) : null}
      <label className="mt-2 block text-[11px] text-zinc-600">
        Narrative (finance handoff)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!canEdit || busy}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:opacity-50"
        />
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-zinc-600">
          FX base (ISO)
          <input
            value={fxBase}
            onChange={(e) => setFxBase(e.target.value)}
            disabled={!canEdit || busy}
            maxLength={3}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1 font-mono text-xs uppercase disabled:opacity-50"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          FX quote (ISO)
          <input
            value={fxQuote}
            onChange={(e) => setFxQuote(e.target.value)}
            disabled={!canEdit || busy}
            maxLength={3}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1 font-mono text-xs uppercase disabled:opacity-50"
          />
        </label>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-zinc-600">
          FX rate (advisory)
          <input
            value={fxRate}
            onChange={(e) => setFxRate(e.target.value)}
            disabled={!canEdit || busy}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1 font-mono text-xs disabled:opacity-50"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          Rate source narrative
          <input
            value={fxSrc}
            onChange={(e) => setFxSrc(e.target.value)}
            disabled={!canEdit || busy}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
          />
        </label>
      </div>
      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runAction({
                action: "set_wms_stock_transfer_landed_cost_notes_bf78",
                stockTransferId: transferId,
                stockTransferLandedCostNotesBf78: {
                  notes: notes.trim() || null,
                  fxBaseCurrency: fxBase.trim() || null,
                  fxQuoteCurrency: fxQuote.trim() || null,
                  fxRate: fxRate.trim() || null,
                  fxRateSourceNarrative: fxSrc.trim() || null,
                },
              })
            }
            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save landed-cost notes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runAction({
                action: "set_wms_stock_transfer_landed_cost_notes_bf78",
                stockTransferId: transferId,
                landedCostNotesBf78Clear: true,
              })
            }
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}

type OutboundCommercialTermsBf87Payload = {
  schemaVersion: string;
  incoterm: string | null;
  paymentTermsDays: number | null;
  paymentTermsLabel: string | null;
  billTo: {
    name: string | null;
    line1: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    countryCode: string | null;
  } | null;
} | null;

function OutboundCommercialTermsBf87Panel({
  outboundOrderId,
  commercialTermsBf87,
  canEdit,
  busy,
  runAction,
}: {
  outboundOrderId: string;
  commercialTermsBf87: OutboundCommercialTermsBf87Payload;
  canEdit: boolean;
  busy: boolean;
  runAction: (body: Record<string, unknown>) => void | Promise<unknown>;
}) {
  const ct = commercialTermsBf87;
  const [incoterm, setIncoterm] = useState(() => ct?.incoterm ?? "");
  const [paymentDays, setPaymentDays] = useState(() =>
    ct?.paymentTermsDays != null ? String(ct.paymentTermsDays) : "",
  );
  const [paymentLabel, setPaymentLabel] = useState(() => ct?.paymentTermsLabel ?? "");
  const [billName, setBillName] = useState(() => ct?.billTo?.name ?? "");
  const [billLine1, setBillLine1] = useState(() => ct?.billTo?.line1 ?? "");
  const [billCity, setBillCity] = useState(() => ct?.billTo?.city ?? "");
  const [billRegion, setBillRegion] = useState(() => ct?.billTo?.region ?? "");
  const [billPostal, setBillPostal] = useState(() => ct?.billTo?.postalCode ?? "");
  const [billCountry, setBillCountry] = useState(() => ct?.billTo?.countryCode ?? "");

  useEffect(() => {
    setIncoterm(ct?.incoterm ?? "");
    setPaymentDays(ct?.paymentTermsDays != null ? String(ct.paymentTermsDays) : "");
    setPaymentLabel(ct?.paymentTermsLabel ?? "");
    setBillName(ct?.billTo?.name ?? "");
    setBillLine1(ct?.billTo?.line1 ?? "");
    setBillCity(ct?.billTo?.city ?? "");
    setBillRegion(ct?.billTo?.region ?? "");
    setBillPostal(ct?.billTo?.postalCode ?? "");
    setBillCountry(ct?.billTo?.countryCode ?? "");
  }, [
    outboundOrderId,
    ct?.incoterm,
    ct?.paymentTermsDays,
    ct?.paymentTermsLabel,
    ct?.billTo?.name,
    ct?.billTo?.line1,
    ct?.billTo?.city,
    ct?.billTo?.region,
    ct?.billTo?.postalCode,
    ct?.billTo?.countryCode,
  ]);

  const disabled = !canEdit || busy;

  return (
    <div className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
        Commercial terms (BF-87)
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
        Incoterms, payment terms, and structured bill-to ride on{" "}
        <span className="font-medium">Export ASN JSON</span> beside CRM quote line pricing (BF-22 fields).
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] text-zinc-600">
          Incoterm
          <input
            value={incoterm}
            onChange={(e) => setIncoterm(e.target.value)}
            disabled={disabled}
            maxLength={16}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-xs uppercase disabled:opacity-50"
            placeholder="e.g. DAP"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          Payment days
          <input
            value={paymentDays}
            onChange={(e) => setPaymentDays(e.target.value)}
            disabled={disabled}
            inputMode="numeric"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-xs disabled:opacity-50"
            placeholder="e.g. 30"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          Payment label
          <input
            value={paymentLabel}
            onChange={(e) => setPaymentLabel(e.target.value)}
            disabled={disabled}
            maxLength={128}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:opacity-50"
            placeholder="Net 30 · ACH"
          />
        </label>
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        Bill-to (optional override)
      </p>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-zinc-600">
          Name
          <input
            value={billName}
            onChange={(e) => setBillName(e.target.value)}
            disabled={disabled}
            maxLength={256}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:opacity-50"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          Address line 1
          <input
            value={billLine1}
            onChange={(e) => setBillLine1(e.target.value)}
            disabled={disabled}
            maxLength={512}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:opacity-50"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          City
          <input
            value={billCity}
            onChange={(e) => setBillCity(e.target.value)}
            disabled={disabled}
            maxLength={128}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:opacity-50"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          Region
          <input
            value={billRegion}
            onChange={(e) => setBillRegion(e.target.value)}
            disabled={disabled}
            maxLength={128}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:opacity-50"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          Postal code
          <input
            value={billPostal}
            onChange={(e) => setBillPostal(e.target.value)}
            disabled={disabled}
            maxLength={32}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:opacity-50"
          />
        </label>
        <label className="text-[11px] text-zinc-600">
          Country (ISO-2)
          <input
            value={billCountry}
            onChange={(e) => setBillCountry(e.target.value.toUpperCase())}
            disabled={disabled}
            maxLength={2}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-xs uppercase disabled:opacity-50"
          />
        </label>
      </div>
      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const pd = paymentDays.trim();
              void runAction({
                action: "set_outbound_commercial_terms_bf87",
                outboundOrderId,
                wmsCommercialTermsIncotermBf87: incoterm.trim() || null,
                wmsCommercialTermsPaymentDaysBf87: pd === "" ? null : pd,
                wmsCommercialTermsPaymentLabelBf87: paymentLabel.trim() || null,
                wmsCommercialTermsBillToNameBf87: billName.trim() || null,
                wmsCommercialTermsBillToLine1Bf87: billLine1.trim() || null,
                wmsCommercialTermsBillToCityBf87: billCity.trim() || null,
                wmsCommercialTermsBillToRegionBf87: billRegion.trim() || null,
                wmsCommercialTermsBillToPostalCodeBf87: billPostal.trim() || null,
                wmsCommercialTermsBillToCountryBf87: billCountry.trim() || null,
              });
            }}
            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save commercial terms
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runAction({
                action: "set_outbound_commercial_terms_bf87",
                outboundOrderId,
                wmsCommercialTermsBf87Clear: true,
              })
            }
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BalanceOwnershipBf79Editor({
  balanceId,
  supplier,
  suppliers,
  canEdit,
  busy,
  runAction,
}: {
  balanceId: string;
  supplier: { id: string; code: string | null; name: string } | null;
  suppliers: Array<{ id: string; code: string | null; name: string }>;
  canEdit: boolean;
  busy: boolean;
  runAction: (body: Record<string, unknown>) => void | Promise<unknown>;
}) {
  const [supplierId, setSupplierId] = useState(() => supplier?.id ?? "");
  useEffect(() => {
    setSupplierId(supplier?.id ?? "");
  }, [balanceId, supplier?.id]);

  if (!canEdit) {
    return supplier ? (
      <span className="text-[11px] text-zinc-700">
        {(supplier.code ?? "").trim() ? `${supplier.code} · ` : ""}
        {supplier.name}
      </span>
    ) : (
      <span className="text-[11px] text-zinc-500">Company</span>
    );
  }

  return (
    <div className="flex min-w-[11rem] flex-col gap-1">
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        disabled={busy}
        className="rounded border border-zinc-300 px-1 py-0.5 text-[11px]"
      >
        <option value="">Company-owned</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {(s.code ?? "").trim() ? `${s.code} · ` : ""}
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void runAction({
            action: "set_inventory_balance_ownership_bf79",
            balanceId,
            ...(supplierId.trim()
              ? { inventoryOwnershipSupplierIdBf79: supplierId.trim() }
              : { inventoryOwnershipSupplierIdBf79Clear: true }),
          })
        }
        className="w-fit rounded border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-800 disabled:opacity-40"
      >
        Apply ownership
      </button>
    </div>
  );
}

export function WmsClient({
  canEdit,
  section,
  inventoryQtyEdit,
  inventoryLotEdit,
  inventorySerialEdit,
}: {
  canEdit: boolean;
  section: WmsSection;
  /** BF-16 Stock — qty-path mutations (holds, cycle counts, saved ledger views). Defaults to `canEdit`. */
  inventoryQtyEdit?: boolean;
  /** BF-16 Stock — lot/batch master (`set_wms_lot_batch`). Defaults to `canEdit`. */
  inventoryLotEdit?: boolean;
  /** BF-48 Stock — serialization registry POST actions. Defaults to `canEdit`. */
  inventorySerialEdit?: boolean;
}) {
  const stockQtyEdit = inventoryQtyEdit ?? canEdit;
  const stockLotEdit = inventoryLotEdit ?? canEdit;
  const stockSerialEdit = inventorySerialEdit ?? canEdit;
  const ssccDemoCompanyPrefixDigits = readSsccDemoCompanyPrefixDigits();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /** Stock: once user picks "All warehouses", do not auto-select demo DC again on refetch. */
  const stockWarehouseDefaultApplied = useRef(false);
  /** BF-10 — consume `?quoteId=&crmAccountId=` once from CRM commercial handoff link. */
  const commercialHandoffPrefilled = useRef(false);
  const pushingLedgerUrl = useRef(false);
  const lastLedgerUrlNormalized = useRef("");
  const [data, setData] = useState<WmsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [bf59AdviseJson, setBf59AdviseJson] = useState(
    '{\n  "externalAsnId": "ADVISE-DEMO-001",\n  "asnReference": "ASN-DEMO",\n  "lines": [{ "lineNo": 1, "productSku": "DEMO-SKU", "quantityExpected": 12 }]\n}',
  );
  const [bf75PartnerId, setBf75PartnerId] = useState("edi-demo");
  const [bf75EnvelopeHint, setBf75EnvelopeHint] = useState<"" | "bf59_wrap" | "compact_items_v1">(
    "compact_items_v1",
  );
  const [bf75Persist, setBf75Persist] = useState(true);
  const [bf75NormalizeExtrasJson, setBf75NormalizeExtrasJson] = useState("{}");
  const [bf75EnvelopeJson, setBf75EnvelopeJson] = useState(
    '{\n  "asnId": "BF75-DEMO-001",\n  "asnRef": "856-DEMO",\n  "eta": "2026-06-01T10:00:00.000Z",\n  "items": [{ "sku": "DEMO-SKU", "qty": 12, "line": 1 }]\n}',
  );
  const [bf60BatchJson, setBf60BatchJson] = useState(
    '{\n  "clientBatchId": "00000000-0000-4000-8000-000000000060",\n  "deviceClock": "2026-04-30T12:00:00.000Z",\n  "events": [\n    {\n      "seq": 1,\n      "deviceClock": "2026-04-30T12:00:01.000Z",\n      "type": "VALIDATE_PACK_SCAN",\n      "payload": {\n        "outboundOrderId": "REPLACE_WITH_OUTBOUND_ID",\n        "packScanTokens": []\n      }\n    }\n  ]\n}',
  );
  const [bf65Context, setBf65Context] = useState<"RECEIVING" | "PACKING">("RECEIVING");
  const [bf65ShipmentId, setBf65ShipmentId] = useState("");
  const [bf65OutboundId, setBf65OutboundId] = useState("");
  const [bf65LineId, setBf65LineId] = useState("");
  const [bf65Category, setBf65Category] = useState("");
  const [bf65Desc, setBf65Desc] = useState("");
  const [bf65Photos, setBf65Photos] = useState("");
  const [bf65Status, setBf65Status] = useState<"DRAFT" | "SUBMITTED">("DRAFT");
  const [bf65ClaimRef, setBf65ClaimRef] = useState("");
  const [bf65ExtraJson, setBf65ExtraJson] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [pickWaveCartonCapDraft, setPickWaveCartonCapDraft] = useState("");
  const [pickWavePickModeDraft, setPickWavePickModeDraft] = useState<"SINGLE_ORDER" | "BATCH">("SINGLE_ORDER");
  const [movementTypeFilter, setMovementTypeFilter] = useState<"" | InventoryMovementType>("");
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
  const [newBinCrossDockStaging, setNewBinCrossDockStaging] = useState(false);
  const [newBinRackCode, setNewBinRackCode] = useState("");
  const [newBinAisle, setNewBinAisle] = useState("");
  const [newBinWarehouseAisleId, setNewBinWarehouseAisleId] = useState("");
  const [newBinBay, setNewBinBay] = useState("");
  const [newAisleCode, setNewAisleCode] = useState("");
  const [newAisleName, setNewAisleName] = useState("");
  const [newAisleZoneId, setNewAisleZoneId] = useState("");
  const [newAisleLengthMm, setNewAisleLengthMm] = useState("");
  const [newAisleWidthMm, setNewAisleWidthMm] = useState("");
  const [newBinLevel, setNewBinLevel] = useState("");
  const [newBinPosition, setNewBinPosition] = useState("");
  const [newBinCapacityCubeMm, setNewBinCapacityCubeMm] = useState("");
  const [bf33CartonProductId, setBf33CartonProductId] = useState("");
  const [bf33CartonL, setBf33CartonL] = useState("");
  const [bf33CartonW, setBf33CartonW] = useState("");
  const [bf33CartonH, setBf33CartonH] = useState("");
  const [bf33CartonUnits, setBf33CartonUnits] = useState("");
  const [bf89PickUnits, setBf89PickUnits] = useState("");
  const [bf89UnitCubeCm3, setBf89UnitCubeCm3] = useState("");
  const [bf33OutboundCubeOrderId, setBf33OutboundCubeOrderId] = useState("");
  const [bf33EstimatedCubeCbm, setBf33EstimatedCubeCbm] = useState("");
  const [bf63CatchProductId, setBf63CatchProductId] = useState("");
  const [bf63IsCatchWeight, setBf63IsCatchWeight] = useState(false);
  const [bf63LabelHint, setBf63LabelHint] = useState("");
  const [bf69Co2eProductId, setBf69Co2eProductId] = useState("");
  const [bf69Co2eFactorStr, setBf69Co2eFactorStr] = useState("");
  const [bf69MovementId, setBf69MovementId] = useState("");
  const [bf69Co2eGrams, setBf69Co2eGrams] = useState("");
  const [bf69StubJson, setBf69StubJson] = useState("");
  const [bf73RecallCode, setBf73RecallCode] = useState("");
  const [bf73RecallTitle, setBf73RecallTitle] = useState("");
  const [bf73RecallNote, setBf73RecallNote] = useState("");
  const [bf73RecallWarehouseIdsRaw, setBf73RecallWarehouseIdsRaw] = useState("");
  const [bf73RecallProductIdsRaw, setBf73RecallProductIdsRaw] = useState("");
  const [bf73RecallLotCodesRaw, setBf73RecallLotCodesRaw] = useState("");
  const [bf73RecallHoldReason, setBf73RecallHoldReason] = useState<string>("RECALL");
  const [bf73RecallHoldGrant, setBf73RecallHoldGrant] = useState("");
  const [rackVizCode, setRackVizCode] = useState("");
  const [topologyExportBusy, setTopologyExportBusy] = useState(false);
  const [slottingWindowDays, setSlottingWindowDays] = useState("30");
  const [slottingPreview, setSlottingPreview] = useState<Bf52SlottingPreview | null>(null);
  const [slottingLoadBusy, setSlottingLoadBusy] = useState(false);
  const [bf86CapPreview, setBf86CapPreview] = useState<Bf86CapacityPreview | null>(null);
  const [bf86CapBusy, setBf86CapBusy] = useState(false);
  const [laborStdTaskType, setLaborStdTaskType] = useState<string>("PICK");
  const [laborStdMinutes, setLaborStdMinutes] = useState("12");
  const [laborStdBusy, setLaborStdBusy] = useState(false);
  const [dockDetentionEnabled, setDockDetentionEnabled] = useState(false);
  const [dockDetentionGateMin, setDockDetentionGateMin] = useState("120");
  const [dockDetentionDwellMin, setDockDetentionDwellMin] = useState("240");
  const [dockDetentionBusy, setDockDetentionBusy] = useState(false);
  const [laborVarianceEnabledBf77, setLaborVarianceEnabledBf77] = useState(false);
  const [laborVarianceExcessPctBf77, setLaborVarianceExcessPctBf77] = useState("25");
  const [laborVarianceMinActualBf77, setLaborVarianceMinActualBf77] = useState("3");
  const [laborVarianceMinStdBf77, setLaborVarianceMinStdBf77] = useState("1");
  const [laborVarianceLookbackBf77, setLaborVarianceLookbackBf77] = useState("14");
  const [laborVarianceMaxRowsBf77, setLaborVarianceMaxRowsBf77] = useState("40");
  const [laborVarianceBusyBf77, setLaborVarianceBusyBf77] = useState(false);
  const [bf88DefaultTtl, setBf88DefaultTtl] = useState("3600");
  const [bf88DefaultPri, setBf88DefaultPri] = useState("100");
  const [bf88PickFloor, setBf88PickFloor] = useState("");
  const [bf88TiersJson, setBf88TiersJson] = useState("[]");
  const [bf88Busy, setBf88Busy] = useState(false);
  const [rfidEncodingDraftBf81, setRfidEncodingDraftBf81] = useState("");
  const [rfidEncodingBusyBf81, setRfidEncodingBusyBf81] = useState(false);
  const [bf93FeatureFlagsJsonDraft, setBf93FeatureFlagsJsonDraft] = useState("{}");
  const [bf93FeatureFlagsBusy, setBf93FeatureFlagsBusy] = useState(false);
  const [stoFromWh, setStoFromWh] = useState("");
  const [stoToWh, setStoToWh] = useState("");
  const [stoSourceBalanceId, setStoSourceBalanceId] = useState("");
  const [stoQty, setStoQty] = useState("1");
  const [stoNote, setStoNote] = useState("");
  const [stoReceiveDraft, setStoReceiveDraft] = useState<Record<string, string>>({});

  const [putawayShipmentItemId, setPutawayShipmentItemId] = useState("");
  const [putawayQty, setPutawayQty] = useState("");
  const [putawayBinId, setPutawayBinId] = useState("");

  const [pickOutboundLineId, setPickOutboundLineId] = useState("");
  const [pickQty, setPickQty] = useState("");
  const [pickBinId, setPickBinId] = useState("");
  const [pickLotCode, setPickLotCode] = useState("");
  const [putawayLotByTaskId, setPutawayLotByTaskId] = useState<Record<string, string>>({});
  /** BF-94 optional `{ outputSerialNos?, consumedSerials? }` JSON per open `KIT_BUILD` task (complete_kit_build_task). */
  const [kitBuildBf94JsonByTaskId, setKitBuildBf94JsonByTaskId] = useState<Record<string, string>>({});
  const [replProductId, setReplProductId] = useState("");
  const [replSourceZoneId, setReplSourceZoneId] = useState("");
  const [replTargetZoneId, setReplTargetZoneId] = useState("");
  const [replMin, setReplMin] = useState("");
  const [replMax, setReplMax] = useState("");
  const [replQty, setReplQty] = useState("");
  const [replPriority, setReplPriority] = useState("");
  const [replMaxTasksPerRun, setReplMaxTasksPerRun] = useState("");
  const [replExceptionQueue, setReplExceptionQueue] = useState(false);
  const [fcProductId, setFcProductId] = useState("");
  const [fcWeekStart, setFcWeekStart] = useState("");
  const [fcQty, setFcQty] = useState("");
  const [fcNote, setFcNote] = useState("");
  const [fcPromoMult, setFcPromoMult] = useState("");
  const [fcPromoNoteBf84, setFcPromoNoteBf84] = useState("");
  const [fcPromoClearBf84, setFcPromoClearBf84] = useState(false);
  const [bf42TplCode, setBf42TplCode] = useState("");
  const [bf42TplTitle, setBf42TplTitle] = useState("");
  const [bf42TplNote, setBf42TplNote] = useState("");
  const [bf42TplSuggested, setBf42TplSuggested] = useState("");
  const [bf42EditingTemplateId, setBf42EditingTemplateId] = useState<string | null>(null);
  const [bf85RuleEditingId, setBf85RuleEditingId] = useState<string | null>(null);
  const [bf85Priority, setBf85Priority] = useState("100");
  const [bf85MatchField, setBf85MatchField] = useState<
    "ORDER_LINE_DESCRIPTION" | "PRODUCT_SKU" | "PRODUCT_CODE" | "SHIPMENT_RMA_REFERENCE"
  >("ORDER_LINE_DESCRIPTION");
  const [bf85MatchMode, setBf85MatchMode] = useState<"EXACT" | "PREFIX" | "CONTAINS">("CONTAINS");
  const [bf85Pattern, setBf85Pattern] = useState("");
  const [bf85ApplyDisp, setBf85ApplyDisp] = useState<"RESTOCK" | "SCRAP" | "QUARANTINE">("RESTOCK");
  const [bf85TemplateId, setBf85TemplateId] = useState("");
  const [bf85RuleNote, setBf85RuleNote] = useState("");
  const [bf85ApplyShipmentId, setBf85ApplyShipmentId] = useState("");
  const [bf85ApplyOverwrite, setBf85ApplyOverwrite] = useState(false);
  const [bf44WebhookUrl, setBf44WebhookUrl] = useState("");
  const [bf44WebhookSecret, setBf44WebhookSecret] = useState("");
  const [bf44EvtReceiptClosed, setBf44EvtReceiptClosed] = useState(true);
  const [bf44EvtOutboundShipped, setBf44EvtOutboundShipped] = useState(false);
  const [bf44EvtBillingDisputed, setBf44EvtBillingDisputed] = useState(false);
  const [bf44EvtBillingInvoicePostDisputed, setBf44EvtBillingInvoicePostDisputed] = useState(false);
  const [bf44EvtBillingCreditMemoStubCreated, setBf44EvtBillingCreditMemoStubCreated] = useState(false);
  const [bf44WebhookActive, setBf44WebhookActive] = useState(true);
  const [bf44EditingSubscriptionId, setBf44EditingSubscriptionId] = useState<string | null>(null);
  const [bf45PartnerKeyLabel, setBf45PartnerKeyLabel] = useState("");
  const [bf45ScopeInventory, setBf45ScopeInventory] = useState(true);
  const [bf45ScopeOutbound, setBf45ScopeOutbound] = useState(true);
  const [bf45IssuedKeyPlaintext, setBf45IssuedKeyPlaintext] = useState<string | null>(null);
  const [outboundRef, setOutboundRef] = useState("");
  const [outboundProductId, setOutboundProductId] = useState("");
  const [outboundLineQty, setOutboundLineQty] = useState("");
  const [outboundCrmAccountId, setOutboundCrmAccountId] = useState("");
  const [outboundSourceQuoteId, setOutboundSourceQuoteId] = useState("");
  const [quoteExplosionPreviewByOutboundId, setQuoteExplosionPreviewByOutboundId] = useState<
    Record<string, QuoteExplosionPreviewPayload | undefined>
  >({});
  const [inboundEdits, setInboundEdits] = useState<
    Record<
      string,
      {
        asn: string;
        expectedReceiveAt: string;
        asnTolerancePct: string;
        catchWeightTolerancePct: string;
        receiptDockNote: string;
        receiptDockAt: string;
        receiptCompleteOnClose: boolean;
        receiptGrn: string;
        generateGrnOnClose: boolean;
        requireTolAdvanceClose: boolean;
        blockTolOutsideClose: boolean;
        requireCwAdvanceClose: boolean;
        blockCwOutsideClose: boolean;
        blockQaSamplingIncompleteClose: boolean;
        crossDock: boolean;
        flowThrough: boolean;
        inboundSubtype: "STANDARD" | "CUSTOMER_RETURN";
        rmaRef: string;
        returnOutboundId: string;
        inboundCustodyJson: string;
      }
    >
  >({});
  const [inboundTagFilter, setInboundTagFilter] = useState<
    "all" | "crossDock" | "flowThrough" | "either" | "customerReturn"
  >("all");
  const [outboundAsnEdits, setOutboundAsnEdits] = useState<
    Record<string, { asn: string; requestedShip: string }>
  >({});
  const [outboundManifestParcelDraftById, setOutboundManifestParcelDraftById] = useState<
    Record<string, string>
  >({});
  const [packScanDraftByOutboundId, setPackScanDraftByOutboundId] = useState<Record<string, string>>({});
  const [packScanTokensByOutboundId, setPackScanTokensByOutboundId] = useState<Record<string, string[]>>(
    {},
  );
  const [packScanFeedbackByOutboundId, setPackScanFeedbackByOutboundId] = useState<
    Record<string, string | null>
  >({});
  const [shipScanDraftByOutboundId, setShipScanDraftByOutboundId] = useState<Record<string, string>>({});
  const [shipScanTokensByOutboundId, setShipScanTokensByOutboundId] = useState<Record<string, string[]>>(
    {},
  );
  const [shipScanFeedbackByOutboundId, setShipScanFeedbackByOutboundId] = useState<
    Record<string, string | null>
  >({});
  const [luDraftByOutboundId, setLuDraftByOutboundId] = useState<Record<string, WmsLuDraftBf43>>({});
  /** BF-57 — last hierarchy/SSCC validation message per outbound (client-only). */
  const [bf57LuValidateMsgByOutboundId, setBf57LuValidateMsgByOutboundId] = useState<Record<string, string>>({});
  const [bf71SerialAggMsgByOutboundId, setBf71SerialAggMsgByOutboundId] = useState<Record<string, string>>({});
  const [bf71LinkDraftByOutboundId, setBf71LinkDraftByOutboundId] = useState<
    Record<string, { logisticsUnitId: string; inventorySerialId: string }>
  >({});
  /** BF-72 — DG checklist checkbox draft keyed by checklist code. */
  const [bf72DgDraftByOutboundId, setBf72DgDraftByOutboundId] = useState<Record<string, Record<string, boolean>>>(
    {},
  );
  const [bf72DgValidateMsgByOutboundId, setBf72DgValidateMsgByOutboundId] = useState<Record<string, string>>({});
  const [outboundCreateAsn, setOutboundCreateAsn] = useState("");
  const [outboundCreateRequestedShip, setOutboundCreateRequestedShip] = useState("");
  const [dockShipmentLink, setDockShipmentLink] = useState("");
  const [dockOutboundLink, setDockOutboundLink] = useState("");
  const [dockDir, setDockDir] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const [dockCodeInput, setDockCodeInput] = useState("DOCK-A");
  const [dockWinStart, setDockWinStart] = useState("");
  const [dockWinEnd, setDockWinEnd] = useState("");
  const [dockScheduleCarrierName, setDockScheduleCarrierName] = useState("");
  const [dockScheduleCarrierRef, setDockScheduleCarrierRef] = useState("");
  const [dockScheduleTrailerId, setDockScheduleTrailerId] = useState("");
  const [dockTransportDraft, setDockTransportDraft] = useState<
    Record<string, { carrierName: string; carrierReference: string; trailerId: string }>
  >({});
  const [dockTmsDraft, setDockTmsDraft] = useState<
    Record<string, { tmsLoadId: string; tmsCarrierBookingRef: string }>
  >({});
  const [dockDoorCreateInput, setDockDoorCreateInput] = useState("");
  const [dockBf38Draft, setDockBf38Draft] = useState<
    Record<string, { doorCode: string; checklist: TrailerChecklistPayload | null }>
  >({});
  const [vasWoTitle, setVasWoTitle] = useState("");
  const [vasWoDesc, setVasWoDesc] = useState("");
  const [vasWoCrmAccountId, setVasWoCrmAccountId] = useState("");
  const [vasWoCrmQuoteLineId, setVasWoCrmQuoteLineId] = useState("");
  const [vasTaskWoId, setVasTaskWoId] = useState("");
  const [vasBalanceLineId, setVasBalanceLineId] = useState("");
  const [vasTaskQty, setVasTaskQty] = useState("");
  const [kitBuildWoId, setKitBuildWoId] = useState("");
  const [kitOutputProductId, setKitOutputProductId] = useState("");
  const [kitOutputBinId, setKitOutputBinId] = useState("");
  const [kitBuildQtyStr, setKitBuildQtyStr] = useState("1");
  const [kitBomRepStr, setKitBomRepStr] = useState("1");
  const [kitBuildBalanceByBomLineId, setKitBuildBalanceByBomLineId] = useState<Record<string, string>>({});
  const [cycleBalanceId, setCycleBalanceId] = useState("");
  const [cycleCountQtyByTask, setCycleCountQtyByTask] = useState<Record<string, string>>({});
  const [bf51ScopeNote, setBf51ScopeNote] = useState("");
  const [bf51AddBalanceId, setBf51AddBalanceId] = useState("");
  const [bf51LineDraft, setBf51LineDraft] = useState<
    Record<string, { counted: string; reason: string; note: string }>
  >({});
  const [bf36SoftBalanceId, setBf36SoftBalanceId] = useState("");
  const [bf36SoftQty, setBf36SoftQty] = useState("");
  const [bf36SoftTtl, setBf36SoftTtl] = useState("3600");
  const [bf36SoftTierTag, setBf36SoftTierTag] = useState("");
  const [woEstDraft, setWoEstDraft] = useState<Record<string, { m: string; l: string }>>({});
  /** BF-26 — draft CRM quote line id for link action (initialized from payload). */
  const [woQuoteLineLinkDraft, setWoQuoteLineLinkDraft] = useState<Record<string, string>>({});
  const [woBomDraft, setWoBomDraft] = useState<Record<string, Array<{ productId: string; qty: string }>>>(
    {},
  );
  const [woBomConsumeDraft, setWoBomConsumeDraft] = useState<
    Record<string, { balanceLineId: string; qty: string }>
  >({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, { m: string; l: string }> = {};
    for (const wo of data.workOrders) {
      next[wo.id] = {
        m: wo.estimatedMaterialsCents != null ? String(wo.estimatedMaterialsCents / 100) : "",
        l: wo.estimatedLaborMinutes != null ? String(wo.estimatedLaborMinutes) : "",
      };
    }
    setWoEstDraft(next);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const wo of data.workOrders) {
      next[wo.id] = wo.crmQuoteLineId ?? "";
    }
    setWoQuoteLineLinkDraft(next);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, Array<{ productId: string; qty: string }>> = {};
    for (const wo of data.workOrders) {
      const lines = wo.bomLines ?? [];
      next[wo.id] =
        lines.length > 0
          ? lines.map((bl) => ({
              productId: bl.componentProduct.id,
              qty: bl.plannedQty,
            }))
          : [{ productId: "", qty: "1" }];
    }
    setWoBomDraft(next);
  }, [data]);

  useEffect(() => {
    if (!data?.dockDetentionPolicy) return;
    const p = data.dockDetentionPolicy;
    setDockDetentionEnabled(p.enabled);
    setDockDetentionGateMin(String(p.freeMinutesGateToDock));
    setDockDetentionDwellMin(String(p.freeMinutesDockToDepart));
  }, [
    data?.dockDetentionPolicy?.enabled,
    data?.dockDetentionPolicy?.freeMinutesGateToDock,
    data?.dockDetentionPolicy?.freeMinutesDockToDepart,
  ]);

  useEffect(() => {
    if (!data?.laborVarianceBf77?.policy) return;
    const p = data.laborVarianceBf77.policy;
    setLaborVarianceEnabledBf77(p.enabled);
    setLaborVarianceExcessPctBf77(String(p.excessPercentThreshold));
    setLaborVarianceMinActualBf77(String(p.minActualMinutes));
    setLaborVarianceMinStdBf77(String(p.minStandardMinutes));
    setLaborVarianceLookbackBf77(String(p.lookbackDays));
    setLaborVarianceMaxRowsBf77(String(p.maxRows));
  }, [
    data?.laborVarianceBf77?.policy?.enabled,
    data?.laborVarianceBf77?.policy?.excessPercentThreshold,
    data?.laborVarianceBf77?.policy?.minActualMinutes,
    data?.laborVarianceBf77?.policy?.minStandardMinutes,
    data?.laborVarianceBf77?.policy?.lookbackDays,
    data?.laborVarianceBf77?.policy?.maxRows,
  ]);

  useEffect(() => {
    const raw = data?.wmsFeatureFlagsBf93;
    if (!raw || typeof raw.flags !== "object") {
      setBf93FeatureFlagsJsonDraft("{}");
      return;
    }
    setBf93FeatureFlagsJsonDraft(JSON.stringify(raw.flags, null, 2));
  }, [data?.wmsFeatureFlagsBf93]);

  useEffect(() => {
    const p = data?.atpReservationPolicyBf88?.policy;
    if (!p) return;
    setBf88DefaultTtl(String(p.defaultTtlSeconds));
    setBf88DefaultPri(String(p.defaultPriorityBf88));
    setBf88PickFloor(
      p.pickAllocationSoftReservationPriorityFloorBf88 == null
        ? ""
        : String(p.pickAllocationSoftReservationPriorityFloorBf88),
    );
    setBf88TiersJson(JSON.stringify(p.tiers ?? [], null, 2));
  }, [data?.atpReservationPolicyBf88?.evaluatedAt]);

  useEffect(() => {
    if (!data?.rfidEncodingBf81) return;
    const raw = data.rfidEncodingBf81.raw;
    setRfidEncodingDraftBf81(raw == null ? "" : JSON.stringify(raw, null, 2));
  }, [data?.rfidEncodingBf81?.raw]);

  const [ledgerSince, setLedgerSince] = useState("");
  const [ledgerUntil, setLedgerUntil] = useState("");
  const [ledgerLimit, setLedgerLimit] = useState("");
  const [ledgerDraftSince, setLedgerDraftSince] = useState("");
  const [ledgerDraftUntil, setLedgerDraftUntil] = useState("");
  const [ledgerDraftLimit, setLedgerDraftLimit] = useState("");
  const [openTaskTypeFilter, setOpenTaskTypeFilter] = useState<
    "" | "PUTAWAY" | "PICK" | "REPLENISH" | "CYCLE_COUNT" | "VALUE_ADD" | "KIT_BUILD"
  >("");
  const [replenishTierFilter, setReplenishTierFilter] = useState<"" | "standard" | "exception">("");
  const [replenishMinPriority, setReplenishMinPriority] = useState("");
  const [balanceTextFilter, setBalanceTextFilter] = useState("");
  const [movementSort, setMovementSort] = useState<
    "newest" | "oldest" | "type" | "qtyDesc" | "qtyAsc"
  >("newest");
  const [bf64MovementId, setBf64MovementId] = useState("");
  const [bf64CustodyJson, setBf64CustodyJson] = useState("");
  const [balanceSort, setBalanceSort] = useState<
    "bin" | "product" | "availableDesc" | "availableAsc"
  >("bin");
  const [balanceOwnershipBf79Mode, setBalanceOwnershipBf79Mode] = useState<"all" | "company" | "vendor">(
    "all",
  );
  const [balanceOwnershipBf79SupplierId, setBalanceOwnershipBf79SupplierId] = useState("");
  const [lotBatchProductId, setLotBatchProductId] = useState("");
  const [lotBatchCode, setLotBatchCode] = useState("");
  const [lotBatchExpiry, setLotBatchExpiry] = useState("");
  const [lotBatchCountry, setLotBatchCountry] = useState("");
  const [lotBatchNotes, setLotBatchNotes] = useState("");
  const [serialTraceLookup, setSerialTraceLookup] = useState<{ productId: string; serialNo: string } | null>(null);
  const [serialTraceDraftProductId, setSerialTraceDraftProductId] = useState("");
  const [serialTraceDraftNo, setSerialTraceDraftNo] = useState("");
  const [regSerialProductId, setRegSerialProductId] = useState("");
  const [regSerialNo, setRegSerialNo] = useState("");
  const [regSerialNote, setRegSerialNote] = useState("");
  const [attachSerialMovementId, setAttachSerialMovementId] = useState("");
  const [attachSerialProductId, setAttachSerialProductId] = useState("");
  const [attachSerialNo, setAttachSerialNo] = useState("");
  const [serialBalProductId, setSerialBalProductId] = useState("");
  const [serialBalNo, setSerialBalNo] = useState("");
  const [serialBalBalanceId, setSerialBalBalanceId] = useState("");
  const [savedViews, setSavedViews] = useState<SavedLedgerView[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(false);
  const [savedViewsError, setSavedViewsError] = useState<string | null>(null);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("");
  const [newSavedViewName, setNewSavedViewName] = useState("");
  const onHoldOnly = searchParams.get("onHold") === "1";

  const balanceProductOptions = useMemo(() => {
    if (!data?.balances?.length) return [];
    const m = new Map<string, { id: string; label: string }>();
    for (const b of data.balances) {
      const p = b.product;
      if (!m.has(p.id)) {
        const code = p.productCode ?? p.sku ?? "";
        m.set(p.id, { id: p.id, label: `${code ? `${code} · ` : ""}${p.name}`.trim() });
      }
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [data?.balances]);

  const quotesFilteredForCreate = useMemo(() => {
    const opts = data?.crmQuoteOptions ?? [];
    const crm = outboundCrmAccountId.trim();
    if (!crm) return opts;
    return opts.filter((q) => q.accountId === crm);
  }, [data?.crmQuoteOptions, outboundCrmAccountId]);

  useEffect(() => {
    if (!data?.warehouses?.length || !selectedWarehouseId) {
      setPickWaveCartonCapDraft("");
      return;
    }
    const wh = data.warehouses.find((w) => w.id === selectedWarehouseId);
    const cap = wh?.pickWaveCartonUnits;
    setPickWaveCartonCapDraft(cap != null && cap !== "" ? cap : "");
  }, [data?.warehouses, selectedWarehouseId]);

  useEffect(() => {
    const taskType = (searchParams.get("taskType") || "").toUpperCase();
    if (
      taskType === "PUTAWAY" ||
      taskType === "PICK" ||
      taskType === "REPLENISH" ||
      taskType === "CYCLE_COUNT" ||
      taskType === "VALUE_ADD" ||
      taskType === "KIT_BUILD"
    ) {
      startTransition(() => {
        setOpenTaskTypeFilter(taskType);
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (section !== "operations" || commercialHandoffPrefilled.current) return;
    const qid = searchParams.get("quoteId");
    const cid = searchParams.get("crmAccountId");
    if (!qid && !cid) return;
    commercialHandoffPrefilled.current = true;
    startTransition(() => {
      if (cid) setOutboundCrmAccountId(cid);
      if (qid) setOutboundSourceQuoteId(qid);
    });
    router.replace(pathname, { scroll: false });
  }, [section, searchParams, pathname, router]);

  useEffect(() => {
    if (!outboundSourceQuoteId.trim() || !data?.crmQuoteOptions?.length) return;
    const q = data.crmQuoteOptions.find((x) => x.id === outboundSourceQuoteId);
    if (!q) return;
    const crm = outboundCrmAccountId.trim();
    if (crm && q.accountId !== crm) setOutboundSourceQuoteId("");
  }, [outboundCrmAccountId, outboundSourceQuoteId, data?.crmQuoteOptions]);

  useEffect(() => {
    if (!data) return;
    const rows = data.dockAppointments ?? [];
    const next: Record<string, { carrierName: string; carrierReference: string; trailerId: string }> = {};
    for (const a of rows) {
      next[a.id] = {
        carrierName: a.carrierName ?? "",
        carrierReference: a.carrierReference ?? "",
        trailerId: a.trailerId ?? "",
      };
    }
    setDockTransportDraft(next);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const rows = data.dockAppointments ?? [];
    const next: Record<string, { doorCode: string; checklist: TrailerChecklistPayload | null }> = {};
    for (const a of rows) {
      next[a.id] = {
        doorCode: a.doorCode ?? "",
        checklist: a.trailerChecklistJson,
      };
    }
    setDockBf38Draft(next);
  }, [data]);

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
        if (serialTraceLookup) {
          params.set("traceProductId", serialTraceLookup.productId);
          params.set("traceSerialNo", serialTraceLookup.serialNo);
        }
        if (balanceOwnershipBf79Mode !== "all") {
          params.set("balanceOwnership", balanceOwnershipBf79Mode);
        }
        const ownSid = balanceOwnershipBf79SupplierId.trim();
        if (ownSid) params.set("balanceOwnershipSupplierId", ownSid);
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
    serialTraceLookup,
    balanceOwnershipBf79Mode,
    balanceOwnershipBf79SupplierId,
  ]);

  const inventoryAgingBf91ExportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedWarehouseId) params.set("warehouseId", selectedWarehouseId);
    if (balanceOwnershipBf79Mode !== "all") params.set("balanceOwnership", balanceOwnershipBf79Mode);
    const ownSid = balanceOwnershipBf79SupplierId.trim();
    if (ownSid) params.set("balanceOwnershipSupplierId", ownSid);
    const qs = params.toString();
    return qs ? `/api/wms/inventory-aging-export?${qs}` : "/api/wms/inventory-aging-export";
  }, [selectedWarehouseId, balanceOwnershipBf79Mode, balanceOwnershipBf79SupplierId]);

  const inventoryAgingBf91CsvHref = useMemo(
    () =>
      `${inventoryAgingBf91ExportHref}${
        inventoryAgingBf91ExportHref.includes("?") ? "&" : "?"
      }format=csv`,
    [inventoryAgingBf91ExportHref],
  );

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!data) return;
    startTransition(() => {
      const next: Record<
        string,
        {
          asn: string;
          expectedReceiveAt: string;
          asnTolerancePct: string;
          catchWeightTolerancePct: string;
          receiptDockNote: string;
          receiptDockAt: string;
          receiptCompleteOnClose: boolean;
          receiptGrn: string;
          generateGrnOnClose: boolean;
          requireTolAdvanceClose: boolean;
          blockTolOutsideClose: boolean;
          requireCwAdvanceClose: boolean;
          blockCwOutsideClose: boolean;
          blockQaSamplingIncompleteClose: boolean;
          crossDock: boolean;
          flowThrough: boolean;
          inboundSubtype: "STANDARD" | "CUSTOMER_RETURN";
          rmaRef: string;
          returnOutboundId: string;
          inboundCustodyJson: string;
        }
      > = {};
      for (const s of data.inboundShipments) {
        next[s.id] = {
          asn: s.asnReference ?? "",
          expectedReceiveAt: s.expectedReceiveAt
            ? s.expectedReceiveAt.slice(0, 16)
            : "",
          asnTolerancePct: s.asnQtyTolerancePct ?? "",
          catchWeightTolerancePct: s.catchWeightTolerancePct ?? "",
          receiptDockNote: "",
          receiptDockAt: "",
          receiptCompleteOnClose: false,
          receiptGrn: "",
          generateGrnOnClose: false,
          requireTolAdvanceClose: false,
          blockTolOutsideClose: false,
          requireCwAdvanceClose: false,
          blockCwOutsideClose: false,
          blockQaSamplingIncompleteClose: true,
          crossDock: s.wmsCrossDock,
          flowThrough: s.wmsFlowThrough,
          inboundSubtype: s.wmsInboundSubtype,
          rmaRef: s.wmsRmaReference ?? "",
          returnOutboundId: s.returnSourceOutboundOrderId ?? "",
          inboundCustodyJson:
            s.custodySegmentJson != null ? JSON.stringify(s.custodySegmentJson) : "",
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
  const aislesForWarehouse = useMemo(
    () => (data?.aisles ?? []).filter((a) => a.warehouse.id === selectedWarehouseId),
    [data?.aisles, selectedWarehouseId],
  );
  const activeAislesForBinLink = useMemo(
    () => aislesForWarehouse.filter((a) => a.isActive),
    [aislesForWarehouse],
  );
  const inboundShipmentsForOps = useMemo(() => {
    const rows = data?.inboundShipments ?? [];
    if (inboundTagFilter === "all") return rows;
    if (inboundTagFilter === "crossDock") return rows.filter((s) => s.wmsCrossDock);
    if (inboundTagFilter === "flowThrough") return rows.filter((s) => s.wmsFlowThrough);
    if (inboundTagFilter === "customerReturn") return rows.filter((s) => s.wmsInboundSubtype === "CUSTOMER_RETURN");
    return rows.filter((s) => s.wmsCrossDock || s.wmsFlowThrough);
  }, [data?.inboundShipments, inboundTagFilter]);

  const replenishmentRulesForWarehouse = useMemo(
    () =>
      (data?.replenishmentRules ?? []).filter((r) => r.warehouse.id === selectedWarehouseId),
    [data?.replenishmentRules, selectedWarehouseId],
  );

  const forecastGapHintsForWarehouse = useMemo(
    () =>
      (data?.forecastGapHints ?? []).filter((h) => h.warehouseId === selectedWarehouseId),
    [data?.forecastGapHints, selectedWarehouseId],
  );

  const demandForecastStubsForWarehouse = useMemo(
    () =>
      (data?.demandForecastStubs ?? []).filter((s) => s.warehouse.id === selectedWarehouseId),
    [data?.demandForecastStubs, selectedWarehouseId],
  );

  const outboundOrdersForWarehouse = useMemo(
    () =>
      (data?.outboundOrders ?? []).filter(
        (o) => !selectedWarehouseId || o.warehouse.id === selectedWarehouseId,
      ),
    [data?.outboundOrders, selectedWarehouseId],
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

  const cycleSessionsForWarehouse = useMemo(
    () =>
      (data?.cycleCountSessions ?? []).filter(
        (s) => !selectedWarehouseId || s.warehouseId === selectedWarehouseId,
      ),
    [data?.cycleCountSessions, selectedWarehouseId],
  );

  const stockTransfersForWarehouse = useMemo(
    () =>
      (data?.stockTransfers ?? []).filter(
        (t) =>
          !selectedWarehouseId ||
          t.fromWarehouse.id === selectedWarehouseId ||
          t.toWarehouse.id === selectedWarehouseId,
      ),
    [data?.stockTransfers, selectedWarehouseId],
  );

  const workOrdersForWarehouse = useMemo(
    () =>
      (data?.workOrders ?? []).filter(
        (wo) => !selectedWarehouseId || wo.warehouse.id === selectedWarehouseId,
      ),
    [data?.workOrders, selectedWarehouseId],
  );

  const kitBuildSelectedWo = useMemo(
    () => workOrdersForWarehouse.find((w) => w.id === kitBuildWoId) ?? null,
    [workOrdersForWarehouse, kitBuildWoId],
  );

  const kitBuildPreview = useMemo(() => {
    const wo = kitBuildSelectedWo;
    if (!wo?.bomLines?.length) return { status: "idle" as const };
    const kq = Number(kitBuildQtyStr);
    const brTrim = kitBomRepStr.trim();
    const br = brTrim === "" ? 1 : Number(kitBomRepStr);
    if (!Number.isFinite(kq) || kq <= 0) return { status: "bad_qty" as const };
    if (!Number.isInteger(br) || br < 1) return { status: "bad_rep" as const };
    const rows = wo.bomLines.map((bl) => ({
      id: bl.id,
      plannedQty: new Prisma.Decimal(bl.plannedQty),
      consumedQty: new Prisma.Decimal(bl.consumedQty),
    }));
    const r = computeKitBuildLineDeltas(rows, kq, br);
    if (!r.ok) return { status: "delta_err" as const, message: r.message };
    return { status: "ok" as const, deltas: r.deltas, kitQty: kq, bomRep: br };
  }, [kitBuildSelectedWo, kitBuildQtyStr, kitBomRepStr]);

  useEffect(() => {
    setKitBuildBalanceByBomLineId({});
  }, [kitBuildWoId]);

  const productPickOptionsForWarehouse = useMemo(() => {
    const m = new Map<string, WmsProductRef>();
    for (const b of balancesForWarehouseOps) {
      m.set(b.product.id, b.product);
    }
    for (const wo of workOrdersForWarehouse) {
      for (const bl of wo.bomLines ?? []) {
        m.set(bl.componentProduct.id, bl.componentProduct);
      }
    }
    for (const r of replenishmentRulesForWarehouse) {
      m.set(r.product.id, r.product);
    }
    for (const o of data?.outboundOrders ?? []) {
      if (selectedWarehouseId && o.warehouse.id !== selectedWarehouseId) continue;
      for (const l of o.lines) {
        m.set(l.product.id, l.product);
      }
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [
    balancesForWarehouseOps,
    workOrdersForWarehouse,
    replenishmentRulesForWarehouse,
    data?.outboundOrders,
    selectedWarehouseId,
  ]);

  useEffect(() => {
    if (!bf33CartonProductId) {
      setBf33CartonL("");
      setBf33CartonW("");
      setBf33CartonH("");
      setBf33CartonUnits("");
      setBf89PickUnits("");
      setBf89UnitCubeCm3("");
      return;
    }
    const p = productPickOptionsForWarehouse.find((x) => x.id === bf33CartonProductId);
    if (!p) return;
    setBf33CartonL(p.cartonLengthMm != null ? String(p.cartonLengthMm) : "");
    setBf33CartonW(p.cartonWidthMm != null ? String(p.cartonWidthMm) : "");
    setBf33CartonH(p.cartonHeightMm != null ? String(p.cartonHeightMm) : "");
    setBf33CartonUnits(p.cartonUnitsPerMasterCarton ?? "");
    setBf89PickUnits(p.wmsCartonUnitsBf89 ?? "");
    setBf89UnitCubeCm3(p.wmsUnitCubeCm3Bf89 ?? "");
  }, [bf33CartonProductId, productPickOptionsForWarehouse]);

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

  const atpRowsShown = useMemo(() => {
    const rows = data?.atpByWarehouseProduct ?? [];
    if (!selectedWarehouseId) return rows;
    return rows.filter((r) => r.warehouseId === selectedWarehouseId);
  }, [data?.atpByWarehouseProduct, selectedWarehouseId]);

  const softReservationsShown = useMemo(() => {
    const rows = data?.softReservations ?? [];
    if (!selectedWarehouseId) return rows;
    return rows.filter((r) => r.warehouse.id === selectedWarehouseId);
  }, [data?.softReservations, selectedWarehouseId]);

  const lotBatchProductOptions = useMemo(() => {
    const rows = data?.balances ?? [];
    return Array.from(new Map(rows.map((b) => [b.product.id, b.product] as const)).values());
  }, [data?.balances]);

  const tasksShown = useMemo(() => {
    const rows = data?.openTasks ?? [];
    let filtered = !openTaskTypeFilter ? rows : rows.filter((t) => t.taskType === openTaskTypeFilter);
    if (openTaskTypeFilter === "REPLENISH") {
      if (replenishTierFilter === "standard") {
        filtered = filtered.filter((t) => t.replenishmentException !== true);
      } else if (replenishTierFilter === "exception") {
        filtered = filtered.filter((t) => t.replenishmentException === true);
      }
      const minP = replenishMinPriority.trim();
      if (minP !== "") {
        const n = Number(minP);
        if (Number.isFinite(n)) {
          filtered = filtered.filter((t) => (t.replenishmentPriority ?? 0) >= n);
        }
      }
      filtered = [...filtered].sort(
        (a, b) => (b.replenishmentPriority ?? -999999) - (a.replenishmentPriority ?? -999999),
      );
    }
    return filtered;
  }, [data?.openTasks, openTaskTypeFilter, replenishTierFilter, replenishMinPriority]);

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
    setMovementTypeFilter(movementType as "" | InventoryMovementType);
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

  async function runAction(
    body: Record<string, unknown>,
    options?: { reload?: boolean },
  ): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    const reload = options?.reload !== false;
    const res = await fetch("/api/wms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed: unknown = await res.json();
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "WMS action failed."));
      setBusy(false);
      return null;
    }
    const parsedObj =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    if (reload) {
      await load();
    }
    setBusy(false);
    return parsedObj;
  }

  async function submitInboundAsnAdvise(): Promise<void> {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(bf59AdviseJson) as Record<string, unknown>;
    } catch {
      window.alert("Invalid JSON — fix the payload before posting.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wms/inbound-asn-advise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const parsed: unknown = await res.json();
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "ASN pre-advise failed."));
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
    const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const upd = o.updated === true ? "updated" : "created";
    window.alert(`ASN pre-advise ${upd} (id: ${String(o.id ?? "")}).`);
  }

  async function submitInboundAsnNormalize(): Promise<void> {
    let envelope: unknown;
    try {
      envelope = JSON.parse(bf75EnvelopeJson);
    } catch {
      window.alert("Invalid envelope JSON.");
      return;
    }
    let extras: Record<string, unknown> = {};
    if (bf75NormalizeExtrasJson.trim()) {
      try {
        extras = JSON.parse(bf75NormalizeExtrasJson) as Record<string, unknown>;
      } catch {
        window.alert("Invalid linkage JSON — use {} or optional warehouseId / purchaseOrderId / shipmentId.");
        return;
      }
    }
    const partnerId = bf75PartnerId.trim();
    if (!partnerId) {
      window.alert("partnerId is required.");
      return;
    }
    const body: Record<string, unknown> = {
      partnerId,
      rawEnvelope: envelope,
      persist: bf75Persist,
    };
    if (bf75EnvelopeHint) {
      body.envelopeHint = bf75EnvelopeHint;
    }
    const wh = extras.warehouseId;
    const po = extras.purchaseOrderId;
    const sh = extras.shipmentId;
    if (typeof wh === "string" && wh.trim()) body.warehouseId = wh.trim();
    if (typeof po === "string" && po.trim()) body.purchaseOrderId = po.trim();
    if (typeof sh === "string" && sh.trim()) body.shipmentId = sh.trim();

    setBusy(true);
    setError(null);
    const res = await fetch("/api/wms/inbound-asn-normalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed: unknown = await res.json();
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "ASN normalize failed."));
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
    const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    if (bf75Persist) {
      const adviseId = String(o.adviseId ?? "");
      const upd = o.updated === true ? "updated" : "created";
      window.alert(`ASN normalized and advise ${upd} (advise id: ${adviseId}).`);
      return;
    }
    window.alert("ASN normalized (persist off — response includes bf75.v1 in DevTools).");
  }

  async function submitScanEventBatch(): Promise<void> {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(bf60BatchJson) as Record<string, unknown>;
    } catch {
      window.alert("Invalid JSON — fix the payload before posting.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wms/scan-events/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const parsed: unknown = await res.json();
    if (res.status === 409) {
      const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      const c = o.conflict && typeof o.conflict === "object" ? (o.conflict as Record<string, unknown>) : {};
      const msg = typeof c.message === "string" ? c.message : "Scan batch conflict.";
      setError(
        `${msg} (HTTP 409, seq ${String(o.failedAtSeq ?? "—")}, kind ${String(c.kind ?? "—")}).`,
      );
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Scan batch failed."));
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
    const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    window.alert(`Scan batch stored (id: ${String(o.batchId ?? "")}).`);
  }

  async function submitDamageReportBf65(): Promise<void> {
    let extra: unknown = undefined;
    if (bf65ExtraJson.trim()) {
      try {
        extra = JSON.parse(bf65ExtraJson) as unknown;
      } catch {
        window.alert("Extra detail must be valid JSON or leave empty.");
        return;
      }
      if (extra !== null && (typeof extra !== "object" || Array.isArray(extra))) {
        window.alert("Extra detail must be a JSON object.");
        return;
      }
    }
    const urls = bf65Photos
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      action: "create_wms_damage_report_bf65",
      damageReportContext: bf65Context,
      damageReportStatus: bf65Status,
      damageCategory: bf65Category.trim() || undefined,
      damageDescription: bf65Desc.trim() || undefined,
      damagePhotoUrls: urls.length > 0 ? urls : undefined,
      carrierClaimReference: bf65ClaimRef.trim() || undefined,
    };
    if (extra !== undefined && bf65ExtraJson.trim()) {
      body.damageExtraDetailJson = extra;
    }
    if (bf65Context === "RECEIVING") {
      body.shipmentId = bf65ShipmentId.trim();
      if (bf65LineId.trim()) body.shipmentItemId = bf65LineId.trim();
    } else {
      body.outboundOrderId = bf65OutboundId.trim();
    }
    const res = await runAction(body);
    if (res && typeof res.id === "string") {
      window.alert(`Damage report created (id: ${res.id}).`);
      setBf65Desc("");
      setBf65Photos("");
      setBf65ExtraJson("");
    }
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-6 py-8 text-sm text-zinc-600">Loading WMS…</main>
    );
  }

  const packShipScanPolicy = data.packShipScanPolicy ?? {
    packScanRequired: false,
    shipScanRequired: false,
  };

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
                setMovementTypeFilter(e.target.value as "" | InventoryMovementType)
              }
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="RECEIPT">RECEIPT</option>
              <option value="PUTAWAY">PUTAWAY</option>
              <option value="PICK">PICK</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="SHIPMENT">SHIPMENT</option>
              <option value="STO_SHIP">STO_SHIP (BF-55)</option>
              <option value="STO_RECEIVE">STO_RECEIVE (BF-55)</option>
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
                    onClick={() => setMovementTypeFilter(p.value)}
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
          {data.externalPdpBf70?.enabled ? (
            <section className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-900">BF-70 — External PDP</p>
              <p className="mt-2 text-xs text-violet-950/90">
                Server <span className="font-mono">POST /api/wms</span> calls your policy endpoint after RBAC tier
                gates. Schema <span className="font-mono">{data.externalPdpBf70.schemaVersion}</span> · timeout{" "}
                <span className="font-mono">{data.externalPdpBf70.timeoutMs}ms</span>
                {data.externalPdpBf70.failOpen ? (
                  <>
                    {" "}
                    · <span className="font-medium">fail-open</span> on PDP errors (
                    <span className="font-mono">WMS_EXTERNAL_PDP_FAIL_OPEN</span>)
                  </>
                ) : (
                  <>
                    {" "}
                    · <span className="font-medium">fail-closed</span> on PDP errors
                  </>
                )}
                . See <span className="font-medium">docs/wms/WMS_EXTERNAL_PDP_BF70.md</span>.
              </p>
            </section>
          ) : null}
          {data.deniedPartyScreeningBf92?.enabled ? (
            <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-950">BF-92 — Denied-party screening</p>
              <p className="mt-2 text-xs text-amber-950/90">
                <span className="font-medium">mark_outbound_shipped</span> POSTs ship-party hints (
                <span className="font-mono">{data.deniedPartyScreeningBf92.schemaVersion}</span>) before committing shipment moves.
                Timeout <span className="font-mono">{data.deniedPartyScreeningBf92.timeoutMs}ms</span>
                {data.deniedPartyScreeningBf92.failOpen ? (
                  <>
                    {" "}
                    · <span className="font-medium">fail-open</span> on provider errors (
                    <span className="font-mono">WMS_DENIED_PARTY_SCREENING_FAIL_OPEN</span>)
                  </>
                ) : (
                  <>
                    {" "}
                    · <span className="font-medium">fail-closed</span> on provider errors
                  </>
                )}
                {data.deniedPartyScreeningBf92.bearerConfigured ? (
                  <>
                    {" "}
                    · Bearer auth configured (<span className="font-mono">WMS_DENIED_PARTY_SCREENING_BEARER_TOKEN</span>)
                  </>
                ) : null}
                . Response contract:{" "}
                <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-[11px]">
                  {`{ "allow": boolean, "reason"?: string }`}
                </code>
                .
              </p>
            </section>
          ) : null}
      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Pick allocation policy</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Controls how <span className="font-medium text-zinc-800">Create pick wave</span> orders bins and
          increments <span className="font-medium">allocatedQty</span>. Individual{" "}
          <span className="font-medium">Create pick task</span> actions always require an explicit bin choice.
          See <span className="font-medium">docs/wms/WMS_ALLOCATION_STRATEGIES.md</span>. BF-34 solver options require{" "}
          <span className="font-mono">WMS_ENABLE_BF34_SOLVER=1</span> on the server.
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
                    | "GREEDY_MIN_BIN_TOUCHES"
                    | "GREEDY_RESERVE_PICK_FACE"
                    | "GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE"
                    | "GREEDY_RESERVE_PICK_FACE_CUBE_AWARE"
                    | "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES"
                    | "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE"
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
                <option value="GREEDY_MIN_BIN_TOUCHES">
                  BF-15 — Greedy min bin touches (fungible waves): fewer bin visits heuristic per outbound line
                </option>
                <option value="GREEDY_RESERVE_PICK_FACE">
                  BF-23 — Min bin touches + reserve pick face (prefer bulk/reserve bins before isPickFace bins when ties)
                </option>
                <option value="GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE">
                  BF-33 — Min bin touches + cube-aware tier (carton dims + bin mm³ capacity hints when set)
                </option>
                <option value="GREEDY_RESERVE_PICK_FACE_CUBE_AWARE">
                  BF-33 — BF-23 reserve pick face + cube-aware tier
                </option>
                <option value="SOLVER_PROTOTYPE_MIN_BIN_TOUCHES">
                  BF-34 — Solver prototype: minimal slot subset + BF-15 (needs WMS_ENABLE_BF34_SOLVER=1)
                </option>
                <option value="SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE">
                  BF-34 — Solver prototype: minimal subset + BF-23 reserve (needs WMS_ENABLE_BF34_SOLVER=1)
                </option>
                <option value="MANUAL_ONLY">Manual only — automated waves disabled</option>
              </select>
            </label>
            <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                BF-15 · Wave task unit cap
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Optional max quantity per automated wave pick task (carton / tote / conveyor slice). Applies to all wave
                strategies except manual picks.
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">Cap units</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={pickWaveCartonCapDraft}
                    onChange={(e) => setPickWaveCartonCapDraft(e.target.value)}
                    placeholder="e.g. 24"
                    disabled={!canEdit || busy}
                    className="mt-0.5 block w-36 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={!canEdit || busy}
                  onClick={() =>
                    void runAction({
                      action: "set_warehouse_pick_wave_carton_units",
                      warehouseId: selectedWarehouseId,
                      pickWaveCartonUnits: pickWaveCartonCapDraft.trim()
                        ? Number(pickWaveCartonCapDraft.trim())
                        : null,
                    })
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Save cap
                </button>
                <button
                  type="button"
                  disabled={!canEdit || busy}
                  onClick={() => {
                    setPickWaveCartonCapDraft("");
                    void runAction({
                      action: "set_warehouse_pick_wave_carton_units",
                      warehouseId: selectedWarehouseId,
                      pickWaveCartonUnits: null,
                    });
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear cap
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">BF-33 · Carton & cube hints</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Master-carton dimensions (mm) and units-per-carton drive estimated pick cube for{" "}
          <span className="font-medium">GREEDY_*_CUBE_AWARE</span> strategies.{" "}
          <span className="font-medium">BF-89</span> adds optional pick-slice units (min with warehouse wave cap) and
          per-unit cube (cm³) when outer dims are incomplete. Optional bin soft capacity (mm³) on create nudges ordering
          when product hints resolve to cube. Outbound estimated cube (cbm) is surfaced on the payload for planning
          dashboards.
        </p>
        {!selectedWarehouseId ? (
          <p className="mt-3 text-sm text-zinc-500">
            Select a warehouse above to filter outbound picks for this warehouse.
          </p>
        ) : (
          <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Product master carton</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">SKU</span>
                  <select
                    disabled={!canEdit || busy}
                    value={bf33CartonProductId}
                    onChange={(e) => setBf33CartonProductId(e.target.value)}
                    className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select product…</option>
                    {productPickOptionsForWarehouse.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku || p.productCode || p.id.slice(0, 8)} · {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">L mm</span>
                  <input
                    value={bf33CartonL}
                    onChange={(e) => setBf33CartonL(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 400"
                    disabled={!canEdit || busy}
                    className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">W mm</span>
                  <input
                    value={bf33CartonW}
                    onChange={(e) => setBf33CartonW(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 300"
                    disabled={!canEdit || busy}
                    className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">H mm</span>
                  <input
                    value={bf33CartonH}
                    onChange={(e) => setBf33CartonH(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 250"
                    disabled={!canEdit || busy}
                    className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">Units / carton</span>
                  <input
                    value={bf33CartonUnits}
                    onChange={(e) => setBf33CartonUnits(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 24"
                    disabled={!canEdit || busy}
                    className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">
                    BF-89 · Pick slice max units (optional)
                  </span>
                  <input
                    value={bf89PickUnits}
                    onChange={(e) => setBf89PickUnits(e.target.value)}
                    inputMode="decimal"
                    placeholder="Min with warehouse BF-15 wave cap when both set"
                    disabled={!canEdit || busy}
                    className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">
                    BF-89 · Unit cube (cm³, optional)
                  </span>
                  <input
                    value={bf89UnitCubeCm3}
                    onChange={(e) => setBf89UnitCubeCm3(e.target.value)}
                    inputMode="decimal"
                    placeholder="Pick cube fallback when L/W/H master carton incomplete"
                    disabled={!canEdit || busy}
                    className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton
                  disabled={!canEdit || busy || !bf33CartonProductId}
                  onClick={() => {
                    const L = bf33CartonL.trim() === "" ? undefined : Number(bf33CartonL.trim());
                    const W = bf33CartonW.trim() === "" ? undefined : Number(bf33CartonW.trim());
                    const H = bf33CartonH.trim() === "" ? undefined : Number(bf33CartonH.trim());
                    const u = bf33CartonUnits.trim() === "" ? undefined : Number(bf33CartonUnits.trim());
                    const bf89u = bf89PickUnits.trim() === "" ? undefined : Number(bf89PickUnits.trim());
                    const bf89c = bf89UnitCubeCm3.trim() === "" ? undefined : Number(bf89UnitCubeCm3.trim());
                    void runAction({
                      action: "set_product_carton_cube_hints",
                      productId: bf33CartonProductId,
                      cartonLengthMm: L !== undefined && Number.isFinite(L) ? Math.trunc(L) : undefined,
                      cartonWidthMm: W !== undefined && Number.isFinite(W) ? Math.trunc(W) : undefined,
                      cartonHeightMm: H !== undefined && Number.isFinite(H) ? Math.trunc(H) : undefined,
                      cartonUnitsPerMasterCarton:
                        u !== undefined && Number.isFinite(u) && u > 0 ? u : undefined,
                      ...(bf89u !== undefined && Number.isFinite(bf89u) && bf89u > 0
                        ? { wmsCartonUnitsBf89: bf89u }
                        : {}),
                      ...(bf89c !== undefined && Number.isFinite(bf89c) && bf89c > 0
                        ? { wmsUnitCubeCm3Bf89: bf89c }
                        : {}),
                    });
                  }}
                >
                  Save carton hints
                </ActionButton>
                <button
                  type="button"
                  disabled={!canEdit || busy || !bf33CartonProductId}
                  onClick={() =>
                    void runAction({
                      action: "set_product_carton_cube_hints",
                      productId: bf33CartonProductId,
                      wmsCartonUnitsBf89: null,
                      wmsUnitCubeCm3Bf89: null,
                    })
                  }
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear BF-89 fields
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                Outbound cube hint (cbm)
              </p>
              <label className="mt-2 block">
                <span className="text-[10px] font-medium uppercase text-zinc-500">Outbound</span>
                <select
                  disabled={!canEdit || busy}
                  value={bf33OutboundCubeOrderId}
                  onChange={(e) => setBf33OutboundCubeOrderId(e.target.value)}
                  className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select outbound…</option>
                  {outboundOrdersForWarehouse.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.outboundNo} · {o.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2 block">
                <span className="text-[10px] font-medium uppercase text-zinc-500">Estimated cube (cbm)</span>
                <input
                  value={bf33EstimatedCubeCbm}
                  onChange={(e) => setBf33EstimatedCubeCbm(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 1.25"
                  disabled={!canEdit || busy}
                  className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <ActionButton
                  disabled={
                    !canEdit ||
                    busy ||
                    !bf33OutboundCubeOrderId ||
                    !bf33EstimatedCubeCbm.trim() ||
                    !Number.isFinite(Number(bf33EstimatedCubeCbm.trim())) ||
                    Number(bf33EstimatedCubeCbm.trim()) < 0
                  }
                  onClick={() => {
                    const raw = bf33EstimatedCubeCbm.trim();
                    void runAction({
                      action: "set_outbound_order_cube_hint",
                      outboundOrderId: bf33OutboundCubeOrderId,
                      estimatedCubeCbm: Number(raw),
                    });
                  }}
                >
                  Save outbound cube
                </ActionButton>
                <button
                  type="button"
                  disabled={!canEdit || busy || !bf33OutboundCubeOrderId}
                  onClick={() => {
                    setBf33EstimatedCubeCbm("");
                    void runAction({
                      action: "set_outbound_order_cube_hint",
                      outboundOrderId: bf33OutboundCubeOrderId,
                      estimatedCubeCbm: null,
                    });
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear cube
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              BF-63 — Catch-weight product
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Marks SKUs variable net-weight for receiving. Shipments optionally set a catch-weight % band via{" "}
              <span className="font-medium">Catch wt %</span> on inbound (vs declared <span className="font-medium">cargoGrossWeightKg</span>).
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-medium uppercase text-zinc-500">Product</span>
                <select
                  disabled={!canEdit || busy}
                  value={bf63CatchProductId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setBf63CatchProductId(id);
                    const p = productPickOptionsForWarehouse.find((x) => x.id === id);
                    setBf63IsCatchWeight(p?.isCatchWeight ?? false);
                    setBf63LabelHint(p?.catchWeightLabelHint ?? "");
                  }}
                  className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select product…</option>
                  {productPickOptionsForWarehouse.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku || p.productCode || p.id.slice(0, 8)} · {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700 sm:col-span-2">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  disabled={!canEdit || busy || !bf63CatchProductId}
                  checked={bf63IsCatchWeight}
                  onChange={(e) => setBf63IsCatchWeight(e.target.checked)}
                />
                Catch-weight SKU
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-medium uppercase text-zinc-500">Label / scale hint</span>
                <input
                  value={bf63LabelHint}
                  onChange={(e) => setBf63LabelHint(e.target.value)}
                  disabled={!canEdit || busy || !bf63CatchProductId}
                  placeholder="e.g. Weigh master carton"
                  className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3">
              <ActionButton
                disabled={!canEdit || busy || !bf63CatchProductId}
                onClick={() =>
                  void runAction({
                    action: "set_product_catch_weight_bf63",
                    productId: bf63CatchProductId,
                    isCatchWeight: bf63IsCatchWeight,
                    catchWeightLabelHint: bf63LabelHint.trim() ? bf63LabelHint.trim() : null,
                  })
                }
              >
                Save catch-weight profile
              </ActionButton>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-900">
              BF-69 — Product CO₂e planning factor
            </p>
            <p className="mt-1 text-[11px] text-emerald-950/85">
              Optional grams CO₂e per kg·km on the SKU for sustainability handoffs —{" "}
              <span className="font-medium">indicative only</span>, not audited carbon accounting.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-medium uppercase text-zinc-500">Product</span>
                <select
                  disabled={!canEdit || busy}
                  value={bf69Co2eProductId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setBf69Co2eProductId(id);
                    const p = productPickOptionsForWarehouse.find((x) => x.id === id);
                    setBf69Co2eFactorStr(p?.wmsCo2eFactorGramsPerKgKm?.trim() ?? "");
                  }}
                  className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select product…</option>
                  {productPickOptionsForWarehouse.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku || p.productCode || p.id.slice(0, 8)} · {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-medium uppercase text-zinc-500">
                  g CO₂e per kg·km (blank = no change on save; use Clear to remove)
                </span>
                <input
                  value={bf69Co2eFactorStr}
                  onChange={(e) => setBf69Co2eFactorStr(e.target.value)}
                  inputMode="decimal"
                  disabled={!canEdit || busy || !bf69Co2eProductId}
                  placeholder="e.g. 35"
                  className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  !canEdit ||
                  busy ||
                  !bf69Co2eProductId ||
                  !bf69Co2eFactorStr.trim() ||
                  !Number.isFinite(Number(bf69Co2eFactorStr.trim())) ||
                  Number(bf69Co2eFactorStr.trim()) < 0
                }
                onClick={() =>
                  void runAction({
                    action: "set_product_wms_co2e_factor_bf69",
                    productId: bf69Co2eProductId,
                    wmsCo2eFactorGramsPerKgKm: Number(bf69Co2eFactorStr.trim()),
                  })
                }
                className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Save factor
              </button>
              <button
                type="button"
                disabled={!canEdit || busy || !bf69Co2eProductId}
                onClick={() => {
                  setBf69Co2eFactorStr("");
                  void runAction({
                    action: "set_product_wms_co2e_factor_bf69",
                    productId: bf69Co2eProductId,
                    wmsCo2eFactorGramsPerKgKm: null,
                  });
                }}
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-950 disabled:opacity-40"
              >
                Clear factor
              </button>
            </div>
          </div>
          </>
        )}
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Current layout</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Read-only view of zones, aisle masters (BF-24), bins, and replenishment rules. Bins can carry optional{" "}
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
                Aisles ({aislesForWarehouse.length})
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Corridor identifiers plus optional mm hints. Bins can reference a master so labels stay consistent.
              </p>
              <div className="mt-2 max-h-48 overflow-auto rounded border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-100 text-left text-xs uppercase text-zinc-700">
                    <tr>
                      <th className="px-2 py-1">Code</th>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Zone hint</th>
                      <th className="px-2 py-1">Active</th>
                      <th className="px-2 py-1">L×W mm</th>
                      <th className="px-2 py-1"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {aislesForWarehouse.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-2 text-zinc-500">
                          No aisle masters for this warehouse yet.
                        </td>
                      </tr>
                    ) : (
                      [...aislesForWarehouse]
                        .sort((a, b) => a.code.localeCompare(b.code))
                        .map((a) => (
                          <tr
                            key={a.id}
                            className={a.isActive ? undefined : "bg-zinc-50 text-zinc-500"}
                          >
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-xs">{a.code}</td>
                            <td className="px-2 py-1 text-zinc-800">{a.name}</td>
                            <td className="px-2 py-1 text-zinc-600">
                              {a.zone ? `${a.zone.code}` : "—"}
                            </td>
                            <td className="px-2 py-1 text-zinc-600">{a.isActive ? "Yes" : "No"}</td>
                            <td className="whitespace-nowrap px-2 py-1 text-xs text-zinc-600">
                              {a.lengthMm != null || a.widthMm != null
                                ? `${a.lengthMm ?? "—"} × ${a.widthMm ?? "—"}`
                                : "—"}
                            </td>
                            <td className="px-2 py-1">
                              {canEdit ? (
                                a.isActive ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void runAction({
                                        action: "update_warehouse_aisle",
                                        warehouseAisleId: a.id,
                                        isActive: false,
                                      })
                                    }
                                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void runAction({
                                        action: "update_warehouse_aisle",
                                        warehouseAisleId: a.id,
                                        isActive: true,
                                      })
                                    }
                                    className="rounded-lg bg-[var(--arscmp-primary)] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                                  >
                                    Reactivate
                                  </button>
                                )
                              ) : null}
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
                      <th className="px-2 py-1">XD stage</th>
                      <th className="px-2 py-1">Max pal.</th>
                      <th className="px-2 py-1">Rack</th>
                      <th className="px-2 py-1">Aisle master</th>
                      <th className="px-2 py-1">Aisle</th>
                      <th className="px-2 py-1">Bay</th>
                      <th className="px-2 py-1">Lvl</th>
                      <th className="px-2 py-1">Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {binsForWarehouse.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-2 py-2 text-zinc-500">
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
                            <td className="px-2 py-1 text-zinc-600">{b.isCrossDockStaging ? "Yes" : "—"}</td>
                            <td className="px-2 py-1 text-zinc-600">
                              {b.maxPallets != null ? String(b.maxPallets) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-xs text-zinc-700">
                              {b.rackCode ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-xs text-zinc-700">
                              {b.warehouseAisle?.code ?? "—"}
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
            <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Labor standards (BF-53)
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Engineered <span className="font-medium">standard minutes</span> per task type; new tasks snapshot{" "}
                <span className="font-mono text-[11px]">standardMinutes</span>. Use{" "}
                <span className="font-mono text-[11px]">start_wms_task</span> on Operations so{" "}
                <span className="font-mono text-[11px]">completedAt − startedAt</span> feeds home KPIs (
                <span className="font-medium">org.wms.setup → edit</span>).
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <select
                  value={laborStdTaskType}
                  onChange={(e) => setLaborStdTaskType(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  {WMS_LABOR_TASK_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                <label className="text-[11px] text-zinc-600">
                  Minutes
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={laborStdMinutes}
                    onChange={(e) => setLaborStdMinutes(e.target.value)}
                    className="ml-1 w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={laborStdBusy || !canEdit}
                  onClick={() =>
                    void (async () => {
                      try {
                        setLaborStdBusy(true);
                        const m = Math.floor(Number(laborStdMinutes));
                        if (!Number.isFinite(m) || m < 1 || m > 10080) {
                          window.alert("Minutes must be 1–10080.");
                          return;
                        }
                        await runAction({
                          action: "set_wms_labor_task_standard",
                          laborTaskType: laborStdTaskType,
                          laborStandardMinutes: m,
                        });
                      } finally {
                        setLaborStdBusy(false);
                      }
                    })()
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {laborStdBusy ? "Saving…" : "Save standard"}
                </button>
              </div>
              <div className="mt-3 max-h-40 overflow-auto rounded border border-zinc-200 bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase text-zinc-600">
                    <tr>
                      <th className="px-2 py-1">Task type</th>
                      <th className="px-2 py-1">Std min</th>
                      <th className="px-2 py-1">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.laborStandards?.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-2 text-zinc-500">
                          No standards yet — configure above so new tasks copy{" "}
                          <span className="font-mono">standardMinutes</span>.
                        </td>
                      </tr>
                    ) : (
                      (data.laborStandards ?? []).map((r) => (
                        <tr key={r.taskType} className="border-t border-zinc-100">
                          <td className="px-2 py-1 font-medium text-zinc-800">{r.taskType}</td>
                          <td className="px-2 py-1 tabular-nums">{r.standardMinutes}</td>
                          <td className="px-2 py-1 text-zinc-600">{r.updatedAt.slice(0, 16)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/35 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Labor variance queue (BF-77)
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Flags recent <span className="font-medium">DONE</span> tasks where{" "}
                <span className="font-mono text-[11px]">completedAt − startedAt</span> exceeds the snapshotted{" "}
                <span className="font-mono text-[11px]">standardMinutes</span> by a tenant threshold. Exceptions are
                listed on Operations below and refreshed on each{" "}
                <span className="font-mono text-[11px]">GET /api/wms</span> (
                <span className="font-medium">org.wms.setup → edit</span>). See{" "}
                <span className="font-medium">docs/wms/WMS_LABOR_VARIANCE_BF77.md</span>.
              </p>
              {data?.laborVarianceBf77?.policyNotice ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {data.laborVarianceBf77.policyNotice}
                </p>
              ) : null}
              <label className="mt-3 flex items-center gap-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={laborVarianceEnabledBf77}
                  onChange={(e) => setLaborVarianceEnabledBf77(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Enable variance queue on dashboard
              </label>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-[11px] text-zinc-600">
                  Excess vs std %
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={laborVarianceExcessPctBf77}
                    onChange={(e) => setLaborVarianceExcessPctBf77(e.target.value)}
                    className="ml-1 w-16 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-[11px] text-zinc-600">
                  Min actual min
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={laborVarianceMinActualBf77}
                    onChange={(e) => setLaborVarianceMinActualBf77(e.target.value)}
                    className="ml-1 w-14 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-[11px] text-zinc-600">
                  Min std min
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={laborVarianceMinStdBf77}
                    onChange={(e) => setLaborVarianceMinStdBf77(e.target.value)}
                    className="ml-1 w-14 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-[11px] text-zinc-600">
                  Lookback days
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={laborVarianceLookbackBf77}
                    onChange={(e) => setLaborVarianceLookbackBf77(e.target.value)}
                    className="ml-1 w-14 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-[11px] text-zinc-600">
                  Max rows
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={laborVarianceMaxRowsBf77}
                    onChange={(e) => setLaborVarianceMaxRowsBf77(e.target.value)}
                    className="ml-1 w-14 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={laborVarianceBusyBf77 || !canEdit}
                  onClick={() =>
                    void (async () => {
                      try {
                        setLaborVarianceBusyBf77(true);
                        const excess = Math.floor(Number(laborVarianceExcessPctBf77));
                        const minAct = Math.floor(Number(laborVarianceMinActualBf77));
                        const minStd = Math.floor(Number(laborVarianceMinStdBf77));
                        const lb = Math.floor(Number(laborVarianceLookbackBf77));
                        const mx = Math.floor(Number(laborVarianceMaxRowsBf77));
                        if (
                          !Number.isFinite(excess) ||
                          excess < 0 ||
                          excess > 500 ||
                          !Number.isFinite(minAct) ||
                          minAct < 0 ||
                          minAct > 180 ||
                          !Number.isFinite(minStd) ||
                          minStd < 1 ||
                          minStd > 10080 ||
                          !Number.isFinite(lb) ||
                          lb < 1 ||
                          lb > 90 ||
                          !Number.isFinite(mx) ||
                          mx < 5 ||
                          mx > 200
                        ) {
                          window.alert("Check BF-77 numeric limits (see docs).");
                          return;
                        }
                        await runAction({
                          action: "set_wms_labor_variance_policy",
                          laborVarianceEnabled: laborVarianceEnabledBf77,
                          laborVarianceExcessPercentThreshold: excess,
                          laborVarianceMinActualMinutes: minAct,
                          laborVarianceMinStandardMinutes: minStd,
                          laborVarianceLookbackDays: lb,
                          laborVarianceMaxRows: mx,
                        });
                      } finally {
                        setLaborVarianceBusyBf77(false);
                      }
                    })()
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {laborVarianceBusyBf77 ? "Saving…" : "Save BF-77 policy"}
                </button>
                <button
                  type="button"
                  disabled={laborVarianceBusyBf77 || !canEdit}
                  onClick={() =>
                    void (async () => {
                      if (!window.confirm("Clear labor variance policy for this tenant?")) return;
                      try {
                        setLaborVarianceBusyBf77(true);
                        await runAction({
                          action: "set_wms_labor_variance_policy",
                          laborVariancePolicyClear: true,
                        });
                        setLaborVarianceEnabledBf77(false);
                      } finally {
                        setLaborVarianceBusyBf77(false);
                      }
                    })()
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-teal-100 bg-teal-50/35 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                ATP reservation tiers (BF-88)
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Tier rules set default TTL and <span className="font-medium">priority</span> on soft reservations from{" "}
                <span className="font-mono text-[11px]">referenceType</span> /{" "}
                <span className="font-mono text-[11px]">referenceId</span> / optional tier tag. Optional{" "}
                <span className="font-medium">pick floor</span> ignores low-priority reservations when allocating picks,
                waves, replen moves, and STO ships — dashboard ATP stays strict (all soft qty).
              </p>
              {data?.atpReservationPolicyBf88?.policyNotice ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {data.atpReservationPolicyBf88.policyNotice}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-[11px] text-zinc-600">
                  Default TTL (sec)
                  <input
                    type="number"
                    min={1}
                    value={bf88DefaultTtl}
                    onChange={(e) => setBf88DefaultTtl(e.target.value)}
                    className="ml-1 w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-[11px] text-zinc-600">
                  Default priority
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={bf88DefaultPri}
                    onChange={(e) => setBf88DefaultPri(e.target.value)}
                    className="ml-1 w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-[11px] text-zinc-600">
                  Pick ATP floor (priority ≥)
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    placeholder="empty = all soft qty"
                    value={bf88PickFloor}
                    onChange={(e) => setBf88PickFloor(e.target.value)}
                    className="ml-1 w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                Tiers JSON (first match wins). Example:{" "}
                <span className="font-mono text-[10px]">
                  {`[{"ttlSeconds":7200,"priorityBf88":400,"matchReferenceTypePrefix":"CHANNEL:"}]`}
                </span>
              </p>
              <textarea
                value={bf88TiersJson}
                onChange={(e) => setBf88TiersJson(e.target.value)}
                rows={6}
                spellCheck={false}
                disabled={bf88Busy || !canEdit}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 font-mono text-[11px] text-zinc-900"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={bf88Busy || !canEdit}
                  onClick={() =>
                    void (async () => {
                      try {
                        setBf88Busy(true);
                        const dt = Math.floor(Number(bf88DefaultTtl));
                        const dp = Math.floor(Number(bf88DefaultPri));
                        if (
                          !Number.isFinite(dt) ||
                          dt <= 0 ||
                          dt > 86400 * 366 ||
                          !Number.isFinite(dp) ||
                          dp < 0 ||
                          dp > 100000
                        ) {
                          window.alert("Check default TTL (1–366d) and priority (0–100000).");
                          return;
                        }
                        let tiersParsed: unknown;
                        try {
                          tiersParsed = JSON.parse(bf88TiersJson || "[]") as unknown;
                        } catch {
                          window.alert("Tiers must be valid JSON array.");
                          return;
                        }
                        if (!Array.isArray(tiersParsed)) {
                          window.alert("Tiers JSON must be an array.");
                          return;
                        }
                        const floorRaw = bf88PickFloor.trim();
                        let floorArg: number | null = null;
                        if (floorRaw !== "") {
                          const fl = Math.floor(Number(floorRaw));
                          if (!Number.isFinite(fl) || fl < 0 || fl > 100000) {
                            window.alert("Pick floor must be empty or 0–100000.");
                            return;
                          }
                          floorArg = fl;
                        }
                        await runAction({
                          action: "set_wms_atp_reservation_policy_bf88",
                          atpReservationDefaultTtlSecondsBf88: dt,
                          atpReservationDefaultPriorityBf88: dp,
                          atpReservationPickFloorPriorityBf88: floorArg,
                          atpReservationTiersBf88: tiersParsed,
                        });
                      } finally {
                        setBf88Busy(false);
                      }
                    })()
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {bf88Busy ? "Saving…" : "Save BF-88 policy"}
                </button>
                <button
                  type="button"
                  disabled={bf88Busy || !canEdit}
                  onClick={() =>
                    void (async () => {
                      if (!window.confirm("Clear ATP reservation policy for this tenant?")) return;
                      try {
                        setBf88Busy(true);
                        await runAction({
                          action: "set_wms_atp_reservation_policy_bf88",
                          atpReservationPolicyBf88Clear: true,
                        });
                        setBf88DefaultTtl("3600");
                        setBf88DefaultPri("100");
                        setBf88PickFloor("");
                        setBf88TiersJson("[]");
                      } finally {
                        setBf88Busy(false);
                      }
                    })()
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/35 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                RFID commissioning bridge (BF-81)
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Tenant JSON maps TID hex / GS1 SSCC URIs / GTIN digits into BF-29 multiset tokens before{" "}
                <span className="font-mono text-[11px]">validate_outbound_pack_scan</span>, pack/ship gates, and BF-60
                batch replay. See <span className="font-medium">docs/wms/WMS_RFID_COMMISSIONING_BF81.md</span>.
              </p>
              {data?.rfidEncodingBf81?.parseNotice ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {data.rfidEncodingBf81.parseNotice}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-zinc-600">
                Stored policy enabled:{" "}
                <span className="font-semibold text-zinc-800">{data?.rfidEncodingBf81?.enabled ? "yes" : "no"}</span>
              </p>
              <textarea
                value={rfidEncodingDraftBf81}
                onChange={(e) => setRfidEncodingDraftBf81(e.target.value)}
                rows={10}
                spellCheck={false}
                disabled={rfidEncodingBusyBf81 || !canEdit}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white p-2 font-mono text-[11px] text-zinc-900"
                placeholder={`{\n  "schemaVersion": "bf81.v1",\n  "enabled": true,\n  "tidHexPrefixStrip": ["E280"],\n  "tidHexToPackToken": { "DEADBEEF": "SKU-A" },\n  "tidSuffixHexToPackToken": {}\n}`}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={rfidEncodingBusyBf81 || !canEdit}
                  onClick={() =>
                    void (async () => {
                      try {
                        setRfidEncodingBusyBf81(true);
                        let doc: unknown;
                        try {
                          doc = JSON.parse(rfidEncodingDraftBf81 || "{}") as unknown;
                        } catch {
                          window.alert("Invalid JSON — fix the textarea before saving.");
                          return;
                        }
                        await runAction({
                          action: "set_wms_rfid_encoding_table_bf81",
                          rfidEncodingTableBf81: doc,
                        });
                      } finally {
                        setRfidEncodingBusyBf81(false);
                      }
                    })()
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {rfidEncodingBusyBf81 ? "Saving…" : "Save BF-81 encoding table"}
                </button>
                <button
                  type="button"
                  disabled={rfidEncodingBusyBf81 || !canEdit}
                  onClick={() =>
                    void (async () => {
                      if (!window.confirm("Clear RFID encoding table for this tenant?")) return;
                      try {
                        setRfidEncodingBusyBf81(true);
                        await runAction({
                          action: "set_wms_rfid_encoding_table_bf81",
                          rfidEncodingTableBf81Clear: true,
                        });
                        setRfidEncodingDraftBf81("");
                      } finally {
                        setRfidEncodingBusyBf81(false);
                      }
                    })()
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/35 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Feature flags (BF-93)</h3>
              <p className="mt-1 text-xs text-zinc-600">
                Tenant bundle <span className="font-mono text-[11px]">wmsFeatureFlagsJsonBf93</span> surfaced on{" "}
                <span className="font-mono text-[11px]">GET /api/wms</span> — POST{" "}
                <span className="font-mono text-[11px]">set_wms_feature_flags</span> (
                <span className="font-medium">org.wms.setup → edit</span>). Values: boolean, finite number, short string,
                or null per flag key.
              </p>
              {data?.wmsFeatureFlagsBf93?.parseError ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Parse warning: {data.wmsFeatureFlagsBf93.parseError}
                </p>
              ) : null}
              <textarea
                value={bf93FeatureFlagsJsonDraft}
                onChange={(e) => setBf93FeatureFlagsJsonDraft(e.target.value)}
                rows={8}
                spellCheck={false}
                disabled={bf93FeatureFlagsBusy || !canEdit}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white p-2 font-mono text-[11px] text-zinc-900"
                placeholder={`{\n  "exampleRolloutToggle": true,\n  "opsPilotHint": "demo"\n}`}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={bf93FeatureFlagsBusy || !canEdit}
                  onClick={() =>
                    void (async () => {
                      try {
                        setBf93FeatureFlagsBusy(true);
                        let doc: unknown;
                        try {
                          doc = JSON.parse(bf93FeatureFlagsJsonDraft.trim() || "{}") as unknown;
                        } catch {
                          window.alert("Invalid JSON — fix the textarea before saving.");
                          return;
                        }
                        await runAction({
                          action: "set_wms_feature_flags",
                          wmsFeatureFlagsBf93: doc,
                        });
                      } finally {
                        setBf93FeatureFlagsBusy(false);
                      }
                    })()
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {bf93FeatureFlagsBusy ? "Saving…" : "Save BF-93 flags"}
                </button>
                <button
                  type="button"
                  disabled={bf93FeatureFlagsBusy || !canEdit}
                  onClick={() =>
                    void (async () => {
                      if (!window.confirm("Clear tenant WMS feature flags for this tenant?")) return;
                      try {
                        setBf93FeatureFlagsBusy(true);
                        await runAction({
                          action: "set_wms_feature_flags",
                          wmsFeatureFlagsBf93Clear: true,
                        });
                        setBf93FeatureFlagsJsonDraft("{}");
                      } finally {
                        setBf93FeatureFlagsBusy(false);
                      }
                    })()
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/35 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Dock detention (BF-54)
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Tenant-wide thresholds on <span className="font-medium">gate → dock</span> and{" "}
                <span className="font-medium">dock dwell</span>. Alerts are computed on read from yard timestamps (
                <span className="font-medium">org.wms.setup → edit</span>). Retrospective breaches log{" "}
                <span className="font-mono text-[11px]">dock_detention_breach</span> on{" "}
                <span className="font-mono text-[11px]">CtAuditLog</span> when milestones complete a slow segment.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={dockDetentionEnabled}
                    onChange={(e) => setDockDetentionEnabled(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  Enable alerts
                </label>
                <label className="text-[11px] text-zinc-600">
                  Gate→dock (min)
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={dockDetentionGateMin}
                    onChange={(e) => setDockDetentionGateMin(e.target.value)}
                    className="ml-1 w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-[11px] text-zinc-600">
                  At dock (min)
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={dockDetentionDwellMin}
                    onChange={(e) => setDockDetentionDwellMin(e.target.value)}
                    className="ml-1 w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={dockDetentionBusy || !canEdit}
                  onClick={() =>
                    void (async () => {
                      try {
                        setDockDetentionBusy(true);
                        const g = Math.floor(Number(dockDetentionGateMin));
                        const d = Math.floor(Number(dockDetentionDwellMin));
                        if (!Number.isFinite(g) || g < 1 || !Number.isFinite(d) || d < 1) {
                          window.alert("Thresholds must be integers ≥ 1.");
                          return;
                        }
                        await runAction({
                          action: "set_wms_dock_detention_policy",
                          dockDetentionEnabled,
                          dockDetentionFreeGateToDockMinutes: g,
                          dockDetentionFreeDockToDepartMinutes: d,
                        });
                      } finally {
                        setDockDetentionBusy(false);
                      }
                    })()
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {dockDetentionBusy ? "Saving…" : "Save policy"}
                </button>
                <button
                  type="button"
                  disabled={dockDetentionBusy || !canEdit}
                  onClick={() =>
                    void (async () => {
                      if (!window.confirm("Clear dock detention policy for this tenant?")) return;
                      try {
                        setDockDetentionBusy(true);
                        await runAction({
                          action: "set_wms_dock_detention_policy",
                          dockDetentionPolicyClear: true,
                        });
                        setDockDetentionEnabled(false);
                      } finally {
                        setDockDetentionBusy(false);
                      }
                    })()
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Topology graph export (BF-50)
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                JSON nodes/edges for aisle masters and bins: <span className="font-medium">BIN_IN_AISLE</span> links plus
                heuristic <span className="font-medium">ADJACENT_SLOT</span> (same aisle FK + rack + bay + level;
                consecutive positions). Endpoint{" "}
                <span className="font-mono text-[11px]">GET /api/wms?topologyGraph=1&amp;warehouseId=…</span> (
                <span className="font-medium">org.wms → view</span>).
              </p>
              <button
                type="button"
                disabled={topologyExportBusy || !selectedWarehouseId}
                onClick={() =>
                  void (async () => {
                    try {
                      setTopologyExportBusy(true);
                      const params = new URLSearchParams();
                      params.set("topologyGraph", "1");
                      params.set("warehouseId", selectedWarehouseId);
                      const res = await fetch(`/api/wms?${params.toString()}`, { credentials: "include" });
                      const parsed: unknown = await res.json().catch(() => null);
                      if (!res.ok) throw new Error(apiClientErrorMessage(parsed, "Topology export failed."));
                      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
                      const href = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = href;
                      a.download = `warehouse-topology-${selectedWarehouseId.slice(0, 8)}.json`;
                      a.click();
                      URL.revokeObjectURL(href);
                    } catch (e) {
                      window.alert(e instanceof Error ? e.message : "Topology export failed.");
                    } finally {
                      setTopologyExportBusy(false);
                    }
                  })()
                }
                className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {topologyExportBusy ? "Exporting…" : "Download topology JSON"}
              </button>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Slotting recommendations (BF-52)
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Advisory ABC from outbound <span className="font-medium">PICK</span> volumes +{" "}
                <span className="font-medium">WarehouseBin.isPickFace</span>. Read-only{" "}
                <span className="font-mono text-[11px]">GET /api/wms/slotting-recommendations</span> — JSON or{" "}
                <span className="font-mono text-[11px]">format=csv</span> (<span className="font-medium">org.wms → view</span>).
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="block text-[11px] text-zinc-600">
                  Window (days)
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={slottingWindowDays}
                    onChange={(e) => setSlottingWindowDays(e.target.value)}
                    className="ml-1 w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={slottingLoadBusy || !selectedWarehouseId}
                  onClick={() =>
                    void (async () => {
                      try {
                        setSlottingLoadBusy(true);
                        const days = Math.min(365, Math.max(1, Math.floor(Number(slottingWindowDays) || 30)));
                        const params = new URLSearchParams();
                        params.set("warehouseId", selectedWarehouseId);
                        params.set("days", String(days));
                        const res = await fetch(`/api/wms/slotting-recommendations?${params.toString()}`, {
                          credentials: "include",
                        });
                        const parsed: unknown = await res.json().catch(() => null);
                        if (!res.ok) throw new Error(apiClientErrorMessage(parsed, "Slotting recommendations failed."));
                        setSlottingPreview(parsed as Bf52SlottingPreview);
                      } catch (e) {
                        window.alert(e instanceof Error ? e.message : "Slotting recommendations failed.");
                      } finally {
                        setSlottingLoadBusy(false);
                      }
                    })()
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {slottingLoadBusy ? "Loading…" : "Load preview"}
                </button>
                <button
                  type="button"
                  disabled={!selectedWarehouseId}
                  onClick={() =>
                    void (async () => {
                      try {
                        const days = Math.min(365, Math.max(1, Math.floor(Number(slottingWindowDays) || 30)));
                        const params = new URLSearchParams();
                        params.set("warehouseId", selectedWarehouseId);
                        params.set("days", String(days));
                        const res = await fetch(`/api/wms/slotting-recommendations?${params.toString()}`, {
                          credentials: "include",
                        });
                        const parsed: unknown = await res.json().catch(() => null);
                        if (!res.ok) throw new Error(apiClientErrorMessage(parsed, "Slotting JSON export failed."));
                        const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
                        const href = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = href;
                        a.download = `slotting-recommendations-${selectedWarehouseId.slice(0, 8)}.json`;
                        a.click();
                        URL.revokeObjectURL(href);
                      } catch (e) {
                        window.alert(e instanceof Error ? e.message : "Slotting JSON export failed.");
                      }
                    })()
                  }
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                >
                  Download JSON
                </button>
                <a
                  href={
                    selectedWarehouseId
                      ? (() => {
                          const days = Math.min(365, Math.max(1, Math.floor(Number(slottingWindowDays) || 30)));
                          const p = new URLSearchParams();
                          p.set("warehouseId", selectedWarehouseId);
                          p.set("days", String(days));
                          p.set("format", "csv");
                          return `/api/wms/slotting-recommendations?${p.toString()}`;
                        })()
                      : "#"
                  }
                  onClick={(e) => {
                    if (!selectedWarehouseId) e.preventDefault();
                  }}
                  className={`inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 ${
                    selectedWarehouseId ? "" : "pointer-events-none opacity-40"
                  }`}
                >
                  Download CSV
                </a>
              </div>
              {slottingPreview ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] leading-snug text-zinc-600">{slottingPreview.methodology}</p>
                  <p className="text-[11px] text-zinc-600">
                    Scanned {slottingPreview.summary.balancesScanned} balance rows ·{" "}
                    {slottingPreview.summary.recommendationCount} recommendations · pick-face bins{" "}
                    {slottingPreview.summary.pickFaceBins} · bulk candidates {slottingPreview.summary.bulkCandidateBins} · SKUs
                    with picks {slottingPreview.summary.productsWithPicks}
                  </p>
                  {slottingPreview.warnings.length > 0 ? (
                    <ul className="list-inside list-disc text-[11px] text-amber-900">
                      {slottingPreview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="max-h-64 overflow-auto rounded border border-zinc-200 bg-white">
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase text-zinc-600">
                        <tr>
                          <th className="px-2 py-1">Pri</th>
                          <th className="px-2 py-1">Reason</th>
                          <th className="px-2 py-1">ABC</th>
                          <th className="px-2 py-1">Pick vol</th>
                          <th className="px-2 py-1">SKU</th>
                          <th className="px-2 py-1">From</th>
                          <th className="px-2 py-1">To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {slottingPreview.recommendations.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-2 py-2 text-zinc-500">
                              No actionable rows — inventory already matches coarse pick-face / bulk hints, or no PICK history in the
                              window.
                            </td>
                          </tr>
                        ) : (
                          slottingPreview.recommendations.slice(0, 40).map((r, idx) => (
                            <tr key={`${r.product.productCode ?? r.product.sku ?? "p"}-${r.currentBin.code}-${idx}`}>
                              <td className="whitespace-nowrap px-2 py-1 font-mono">{r.priorityScore}</td>
                              <td className="px-2 py-1 text-zinc-700">{r.reasonCode}</td>
                              <td className="px-2 py-1">{r.abcClass}</td>
                              <td className="whitespace-nowrap px-2 py-1 font-mono">{r.productPickVolume}</td>
                              <td className="px-2 py-1 text-zinc-800">
                                {r.product.productCode || r.product.sku || "—"} · {r.product.name}
                              </td>
                              <td className="px-2 py-1 text-zinc-600">
                                {r.currentBin.code}
                                {r.currentBin.isPickFace ? " · PF" : ""}
                              </td>
                              <td className="px-2 py-1 text-zinc-600">
                                {r.suggestedBin ? r.suggestedBin.code : "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Capacity utilization snapshot (BF-86)
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Bin cohort with pick velocity (same <span className="font-medium">PICK</span> ledger window as slotting above) plus optional cube utilization vs{" "}
                <span className="font-medium">capacityCubeCubicMm</span>.{" "}
                <span className="font-mono text-[11px]">GET /api/wms/capacity-utilization-snapshot</span> · capped bins ·{" "}
                <span className="font-medium">docs/wms/WMS_CAPACITY_UTILIZATION_BF86.md</span>.
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  disabled={bf86CapBusy || !selectedWarehouseId}
                  onClick={() =>
                    void (async () => {
                      try {
                        setBf86CapBusy(true);
                        const days = Math.min(365, Math.max(1, Math.floor(Number(slottingWindowDays) || 30)));
                        const params = new URLSearchParams();
                        params.set("warehouseId", selectedWarehouseId);
                        params.set("days", String(days));
                        params.set("limitBins", "200");
                        params.set("sort", "velocity_desc");
                        const res = await fetch(`/api/wms/capacity-utilization-snapshot?${params.toString()}`, {
                          credentials: "include",
                        });
                        const parsed: unknown = await res.json().catch(() => null);
                        if (!res.ok) throw new Error(apiClientErrorMessage(parsed, "Capacity snapshot failed."));
                        setBf86CapPreview(parsed as Bf86CapacityPreview);
                      } catch (e) {
                        window.alert(e instanceof Error ? e.message : "Capacity snapshot failed.");
                      } finally {
                        setBf86CapBusy(false);
                      }
                    })()
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {bf86CapBusy ? "Loading…" : "Load preview"}
                </button>
                <button
                  type="button"
                  disabled={!selectedWarehouseId}
                  onClick={() =>
                    void (async () => {
                      try {
                        const days = Math.min(365, Math.max(1, Math.floor(Number(slottingWindowDays) || 30)));
                        const params = new URLSearchParams();
                        params.set("warehouseId", selectedWarehouseId);
                        params.set("days", String(days));
                        params.set("limitBins", "200");
                        const res = await fetch(`/api/wms/capacity-utilization-snapshot?${params.toString()}`, {
                          credentials: "include",
                        });
                        const parsed: unknown = await res.json().catch(() => null);
                        if (!res.ok) throw new Error(apiClientErrorMessage(parsed, "Capacity JSON export failed."));
                        const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
                        const href = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = href;
                        a.download = `capacity-utilization-${selectedWarehouseId.slice(0, 8)}.json`;
                        a.click();
                        URL.revokeObjectURL(href);
                      } catch (e) {
                        window.alert(e instanceof Error ? e.message : "Capacity JSON export failed.");
                      }
                    })()
                  }
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                >
                  Download JSON
                </button>
                <a
                  href={
                    selectedWarehouseId
                      ? (() => {
                          const days = Math.min(365, Math.max(1, Math.floor(Number(slottingWindowDays) || 30)));
                          const p = new URLSearchParams();
                          p.set("warehouseId", selectedWarehouseId);
                          p.set("days", String(days));
                          p.set("limitBins", "200");
                          return `/api/wms/capacity-utilization-snapshot?${p.toString()}`;
                        })()
                      : "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!selectedWarehouseId) e.preventDefault();
                  }}
                  className={`inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 ${
                    selectedWarehouseId ? "" : "pointer-events-none opacity-40"
                  }`}
                >
                  Open JSON (new tab)
                </a>
              </div>
              {bf86CapPreview ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] leading-snug text-zinc-600">{bf86CapPreview.methodology}</p>
                  <p className="text-[11px] text-zinc-600">
                    {bf86CapPreview.warehouse.code ?? bf86CapPreview.warehouse.name} · sort{" "}
                    <span className="font-mono">{bf86CapPreview.sort}</span> · returned {bf86CapPreview.cap.returnedBins}/
                    {bf86CapPreview.cap.binsInWarehouseActive} bins (cap {bf86CapPreview.cap.requestedMaxBins})
                  </p>
                  {bf86CapPreview.warnings.length > 0 ? (
                    <ul className="list-inside list-disc text-[11px] text-amber-900">
                      {bf86CapPreview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="max-h-64 overflow-auto rounded border border-zinc-200 bg-white">
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase text-zinc-600">
                        <tr>
                          <th className="px-2 py-1">Bin</th>
                          <th className="px-2 py-1">Heat</th>
                          <th className="px-2 py-1">Pick u</th>
                          <th className="px-2 py-1">Cube %</th>
                          <th className="px-2 py-1">Rows</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {bf86CapPreview.bins.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-2 py-2 text-zinc-500">
                              No bins in cohort.
                            </td>
                          </tr>
                        ) : (
                          bf86CapPreview.bins.slice(0, 40).map((b) => (
                            <tr key={b.binId}>
                              <td className="whitespace-nowrap px-2 py-1 font-mono text-zinc-800">{b.binCode}</td>
                              <td className="px-2 py-1">{b.velocityHeatScore}</td>
                              <td className="whitespace-nowrap px-2 py-1 font-mono">{b.pickVelocityUnits}</td>
                              <td className="whitespace-nowrap px-2 py-1 font-mono">
                                {b.cubeUtilizationRatio == null ? "—" : `${(100 * b.cubeUtilizationRatio).toFixed(0)}%`}
                              </td>
                              <td className="px-2 py-1">{b.balanceRowCount}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
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
                      <th className="px-2 py-1">Pri</th>
                      <th className="px-2 py-1">Max/run</th>
                      <th className="px-2 py-1">Exc</th>
                      <th className="px-2 py-1">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {replenishmentRulesForWarehouse.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-2 py-2 text-zinc-500">
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
                          <td className="whitespace-nowrap px-2 py-1 text-zinc-600">{r.priority}</td>
                          <td className="whitespace-nowrap px-2 py-1 text-zinc-600">
                            {r.maxTasksPerRun == null ? "∞" : String(r.maxTasksPerRun)}
                          </td>
                          <td className="px-2 py-1 text-zinc-600">{r.exceptionQueue ? "Yes" : "No"}</td>
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
        <p className="mt-1 text-xs text-zinc-600">
          <span className="font-medium">BF-24:</span> optional aisle masters group corridor identity; bins can link so text{" "}
          <span className="font-mono">aisle</span> stays aligned with the master code. Millimetre fields are layout hints only—AGV paths stay backlog.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <input
            value={newAisleCode}
            onChange={(e) => setNewAisleCode(e.target.value.toUpperCase())}
            placeholder="Aisle code"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newAisleName}
            onChange={(e) => setNewAisleName(e.target.value)}
            placeholder="Aisle display name"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            value={newAisleZoneId}
            onChange={(e) => setNewAisleZoneId(e.target.value)}
            disabled={!selectedWarehouseId}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Zone hint (optional)</option>
            {zonesForWarehouse.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code} · {z.name}
              </option>
            ))}
          </select>
          <input
            value={newAisleLengthMm}
            onChange={(e) => setNewAisleLengthMm(e.target.value)}
            placeholder="Length mm"
            inputMode="numeric"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newAisleWidthMm}
            onChange={(e) => setNewAisleWidthMm(e.target.value)}
            placeholder="Width mm"
            inputMode="numeric"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <ActionButton
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() => {
              const lm = newAisleLengthMm.trim();
              const wm = newAisleWidthMm.trim();
              void runAction({
                action: "create_warehouse_aisle",
                warehouseId: selectedWarehouseId,
                code: newAisleCode,
                name: newAisleName,
                primaryZoneId: newAisleZoneId || null,
                lengthMm: lm === "" ? undefined : Number(lm),
                widthMm: wm === "" ? undefined : Number(wm),
              });
            }}
          >
            Create aisle
          </ActionButton>
        </div>
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
          <label className="flex items-center gap-2 rounded border border-zinc-300 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={newBinCrossDockStaging}
              onChange={(e) => setNewBinCrossDockStaging(e.target.checked)}
            />
            XD staging
          </label>
          <input
            value={newBinCapacityCubeMm}
            onChange={(e) => setNewBinCapacityCubeMm(e.target.value)}
            placeholder="Cube mm³ (opt)"
            inputMode="numeric"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <ActionButton
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() => {
              const levelRaw = newBinLevel.trim();
              const posRaw = newBinPosition.trim();
              const capRaw = newBinCapacityCubeMm.trim();
              const levelNum = levelRaw === "" ? undefined : Number(levelRaw);
              const posNum = posRaw === "" ? undefined : Number(posRaw);
              const capNum = capRaw === "" ? undefined : Number(capRaw);
              void runAction({
                action: "create_bin",
                warehouseId: selectedWarehouseId,
                targetZoneId: newBinZoneId || null,
                code: newBinCode,
                name: newBinName,
                storageType: newBinStorageType,
                isPickFace: newBinPickFace,
                isCrossDockStaging: newBinCrossDockStaging,
                warehouseAisleId: newBinWarehouseAisleId.trim() || undefined,
                rackCode: newBinRackCode.trim() || undefined,
                aisle: newBinAisle.trim() || undefined,
                bay: newBinBay.trim() || undefined,
                level: Number.isFinite(levelNum) ? levelNum : undefined,
                positionIndex: Number.isFinite(posNum) ? posNum : undefined,
                ...(Number.isFinite(capNum) &&
                capNum !== undefined &&
                capNum >= 0 &&
                Math.trunc(capNum) === capNum
                  ? { capacityCubeCubicMm: Math.trunc(capNum) }
                  : {}),
              });
            }}
          >
            Create bin
          </ActionButton>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Optional rack addressing (same <span className="font-mono">rackCode</span> on many bins = one physical rack).
          Choose an <span className="font-medium">aisle master</span> so the bin&apos;s text aisle matches that code, or
          leave unlinked and type a free-text aisle label.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-6">
          <select
            value={newBinWarehouseAisleId}
            onChange={(e) => {
              const v = e.target.value;
              setNewBinWarehouseAisleId(v);
              const row = activeAislesForBinLink.find((x) => x.id === v);
              setNewBinAisle(row ? row.code : "");
            }}
            disabled={!selectedWarehouseId}
            className="rounded border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
          >
            <option value="">Aisle master (optional)</option>
            {activeAislesForBinLink.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
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
        <p className="mt-2 text-xs text-zinc-500">
          Use positive integers for <span className="font-medium">level</span> and{" "}
          <span className="font-medium">position</span> so the rack map can place each bin.
        </p>
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Replenishment setup</h2>
        <p className="mt-1 text-xs text-zinc-600">
          <span className="font-medium">BF-35:</span> higher priority runs first within the same tier; exception-queue rules run after normal rules. Leave{" "}
          <span className="font-medium">Max/run</span> blank for no cap, or set <span className="font-medium">0</span> to disable automated creates for that rule.
        </p>
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
            disabled={
              !canEdit ||
              busy ||
              !(
                replPriority.trim() === "" ||
                (Number.isFinite(Number(replPriority)) &&
                  Math.trunc(Number(replPriority)) === Number(replPriority))
              ) ||
              !(
                replMaxTasksPerRun.trim() === "" ||
                (Number.isFinite(Number(replMaxTasksPerRun)) &&
                  Math.trunc(Number(replMaxTasksPerRun)) === Number(replMaxTasksPerRun) &&
                  Number(replMaxTasksPerRun) >= 0)
              )
            }
            onClick={() => {
              const pri = replPriority.trim() === "" ? 0 : Number(replPriority);
              const capTrim = replMaxTasksPerRun.trim();
              void runAction({
                action: "set_replenishment_rule",
                warehouseId: selectedWarehouseId,
                productId: replProductId,
                sourceZoneId: replSourceZoneId || null,
                targetZoneId: replTargetZoneId || null,
                minPickQty: Number(replMin),
                maxPickQty: Number(replMax),
                replenishQty: Number(replQty),
                priority: pri,
                ...(capTrim !== "" ? { maxTasksPerRun: Number(capTrim) } : {}),
                exceptionQueue: replExceptionQueue,
              });
            }}
          >
            Save rule
          </ActionButton>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            value={replPriority}
            onChange={(e) => setReplPriority(e.target.value)}
            placeholder="Priority (int)"
            inputMode="numeric"
            className="w-36 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={replMaxTasksPerRun}
            onChange={(e) => setReplMaxTasksPerRun(e.target.value)}
            placeholder="Max tasks / run (blank = ∞)"
            inputMode="numeric"
            className="min-w-[11rem] rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={replExceptionQueue}
              onChange={(e) => setReplExceptionQueue(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Exception queue tier
          </label>
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

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Demand forecast stub (BF-61)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          <span className="font-medium">BF-61:</span> Weekly demand units per SKU lift automated{" "}
          <span className="font-medium">create_replenishment_tasks</span> ordering on top of BF-35 priority (exception tier
          unchanged). Hints compare forecast to fungible pick-face availability (soft reservations included). Saving stubs
          requires <span className="font-medium">org.wms.operations → edit</span> or legacy full WMS edit.{" "}
          <span className="font-medium">BF-84</span> optionally applies a promo uplift multiplier to the stored qty for gap /
          boost math only (stored base qty unchanged).
        </p>
        <div className="mt-3 max-h-40 overflow-auto rounded border border-zinc-200">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-left uppercase text-zinc-600">
              <tr>
                <th className="px-2 py-1">SKU</th>
                <th className="px-2 py-1">Week</th>
                <th className="px-2 py-1">Base</th>
                <th className="px-2 py-1">×</th>
                <th className="px-2 py-1">Eff.</th>
                <th className="px-2 py-1">Pick eff.</th>
                <th className="px-2 py-1">Gap</th>
                <th className="px-2 py-1">Boost</th>
                <th className="px-2 py-1">Sort pri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {forecastGapHintsForWarehouse.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-2 text-zinc-500">
                    No active replenishment rules for this warehouse (or no data yet).
                  </td>
                </tr>
              ) : (
                forecastGapHintsForWarehouse.map((h) => (
                  <tr key={h.replenishmentRuleId}>
                    <td className="px-2 py-1 text-zinc-800">
                      {h.product.productCode || h.product.sku || "—"} · {h.product.name}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-zinc-600">{h.weekStart}</td>
                    <td className="px-2 py-1 font-mono text-zinc-700">{h.forecastQtyBase}</td>
                    <td className="px-2 py-1 font-mono text-zinc-700">{h.promoUpliftMultiplier}</td>
                    <td className="px-2 py-1 font-mono text-zinc-700">{h.forecastQty}</td>
                    <td className="px-2 py-1 font-mono text-zinc-700">{h.pickFaceEffectiveQty}</td>
                    <td className="px-2 py-1 font-mono text-zinc-700">{h.forecastGapQty}</td>
                    <td className="px-2 py-1 font-mono text-zinc-700">{h.priorityBoost}</td>
                    <td className="px-2 py-1 font-mono text-zinc-700">{h.effectiveSortPriority}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Saved stubs (warehouse)</h3>
        <div className="mt-1 max-h-32 overflow-auto rounded border border-zinc-200">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-left uppercase text-zinc-600">
              <tr>
                <th className="px-2 py-1">SKU</th>
                <th className="px-2 py-1">Week</th>
                <th className="px-2 py-1">Base</th>
                <th className="px-2 py-1">×</th>
                <th className="px-2 py-1">Eff.</th>
                <th className="px-2 py-1">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {demandForecastStubsForWarehouse.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-2 text-zinc-500">
                    No stubs for this warehouse in the current UTC week.
                  </td>
                </tr>
              ) : (
                demandForecastStubsForWarehouse.map((s) => (
                  <tr key={s.id}>
                    <td className="px-2 py-1 text-zinc-800">
                      {s.product.productCode || s.product.sku || "—"} · {s.product.name}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-zinc-600">{s.weekStart}</td>
                    <td className="px-2 py-1 font-mono">{s.forecastQty}</td>
                    <td className="px-2 py-1 font-mono">{s.promoUpliftBf84.upliftMultiplier}</td>
                    <td className="px-2 py-1 font-mono">{s.forecastQtyEffective}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-zinc-600">{s.updatedAt.slice(0, 19)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-6">
          <select
            value={fcProductId}
            onChange={(e) => setFcProductId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
          >
            <option value="">Product</option>
            {productPickOptionsForWarehouse.map((p) => (
              <option key={p.id} value={p.id}>
                {p.productCode || p.sku || "SKU"} · {p.name}
              </option>
            ))}
          </select>
          <input
            value={fcWeekStart}
            onChange={(e) => setFcWeekStart(e.target.value.trim())}
            placeholder="Week start YYYY-MM-DD (optional)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-mono"
          />
          <input
            value={fcQty}
            onChange={(e) => setFcQty(e.target.value)}
            placeholder="Forecast qty"
            inputMode="decimal"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={fcPromoMult}
            onChange={(e) => setFcPromoMult(e.target.value)}
            placeholder="BF-84 × (1–5)"
            inputMode="decimal"
            disabled={fcPromoClearBf84}
            className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
          <ActionButton
            disabled={
              !canEdit ||
              busy ||
              !selectedWarehouseId ||
              !fcProductId ||
              !Number.isFinite(Number(fcQty)) ||
              Number(fcQty) < 0 ||
              (() => {
                const trimmed = fcPromoMult.trim();
                if (fcPromoClearBf84 || trimmed === "") return false;
                const n = Number(trimmed);
                return !Number.isFinite(n) || n < 1 || n > 5;
              })()
            }
            onClick={() =>
              void runAction({
                action: "upsert_wms_demand_forecast_stub",
                warehouseId: selectedWarehouseId,
                productId: fcProductId,
                forecastQty: Number(fcQty),
                ...(fcWeekStart.trim() ? { weekStart: fcWeekStart.trim() } : {}),
                ...(fcNote.trim() ? { note: fcNote.trim() } : {}),
                ...(fcPromoClearBf84 ? { promoUpliftBf84Clear: true } : {}),
                ...(fcPromoMult.trim() &&
                !fcPromoClearBf84 &&
                Number.isFinite(Number(fcPromoMult.trim()))
                  ? {
                      promoUpliftBf84: {
                        upliftMultiplier: Number(fcPromoMult.trim()),
                        ...(fcPromoNoteBf84.trim() ? { promoNote: fcPromoNoteBf84.trim() } : {}),
                      },
                    }
                  : {}),
              })
            }
          >
            Save stub
          </ActionButton>
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={fcPromoClearBf84}
            onChange={(e) => setFcPromoClearBf84(e.target.checked)}
            className="rounded border-zinc-300"
          />
          Clear BF-84 promo uplift on save (base qty unchanged)
        </label>
        <input
          value={fcPromoNoteBf84}
          onChange={(e) => setFcPromoNoteBf84(e.target.value)}
          placeholder="BF-84 promo note (optional, sent only when × is set)"
          disabled={fcPromoClearBf84 || !fcPromoMult.trim()}
          className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
        <input
          value={fcNote}
          onChange={(e) => setFcNote(e.target.value)}
          placeholder="Optional note (max 500 chars)"
          className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Receiving QA templates (BF-42)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Tenant-scoped note templates with tokens{" "}
          <span className="font-mono text-[11px]">
            {"{{lineNo}} {{qtyShipped}} {{qtyReceived}} {{productSku}} {{asnReference}} {{orderNumber}}"}
          </span>
          . Operators attach a template per inbound line and use{" "}
          <span className="font-medium">Apply template</span> on the Operations receiving grid to stamp{" "}
          <span className="font-medium">variance note</span>. Optional suggested disposition is guidance only (not auto-applied).
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="min-w-full text-xs">
            <thead className="bg-zinc-100 text-left uppercase text-zinc-600">
              <tr>
                <th className="px-2 py-1.5">Code</th>
                <th className="px-2 py-1.5">Title</th>
                <th className="px-2 py-1.5">Suggested disp.</th>
                <th className="px-2 py-1.5">Updated</th>
                {canEdit ? <th className="px-2 py-1.5"> </th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(!data.receivingDispositionTemplates || data.receivingDispositionTemplates.length === 0) ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-2 py-3 text-zinc-500">
                    No templates yet — create one below.
                  </td>
                </tr>
              ) : (
                (data.receivingDispositionTemplates ?? []).map((t) => (
                  <tr key={t.id}>
                    <td className="px-2 py-1.5 font-mono text-zinc-800">{t.code}</td>
                    <td className="px-2 py-1.5 text-zinc-700">{t.title}</td>
                    <td className="px-2 py-1.5 text-zinc-600">{t.suggestedVarianceDisposition ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-500">
                      {new Date(t.updatedAt).toLocaleString()}
                    </td>
                    {canEdit ? (
                      <td className="space-x-1 whitespace-nowrap px-2 py-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setBf42EditingTemplateId(t.id);
                            setBf42TplCode(t.code);
                            setBf42TplTitle(t.title);
                            setBf42TplNote(t.noteTemplate);
                            setBf42TplSuggested(t.suggestedVarianceDisposition ?? "");
                          }}
                          className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction({
                              action: "delete_wms_receiving_disposition_template",
                              receivingDispositionTemplateId: t.id,
                            })
                          }
                          className="rounded border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-800 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {canEdit ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:grid-cols-2">
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Template code
              <input
                value={bf42TplCode}
                disabled={busy || Boolean(bf42EditingTemplateId)}
                onChange={(e) => setBf42TplCode(e.target.value)}
                placeholder="e.g. qa_visual_pass"
                className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono disabled:bg-zinc-100"
              />
            </label>
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Title
              <input
                value={bf42TplTitle}
                disabled={busy}
                onChange={(e) => setBf42TplTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Note template
              <textarea
                value={bf42TplNote}
                disabled={busy}
                onChange={(e) => setBf42TplNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-[11px] font-medium text-zinc-600">
              Suggested variance disposition (optional)
              <select
                value={bf42TplSuggested}
                disabled={busy}
                onChange={(e) => setBf42TplSuggested(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                <option value="MATCH">Match</option>
                <option value="SHORT">Short</option>
                <option value="OVER">Over</option>
                <option value="DAMAGED">Damaged</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={
                  busy ||
                  !bf42TplCode.trim() ||
                  !bf42TplTitle.trim() ||
                  !bf42TplNote.trim()
                }
                onClick={() => {
                  if (bf42EditingTemplateId) {
                    void runAction({
                      action: "update_wms_receiving_disposition_template",
                      receivingDispositionTemplateId: bf42EditingTemplateId,
                      receivingDispositionTemplateTitle: bf42TplTitle.trim(),
                      receivingDispositionNoteTemplate: bf42TplNote.trim(),
                      receivingDispositionTemplateSuggestedVarianceDisposition:
                        bf42TplSuggested.trim() === "" ? null : bf42TplSuggested.trim(),
                    }).then((res) => {
                      if (res) {
                        setBf42EditingTemplateId(null);
                        setBf42TplCode("");
                        setBf42TplTitle("");
                        setBf42TplNote("");
                        setBf42TplSuggested("");
                      }
                    });
                  } else {
                    void runAction({
                      action: "create_wms_receiving_disposition_template",
                      receivingDispositionTemplateCode: bf42TplCode.trim(),
                      receivingDispositionTemplateTitle: bf42TplTitle.trim(),
                      receivingDispositionNoteTemplate: bf42TplNote.trim(),
                      receivingDispositionTemplateSuggestedVarianceDisposition:
                        bf42TplSuggested.trim() === "" ? null : bf42TplSuggested.trim(),
                    }).then((res) => {
                      if (res) {
                        setBf42TplCode("");
                        setBf42TplTitle("");
                        setBf42TplNote("");
                        setBf42TplSuggested("");
                      }
                    });
                  }
                }}
                className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {bf42EditingTemplateId ? "Save template" : "Create template"}
              </button>
              {bf42EditingTemplateId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBf42EditingTemplateId(null);
                    setBf42TplCode("");
                    setBf42TplTitle("");
                    setBf42TplNote("");
                    setBf42TplSuggested("");
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">RMA disposition rules (BF-85)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Ordered tenant rules match <span className="font-medium">CUSTOMER_RETURN</span> lines (
          <span className="font-medium">BF-41</span>) on PO line description, product SKU/code, or shipment RMA ref (
          case-insensitive). Lower priority runs first. Optional{" "}
          <span className="font-medium">BF-42</span> receiving template attaches when a rule matches. Apply from{" "}
          <span className="font-medium">Operations → Inbound</span>. See{" "}
          <span className="font-medium">docs/wms/WMS_RMA_DISPOSITION_RULES_BF85.md</span>.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="min-w-full text-xs">
            <thead className="bg-zinc-100 text-left uppercase text-zinc-600">
              <tr>
                <th className="px-2 py-1.5">Pri</th>
                <th className="px-2 py-1.5">Field</th>
                <th className="px-2 py-1.5">Mode</th>
                <th className="px-2 py-1.5">Pattern</th>
                <th className="px-2 py-1.5">Disposition</th>
                <th className="px-2 py-1.5">BF-42 tpl</th>
                <th className="px-2 py-1.5">Updated</th>
                {canEdit ? <th className="px-2 py-1.5"> </th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(!data.rmaDispositionRulesBf85 || data.rmaDispositionRulesBf85.length === 0) ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-2 py-3 text-zinc-500">
                    No rules yet — create one below (requires inbound customer-return shipments to apply).
                  </td>
                </tr>
              ) : (
                (data.rmaDispositionRulesBf85 ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-800">{r.priority}</td>
                    <td className="px-2 py-1.5 text-zinc-700">{r.matchField}</td>
                    <td className="px-2 py-1.5 text-zinc-700">{r.matchMode}</td>
                    <td className="max-w-[12rem] truncate px-2 py-1.5 font-mono text-[11px] text-zinc-800" title={r.pattern}>
                      {r.pattern}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-700">{r.applyDisposition}</td>
                    <td className="px-2 py-1.5 text-zinc-600">
                      {r.receivingDispositionTemplate ? `${r.receivingDispositionTemplate.code}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-500">
                      {new Date(r.updatedAt).toLocaleString()}
                    </td>
                    {canEdit ? (
                      <td className="space-x-1 whitespace-nowrap px-2 py-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setBf85RuleEditingId(r.id);
                            setBf85Priority(String(r.priority));
                            setBf85MatchField(r.matchField);
                            setBf85MatchMode(r.matchMode);
                            setBf85Pattern(r.pattern);
                            setBf85ApplyDisp(r.applyDisposition);
                            setBf85TemplateId(r.receivingDispositionTemplateId ?? "");
                            setBf85RuleNote(r.note ?? "");
                          }}
                          className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction({
                              action: "delete_wms_rma_disposition_rule_bf85",
                              wmsRmaDispositionRuleIdBf85: r.id,
                            })
                          }
                          className="rounded border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-800 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {canEdit ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:grid-cols-2">
            <label className="block text-[11px] font-medium text-zinc-600">
              Priority (lower runs first)
              <input
                value={bf85Priority}
                disabled={busy}
                onChange={(e) => setBf85Priority(e.target.value)}
                placeholder="100"
                className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </label>
            <label className="block text-[11px] font-medium text-zinc-600">
              Match field
              <select
                value={bf85MatchField}
                disabled={busy}
                onChange={(e) =>
                  setBf85MatchField(
                    e.target.value as
                      | "ORDER_LINE_DESCRIPTION"
                      | "PRODUCT_SKU"
                      | "PRODUCT_CODE"
                      | "SHIPMENT_RMA_REFERENCE",
                  )
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="ORDER_LINE_DESCRIPTION">Order line description</option>
                <option value="PRODUCT_SKU">Product SKU</option>
                <option value="PRODUCT_CODE">Product code</option>
                <option value="SHIPMENT_RMA_REFERENCE">Shipment RMA reference</option>
              </select>
            </label>
            <label className="block text-[11px] font-medium text-zinc-600">
              Match mode
              <select
                value={bf85MatchMode}
                disabled={busy}
                onChange={(e) => setBf85MatchMode(e.target.value as "EXACT" | "PREFIX" | "CONTAINS")}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="CONTAINS">Contains</option>
                <option value="PREFIX">Prefix</option>
                <option value="EXACT">Exact</option>
              </select>
            </label>
            <label className="block text-[11px] font-medium text-zinc-600">
              Apply disposition
              <select
                value={bf85ApplyDisp}
                disabled={busy}
                onChange={(e) =>
                  setBf85ApplyDisp(e.target.value as "RESTOCK" | "SCRAP" | "QUARANTINE")
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="RESTOCK">RESTOCK</option>
                <option value="SCRAP">SCRAP</option>
                <option value="QUARANTINE">QUARANTINE</option>
              </select>
            </label>
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Pattern (1–256 chars)
              <input
                value={bf85Pattern}
                disabled={busy}
                onChange={(e) => setBf85Pattern(e.target.value)}
                placeholder="e.g. defective, RMA-, SKU prefix…"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </label>
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Optional BF-42 receiving template
              <select
                value={bf85TemplateId}
                disabled={busy}
                onChange={(e) => setBf85TemplateId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {(data.receivingDispositionTemplates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Rule note (optional)
              <input
                value={bf85RuleNote}
                disabled={busy}
                onChange={(e) => setBf85RuleNote(e.target.value)}
                placeholder="Operator hint (max 500 chars)"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={busy || !bf85Pattern.trim()}
                onClick={() => {
                  const pri = Number(bf85Priority.trim());
                  const payload = {
                    action: "upsert_wms_rma_disposition_rule_bf85" as const,
                    wmsRmaDispositionRuleMatchFieldBf85: bf85MatchField,
                    wmsRmaDispositionRuleMatchModeBf85: bf85MatchMode,
                    wmsRmaDispositionRulePatternBf85: bf85Pattern.trim(),
                    wmsRmaDispositionRuleApplyDispositionBf85: bf85ApplyDisp,
                    ...(Number.isFinite(pri) ? { wmsRmaDispositionRulePriorityBf85: pri } : {}),
                    ...(bf85RuleEditingId
                      ? {
                          wmsRmaDispositionRuleReceivingTemplateIdBf85: bf85TemplateId.trim() || null,
                          wmsRmaDispositionRuleNoteBf85: bf85RuleNote.trim() === "" ? null : bf85RuleNote.trim(),
                        }
                      : {
                          ...(bf85TemplateId.trim()
                            ? { wmsRmaDispositionRuleReceivingTemplateIdBf85: bf85TemplateId.trim() }
                            : {}),
                          ...(bf85RuleNote.trim() ? { wmsRmaDispositionRuleNoteBf85: bf85RuleNote.trim() } : {}),
                        }),
                    ...(bf85RuleEditingId ? { wmsRmaDispositionRuleIdBf85: bf85RuleEditingId } : {}),
                  };
                  void runAction(payload).then((res) => {
                    if (res) {
                      setBf85RuleEditingId(null);
                      setBf85Priority("100");
                      setBf85MatchField("ORDER_LINE_DESCRIPTION");
                      setBf85MatchMode("CONTAINS");
                      setBf85Pattern("");
                      setBf85ApplyDisp("RESTOCK");
                      setBf85TemplateId("");
                      setBf85RuleNote("");
                    }
                  });
                }}
                className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {bf85RuleEditingId ? "Save rule" : "Create rule"}
              </button>
              {bf85RuleEditingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBf85RuleEditingId(null);
                    setBf85Priority("100");
                    setBf85MatchField("ORDER_LINE_DESCRIPTION");
                    setBf85MatchMode("CONTAINS");
                    setBf85Pattern("");
                    setBf85ApplyDisp("RESTOCK");
                    setBf85TemplateId("");
                    setBf85RuleNote("");
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Outbound webhooks (BF-44)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Signed <span className="font-mono text-[11px]">POST</span> JSON to your HTTPS endpoint when milestones occur.
          Header <span className="font-mono text-[11px]">X-WMS-Webhook-Signature</span> uses HMAC-SHA256 over the raw body
          (same <span className="font-mono text-[11px]">sha256=&lt;hex&gt;</span> shape as BF-25 TMS inbound verification).
          Failed deliveries set <span className="font-medium">nextAttemptAt</span>; Vercel cron{" "}
          <span className="font-mono text-[11px]">/api/cron/wms-outbound-webhook-retries</span> (Bearer{" "}
          <span className="font-mono text-[11px]">CRON_SECRET</span>) drains retries with exponential backoff (BF-45).
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="min-w-full text-xs">
            <thead className="bg-zinc-100 text-left uppercase text-zinc-600">
              <tr>
                <th className="px-2 py-1.5">URL</th>
                <th className="px-2 py-1.5">Events</th>
                <th className="px-2 py-1.5">Secret …</th>
                <th className="px-2 py-1.5">Active</th>
                {canEdit ? <th className="px-2 py-1.5"> </th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(!data.outboundWebhookSubscriptions || data.outboundWebhookSubscriptions.length === 0) ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-2 py-3 text-zinc-500">
                    No webhook subscriptions — add one below.
                  </td>
                </tr>
              ) : (
                (data.outboundWebhookSubscriptions ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-[14rem] truncate px-2 py-1.5 font-mono text-[11px]" title={s.url}>
                      {s.url}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-700">{s.eventTypes.join(", ") || "—"}</td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-zinc-600">…{s.signingSecretSuffix}</td>
                    <td className="px-2 py-1.5">{s.isActive ? "yes" : "no"}</td>
                    {canEdit ? (
                      <td className="space-x-1 whitespace-nowrap px-2 py-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setBf44EditingSubscriptionId(s.id);
                            setBf44WebhookUrl(s.url);
                            setBf44WebhookSecret("");
                            setBf44EvtReceiptClosed(s.eventTypes.includes("RECEIPT_CLOSED"));
                            setBf44EvtOutboundShipped(s.eventTypes.includes("OUTBOUND_SHIPPED"));
                            setBf44EvtBillingDisputed(s.eventTypes.includes("BILLING_EVENT_DISPUTED"));
                            setBf44EvtBillingInvoicePostDisputed(s.eventTypes.includes("BILLING_INVOICE_POST_DISPUTED"));
                            setBf44EvtBillingCreditMemoStubCreated(s.eventTypes.includes("BILLING_CREDIT_MEMO_STUB_CREATED"));
                            setBf44WebhookActive(s.isActive);
                          }}
                          className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction({
                              action: "delete_wms_outbound_webhook_subscription_bf44",
                              webhookSubscriptionId: s.id,
                            })
                          }
                          className="rounded border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-800 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {canEdit ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:grid-cols-2">
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Endpoint URL (https, or http://localhost only)
              <input
                value={bf44WebhookUrl}
                disabled={busy}
                onChange={(e) => setBf44WebhookUrl(e.target.value)}
                placeholder="https://hooks.example.com/wms"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Signing secret (min 8 chars){bf44EditingSubscriptionId ? " — leave blank to keep existing" : ""}
              <input
                type="password"
                autoComplete="new-password"
                value={bf44WebhookSecret}
                disabled={busy}
                onChange={(e) => setBf44WebhookSecret(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-3 text-xs text-zinc-700 sm:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bf44EvtReceiptClosed}
                  disabled={busy}
                  onChange={(e) => setBf44EvtReceiptClosed(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                RECEIPT_CLOSED
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bf44EvtOutboundShipped}
                  disabled={busy}
                  onChange={(e) => setBf44EvtOutboundShipped(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                OUTBOUND_SHIPPED
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bf44EvtBillingDisputed}
                  disabled={busy}
                  onChange={(e) => setBf44EvtBillingDisputed(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                BILLING_EVENT_DISPUTED
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bf44EvtBillingInvoicePostDisputed}
                  disabled={busy}
                  onChange={(e) => setBf44EvtBillingInvoicePostDisputed(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                BILLING_INVOICE_POST_DISPUTED
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bf44EvtBillingCreditMemoStubCreated}
                  disabled={busy}
                  onChange={(e) => setBf44EvtBillingCreditMemoStubCreated(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                BILLING_CREDIT_MEMO_STUB_CREATED
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bf44WebhookActive}
                  disabled={busy}
                  onChange={(e) => setBf44WebhookActive(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Active
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={
                  busy ||
                  !bf44WebhookUrl.trim() ||
                  (!bf44EditingSubscriptionId && bf44WebhookSecret.trim().length < 8) ||
                  (!bf44EvtReceiptClosed &&
                    !bf44EvtOutboundShipped &&
                    !bf44EvtBillingDisputed &&
                    !bf44EvtBillingInvoicePostDisputed &&
                    !bf44EvtBillingCreditMemoStubCreated)
                }
                onClick={() => {
                  const types: string[] = [];
                  if (bf44EvtReceiptClosed) types.push("RECEIPT_CLOSED");
                  if (bf44EvtOutboundShipped) types.push("OUTBOUND_SHIPPED");
                  if (bf44EvtBillingDisputed) types.push("BILLING_EVENT_DISPUTED");
                  if (bf44EvtBillingInvoicePostDisputed) types.push("BILLING_INVOICE_POST_DISPUTED");
                  if (bf44EvtBillingCreditMemoStubCreated) types.push("BILLING_CREDIT_MEMO_STUB_CREATED");
                  if (bf44EditingSubscriptionId) {
                    const body: Record<string, unknown> = {
                      action: "update_wms_outbound_webhook_subscription_bf44",
                      webhookSubscriptionId: bf44EditingSubscriptionId,
                      webhookUrl: bf44WebhookUrl.trim(),
                      webhookEventTypes: types,
                      webhookIsActive: bf44WebhookActive,
                    };
                    if (bf44WebhookSecret.trim().length >= 8) {
                      body.webhookSigningSecret = bf44WebhookSecret.trim();
                    }
                    void runAction(body).then((res) => {
                      if (res) {
                        setBf44EditingSubscriptionId(null);
                        setBf44WebhookUrl("");
                        setBf44WebhookSecret("");
                        setBf44EvtReceiptClosed(true);
                        setBf44EvtOutboundShipped(false);
                        setBf44EvtBillingDisputed(false);
                        setBf44EvtBillingInvoicePostDisputed(false);
                        setBf44EvtBillingCreditMemoStubCreated(false);
                        setBf44WebhookActive(true);
                      }
                    });
                  } else {
                    void runAction({
                      action: "create_wms_outbound_webhook_subscription_bf44",
                      webhookUrl: bf44WebhookUrl.trim(),
                      webhookSigningSecret: bf44WebhookSecret.trim(),
                      webhookEventTypes: types,
                      webhookIsActive: bf44WebhookActive,
                    }).then((res) => {
                      if (res) {
                        setBf44WebhookUrl("");
                        setBf44WebhookSecret("");
                        setBf44EvtReceiptClosed(true);
                        setBf44EvtOutboundShipped(false);
                        setBf44EvtBillingDisputed(false);
                        setBf44EvtBillingInvoicePostDisputed(false);
                        setBf44EvtBillingCreditMemoStubCreated(false);
                        setBf44WebhookActive(true);
                      }
                    });
                  }
                }}
                className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {bf44EditingSubscriptionId ? "Save subscription" : "Create subscription"}
              </button>
              {bf44EditingSubscriptionId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBf44EditingSubscriptionId(null);
                    setBf44WebhookUrl("");
                    setBf44WebhookSecret("");
                    setBf44EvtReceiptClosed(true);
                    setBf44EvtOutboundShipped(false);
                    setBf44EvtBillingDisputed(false);
                    setBf44EvtBillingInvoicePostDisputed(false);
                    setBf44EvtBillingCreditMemoStubCreated(false);
                    setBf44WebhookActive(true);
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Partner API keys (BF-45)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Scoped <span className="font-mono text-[11px]">GET</span> access for integrations — inventory balances by warehouse and
          outbound order detail. Send{" "}
          <span className="font-mono text-[11px]">Authorization: Bearer &lt;key&gt;</span> or header{" "}
          <span className="font-mono text-[11px]">X-WMS-Partner-Key</span>. Plaintext key is shown once when created; store it as a
          secret. Rate-limit headers are advisory stubs until enforcement lands.
        </p>
        <ul className="mt-2 list-inside list-disc text-[11px] text-zinc-600">
          <li className="font-mono">
            GET /api/wms/partner/v1/inventory-balances?warehouseId=&lt;id&gt;&amp;limit=500
          </li>
          <li className="font-mono">GET /api/wms/partner/v1/outbound-orders/&lt;outboundOrderId&gt;</li>
        </ul>
        {bf45IssuedKeyPlaintext ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <p className="font-semibold">Copy this key now — it will not be shown again.</p>
            <p className="mt-2 break-all font-mono text-[11px]">{bf45IssuedKeyPlaintext}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void navigator.clipboard.writeText(bf45IssuedKeyPlaintext).catch(() => {});
              }}
              className="mt-2 rounded-lg bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Copy to clipboard
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setBf45IssuedKeyPlaintext(null)}
              className="mt-2 ml-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="min-w-full text-xs">
            <thead className="bg-zinc-100 text-left uppercase text-zinc-600">
              <tr>
                <th className="px-2 py-1.5">Label</th>
                <th className="px-2 py-1.5">Prefix</th>
                <th className="px-2 py-1.5">Scopes</th>
                <th className="px-2 py-1.5">Active</th>
                <th className="px-2 py-1.5">Last used</th>
                {canEdit ? <th className="px-2 py-1.5"> </th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(!data.partnerApiKeys || data.partnerApiKeys.length === 0) ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-2 py-3 text-zinc-500">
                    No partner keys — issue one below (Setup tier).
                  </td>
                </tr>
              ) : (
                (data.partnerApiKeys ?? []).map((k) => (
                  <tr key={k.id}>
                    <td className="px-2 py-1.5">{k.label}</td>
                    <td className="font-mono text-[11px] text-zinc-600 px-2 py-1.5">{k.keyPrefix}…</td>
                    <td className="px-2 py-1.5 text-zinc-700">{k.scopes.join(", ") || "—"}</td>
                    <td className="px-2 py-1.5">{k.isActive ? "yes" : "no"}</td>
                    <td className="px-2 py-1.5 text-zinc-600">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                    </td>
                    {canEdit ? (
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          disabled={busy || !k.isActive}
                          onClick={() =>
                            void runAction({
                              action: "revoke_wms_partner_api_key_bf45",
                              partnerApiKeyId: k.id,
                            }).then((res) => {
                              if (res) setBf45IssuedKeyPlaintext(null);
                            })
                          }
                          className="rounded border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-800 disabled:opacity-40"
                        >
                          Revoke
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {canEdit ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:grid-cols-2">
            <label className="block text-[11px] font-medium text-zinc-600 sm:col-span-2">
              Label (optional)
              <input
                value={bf45PartnerKeyLabel}
                disabled={busy}
                onChange={(e) => setBf45PartnerKeyLabel(e.target.value)}
                placeholder="3PL prod feed"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-3 text-xs text-zinc-700 sm:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bf45ScopeInventory}
                  disabled={busy}
                  onChange={(e) => setBf45ScopeInventory(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                INVENTORY_READ
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bf45ScopeOutbound}
                  disabled={busy}
                  onChange={(e) => setBf45ScopeOutbound(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                OUTBOUND_READ
              </label>
            </div>
            <button
              type="button"
              disabled={busy || (!bf45ScopeInventory && !bf45ScopeOutbound)}
              onClick={() => {
                const scopes: string[] = [];
                if (bf45ScopeInventory) scopes.push("INVENTORY_READ");
                if (bf45ScopeOutbound) scopes.push("OUTBOUND_READ");
                void runAction({
                  action: "create_wms_partner_api_key_bf45",
                  partnerApiKeyLabel: bf45PartnerKeyLabel.trim() || undefined,
                  partnerApiKeyScopes: scopes,
                }).then((res) => {
                  if (!res) return;
                  const plain = res.apiKeyPlaintext;
                  if (typeof plain === "string" && plain.length > 0) {
                    setBf45IssuedKeyPlaintext(plain);
                  }
                  setBf45PartnerKeyLabel("");
                });
              }}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-2"
            >
              Issue partner API key
            </button>
          </div>
        ) : null}
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
          Optional <span className="font-medium">dock receipt sessions</span> (BF-12) wrap line posts with a tenant-scoped{" "}
          <span className="font-medium">WmsReceipt</span> without replacing Option A/BF-01 fields. BF-21 adds{" "}
          <span className="font-medium">closed receipt history</span>,{" "}
          <span className="font-medium">idempotent close</span>, and an optional{" "}
          <span className="font-medium">Receipt complete</span> advance when closing a session. Putaway still runs per
          shipment line below. BF-37 adds{" "}
          <span className="font-medium">cross-dock</span> /{" "}
          <span className="font-medium">flow-through</span> tags plus outbound preference for bins marked{" "}
          <span className="font-medium">cross-dock staging</span>.{" "}
          <span className="font-medium">BF-41</span> adds{" "}
          <span className="font-medium">customer-return</span> subtype, RMA ref, optional source outbound link, and{" "}
          <span className="font-medium">line disposition</span> (restock / scrap / quarantine) aligned with putaway and holds.{" "}
          <span className="font-medium">BF-42</span> adds optional{" "}
          <span className="font-medium">QA sampling hints</span>, disposition{" "}
          <span className="font-medium">note templates</span> (Setup), and one-click{" "}
          <span className="font-medium">Apply template</span> into the variance note.
          <span className="font-medium"> BF-85</span> adds tenant pattern rules on Setup and bulk{" "}
          <span className="font-medium">Apply rules to shipment</span> for customer returns (panel below).
          <span className="font-medium"> BF-59</span> adds JSON{" "}
          <span className="font-medium">ASN pre-advise</span> ingestion (
          <span className="font-mono text-[11px]">POST /api/wms/inbound-asn-advise</span>, idempotent{" "}
          <span className="font-medium">externalAsnId</span>) to prime expected lines ahead of receipt — see{" "}
          <span className="font-medium">docs/wms/WMS_INBOUND_ASN_ADVISE_BF59.md</span>.{" "}
          <span className="font-medium">BF-75</span> adds a partner-envelope →{" "}
          <span className="font-mono text-[11px]">bf75.v1</span> normalize path (
          <span className="font-mono text-[11px]">POST /api/wms/inbound-asn-normalize</span>) — see{" "}
          <span className="font-medium">docs/wms/WMS_INBOUND_ASN_NORMALIZE_BF75.md</span>.
          <span className="font-medium"> BF-83</span> adds{" "}
          <span className="font-medium">supplier / carrier / CRM-customer receiving scorecard</span> export (
          <span className="font-mono text-[11px]">GET /api/wms/supplier-receiving-scorecard</span>) — see{" "}
          <span className="font-medium">docs/wms/WMS_SUPPLIER_RECEIVING_SCORECARD_BF83.md</span>.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-700">
          <span className="font-semibold text-zinc-600">BF-83 · Scorecard (last 90 days)</span>
          <a
            className="underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900"
            href={`/api/wms/supplier-receiving-scorecard?${new URLSearchParams({
              since: new Date(Date.now() - 90 * 86400000 * 1000).toISOString(),
              until: new Date().toISOString(),
              format: "csv",
              groupBy: "supplier",
            }).toString()}`}
            target="_blank"
            rel="noreferrer"
          >
            Supplier CSV
          </a>
          <a
            className="underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900"
            href={`/api/wms/supplier-receiving-scorecard?${new URLSearchParams({
              since: new Date(Date.now() - 90 * 86400000 * 1000).toISOString(),
              until: new Date().toISOString(),
              format: "csv",
              groupBy: "carrier",
            }).toString()}`}
            target="_blank"
            rel="noreferrer"
          >
            Carrier CSV
          </a>
          <a
            className="underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900"
            href={`/api/wms/supplier-receiving-scorecard?${new URLSearchParams({
              since: new Date(Date.now() - 90 * 86400000 * 1000).toISOString(),
              until: new Date().toISOString(),
              groupBy: "customer",
            }).toString()}`}
            target="_blank"
            rel="noreferrer"
          >
            CRM customer JSON
          </a>
        </div>
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">BF-85 · Bulk RMA disposition</p>
          <p className="mt-2 text-xs text-zinc-600">
            Runs tenant rules from Setup against every line on a{" "}
            <span className="font-medium">CUSTOMER_RETURN</span> shipment (
            <span className="font-medium">BF-41</span>). First match wins per line. Existing dispositions are left alone unless{" "}
            <span className="font-medium">Overwrite</span> is checked.
          </p>
          <label className="mt-3 block text-[11px] font-medium text-zinc-600">
            Shipment id
            <input
              value={bf85ApplyShipmentId}
              disabled={busy || !canEdit}
              onChange={(e) => setBf85ApplyShipmentId(e.target.value)}
              placeholder="Shipment id (from inbound grid)"
              className="mt-1 w-full max-w-xl rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs disabled:bg-zinc-100"
            />
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={bf85ApplyOverwrite}
              disabled={busy || !canEdit}
              onChange={(e) => setBf85ApplyOverwrite(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Overwrite lines that already have return disposition
          </label>
          <button
            type="button"
            disabled={busy || !canEdit || !bf85ApplyShipmentId.trim()}
            onClick={() =>
              void runAction({
                action: "apply_rma_disposition_rules_bf85",
                shipmentId: bf85ApplyShipmentId.trim(),
                wmsRmaDispositionRulesOverwriteBf85: bf85ApplyOverwrite,
              })
            }
            className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Apply rules to shipment
          </button>
        </section>
        {canEdit ? (
          <Fragment>
            <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">BF-59 · ASN pre-advise</p>
            <p className="mt-2 text-xs text-zinc-600">
              Post structured lines (JSON). Re-using the same <span className="font-medium">externalAsnId</span> replaces
              the stored advise for this tenant.
            </p>
            <textarea
              value={bf59AdviseJson}
              onChange={(e) => setBf59AdviseJson(e.target.value)}
              rows={8}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
              spellCheck={false}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitInboundAsnAdvise()}
              className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Post ASN pre-advise
            </button>
            {(data.inboundAsnAdvises ?? []).length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <p className="text-xs font-medium text-zinc-800">Recent advises ({data.inboundAsnAdvises.length})</p>
                <table className="mt-2 min-w-full text-xs">
                  <thead className="bg-zinc-100 text-left text-[10px] uppercase text-zinc-600">
                    <tr>
                      <th className="px-2 py-1">External ASN id</th>
                      <th className="px-2 py-1">Partner</th>
                      <th className="px-2 py-1">Lines</th>
                      <th className="px-2 py-1">PO</th>
                      <th className="px-2 py-1">Shipment</th>
                      <th className="px-2 py-1">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {data.inboundAsnAdvises.map((a) => (
                      <tr key={a.id}>
                        <td className="px-2 py-1 font-mono">{a.externalAsnId}</td>
                        <td className="px-2 py-1 font-mono text-zinc-700">{a.asnPartnerId ?? "—"}</td>
                        <td className="px-2 py-1">{a.lineCount}</td>
                        <td className="px-2 py-1">{a.purchaseOrder?.orderNumber ?? "—"}</td>
                        <td className="px-2 py-1">{a.shipment?.shipmentNo ?? a.shipmentId?.slice(0, 8) ?? "—"}</td>
                        <td className="px-2 py-1 text-zinc-600">{a.updatedAt.slice(0, 19)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
          <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
              BF-75 · ASN envelope normalize
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              Map a carrier-style JSON envelope into canonical{" "}
              <span className="font-mono text-[11px]">bf75.v1</span> and upsert the same{" "}
              <span className="font-medium">WmsInboundAsnAdvise</span> row as BF-59 (optional{" "}
              <span className="font-medium">persist: false</span> for dry-run). Full X12/856 translators remain out of
              scope.
            </p>
            <label className="mt-3 block text-xs font-medium text-zinc-700">
              partnerId
              <input
                type="text"
                value={bf75PartnerId}
                onChange={(e) => setBf75PartnerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
                spellCheck={false}
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-zinc-700">
              Envelope hint (optional — auto-detect when empty)
              <select
                value={bf75EnvelopeHint}
                onChange={(e) =>
                  setBf75EnvelopeHint(e.target.value as "" | "bf59_wrap" | "compact_items_v1")
                }
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              >
                <option value="">Auto</option>
                <option value="bf59_wrap">bf59_wrap (same shape as BF-59 POST)</option>
                <option value="compact_items_v1">compact_items_v1</option>
              </select>
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={bf75Persist}
                onChange={(e) => setBf75Persist(e.target.checked)}
              />
              Persist advise (<span className="font-mono text-[11px]">POST …/inbound-asn-normalize</span> default)
            </label>
            <p className="mt-3 text-xs font-medium text-zinc-700">
              Linkage JSON (optional — <span className="font-mono">warehouseId</span>,{" "}
              <span className="font-mono">purchaseOrderId</span>, <span className="font-mono">shipmentId</span>)
            </p>
            <textarea
              value={bf75NormalizeExtrasJson}
              onChange={(e) => setBf75NormalizeExtrasJson(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
              spellCheck={false}
            />
            <p className="mt-3 text-xs font-medium text-zinc-700">Raw envelope JSON</p>
            <textarea
              value={bf75EnvelopeJson}
              onChange={(e) => setBf75EnvelopeJson(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
              spellCheck={false}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitInboundAsnNormalize()}
              className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Run ASN normalize
            </button>
          </section>
          </Fragment>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex flex-wrap items-center gap-2 text-xs text-zinc-700">
            Inbound tag filter
            <select
              value={inboundTagFilter}
              onChange={(e) =>
                setInboundTagFilter(
                  e.target.value as "all" | "crossDock" | "flowThrough" | "either" | "customerReturn",
                )
              }
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="all">All inbound</option>
              <option value="crossDock">Cross-dock only</option>
              <option value="flowThrough">Flow-through only</option>
              <option value="either">Cross-dock or flow-through</option>
              <option value="customerReturn">Customer returns only</option>
            </select>
          </label>
        </div>
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
                <th className="px-2 py-1">ASN tol %</th>
                <th className="px-2 py-1">Catch wt %</th>
                <th className="px-2 py-1">Cold (BF-64)</th>
                <th className="px-2 py-1">Lines</th>
                <th className="px-2 py-1">Inbound type</th>
                <th className="px-2 py-1">RMA</th>
                <th className="px-2 py-1">Src outbound</th>
                <th className="px-2 py-1">XD</th>
                <th className="px-2 py-1">FT</th>
                {canEdit ? <th className="px-2 py-1">Dock</th> : null}
                {canEdit ? <th className="px-2 py-1">Log</th> : null}
                {canEdit ? <th className="px-2 py-1">Save</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {inboundShipmentsForOps.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 19 : 16} className="px-2 py-3 text-zinc-500">
                    {data.inboundShipments.length === 0
                      ? "No shipments for this tenant yet."
                      : "No inbound rows match this tag filter."}
                  </td>
                </tr>
              ) : (
                inboundShipmentsForOps.map((s) => {
                  const openRec = s.openWmsReceipt;
                  const draft =
                    inboundEdits[s.id] ?? {
                      asn: "",
                      expectedReceiveAt: "",
                      asnTolerancePct: "",
                      catchWeightTolerancePct: "",
                      receiptDockNote: "",
                      receiptDockAt: "",
                      receiptCompleteOnClose: false,
                      receiptGrn: "",
                      generateGrnOnClose: false,
                      requireTolAdvanceClose: false,
                      blockTolOutsideClose: false,
                      requireCwAdvanceClose: false,
                      blockCwOutsideClose: false,
                      blockQaSamplingIncompleteClose: true,
                      crossDock: s.wmsCrossDock,
                      flowThrough: s.wmsFlowThrough,
                      inboundSubtype: s.wmsInboundSubtype,
                      rmaRef: s.wmsRmaReference ?? "",
                      returnOutboundId: s.returnSourceOutboundOrderId ?? "",
                      inboundCustodyJson:
                        s.custodySegmentJson != null ? JSON.stringify(s.custodySegmentJson) : "",
                    };
                  const outboundNotInWh =
                    s.returnSourceOutboundOrderId &&
                    !outboundOrdersForWarehouse.some((o) => o.id === s.returnSourceOutboundOrderId)
                      ? data.outboundOrders.find((o) => o.id === s.returnSourceOutboundOrderId)
                      : undefined;
                  const outboundSelectRows = outboundNotInWh
                    ? [...outboundOrdersForWarehouse, outboundNotInWh]
                    : outboundOrdersForWarehouse;
                  const lineColSpan = canEdit ? 19 : 16;
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
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <input
                            value={draft.asnTolerancePct}
                            onChange={(e) =>
                              setInboundEdits((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, asnTolerancePct: e.target.value },
                              }))
                            }
                            className="w-16 rounded border border-zinc-300 px-1 py-1 text-xs"
                            placeholder="—"
                            title="BF-31 optional max %-delta vs shipped qty per line"
                          />
                        ) : (
                          <span className="text-zinc-600">{s.asnQtyTolerancePct ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <input
                            value={draft.catchWeightTolerancePct}
                            onChange={(e) =>
                              setInboundEdits((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, catchWeightTolerancePct: e.target.value },
                              }))
                            }
                            className="w-16 rounded border border-zinc-300 px-1 py-1 text-xs"
                            placeholder="—"
                            title="BF-63 optional max %-delta vs declared kg per catch-weight line"
                          />
                        ) : (
                          <span className="text-zinc-600">{s.catchWeightTolerancePct ?? "—"}</span>
                        )}
                      </td>
                      <td
                        className="px-2 py-1 text-xs text-zinc-600"
                        title={
                          s.custodySegmentJson != null
                            ? JSON.stringify(s.custodySegmentJson).slice(0, 500)
                            : ""
                        }
                      >
                        {s.custodySegmentJson != null ? (
                          <span className="rounded-full bg-sky-50 px-1.5 py-0.5 font-medium text-sky-900">
                            Segment
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-1 text-zinc-600">{s.itemCount}</td>
                      <td className="px-2 py-1">
                        {canEdit ? (
                          <select
                            value={draft.inboundSubtype}
                            disabled={busy}
                            onChange={(e) => {
                              const v = e.target.value as "STANDARD" | "CUSTOMER_RETURN";
                              setInboundEdits((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...draft,
                                  inboundSubtype: v,
                                  ...(v === "STANDARD"
                                    ? { rmaRef: "", returnOutboundId: "" }
                                    : {}),
                                },
                              }));
                            }}
                            className="max-w-[9rem] rounded border border-zinc-300 px-1 py-1 text-[11px]"
                            title="BF-41 — customer-return inbound vs standard PO receipt"
                          >
                            <option value="STANDARD">Standard</option>
                            <option value="CUSTOMER_RETURN">Customer return</option>
                          </select>
                        ) : (
                          <span className="text-zinc-700">
                            {s.wmsInboundSubtype === "CUSTOMER_RETURN" ? "Customer return" : "Standard"}
                          </span>
                        )}
                      </td>
                      <td className="min-w-[5rem] px-2 py-1">
                        {canEdit ? (
                          <input
                            value={draft.rmaRef}
                            disabled={busy || draft.inboundSubtype !== "CUSTOMER_RETURN"}
                            onChange={(e) =>
                              setInboundEdits((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, rmaRef: e.target.value },
                              }))
                            }
                            className="w-full max-w-[9rem] rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                            placeholder="RMA #"
                            title="BF-41 — RMA / authorization reference"
                          />
                        ) : (
                          <span className="text-zinc-600">{s.wmsRmaReference || "—"}</span>
                        )}
                      </td>
                      <td className="min-w-[7rem] px-2 py-1">
                        {canEdit ? (
                          <select
                            value={draft.returnOutboundId}
                            disabled={busy || draft.inboundSubtype !== "CUSTOMER_RETURN"}
                            onChange={(e) =>
                              setInboundEdits((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, returnOutboundId: e.target.value },
                              }))
                            }
                            className="max-w-[11rem] rounded border border-zinc-300 px-1 py-1 text-[11px]"
                            title="BF-41 — optional link to original outbound shipment"
                          >
                            <option value="">None</option>
                            {outboundSelectRows.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.outboundNo} · {o.status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-zinc-600">
                            {s.returnSourceOutbound?.outboundNo ?? "—"}
                          </span>
                        )}
                      </td>
                      {canEdit ? (
                        <>
                          <td className="px-2 py-1">
                            <label
                              className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-zinc-700"
                              title="Cross-dock tag (BF-37)"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-zinc-300"
                                checked={draft.crossDock}
                                disabled={busy}
                                onChange={(e) =>
                                  setInboundEdits((prev) => ({
                                    ...prev,
                                    [s.id]: { ...draft, crossDock: e.target.checked },
                                  }))
                                }
                              />
                              <span className="sr-only">Cross-dock</span>
                            </label>
                          </td>
                          <td className="px-2 py-1">
                            <label
                              className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-zinc-700"
                              title="Flow-through tag (BF-37)"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-zinc-300"
                                checked={draft.flowThrough}
                                disabled={busy}
                                onChange={(e) =>
                                  setInboundEdits((prev) => ({
                                    ...prev,
                                    [s.id]: { ...draft, flowThrough: e.target.checked },
                                  }))
                                }
                              />
                              <span className="sr-only">Flow-through</span>
                            </label>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-zinc-600">{s.wmsCrossDock ? "Yes" : "—"}</td>
                          <td className="px-2 py-1 text-zinc-600">{s.wmsFlowThrough ? "Yes" : "—"}</td>
                        </>
                      )}
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
                                asnQtyTolerancePct:
                                  draft.asnTolerancePct.trim() === ""
                                    ? null
                                    : Number(draft.asnTolerancePct),
                                catchWeightTolerancePct:
                                  draft.catchWeightTolerancePct.trim() === ""
                                    ? null
                                    : Number(draft.catchWeightTolerancePct),
                                wmsCrossDock: draft.crossDock,
                                wmsFlowThrough: draft.flowThrough,
                                wmsInboundSubtype: draft.inboundSubtype,
                                wmsRmaReference:
                                  draft.inboundSubtype === "CUSTOMER_RETURN"
                                    ? draft.rmaRef.trim() || null
                                    : null,
                                returnSourceOutboundOrderId:
                                  draft.inboundSubtype === "CUSTOMER_RETURN"
                                    ? draft.returnOutboundId.trim() || null
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
                    {canEdit ? (
                      <tr className="bg-sky-50/40">
                        <td colSpan={lineColSpan} className="px-2 py-2 align-top">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                            Cold-chain custody (BF-64)
                          </p>
                          <p className="mt-0.5 max-w-3xl text-[11px] text-sky-900/85">
                            Shipment-level JSON (probe / min / max °C, breach flags). Breach records{" "}
                            <span className="font-medium">cold_chain_custody_breach_bf64</span> for Control Tower
                            timeline.
                          </p>
                          <textarea
                            value={draft.inboundCustodyJson}
                            disabled={busy}
                            onChange={(e) =>
                              setInboundEdits((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, inboundCustodyJson: e.target.value },
                              }))
                            }
                            rows={2}
                            className="mt-2 w-full max-w-2xl rounded-lg border border-sky-200 bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-800"
                            placeholder='{"minTempC":2,"maxTempC":8,"probeTempC":5}'
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                const t = draft.inboundCustodyJson.trim();
                                if (!t) {
                                  window.alert("Paste JSON or use Clear custody.");
                                  return;
                                }
                                let parsed: unknown;
                                try {
                                  parsed = JSON.parse(t) as unknown;
                                } catch {
                                  window.alert("Invalid JSON — fix before applying.");
                                  return;
                                }
                                void runAction({
                                  action: "set_shipment_inbound_fields",
                                  shipmentId: s.id,
                                  custodySegmentJson: parsed,
                                });
                              }}
                              className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                            >
                              Apply custody JSON
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void runAction({
                                  action: "set_shipment_inbound_fields",
                                  shipmentId: s.id,
                                  custodySegmentJson: null,
                                })
                              }
                              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-[11px] font-medium text-sky-900 disabled:opacity-40"
                            >
                              Clear custody
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
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
                          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                              Dock receipt session (BF-12)
                            </p>
                            <p className="mt-1 max-w-3xl text-[11px] text-zinc-600">
                              Optional Option B wrapper on this shipment: while a session is{" "}
                              <span className="font-medium">open</span>, line saves use{" "}
                              <span className="font-medium">set_wms_receipt_line</span> (same BF-01 quantities on the
                              shipment line; audit carries <span className="font-medium">wmsReceiptId</span>). With no
                              session, <span className="font-medium">Save line</span> stays on direct Option A/BF-01
                              posting. Closing is <span className="font-medium">idempotent</span> (BF-21).
                            </p>
                            {openRec ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-700">
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-900">
                                  Session open
                                </span>
                                <span className="text-zinc-500">
                                  {openRec.id.slice(0, 10)}… · {openRec.lines.length} receipt line
                                  {openRec.lines.length === 1 ? "" : "s"}
                                </span>
                                {openRec.dockNote ? (
                                  <span className="max-w-md truncate text-zinc-600" title={openRec.dockNote}>
                                    Note: {openRec.dockNote}
                                  </span>
                                ) : null}
                                {canEdit ? (
                                  <div className="flex w-full flex-col gap-2">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                      <label className="flex max-w-md cursor-pointer items-center gap-2 text-[11px] text-zinc-600">
                                        <input
                                          type="checkbox"
                                          className="rounded border-zinc-300"
                                          checked={draft.receiptCompleteOnClose}
                                          disabled={busy}
                                          onChange={(e) =>
                                            setInboundEdits((prev) => ({
                                              ...prev,
                                              [s.id]: { ...draft, receiptCompleteOnClose: e.target.checked },
                                            }))
                                          }
                                        />
                                        On close, advance WMS receiving to Receipt complete when allowed (BF-21)
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-600">
                                        <input
                                          type="checkbox"
                                          className="rounded border-zinc-300"
                                          checked={draft.requireTolAdvanceClose}
                                          disabled={busy}
                                          onChange={(e) =>
                                            setInboundEdits((prev) => ({
                                              ...prev,
                                              [s.id]: { ...draft, requireTolAdvanceClose: e.target.checked },
                                            }))
                                          }
                                        />
                                        BF-31 — require ASN qty tolerance before that advance
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-600">
                                        <input
                                          type="checkbox"
                                          className="rounded border-zinc-300"
                                          checked={draft.blockTolOutsideClose}
                                          disabled={busy}
                                          onChange={(e) =>
                                            setInboundEdits((prev) => ({
                                              ...prev,
                                              [s.id]: { ...draft, blockTolOutsideClose: e.target.checked },
                                            }))
                                          }
                                        />
                                        BF-31 — block close if outside tolerance
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-600">
                                        <input
                                          type="checkbox"
                                          className="rounded border-zinc-300"
                                          checked={draft.requireCwAdvanceClose}
                                          disabled={busy}
                                          onChange={(e) =>
                                            setInboundEdits((prev) => ({
                                              ...prev,
                                              [s.id]: { ...draft, requireCwAdvanceClose: e.target.checked },
                                            }))
                                          }
                                        />
                                        BF-63 — require catch-weight kg tolerance before advance
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-600">
                                        <input
                                          type="checkbox"
                                          className="rounded border-zinc-300"
                                          checked={draft.blockCwOutsideClose}
                                          disabled={busy}
                                          onChange={(e) =>
                                            setInboundEdits((prev) => ({
                                              ...prev,
                                              [s.id]: { ...draft, blockCwOutsideClose: e.target.checked },
                                            }))
                                          }
                                        />
                                        BF-63 — block close if outside catch-weight band
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-600">
                                        <input
                                          type="checkbox"
                                          className="rounded border-zinc-300"
                                          checked={draft.blockQaSamplingIncompleteClose}
                                          disabled={busy}
                                          onChange={(e) =>
                                            setInboundEdits((prev) => ({
                                              ...prev,
                                              [s.id]: {
                                                ...draft,
                                                blockQaSamplingIncompleteClose: e.target.checked,
                                              },
                                            }))
                                          }
                                        />
                                        BF-80 — block close if QA sampling notes incomplete
                                      </label>
                                    </div>
                                    <div className="flex flex-wrap items-end gap-2">
                                      <label className="block min-w-[11rem] text-[11px] font-medium text-zinc-600">
                                        GRN (optional)
                                        <input
                                          value={draft.receiptGrn}
                                          disabled={busy || draft.generateGrnOnClose}
                                          onChange={(e) =>
                                            setInboundEdits((prev) => ({
                                              ...prev,
                                              [s.id]: { ...draft, receiptGrn: e.target.value },
                                            }))
                                          }
                                          className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1 text-[11px]"
                                          placeholder="e.g. carrier GRN"
                                        />
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 pb-1 text-[11px] text-zinc-600">
                                        <input
                                          type="checkbox"
                                          className="rounded border-zinc-300"
                                          checked={draft.generateGrnOnClose}
                                          disabled={busy}
                                          onChange={(e) =>
                                            setInboundEdits((prev) => ({
                                              ...prev,
                                              [s.id]: { ...draft, generateGrnOnClose: e.target.checked },
                                            }))
                                          }
                                        />
                                        Generate GRN
                                      </label>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          void runAction({
                                            action: "close_wms_receipt",
                                            receiptId: openRec.id,
                                            receiptCompleteOnClose: draft.receiptCompleteOnClose,
                                            generateGrn: draft.generateGrnOnClose,
                                            ...(draft.generateGrnOnClose
                                              ? {}
                                              : draft.receiptGrn.trim()
                                                ? { grnReference: draft.receiptGrn.trim() }
                                                : {}),
                                            requireWithinAsnToleranceForAdvance: draft.requireTolAdvanceClose,
                                            blockCloseIfOutsideTolerance: draft.blockTolOutsideClose,
                                            requireWithinCatchWeightForAdvance: draft.requireCwAdvanceClose,
                                            blockCloseIfOutsideCatchWeight: draft.blockCwOutsideClose,
                                            blockCloseIfQaSamplingIncompleteBf80:
                                              draft.blockQaSamplingIncompleteClose,
                                          })
                                        }
                                        className="ml-auto rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
                                      >
                                        Close dock receipt
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : canEdit ? (
                              <div className="mt-2 flex flex-wrap items-end gap-2">
                                <label className="block min-w-[10rem] text-[11px] font-medium text-zinc-600">
                                  Receipt note
                                  <input
                                    value={draft.receiptDockNote}
                                    onChange={(e) =>
                                      setInboundEdits((prev) => ({
                                        ...prev,
                                        [s.id]: { ...draft, receiptDockNote: e.target.value },
                                      }))
                                    }
                                    className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1 text-[11px]"
                                    placeholder="Optional"
                                    disabled={busy}
                                  />
                                </label>
                                <label className="block text-[11px] font-medium text-zinc-600">
                                  Dock received at
                                  <input
                                    type="datetime-local"
                                    value={draft.receiptDockAt}
                                    onChange={(e) =>
                                      setInboundEdits((prev) => ({
                                        ...prev,
                                        [s.id]: { ...draft, receiptDockAt: e.target.value },
                                      }))
                                    }
                                    className="mt-0.5 rounded-lg border border-zinc-300 px-2 py-1 text-[11px]"
                                    disabled={busy}
                                  />
                                </label>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction({
                                      action: "create_wms_receipt",
                                      shipmentId: s.id,
                                      receiptDockNote: draft.receiptDockNote.trim() || null,
                                      receiptDockReceivedAt: draft.receiptDockAt.trim()
                                        ? new Date(draft.receiptDockAt).toISOString()
                                        : null,
                                    })
                                  }
                                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                                >
                                  Start dock receipt
                                </button>
                              </div>
                            ) : (
                              <p className="mt-2 text-[11px] text-zinc-500">No open dock receipt session.</p>
                            )}
                            {s.closedWmsReceiptHistory.length > 0 ? (
                              <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/90 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                  Closed dock receipts (BF-21 history)
                                </p>
                                <ul className="mt-1 space-y-1 text-[11px] text-zinc-700">
                                  {s.closedWmsReceiptHistory.map((h) => (
                                    <li key={h.id} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-zinc-100/80 py-1 last:border-0">
                                      <span className="font-mono text-[10px] text-zinc-500">{h.id.slice(0, 10)}…</span>
                                      <span>{h.lineCount} line{h.lineCount === 1 ? "" : "s"}</span>
                                      <span className="text-zinc-500">
                                        closed{" "}
                                        {h.closedAt
                                          ? new Date(h.closedAt).toLocaleString()
                                          : "—"}
                                        {h.closedBy ? ` · ${h.closedBy.name}` : ""}
                                      </span>
                                      {h.grnReference ? (
                                        <span className="font-medium text-emerald-900">GRN {h.grnReference}</span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-2 overflow-x-auto">
                            <table className="min-w-[1100px] w-full border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-zinc-200 bg-zinc-100 text-left text-[10px] uppercase text-zinc-600">
                                  <th className="px-2 py-1">Ln</th>
                                  <th className="px-2 py-1">Description</th>
                                  <th className="px-2 py-1">Expected</th>
                                  <th className="px-2 py-1">Received</th>
                                  <th className="px-2 py-1">Decl kg</th>
                                  <th className="px-2 py-1">Catch kg</th>
                                  <th className="px-2 py-1">Recorded</th>
                                  <th className="px-2 py-1">Disposition</th>
                                  <th className="px-2 py-1">Return disp.</th>
                                  <th className="px-2 py-1">QA (BF-42)</th>
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
                                      <span className="block truncate">{line.description ?? "—"}</span>
                                      {line.isCatchWeightProduct ? (
                                        <span className="mt-0.5 block truncate text-[10px] font-normal text-amber-800">
                                          Catch-weight
                                          {line.catchWeightLabelHint
                                            ? ` · ${line.catchWeightLabelHint}`
                                            : ""}
                                        </span>
                                      ) : null}
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
                                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-zinc-600">
                                      {line.cargoGrossWeightKg ?? "—"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {canEdit ? (
                                        <input
                                          key={`cw-${line.shipmentItemId}-${line.catchWeightKg ?? ""}`}
                                          id={`inbound-cw-${line.shipmentItemId}`}
                                          type="number"
                                          min={0}
                                          step="0.001"
                                          defaultValue={line.catchWeightKg ?? ""}
                                          disabled={busy}
                                          title="BF-63 scale net kg vs declared"
                                          className="w-20 rounded border border-zinc-300 px-1.5 py-1 tabular-nums"
                                        />
                                      ) : (
                                        <span className="tabular-nums text-zinc-800">{line.catchWeightKg ?? "—"}</span>
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
                                      {s.wmsInboundSubtype === "CUSTOMER_RETURN" ? (
                                        canEdit ? (
                                          <select
                                            key={`ret-disp-${line.shipmentItemId}-${line.wmsReturnDisposition ?? "none"}`}
                                            id={`inbound-ret-${line.shipmentItemId}`}
                                            defaultValue={line.wmsReturnDisposition ?? "RESTOCK"}
                                            disabled={busy}
                                            className="max-w-[9rem] rounded border border-zinc-300 px-1 py-1 text-[11px]"
                                            title="BF-41 — restock vs scrap vs quarantine (putaway / holds)"
                                          >
                                            <option value="RESTOCK">Restock</option>
                                            <option value="SCRAP">Scrap</option>
                                            <option value="QUARANTINE">Quarantine</option>
                                          </select>
                                        ) : (
                                          <span className="text-zinc-700">
                                            {line.wmsReturnDisposition ?? "—"}
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-zinc-400">—</span>
                                      )}
                                    </td>
                                    <td className="min-w-[10rem] max-w-[12rem] px-2 py-1.5 align-top">
                                      {canEdit ? (
                                        <div className="flex flex-col gap-1">
                                          <label className="flex cursor-pointer items-center gap-1 text-[10px] text-zinc-600">
                                            <input
                                              type="checkbox"
                                              id={`inbound-qa-skip-${line.shipmentItemId}`}
                                              key={`qa-skip-${line.shipmentItemId}-${line.wmsQaSamplingSkipLot ? "y" : "n"}`}
                                              defaultChecked={line.wmsQaSamplingSkipLot}
                                              disabled={busy}
                                              className="rounded border-zinc-300"
                                            />
                                            Skip-lot
                                          </label>
                                          <input
                                            key={`qa-pct-${line.shipmentItemId}-${line.wmsQaSamplingPct ?? ""}`}
                                            id={`inbound-qa-pct-${line.shipmentItemId}`}
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="0.01"
                                            defaultValue={line.wmsQaSamplingPct ?? ""}
                                            disabled={busy}
                                            placeholder="Sample %"
                                            className="w-full rounded border border-zinc-300 px-1 py-1 text-[11px] tabular-nums"
                                          />
                                          <select
                                            key={`qa-tpl-${line.shipmentItemId}-${line.wmsReceivingDispositionTemplateId ?? ""}`}
                                            id={`inbound-qa-tpl-${line.shipmentItemId}`}
                                            defaultValue={line.wmsReceivingDispositionTemplateId ?? ""}
                                            disabled={busy}
                                            className="max-w-full rounded border border-zinc-300 px-1 py-1 text-[11px]"
                                          >
                                            <option value="">Template…</option>
                                            {(data.receivingDispositionTemplates ?? []).map((tpl) => (
                                              <option key={tpl.id} value={tpl.id}>
                                                {tpl.code}
                                              </option>
                                            ))}
                                          </select>
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                              const skipEl = document.getElementById(
                                                `inbound-qa-skip-${line.shipmentItemId}`,
                                              ) as HTMLInputElement | null;
                                              const pctEl = document.getElementById(
                                                `inbound-qa-pct-${line.shipmentItemId}`,
                                              ) as HTMLInputElement | null;
                                              const tplEl = document.getElementById(
                                                `inbound-qa-tpl-${line.shipmentItemId}`,
                                              ) as HTMLSelectElement | null;
                                              const pctTrim = pctEl?.value?.trim() ?? "";
                                              const pctPayload =
                                                pctTrim === "" ? null : Number.parseFloat(pctTrim);
                                              if (
                                                pctPayload !== null &&
                                                (!Number.isFinite(pctPayload) ||
                                                  pctPayload < 0 ||
                                                  pctPayload > 100)
                                              ) {
                                                return;
                                              }
                                              const tplVal = tplEl?.value?.trim() ?? "";
                                              void runAction({
                                                action: "set_shipment_item_qa_sampling_bf42",
                                                shipmentItemId: line.shipmentItemId,
                                                wmsQaSamplingSkipLot: Boolean(skipEl?.checked),
                                                wmsQaSamplingPct: pctPayload,
                                                wmsReceivingDispositionTemplateId:
                                                  tplVal === "" ? null : tplVal,
                                              });
                                            }}
                                            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-800 disabled:opacity-40"
                                          >
                                            Save QA
                                          </button>
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                              const tplEl = document.getElementById(
                                                `inbound-qa-tpl-${line.shipmentItemId}`,
                                              ) as HTMLSelectElement | null;
                                              const tplVal = tplEl?.value?.trim() ?? "";
                                              void runAction({
                                                action:
                                                  "apply_wms_disposition_template_to_shipment_item",
                                                shipmentItemId: line.shipmentItemId,
                                                ...(tplVal ? { receivingDispositionTemplateId: tplVal } : {}),
                                              });
                                            }}
                                            className="rounded-xl bg-[var(--arscmp-primary)] px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
                                          >
                                            Apply template
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="space-y-0.5 text-[10px] text-zinc-600">
                                          <div>{line.wmsQaSamplingSkipLot ? "Skip-lot" : "—"}</div>
                                          <div>
                                            {line.wmsQaSamplingPct != null
                                              ? `${line.wmsQaSamplingPct}% sample`
                                              : "—"}
                                          </div>
                                          <div className="truncate" title={line.receivingDispositionTemplate?.title ?? ""}>
                                            {line.receivingDispositionTemplate?.code ?? "—"}
                                          </div>
                                        </div>
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
                                            const retDispEl = document.getElementById(
                                              `inbound-ret-${line.shipmentItemId}`,
                                            ) as HTMLSelectElement | null;
                                            const rawRecv = recvEl?.value?.trim() ?? "";
                                            const receivedQty = Number.parseFloat(rawRecv);
                                            if (!Number.isFinite(receivedQty) || receivedQty < 0) {
                                              return;
                                            }
                                            const vd = dispEl?.value?.trim() ?? "";
                                            const noteVal = noteEl?.value ?? "";
                                            const cwEl = document.getElementById(
                                              `inbound-cw-${line.shipmentItemId}`,
                                            ) as HTMLInputElement | null;
                                            const cwTrim = cwEl?.value?.trim() ?? "";
                                            const hadCatch =
                                              line.catchWeightKg != null && line.catchWeightKg !== "";
                                            let catchWeightKg: number | null | undefined;
                                            if (cwTrim === "") {
                                              catchWeightKg = hadCatch ? null : undefined;
                                            } else {
                                              const cwN = Number.parseFloat(cwTrim);
                                              if (!Number.isFinite(cwN) || cwN < 0) {
                                                return;
                                              }
                                              catchWeightKg = cwN;
                                            }
                                            const base = {
                                              shipmentItemId: line.shipmentItemId,
                                              receivedQty,
                                              varianceDisposition: vd === "" ? undefined : vd,
                                              varianceNote: noteVal,
                                              ...(catchWeightKg !== undefined ? { catchWeightKg } : {}),
                                            };
                                            void (async () => {
                                              if (s.wmsInboundSubtype === "CUSTOMER_RETURN") {
                                                const rd = retDispEl?.value?.trim() ?? "";
                                                if (
                                                  rd !== "RESTOCK" &&
                                                  rd !== "SCRAP" &&
                                                  rd !== "QUARANTINE"
                                                ) {
                                                  return;
                                                }
                                                const okDisp = await runAction(
                                                  {
                                                    action: "set_shipment_item_return_disposition",
                                                    shipmentItemId: line.shipmentItemId,
                                                    wmsReturnDisposition: rd,
                                                  },
                                                  { reload: false },
                                                );
                                                if (!okDisp) return;
                                              }
                                              await runAction(
                                                openRec
                                                  ? {
                                                      action: "set_wms_receipt_line",
                                                      receiptId: openRec.id,
                                                      ...base,
                                                    }
                                                  : {
                                                      action: "set_shipment_item_receive_line",
                                                      ...base,
                                                    },
                                              );
                                            })();
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
          <span className="font-medium">SCHEDULED</span> appointment overlaps the same dock.
          Optional <span className="font-medium">carrier / trailer</span> metadata and{" "}
          <span className="font-medium">yard milestones</span> (gate → dock → departed) cover BF-05 ops depth —
          not TMS routing or carrier APIs. <span className="font-medium">BF-17</span> adds optional TMS identifiers and a
          Bearer-authenticated <span className="font-medium">POST /api/wms/tms-webhook</span>;{" "}
          <span className="font-medium">BF-25</span> adds optional HMAC signing (<span className="font-medium">X-TMS-Signature</span>) and{" "}
          <span className="font-medium">externalEventId</span> idempotency — see{" "}
          <span className="font-medium">docs/wms/WMS_DOCK_APPOINTMENTS.md</span> and{" "}
          <span className="font-medium">docs/wms/WMS_TMS_WEBHOOK_BF25.md</span>.{" "}
          <span className="font-medium">BF-74</span> adds a dedicated signed{" "}
          <span className="font-medium">POST /api/wms/yard-geofence-webhook</span> for arrival pings (requires{" "}
          <span className="font-medium">externalEventId</span>) — see{" "}
          <span className="font-medium">docs/wms/WMS_YARD_GEOFENCE_BF74.md</span>.{" "}
          <span className="font-medium">BF-90</span> exposes advisory JSON (
          <a
            href={`/api/wms/tms-appointment-hints${selectedWarehouseId ? `?warehouseId=${encodeURIComponent(selectedWarehouseId)}` : ""}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-[var(--arscmp-primary)] underline"
          >
            GET /api/wms/tms-appointment-hints
          </a>
          , optional <span className="font-medium">warehouseId</span>) combining dock queue overlap with BF-54 timers — read-only for TMS planning. BF-38 adds optional{" "}
          <span className="font-medium">physical door</span>,{" "}
          <span className="font-medium">trailer checklist</span> with DEPARTED validation when required lines stay open, optional{" "}
          <span className="font-mono text-[11px]">WMS_BF38_REQUIRE_DOOR_BEFORE_AT_DOCK</span> for AT_DOCK, and a{" "}
          <span className="font-medium">next booking</span> hint per dock row.
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
          <label className="block text-xs font-medium text-zinc-600">
            Carrier name (optional)
            <input
              value={dockScheduleCarrierName}
              onChange={(e) => setDockScheduleCarrierName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. carrier legal name"
              disabled={!canEdit}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Carrier ref / SCAC / PRO (optional)
            <input
              value={dockScheduleCarrierRef}
              onChange={(e) => setDockScheduleCarrierRef(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Booking or PRO number"
              disabled={!canEdit}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Trailer ID (optional)
            <input
              value={dockScheduleTrailerId}
              onChange={(e) => setDockScheduleTrailerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Trailer / plate"
              disabled={!canEdit}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Door (BF-38, optional)
            <input
              value={dockDoorCreateInput}
              onChange={(e) => setDockDoorCreateInput(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. DR-02"
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
                const cn = dockScheduleCarrierName.trim();
                const cr = dockScheduleCarrierRef.trim();
                const tr = dockScheduleTrailerId.trim();
                if (cn) body.carrierName = cn;
                if (cr) body.carrierReference = cr;
                if (tr) body.trailerId = tr;
                const door = dockDoorCreateInput.trim();
                if (door) body.doorCode = door;
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
                <th className="px-2 py-1">Door</th>
                <th className="px-2 py-1">Window</th>
                <th className="px-2 py-1">Dir</th>
                <th className="px-2 py-1">Ref</th>
                <th className="px-2 py-1">Carrier</th>
                <th className="px-2 py-1">Yard</th>
                <th className="px-2 py-1">Detention</th>
                <th className="px-2 py-1">TMS load</th>
                <th className="px-2 py-1">TMS booking</th>
                <th className="px-2 py-1">Webhook</th>
                <th className="px-2 py-1">Status</th>
                {canEdit ? <th className="px-2 py-1"> </th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {(data.dockAppointments ?? []).filter(
                (a) => !selectedWarehouseId || a.warehouse.id === selectedWarehouseId,
              ).length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 14 : 13} className="px-2 py-3 text-zinc-500">
                    No dock appointments
                    {selectedWarehouseId ? " for this warehouse" : ""} yet.
                  </td>
                </tr>
              ) : (
                (data.dockAppointments ?? [])
                  .filter((a) => !selectedWarehouseId || a.warehouse.id === selectedWarehouseId)
                  .flatMap((a) => {
                    const tdraft = dockTransportDraft[a.id] ?? {
                      carrierName: "",
                      carrierReference: "",
                      trailerId: "",
                    };
                    const bf38 = dockBf38Draft[a.id] ?? {
                      doorCode: a.doorCode ?? "",
                      checklist: a.trailerChecklistJson,
                    };
                    const mdraft = dockTmsDraft[a.id] ?? {
                      tmsLoadId: a.tmsLoadId ?? "",
                      tmsCarrierBookingRef: a.tmsCarrierBookingRef ?? "",
                    };
                    const main = (
                      <tr key={a.id}>
                        <td className="px-2 py-1 text-zinc-800">
                          {a.warehouse.code || a.warehouse.name}
                        </td>
                        <td className="px-2 py-1 font-mono text-xs text-zinc-700">{a.dockCode}</td>
                        <td className="px-2 py-1 font-mono text-xs text-zinc-600">{a.doorCode ?? "—"}</td>
                        <td className="px-2 py-1 text-xs text-zinc-700">
                          <span className="block">
                            {new Date(a.windowStart).toLocaleString()} →{" "}
                            {new Date(a.windowEnd).toLocaleString()}
                          </span>
                          {a.nextDockAppointmentWindowStart ? (
                            <span className="mt-0.5 block text-[10px] text-zinc-500">
                              Next on dock: {new Date(a.nextDockAppointmentWindowStart).toLocaleString()}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1 text-zinc-600">{a.direction}</td>
                        <td className="px-2 py-1 text-xs text-zinc-700">
                          {a.shipment
                            ? `${a.shipment.orderNumber} · ${a.shipment.shipmentNo ?? a.shipment.id.slice(0, 8)}`
                            : a.outboundNo
                              ? `Outbound ${a.outboundNo}`
                              : "—"}
                        </td>
                        <td className="max-w-[10rem] truncate px-2 py-1 text-xs text-zinc-700">
                          {dockCarrierDisplayLine(a)}
                        </td>
                        <td className="max-w-[11rem] truncate px-2 py-1 text-xs text-zinc-600">
                          {dockYardDisplayLine(a)}
                        </td>
                        <td className="px-2 py-1 text-xs">
                          {a.detentionAlert ? (
                            <span
                              className="inline-block rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-950"
                              title={`Over ${a.detentionAlert.limitMinutes} min (${a.detentionAlert.phase})`}
                            >
                              {a.detentionAlert.phase === "GATE_TO_DOCK" ? "Gate→dock" : "Dwell"} +
                              {a.detentionAlert.minutesOver}m
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-[9rem] truncate px-2 py-1 font-mono text-[11px] text-zinc-600">
                          {a.tmsLoadId ?? "—"}
                        </td>
                        <td className="max-w-[9rem] truncate px-2 py-1 text-[11px] text-zinc-600">
                          {a.tmsCarrierBookingRef ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-[11px] text-zinc-500">
                          {a.tmsLastWebhookAt ? new Date(a.tmsLastWebhookAt).toLocaleString() : "—"}
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
                    );
                    const yardControls =
                      canEdit && a.status === "SCHEDULED" ? (
                        <tr key={`${a.id}-yard`} className="bg-zinc-50/90">
                          <td colSpan={canEdit ? 14 : 13} className="px-3 py-2">
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="block min-w-[140px] text-[11px] font-medium text-zinc-600">
                                Carrier name
                                <input
                                  value={tdraft.carrierName}
                                  onChange={(e) =>
                                    setDockTransportDraft((prev) => ({
                                      ...prev,
                                      [a.id]: { ...tdraft, carrierName: e.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                                  disabled={busy}
                                />
                              </label>
                              <label className="block min-w-[140px] text-[11px] font-medium text-zinc-600">
                                Carrier ref
                                <input
                                  value={tdraft.carrierReference}
                                  onChange={(e) =>
                                    setDockTransportDraft((prev) => ({
                                      ...prev,
                                      [a.id]: { ...tdraft, carrierReference: e.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                                  disabled={busy}
                                />
                              </label>
                              <label className="block min-w-[120px] text-[11px] font-medium text-zinc-600">
                                Trailer
                                <input
                                  value={tdraft.trailerId}
                                  onChange={(e) =>
                                    setDockTransportDraft((prev) => ({
                                      ...prev,
                                      [a.id]: { ...tdraft, trailerId: e.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                                  disabled={busy}
                                />
                              </label>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction({
                                    action: "set_dock_appointment_transport",
                                    dockAppointmentId: a.id,
                                    carrierName: tdraft.carrierName.trim() || null,
                                    carrierReference: tdraft.carrierReference.trim() || null,
                                    trailerId: tdraft.trailerId.trim() || null,
                                  })
                                }
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                              >
                                Save carrier
                              </button>
                              <label className="block min-w-[120px] text-[11px] font-medium text-zinc-600">
                                TMS load id
                                <input
                                  value={mdraft.tmsLoadId}
                                  onChange={(e) =>
                                    setDockTmsDraft((prev) => ({
                                      ...prev,
                                      [a.id]: { ...mdraft, tmsLoadId: e.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-[11px]"
                                  disabled={busy}
                                  placeholder="Opaque TMS / load id"
                                />
                              </label>
                              <label className="block min-w-[140px] text-[11px] font-medium text-zinc-600">
                                TMS booking ref
                                <input
                                  value={mdraft.tmsCarrierBookingRef}
                                  onChange={(e) =>
                                    setDockTmsDraft((prev) => ({
                                      ...prev,
                                      [a.id]: { ...mdraft, tmsCarrierBookingRef: e.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-[11px]"
                                  disabled={busy}
                                  placeholder="PRO / BOL / booking"
                                />
                              </label>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction({
                                    action: "set_dock_appointment_tms_refs",
                                    dockAppointmentId: a.id,
                                    tmsLoadId: mdraft.tmsLoadId.trim() || null,
                                    tmsCarrierBookingRef: mdraft.tmsCarrierBookingRef.trim() || null,
                                  })
                                }
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                              >
                                Save TMS refs
                              </button>
                              <div className="mt-3 w-full basis-full rounded-xl border border-zinc-200 bg-white/90 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                  BF-38 — Door & trailer checklist
                                </p>
                                <div className="mt-2 flex flex-wrap items-end gap-3">
                                  <label className="block min-w-[120px] text-[11px] font-medium text-zinc-600">
                                    Physical door
                                    <input
                                      value={bf38.doorCode}
                                      onChange={(e) =>
                                        setDockBf38Draft((prev) => ({
                                          ...prev,
                                          [a.id]: { ...bf38, doorCode: e.target.value },
                                        }))
                                      }
                                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-[11px]"
                                      disabled={busy}
                                      placeholder="e.g. DR-02"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void runAction({
                                        action: "update_dock_appointment_bf38",
                                        dockAppointmentId: a.id,
                                        doorCode: bf38.doorCode.trim() || null,
                                      })
                                    }
                                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                                  >
                                    Save door
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      const init = defaultTrailerChecklistPayload();
                                      setDockBf38Draft((prev) => ({
                                        ...prev,
                                        [a.id]: { ...bf38, checklist: init },
                                      }));
                                      void runAction({
                                        action: "update_dock_appointment_bf38",
                                        dockAppointmentId: a.id,
                                        trailerChecklistJson: init,
                                      });
                                    }}
                                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                                  >
                                    Init checklist
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || !bf38.checklist}
                                    onClick={() => {
                                      setDockBf38Draft((prev) => ({
                                        ...prev,
                                        [a.id]: { ...bf38, checklist: null },
                                      }));
                                      void runAction({
                                        action: "update_dock_appointment_bf38",
                                        dockAppointmentId: a.id,
                                        trailerChecklistJson: null,
                                      });
                                    }}
                                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                                  >
                                    Clear checklist
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || !bf38.checklist}
                                    onClick={() =>
                                      void runAction({
                                        action: "update_dock_appointment_bf38",
                                        dockAppointmentId: a.id,
                                        trailerChecklistJson: bf38.checklist,
                                      })
                                    }
                                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                                  >
                                    Save checklist
                                  </button>
                                </div>
                                {bf38.checklist?.items?.length ? (
                                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                                    {bf38.checklist.items.map((it) => (
                                      <label
                                        key={it.id}
                                        className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700"
                                      >
                                        <input
                                          type="checkbox"
                                          className="rounded border-zinc-300"
                                          checked={it.done}
                                          disabled={busy}
                                          onChange={(e) => {
                                            const done = e.target.checked;
                                            setDockBf38Draft((prev) => {
                                              const cur = prev[a.id] ?? bf38;
                                              if (!cur.checklist) return prev;
                                              return {
                                                ...prev,
                                                [a.id]: {
                                                  ...cur,
                                                  checklist: {
                                                    items: cur.checklist.items.map((row) =>
                                                      row.id === it.id ? { ...row, done } : row,
                                                    ),
                                                  },
                                                },
                                              };
                                            });
                                          }}
                                        />
                                        <span>
                                          {it.label}
                                          {it.required ? (
                                            <span className="text-zinc-500"> *</span>
                                          ) : null}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-[11px] text-zinc-500">
                                    No checklist — use Init checklist (required items must be checked before{" "}
                                    <span className="font-medium">Departed</span>).
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction({
                                    action: "record_dock_appointment_yard_milestone",
                                    dockAppointmentId: a.id,
                                    yardMilestone: "GATE_IN",
                                  })
                                }
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                              >
                                Gate in
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction({
                                    action: "record_dock_appointment_yard_milestone",
                                    dockAppointmentId: a.id,
                                    yardMilestone: "AT_DOCK",
                                  })
                                }
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
                              >
                                At dock
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction({
                                    action: "record_dock_appointment_yard_milestone",
                                    dockAppointmentId: a.id,
                                    yardMilestone: "DEPARTED",
                                  })
                                }
                                className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                              >
                                Departed (complete)
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null;
                    return yardControls ? [main, yardControls] : [main];
                  })
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
          <span className="font-medium text-zinc-800">Mark shipped</span>.           Evidence print + ship-station ZPL stub + audit:{" "}
          <span className="font-medium text-zinc-800">docs/wms/WMS_PACKING_LABELS.md</span>,{" "}
          <span className="font-medium text-zinc-800">docs/wms/WMS_PACKING_LABELS_BF08.md</span>.
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
        {canEdit ? (
          <section className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-800">BF-60 · Offline scan batch</p>
            <p className="mt-2 text-xs text-violet-950/85">
              Replay queued <span className="font-medium">VALIDATE_PACK_SCAN</span> /{" "}
              <span className="font-medium">VALIDATE_SHIP_SCAN</span> events with a client{" "}
              <span className="font-medium">clientBatchId</span> (idempotent). Conflicts return{" "}
              <span className="font-medium">409</span> with <span className="font-medium">SCAN_BATCH_CONFLICT</span>. See{" "}
              <span className="font-medium">docs/wms/WMS_OFFLINE_SCAN_BF60.md</span>.
            </p>
            <textarea
              value={bf60BatchJson}
              onChange={(e) => setBf60BatchJson(e.target.value)}
              rows={10}
              className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
              spellCheck={false}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitScanEventBatch()}
              className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              POST scan-events/batch
            </button>
            {(data.scanEventBatches ?? []).length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <p className="text-xs font-medium text-violet-950">Recent batches ({data.scanEventBatches.length})</p>
                <table className="mt-2 min-w-full text-xs">
                  <thead className="bg-violet-100/80 text-left text-[10px] uppercase text-violet-900">
                    <tr>
                      <th className="px-2 py-1">Client batch id</th>
                      <th className="px-2 py-1">HTTP</th>
                      <th className="px-2 py-1">Actor</th>
                      <th className="px-2 py-1">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-100">
                    {data.scanEventBatches.map((b) => (
                      <tr key={b.id}>
                        <td className="px-2 py-1 font-mono">{b.clientBatchId}</td>
                        <td className="px-2 py-1">{b.lastStatusCode}</td>
                        <td className="px-2 py-1">{b.createdBy?.name ?? b.createdBy?.id?.slice(0, 8) ?? "—"}</td>
                        <td className="px-2 py-1 text-zinc-600">{b.createdAt.slice(0, 19)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}
        {canEdit ? (
          <section className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-900">BF-65 · Damage &amp; carrier claim stub</p>
            <p className="mt-2 text-xs text-amber-950/85">
              Create <span className="font-medium">WmsDamageReport</span> via{" "}
              <span className="font-mono text-[11px]">POST /api/wms</span>{" "}
              <span className="font-medium">create_wms_damage_report_bf65</span>. Download carrier-oriented JSON from{" "}
              <span className="font-mono text-[11px]">GET /api/wms/damage-reports/&lt;id&gt;/claim-export</span>. See{" "}
              <span className="font-medium">docs/wms/WMS_DAMAGE_CLAIM_BF65.md</span>.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-medium text-amber-950">
                Context
                <select
                  value={bf65Context}
                  onChange={(e) => setBf65Context(e.target.value as "RECEIVING" | "PACKING")}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="RECEIVING">RECEIVING (inbound shipment)</option>
                  <option value="PACKING">PACKING (outbound order)</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-amber-950">
                Status
                <select
                  value={bf65Status}
                  onChange={(e) => setBf65Status(e.target.value as "DRAFT" | "SUBMITTED")}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                </select>
              </label>
            </div>
            {bf65Context === "RECEIVING" ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  value={bf65ShipmentId}
                  onChange={(e) => setBf65ShipmentId(e.target.value)}
                  placeholder="Inbound shipment id"
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  value={bf65LineId}
                  onChange={(e) => setBf65LineId(e.target.value)}
                  placeholder="Shipment item id (optional)"
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <input
                value={bf65OutboundId}
                onChange={(e) => setBf65OutboundId(e.target.value)}
                placeholder="Outbound order id"
                className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm sm:max-w-md"
              />
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={bf65Category}
                onChange={(e) => setBf65Category(e.target.value)}
                placeholder="Damage category (e.g. CRUSHED)"
                className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={bf65ClaimRef}
                onChange={(e) => setBf65ClaimRef(e.target.value)}
                placeholder="Your claim / ticket ref (optional)"
                className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={bf65Desc}
              onChange={(e) => setBf65Desc(e.target.value)}
              placeholder="Description"
              rows={3}
              className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
            <textarea
              value={bf65Photos}
              onChange={(e) => setBf65Photos(e.target.value)}
              placeholder="Photo URLs (one per line or comma-separated, https or /relative)"
              rows={3}
              className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
              spellCheck={false}
            />
            <textarea
              value={bf65ExtraJson}
              onChange={(e) => setBf65ExtraJson(e.target.value)}
              placeholder='Optional extra JSON object e.g. {"cartonId":"C-1"}'
              rows={2}
              className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
              spellCheck={false}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitDamageReportBf65()}
              className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Create damage report
            </button>
            {(data.wmsDamageReports ?? []).length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <p className="text-xs font-medium text-amber-950">
                  Recent reports ({(data.wmsDamageReports ?? []).length})
                </p>
                <table className="mt-2 min-w-full text-xs">
                  <thead className="bg-amber-100/80 text-left text-[10px] uppercase text-amber-950">
                    <tr>
                      <th className="px-2 py-1">Id</th>
                      <th className="px-2 py-1">Ctx</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Category</th>
                      <th className="px-2 py-1">Claim export</th>
                      <th className="px-2 py-1">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {(data.wmsDamageReports ?? []).map((r) => (
                      <tr key={r.id}>
                        <td className="px-2 py-1 font-mono">{r.id.slice(0, 12)}…</td>
                        <td className="px-2 py-1">{r.context}</td>
                        <td className="px-2 py-1">{r.status}</td>
                        <td className="px-2 py-1">{r.damageCategory ?? "—"}</td>
                        <td className="px-2 py-1">
                          <a
                            href={`/api/wms/damage-reports/${encodeURIComponent(r.id)}/claim-export`}
                            className="font-medium text-[var(--arscmp-primary)] underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            JSON
                          </a>
                        </td>
                        <td className="px-2 py-1 text-zinc-600">{r.createdAt.slice(0, 19)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}
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
            ). Full quote lineage on outbound (
            <span className="font-medium text-zinc-900">BF-10</span>,{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">sourceCrmQuoteId</code>
            ). <span className="font-medium text-zinc-900">BF-14</span> explodes CRM quote lines into outbound SKU lines
            after you set each quote line&apos;s WMS SKU (see CRM quote detail). Docs:{" "}
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
        {(data.crmQuoteOptions ?? []).length > 0 ? (
          <div className="mt-2">
            <label className="block text-xs font-medium text-zinc-600">CRM quote link (optional)</label>
            <select
              value={outboundSourceQuoteId}
              onChange={(e) => {
                const id = e.target.value;
                setOutboundSourceQuoteId(id);
                const qq = (data.crmQuoteOptions ?? []).find((x) => x.id === id);
                if (qq) setOutboundCrmAccountId(qq.accountId);
              }}
              className="mt-1 w-full max-w-xl rounded border border-zinc-300 px-3 py-2 text-sm sm:w-auto"
            >
              <option value="">No quote link</option>
              {quotesFilteredForCreate.map((q) => {
                const accName =
                  data.crmAccountOptions.find((a) => a.id === q.accountId)?.name ?? "Account";
                const head = q.quoteNumber ? `${q.quoteNumber} · ` : "";
                return (
                  <option key={q.id} value={q.id}>
                    {head}
                    {q.title.length > 48 ? `${q.title.slice(0, 48)}…` : q.title} · {accName}
                  </option>
                );
              })}
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
              if (outboundSourceQuoteId.trim()) {
                body.sourceCrmQuoteId = outboundSourceQuoteId.trim();
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
            const canQuoteExplode =
              canEdit &&
              Boolean(o.sourceQuote) &&
              o.lines.length === 0 &&
              o.status !== "PACKED" &&
              o.status !== "SHIPPED" &&
              o.status !== "CANCELLED";
            const explosionPreview = quoteExplosionPreviewByOutboundId[o.id];
            const asnDraft = outboundAsnEdits[o.id] ?? { asn: "", requestedShip: "" };
            const allPicked = o.lines.every((l) => Number(l.pickedQty) >= Number(l.quantity));
            const allPacked = o.lines.every((l) => Number(l.packedQty) >= Number(l.quantity));
            const canPrintPackSlip =
              allPicked &&
              o.lines.length > 0 &&
              o.status !== "DRAFT" &&
              o.status !== "CANCELLED";
            const canExportDesadvAsn =
              o.lines.length > 0 && (o.status === "PACKED" || o.status === "SHIPPED");
            const canExportManifestBf67 =
              canExportDesadvAsn &&
              (Boolean(o.carrierTrackingNo) || (o.manifestParcelIds?.length ?? 0) > 0);
            const canExportSerialBf71 =
              canExportDesadvAsn && (o.logisticsUnits?.length ?? 0) > 0;
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
                {o.sourceQuote ? (
                  <Link
                    href={`/crm/quotes/${o.sourceQuote.id}`}
                    className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-900 underline-offset-2 hover:underline"
                  >
                    Quote: {o.sourceQuote.quoteNumber ?? o.sourceQuote.title.slice(0, 28)}
                  </Link>
                ) : null}
                {o.carrierTrackingNo ? (
                  <span
                    className="max-w-[14rem] truncate rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900"
                    title={o.carrierTrackingNo}
                  >
                    Tracking: {o.carrierTrackingNo}
                  </span>
                ) : null}
                {(o.manifestParcelIds?.length ?? 0) > 0 ? (
                  <span className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-900" title="BF-67 manifest">
                    Parcels: {o.manifestParcelIds.length}
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
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const ssccHr =
                          ssccDemoCompanyPrefixDigits !== null
                            ? buildSscc18DemoFromOutbound(o.id, ssccDemoCompanyPrefixDigits)
                            : null;
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
                          sscc18HumanReadable: ssccHr,
                          lines: o.lines.map((l) => ({
                            lineNo: l.lineNo,
                            productCode: l.product.productCode,
                            sku: l.product.sku,
                            name: l.product.name,
                            quantity: l.quantity,
                            pickedQty: l.pickedQty,
                            packedQty: l.packedQty,
                          })),
                        });
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                    >
                      Print pack slip
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const ssccHr =
                          ssccDemoCompanyPrefixDigits !== null
                            ? buildSscc18DemoFromOutbound(o.id, ssccDemoCompanyPrefixDigits)
                            : null;
                        const shipBits = [o.shipToName, o.shipToCity, o.shipToCountryCode].filter(Boolean);
                        const zpl = buildShipStationZpl({
                          outboundNo: o.outboundNo,
                          warehouseLabel: o.warehouse.code || o.warehouse.name,
                          barcodePayload: ssccHr ?? o.outboundNo,
                          shipToSummary: shipBits.length ? shipBits.join(" · ") : "—",
                          asnReference: o.asnReference,
                          sscc18: ssccHr,
                        });
                        const safeName = o.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";
                        downloadZplTextFile(zpl, `${safeName}-ship-station.zpl`);
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                    >
                      Download ZPL stub
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const r = await runAction(
                          { action: "purchase_carrier_label", outboundOrderId: o.id },
                        );
                        if (!r) return;
                        const zpl = typeof r.zpl === "string" ? r.zpl : null;
                        const tn = typeof r.trackingNo === "string" ? r.trackingNo : "label";
                        if (zpl) {
                          const safeName = o.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";
                          downloadZplTextFile(zpl, `${safeName}-carrier-${tn}.zpl`);
                        }
                      }}
                      className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Purchase carrier label
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const r = await runAction(
                          { action: "request_demo_carrier_label", outboundOrderId: o.id },
                          { reload: false },
                        );
                        if (!r) return;
                        const zpl = typeof r.zpl === "string" ? r.zpl : null;
                        const tn = typeof r.trackingNo === "string" ? r.trackingNo : "demo";
                        if (zpl) {
                          const safeName = o.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";
                          downloadZplTextFile(zpl, `${safeName}-demo-carrier-${tn}.zpl`);
                        }
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                      title="Synthetic DEMO_PARCEL only; does not persist tracking."
                    >
                      Demo label (no save)
                    </button>
                  </>
                ) : null}
                {canExportDesadvAsn ? (
                  <button
                    type="button"
                    disabled={busy}
                    title="BF-40 DESADV-inspired ASN JSON (not certified EDI)."
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const res = await fetch(
                          `/api/wms/outbound-asn-export?${new URLSearchParams({
                            outboundOrderId: o.id,
                            pretty: "1",
                          })}`,
                        );
                        const text = await res.text();
                        if (!res.ok) {
                          let parsed: unknown;
                          try {
                            parsed = JSON.parse(text);
                          } catch {
                            parsed = null;
                          }
                          setError(apiClientErrorMessage(parsed, "ASN export failed."));
                          return;
                        }
                        const safeName = o.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";
                        downloadUtf8Blob(
                          new Blob([text], { type: "application/json;charset=utf-8" }),
                          `${safeName}-desadv-asn.json`,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Export ASN JSON
                  </button>
                ) : null}
                {canExportManifestBf67 ? (
                  <button
                    type="button"
                    disabled={busy}
                    title="BF-67 multi-parcel manifest JSON for carriers / middleware."
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const res = await fetch(
                          `/api/wms/outbound-manifest-export?${new URLSearchParams({
                            outboundOrderId: o.id,
                            pretty: "1",
                          })}`,
                        );
                        const text = await res.text();
                        if (!res.ok) {
                          let parsed: unknown;
                          try {
                            parsed = JSON.parse(text);
                          } catch {
                            parsed = null;
                          }
                          setError(apiClientErrorMessage(parsed, "Manifest export failed."));
                          return;
                        }
                        const safeName = o.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";
                        downloadUtf8Blob(
                          new Blob([text], { type: "application/json;charset=utf-8" }),
                          `${safeName}-outbound-manifest-bf67.json`,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Export manifest JSON
                  </button>
                ) : null}
                {canExportSerialBf71 ? (
                  <button
                    type="button"
                    disabled={busy}
                    title="BF-71 aggregated serial manifest JSON per logistics unit."
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const res = await fetch(
                          `/api/wms/outbound-serial-manifest-export?${new URLSearchParams({
                            outboundOrderId: o.id,
                            pretty: "1",
                          })}`,
                        );
                        const text = await res.text();
                        if (!res.ok) {
                          let parsed: unknown;
                          try {
                            parsed = JSON.parse(text);
                          } catch {
                            parsed = null;
                          }
                          setError(apiClientErrorMessage(parsed, "Serial manifest export failed."));
                          return;
                        }
                        const safeName = o.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";
                        downloadUtf8Blob(
                          new Blob([text], { type: "application/json;charset=utf-8" }),
                          `${safeName}-outbound-serial-manifest-bf71.json`,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Export serial manifest JSON
                  </button>
                ) : null}
                {canExportDesadvAsn ? (
                  <>
                  <button
                    type="button"
                    disabled={busy}
                    title="BF-68 AES/customs handoff JSON for brokers (not a government filing)."
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const res = await fetch(
                          `/api/wms/customs-filing-export?${new URLSearchParams({
                            outboundOrderId: o.id,
                            pretty: "1",
                          })}`,
                        );
                        const text = await res.text();
                        if (!res.ok) {
                          let parsed: unknown;
                          try {
                            parsed = JSON.parse(text);
                          } catch {
                            parsed = null;
                          }
                          setError(apiClientErrorMessage(parsed, "Customs filing export failed."));
                          return;
                        }
                        const safeName = o.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";
                        downloadUtf8Blob(
                          new Blob([text], { type: "application/json;charset=utf-8" }),
                          `${safeName}-customs-filing-bf68.json`,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Export customs JSON
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    title="BF-72 dangerous goods manifest JSON (operator checklist + SKU DG hints)."
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const res = await fetch(
                          `/api/wms/dangerous-goods-manifest?${new URLSearchParams({
                            outboundOrderId: o.id,
                            pretty: "1",
                          })}`,
                        );
                        const text = await res.text();
                        if (!res.ok) {
                          let parsed: unknown;
                          try {
                            parsed = JSON.parse(text);
                          } catch {
                            parsed = null;
                          }
                          setError(apiClientErrorMessage(parsed, "Dangerous goods manifest export failed."));
                          return;
                        }
                        const safeName = o.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";
                        downloadUtf8Blob(
                          new Blob([text], { type: "application/json;charset=utf-8" }),
                          `${safeName}-dangerous-goods-manifest-bf72.json`,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    Export DG manifest JSON
                  </button>
                  </>
                ) : null}
                {canEdit && o.status !== "CANCELLED" ? (
                  <div className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      BF-67 · Multi-parcel manifest
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      One tracking number per line or comma-separated. Merges with the primary label from{" "}
                      <span className="font-medium">Purchase carrier label</span> in the export.
                    </p>
                    <textarea
                      value={
                        outboundManifestParcelDraftById[o.id] ??
                        (o.manifestParcelIds ?? []).join("\n")
                      }
                      onChange={(e) =>
                        setOutboundManifestParcelDraftById((prev) => ({
                          ...prev,
                          [o.id]: e.target.value,
                        }))
                      }
                      rows={2}
                      disabled={busy}
                      className="mt-2 w-full max-w-xl rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs text-zinc-900"
                      placeholder="1Z999AA10123456784 (one per line or comma-separated)"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const raw =
                            outboundManifestParcelDraftById[o.id] ??
                            (o.manifestParcelIds ?? []).join("\n");
                          const ids = raw
                            .split(/[\n,]+/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                          const r = await runAction({
                            action: "set_outbound_manifest_parcel_ids_bf67",
                            outboundOrderId: o.id,
                            manifestParcelIds: ids,
                          });
                          if (r) {
                            setOutboundManifestParcelDraftById((prev) => {
                              const n = { ...prev };
                              delete n[o.id];
                              return n;
                            });
                          }
                        }}
                        className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Save parcel list
                      </button>
                    </div>
                  </div>
                ) : null}
                {o.status !== "CANCELLED" ? (
                  <OutboundCommercialTermsBf87Panel
                    outboundOrderId={o.id}
                    commercialTermsBf87={o.commercialTermsBf87 ?? null}
                    canEdit={canEdit}
                    busy={busy}
                    runAction={runAction}
                  />
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
                      void runAction({
                        action: "mark_outbound_packed",
                        outboundOrderId: o.id,
                        packScanTokens: packScanTokensByOutboundId[o.id] ?? [],
                      })
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
                      void runAction({
                        action: "mark_outbound_shipped",
                        outboundOrderId: o.id,
                        shipScanTokens: shipScanTokensByOutboundId[o.id] ?? [],
                      })
                    }
                    className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Mark shipped
                  </button>
                ) : null}
              </div>
              {canEdit && o.status !== "SHIPPED" && o.status !== "CANCELLED" ? (
                <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50/45 p-2 text-xs text-violet-950">
                  <p className="font-semibold text-violet-950">BF-43 · Logistics units (SSCC / LPN)</p>
                  <p className="mt-0.5 text-violet-900/85">
                    Leaf rows tied to an outbound line substitute{" "}
                    <span className="font-medium">floor(containedQty)</span> scans of that line&apos;s BF-29 primary code
                    during pack or ship verification. Parent-only rows stay structural until you attach a line and qty.{" "}
                    <span className="font-medium">BF-57</span> adds{" "}
                    <span className="font-medium">SSCC-18 check digit</span> checks (18-digit scans) and parent/cycle
                    validation; optional deploy gate <span className="font-mono text-[10px]">WMS_ENFORCE_SSCC=1</span>{" "}
                    on <span className="font-medium">Mark shipped</span>.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !canEdit}
                      onClick={async () => {
                        const ret = await runAction({
                          action: "validate_outbound_lu_hierarchy",
                          outboundOrderId: o.id,
                        });
                        if (!ret) return;
                        const ok = ret.ok === true;
                        const errs = Array.isArray(ret.errors) ? (ret.errors as string[]).join("; ") : "";
                        const warns = Array.isArray(ret.warnings) ? (ret.warnings as string[]).join("; ") : "";
                        const n = typeof ret.unitCount === "number" ? ret.unitCount : 0;
                        setBf57LuValidateMsgByOutboundId((prev) => ({
                          ...prev,
                          [o.id]:
                            n === 0
                              ? "No logistics units to validate."
                              : ok
                                ? warns
                                  ? `BF-57 OK (${n} units). Warnings: ${warns}`
                                  : `BF-57 OK (${n} units) — hierarchy and SSCC checks passed.`
                                : `BF-57 failed: ${errs || "validation errors"}`,
                        }));
                      }}
                      className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-violet-900 disabled:opacity-40"
                    >
                      Validate LU hierarchy (BF-57)
                    </button>
                    {bf57LuValidateMsgByOutboundId[o.id] ? (
                      <span className="text-[11px] text-violet-900/90">{bf57LuValidateMsgByOutboundId[o.id]}</span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-violet-100 pt-2">
                    <button
                      type="button"
                      disabled={busy || !canEdit}
                      onClick={async () => {
                        const ret = await runAction({
                          action: "validate_outbound_serial_aggregation_bf71",
                          outboundOrderId: o.id,
                        });
                        if (!ret) return;
                        const ok = ret.ok === true;
                        const errs = Array.isArray(ret.errors) ? (ret.errors as string[]).join("; ") : "";
                        const warns = Array.isArray(ret.warnings) ? (ret.warnings as string[]).join("; ") : "";
                        const lc = typeof ret.linkCount === "number" ? ret.linkCount : 0;
                        setBf71SerialAggMsgByOutboundId((prev) => ({
                          ...prev,
                          [o.id]:
                            lc === 0
                              ? "BF-71: no LU serial links on this order."
                              : ok
                                ? warns
                                  ? `BF-71 OK (${lc} links). Warnings: ${warns}`
                                  : `BF-71 OK (${lc} links).`
                                : `BF-71 failed: ${errs || "validation errors"}`,
                        }));
                      }}
                      className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-violet-900 disabled:opacity-40"
                    >
                      Validate serial aggregation (BF-71)
                    </button>
                    {bf71SerialAggMsgByOutboundId[o.id] ? (
                      <span className="text-[11px] text-violet-900/90">{bf71SerialAggMsgByOutboundId[o.id]}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[11px] text-violet-900/80">
                    BF-71 ties BF-13 registry ids to LUs; aggregated SNs roll up to parents for manifests. Optional gate{" "}
                    <span className="font-mono text-[10px]">WMS_ENFORCE_BF71_SERIAL_AGGREGATION=1</span> blocks{" "}
                    <span className="font-medium">Mark shipped</span> when links exist but validation fails.
                  </p>
                  {stockSerialEdit && (o.logisticsUnits ?? []).length > 0 ? (
                    <div className="mt-2 grid gap-2 rounded border border-violet-100 bg-white p-2 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="grid gap-1 sm:col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                          Logistics unit
                        </span>
                        <select
                          value={bf71LinkDraftByOutboundId[o.id]?.logisticsUnitId ?? ""}
                          onChange={(e) =>
                            setBf71LinkDraftByOutboundId((prev) => ({
                              ...prev,
                              [o.id]: {
                                logisticsUnitId: e.target.value,
                                inventorySerialId: prev[o.id]?.inventorySerialId ?? "",
                              },
                            }))
                          }
                          className="rounded border border-violet-200 px-2 py-1 text-xs text-zinc-900"
                        >
                          <option value="">Select unit…</option>
                          {(o.logisticsUnits ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.scanCode} ({u.kind})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 sm:col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                          Inventory serial id (BF-13)
                        </span>
                        <input
                          value={bf71LinkDraftByOutboundId[o.id]?.inventorySerialId ?? ""}
                          onChange={(e) =>
                            setBf71LinkDraftByOutboundId((prev) => ({
                              ...prev,
                              [o.id]: {
                                logisticsUnitId: prev[o.id]?.logisticsUnitId ?? "",
                                inventorySerialId: e.target.value,
                              },
                            }))
                          }
                          className="rounded border border-violet-200 px-2 py-1 font-mono text-[11px] text-zinc-900"
                          placeholder="cuid…"
                        />
                      </label>
                      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const d = bf71LinkDraftByOutboundId[o.id];
                            if (!d?.logisticsUnitId.trim() || !d.inventorySerialId.trim()) return;
                            void runAction({
                              action: "link_outbound_lu_serial_bf71",
                              outboundOrderId: o.id,
                              logisticsUnitId: d.logisticsUnitId.trim(),
                              inventorySerialId: d.inventorySerialId.trim(),
                            });
                          }}
                          className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          Link serial to LU
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const d = bf71LinkDraftByOutboundId[o.id];
                            if (!d?.logisticsUnitId.trim() || !d.inventorySerialId.trim()) return;
                            void runAction({
                              action: "unlink_outbound_lu_serial_bf71",
                              outboundOrderId: o.id,
                              logisticsUnitId: d.logisticsUnitId.trim(),
                              inventorySerialId: d.inventorySerialId.trim(),
                            });
                          }}
                          className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {(o.logisticsUnits ?? []).length > 0 ? (
                    <div className="mt-2 overflow-x-auto rounded border border-violet-100 bg-white">
                      <table className="min-w-full border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-violet-100 bg-violet-50/80 text-left">
                            <th className="px-2 py-1 font-semibold">Scan</th>
                            <th className="px-2 py-1 font-semibold">Kind</th>
                            <th className="px-2 py-1 font-semibold">Parent</th>
                            <th className="px-2 py-1 font-semibold">Line</th>
                            <th className="px-2 py-1 font-semibold">Qty</th>
                            <th className="px-2 py-1 font-semibold">BF-71 serials</th>
                            <th className="px-2 py-1 font-semibold" />
                          </tr>
                        </thead>
                        <tbody>
                          {(o.logisticsUnits ?? []).map((u) => (
                            <tr key={u.id} className="border-b border-violet-50">
                              <td className="px-2 py-1 font-mono text-[10px]">{u.scanCode}</td>
                              <td className="px-2 py-1">{u.kind}</td>
                              <td className="px-2 py-1 font-mono text-[10px]">
                                {u.parentUnitId
                                  ? (o.logisticsUnits ?? []).find((x) => x.id === u.parentUnitId)?.scanCode ??
                                    `${u.parentUnitId.slice(0, 8)}…`
                                  : "—"}
                              </td>
                              <td className="px-2 py-1">
                                {u.outboundOrderLineId
                                  ? `Ln ${o.lines.find((l) => l.id === u.outboundOrderLineId)?.lineNo ?? "?"}`
                                  : "—"}
                              </td>
                              <td className="px-2 py-1">{u.containedQty ?? "—"}</td>
                              <td className="max-w-[10rem] truncate px-2 py-1 font-mono text-[10px] text-violet-900">
                                {(u.luSerials ?? []).length > 0
                                  ? (u.luSerials ?? []).map((s) => s.serialNo).join(", ")
                                  : "—"}
                              </td>
                              <td className="px-2 py-1 text-right">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    setLuDraftByOutboundId((prev) => ({
                                      ...prev,
                                      [o.id]: {
                                        logisticsUnitId: u.id,
                                        scanCode: u.scanCode,
                                        kind: u.kind,
                                        parentUnitId: u.parentUnitId ?? "",
                                        outboundOrderLineId: u.outboundOrderLineId ?? "",
                                        containedQty: u.containedQty ?? "1",
                                      },
                                    }))
                                  }
                                  className="rounded border border-violet-200 bg-white px-2 py-0.5 font-medium text-violet-900 disabled:opacity-40"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction({
                                      action: "delete_outbound_logistics_unit_bf43",
                                      outboundOrderId: o.id,
                                      logisticsUnitId: u.id,
                                    })
                                  }
                                  className="ml-1 rounded border border-zinc-200 bg-white px-2 py-0.5 font-medium text-zinc-700 disabled:opacity-40"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-violet-900/75">No logistics units yet.</p>
                  )}
                  <div className="mt-3 grid gap-2 rounded border border-violet-100 bg-white p-2 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="grid gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                        Scan code
                      </span>
                      <input
                        value={mergeBf43LuDraft(luDraftByOutboundId[o.id]).scanCode}
                        onChange={(e) =>
                          setLuDraftByOutboundId((prev) => ({
                            ...prev,
                            [o.id]: { ...mergeBf43LuDraft(prev[o.id]), scanCode: e.target.value },
                          }))
                        }
                        className="rounded border border-violet-200 px-2 py-1 text-xs text-zinc-900"
                        placeholder="SSCC / LPN token"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">Kind</span>
                      <select
                        value={mergeBf43LuDraft(luDraftByOutboundId[o.id]).kind}
                        onChange={(e) =>
                          setLuDraftByOutboundId((prev) => ({
                            ...prev,
                            [o.id]: {
                              ...mergeBf43LuDraft(prev[o.id]),
                              kind: e.target.value as WmsOutboundLuKindUi,
                            },
                          }))
                        }
                        className="rounded border border-violet-200 px-2 py-1 text-xs text-zinc-900"
                      >
                        <option value="UNKNOWN">UNKNOWN</option>
                        <option value="PALLET">PALLET</option>
                        <option value="CASE">CASE</option>
                        <option value="INNER_PACK">INNER_PACK</option>
                        <option value="EACH">EACH</option>
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                        Parent unit
                      </span>
                      <select
                        value={mergeBf43LuDraft(luDraftByOutboundId[o.id]).parentUnitId}
                        onChange={(e) =>
                          setLuDraftByOutboundId((prev) => ({
                            ...prev,
                            [o.id]: { ...mergeBf43LuDraft(prev[o.id]), parentUnitId: e.target.value },
                          }))
                        }
                        className="rounded border border-violet-200 px-2 py-1 text-xs text-zinc-900"
                      >
                        <option value="">None</option>
                        {(o.logisticsUnits ?? [])
                          .filter(
                            (x) =>
                              x.id !== mergeBf43LuDraft(luDraftByOutboundId[o.id]).logisticsUnitId,
                          )
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.scanCode} ({x.kind})
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                        Outbound line
                      </span>
                      <select
                        value={mergeBf43LuDraft(luDraftByOutboundId[o.id]).outboundOrderLineId}
                        onChange={(e) =>
                          setLuDraftByOutboundId((prev) => ({
                            ...prev,
                            [o.id]: { ...mergeBf43LuDraft(prev[o.id]), outboundOrderLineId: e.target.value },
                          }))
                        }
                        className="rounded border border-violet-200 px-2 py-1 text-xs text-zinc-900"
                      >
                        <option value="">Structural only</option>
                        {o.lines.map((l) => (
                          <option key={l.id} value={l.id}>
                            Line {l.lineNo} · {l.product.sku ?? l.product.productCode ?? l.product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                        Contained qty (line only)
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={mergeBf43LuDraft(luDraftByOutboundId[o.id]).containedQty}
                        onChange={(e) =>
                          setLuDraftByOutboundId((prev) => ({
                            ...prev,
                            [o.id]: { ...mergeBf43LuDraft(prev[o.id]), containedQty: e.target.value },
                          }))
                        }
                        className="rounded border border-violet-200 px-2 py-1 text-xs text-zinc-900"
                      />
                    </label>
                    <div className="flex flex-wrap items-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const d = mergeBf43LuDraft(luDraftByOutboundId[o.id]);
                          if (!d.scanCode.trim()) return;
                          if (d.outboundOrderLineId.trim()) {
                            const q = Number(d.containedQty);
                            if (!Number.isFinite(q) || q <= 0) return;
                          }
                          void runAction({
                            action: "upsert_outbound_logistics_unit_bf43",
                            outboundOrderId: o.id,
                            logisticsUnitId: d.logisticsUnitId.trim() || undefined,
                            logisticsUnitScanCode: d.scanCode.trim(),
                            logisticsUnitKind: d.kind,
                            logisticsUnitParentId: d.parentUnitId.trim() ? d.parentUnitId.trim() : null,
                            logisticsOutboundOrderLineId: d.outboundOrderLineId.trim()
                              ? d.outboundOrderLineId.trim()
                              : null,
                            logisticsContainedQty: d.outboundOrderLineId.trim()
                              ? Number(d.containedQty)
                              : null,
                          });
                        }}
                        className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {mergeBf43LuDraft(luDraftByOutboundId[o.id]).logisticsUnitId ? "Save unit" : "Add unit"}
                      </button>
                      {mergeBf43LuDraft(luDraftByOutboundId[o.id]).logisticsUnitId ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setLuDraftByOutboundId((prev) => {
                              const next = { ...prev };
                              delete next[o.id];
                              return next;
                            })
                          }
                          className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                        >
                          Cancel edit
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {canEdit &&
              o.dangerousGoodsChecklistRequired &&
              o.status !== "SHIPPED" &&
              o.status !== "CANCELLED" ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/55 p-2 text-xs text-amber-950">
                  <p className="font-semibold text-amber-950">BF-72 · Dangerous goods checklist</p>
                  <p className="mt-0.5 text-amber-900/85">
                    Confirm SDS review, labeling, packaging, and segregation awareness before ship. JSON export pairs with{" "}
                    <span className="font-medium">BF-68</span> customs handoff. Optional gate{" "}
                    <span className="font-mono text-[10px]">WMS_ENFORCE_DG_CHECKLIST_BF72=1</span> on{" "}
                    <span className="font-medium">Mark shipped</span>.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !canEdit}
                      onClick={async () => {
                        const ret = await runAction({
                          action: "validate_outbound_dangerous_goods_bf72",
                          outboundOrderId: o.id,
                        });
                        if (!ret) return;
                        const ok = ret.ok === true;
                        const warns = Array.isArray(ret.warnings) ? (ret.warnings as string[]).join("; ") : "";
                        const req = ret.checklistRequired === true;
                        const done = ret.checklistComplete === true;
                        setBf72DgValidateMsgByOutboundId((prev) => ({
                          ...prev,
                          [o.id]: !req
                            ? "BF-72: no dangerous goods SKUs on this order."
                            : ok && done
                              ? warns
                                ? `BF-72 checklist OK. Notes: ${warns}`
                                : "BF-72 checklist OK."
                              : `BF-72 checklist incomplete or warnings: ${warns || "submit checklist"}`,
                        }));
                      }}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-950 disabled:opacity-40"
                    >
                      Validate DG readiness
                    </button>
                    {bf72DgValidateMsgByOutboundId[o.id] ? (
                      <span className="text-[11px] text-amber-950/90">{bf72DgValidateMsgByOutboundId[o.id]}</span>
                    ) : null}
                  </div>
                  {o.dangerousGoodsChecklistComplete ? (
                    <p className="mt-2 text-[11px] font-medium text-emerald-800">
                      Checklist filed on server for this outbound
                      {o.dangerousGoodsChecklist?.completedAt
                        ? ` (${new Date(o.dangerousGoodsChecklist.completedAt).toLocaleString()})`
                        : ""}
                      .
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-amber-900/80">
                      Checklist not complete — enforcement mode will block ship until submitted.
                    </p>
                  )}
                  <div className="mt-2 grid gap-2">
                    {DG_CHECKLIST_ITEM_DEFS.map((def) => (
                      <label
                        key={def.code}
                        className="flex cursor-pointer gap-2 rounded border border-amber-100 bg-white p-2 shadow-sm"
                      >
                        <input
                          type="checkbox"
                          checked={mergeBf72DgDraft(bf72DgDraftByOutboundId[o.id])[def.code] ?? false}
                          onChange={(e) =>
                            setBf72DgDraftByOutboundId((prev) => ({
                              ...prev,
                              [o.id]: {
                                ...mergeBf72DgDraft(prev[o.id]),
                                [def.code]: e.target.checked,
                              },
                            }))
                          }
                          disabled={busy}
                          className="mt-0.5"
                        />
                        <span className="text-[11px] leading-snug text-amber-950">{def.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !DG_CHECKLIST_ITEM_DEFS.every(
                          (def) => mergeBf72DgDraft(bf72DgDraftByOutboundId[o.id])[def.code] === true,
                        )
                      }
                      onClick={() => {
                        const d = mergeBf72DgDraft(bf72DgDraftByOutboundId[o.id]);
                        const dangerousGoodsChecklistItems: Record<string, boolean> = {};
                        for (const def of DG_CHECKLIST_ITEM_DEFS) {
                          dangerousGoodsChecklistItems[def.code] = d[def.code] === true;
                        }
                        void runAction({
                          action: "submit_outbound_dangerous_goods_checklist_bf72",
                          outboundOrderId: o.id,
                          dangerousGoodsChecklistItems,
                        });
                      }}
                      className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Submit checklist
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction({
                          action: "clear_outbound_dangerous_goods_checklist_bf72",
                          outboundOrderId: o.id,
                        })
                      }
                      className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
                    >
                      Clear checklist
                    </button>
                  </div>
                </div>
              ) : null}
              {canEdit && (o.status === "RELEASED" || o.status === "PICKING") && allPicked ? (
                <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2 text-xs text-indigo-950">
                  <p className="font-semibold text-indigo-950">BF-29 · Pack scan check</p>
                  <p className="mt-0.5 text-indigo-900/85">
                    Expected identifiers (one scan per picked unit, SKU → product code → product id):{" "}
                    {(o.packScanPlan ?? [])
                      .map((p) => `${p.code}×${p.qty}`)
                      .join(", ") || "—"}
                  </p>
                  {(o.logisticsUnits ?? []).some(
                    (u) =>
                      Boolean(u.outboundOrderLineId) &&
                      u.containedQty != null &&
                      Number(u.containedQty) > 0,
                  ) ? (
                    <p className="mt-1 text-[11px] text-indigo-900/80">
                      BF-43: scans matching configured leaf logistics units consume multiple primary-code slots (see
                      logistics units panel).
                    </p>
                  ) : null}
                  {packShipScanPolicy.packScanRequired ? (
                    <p className="mt-1 font-medium text-amber-900">
                      Server policy: scans are required before pack (`WMS_REQUIRE_PACK_SCAN=1`).
                    </p>
                  ) : (
                    <p className="mt-1 text-indigo-900/75">
                      Optional: submit scans to validate against picks; server enforces only when the env flag is set.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={packScanDraftByOutboundId[o.id] ?? ""}
                      onChange={(e) =>
                        setPackScanDraftByOutboundId((prev) => ({ ...prev, [o.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const raw = (packScanDraftByOutboundId[o.id] ?? "").trim();
                        if (!raw) return;
                        setPackScanTokensByOutboundId((prev) => ({
                          ...prev,
                          [o.id]: [...(prev[o.id] ?? []), raw],
                        }));
                        setPackScanDraftByOutboundId((prev) => ({ ...prev, [o.id]: "" }));
                      }}
                      placeholder="Scan or type SKU / code (Enter)"
                      className="min-w-[12rem] flex-1 rounded border border-indigo-200 px-2 py-1 text-xs text-zinc-900"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const raw = (packScanDraftByOutboundId[o.id] ?? "").trim();
                        if (!raw) return;
                        setPackScanTokensByOutboundId((prev) => ({
                          ...prev,
                          [o.id]: [...(prev[o.id] ?? []), raw],
                        }));
                        setPackScanDraftByOutboundId((prev) => ({ ...prev, [o.id]: "" }));
                      }}
                      className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs font-medium text-indigo-900 disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const r = await runAction(
                          {
                            action: "validate_outbound_pack_scan",
                            outboundOrderId: o.id,
                            packScanTokens: packScanTokensByOutboundId[o.id] ?? [],
                          },
                          { reload: false },
                        );
                        if (!r) return;
                        const ok = r.ok === true;
                        const missing = Array.isArray(r.missing) ? (r.missing as string[]).join(", ") : "";
                        const unexpected = Array.isArray(r.unexpected)
                          ? (r.unexpected as string[]).join(", ")
                          : "";
                        setPackScanFeedbackByOutboundId((prev) => ({
                          ...prev,
                          [o.id]: ok
                            ? "Scan list matches expected picks."
                            : `Mismatch. Missing: ${missing || "—"} · Unexpected: ${unexpected || "—"}`,
                        }));
                      }}
                      className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs font-medium text-indigo-900 disabled:opacity-40"
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPackScanTokensByOutboundId((prev) => ({ ...prev, [o.id]: [] }));
                        setPackScanFeedbackByOutboundId((prev) => ({ ...prev, [o.id]: null }));
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-40"
                    >
                      Clear list
                    </button>
                  </div>
                  {(packScanTokensByOutboundId[o.id] ?? []).length > 0 ? (
                    <p className="mt-2 text-[11px] text-indigo-900/80">
                      Queue: {(packScanTokensByOutboundId[o.id] ?? []).join(" · ")}
                    </p>
                  ) : null}
                  {packScanFeedbackByOutboundId[o.id] ? (
                    <p className="mt-1 text-[11px] font-medium text-indigo-950">
                      {packScanFeedbackByOutboundId[o.id]}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {canEdit && o.status === "PACKED" && allPacked ? (
                <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2 text-xs text-emerald-950">
                  <p className="font-semibold text-emerald-950">BF-29 · Ship scan check</p>
                  <p className="mt-0.5 text-emerald-900/85">
                    Expected (packed units):{" "}
                    {(o.packScanPlan ?? [])
                      .map((p) => `${p.code}×${p.qty}`)
                      .join(", ") || "—"}
                  </p>
                  {packShipScanPolicy.shipScanRequired ? (
                    <p className="mt-1 font-medium text-amber-900">
                      Server policy: scans required before ship (`WMS_REQUIRE_SHIP_SCAN=1`).
                    </p>
                  ) : (
                    <p className="mt-1 text-emerald-900/75">
                      Optional unless `WMS_REQUIRE_SHIP_SCAN` is enabled on the server.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={shipScanDraftByOutboundId[o.id] ?? ""}
                      onChange={(e) =>
                        setShipScanDraftByOutboundId((prev) => ({ ...prev, [o.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const raw = (shipScanDraftByOutboundId[o.id] ?? "").trim();
                        if (!raw) return;
                        setShipScanTokensByOutboundId((prev) => ({
                          ...prev,
                          [o.id]: [...(prev[o.id] ?? []), raw],
                        }));
                        setShipScanDraftByOutboundId((prev) => ({ ...prev, [o.id]: "" }));
                      }}
                      placeholder="Scan before ship (Enter)"
                      className="min-w-[12rem] flex-1 rounded border border-emerald-200 px-2 py-1 text-xs text-zinc-900"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const raw = (shipScanDraftByOutboundId[o.id] ?? "").trim();
                        if (!raw) return;
                        setShipScanTokensByOutboundId((prev) => ({
                          ...prev,
                          [o.id]: [...(prev[o.id] ?? []), raw],
                        }));
                        setShipScanDraftByOutboundId((prev) => ({ ...prev, [o.id]: "" }));
                      }}
                      className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-900 disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const r = await runAction(
                          {
                            action: "validate_outbound_pack_scan",
                            outboundOrderId: o.id,
                            packScanTokens: shipScanTokensByOutboundId[o.id] ?? [],
                          },
                          { reload: false },
                        );
                        if (!r) return;
                        const ok = r.ok === true;
                        const missing = Array.isArray(r.missing) ? (r.missing as string[]).join(", ") : "";
                        const unexpected = Array.isArray(r.unexpected)
                          ? (r.unexpected as string[]).join(", ")
                          : "";
                        setShipScanFeedbackByOutboundId((prev) => ({
                          ...prev,
                          [o.id]: ok
                            ? "Scan list matches expected packed units."
                            : `Mismatch. Missing: ${missing || "—"} · Unexpected: ${unexpected || "—"}`,
                        }));
                      }}
                      className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-900 disabled:opacity-40"
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setShipScanTokensByOutboundId((prev) => ({ ...prev, [o.id]: [] }));
                        setShipScanFeedbackByOutboundId((prev) => ({ ...prev, [o.id]: null }));
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-40"
                    >
                      Clear list
                    </button>
                  </div>
                  {(shipScanTokensByOutboundId[o.id] ?? []).length > 0 ? (
                    <p className="mt-2 text-[11px] text-emerald-900/80">
                      Queue: {(shipScanTokensByOutboundId[o.id] ?? []).join(" · ")}
                    </p>
                  ) : null}
                  {shipScanFeedbackByOutboundId[o.id] ? (
                    <p className="mt-1 text-[11px] font-medium text-emerald-950">
                      {shipScanFeedbackByOutboundId[o.id]}
                    </p>
                  ) : null}
                </div>
              ) : null}
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
                    {l.commercialUnitPrice != null ? (
                      <span className="text-zinc-500">
                        {" "}
                        · ctr {l.commercialUnitPrice}
                        {l.commercialListUnitPrice != null ? ` vs list ${l.commercialListUnitPrice}` : ""}
                        {l.commercialExtendedAmount != null ? ` (ext ${l.commercialExtendedAmount})` : ""}
                        {l.commercialPriceTierLabel ? ` · ${l.commercialPriceTierLabel}` : ""}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
              {canQuoteExplode ? (
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs">
                  <p className="font-semibold text-violet-950">BF-14 / BF-22 · Quote lines → outbound lines</p>
                  <p className="mt-1 text-violet-900/90">
                    Preview maps CRM quote SKUs to tenant products (respects product-division scope). When quote lines
                    carry list unit / tier (BF-22), preview shows contracted-vs-list deltas. Confirm applies only while this
                    outbound has no lines.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void (async () => {
                          const r = await runAction(
                            {
                              action: "explode_crm_quote_to_outbound",
                              outboundOrderId: o.id,
                              quoteExplosionConfirm: false,
                            },
                            { reload: false },
                          );
                          const preview = r?.preview;
                          if (preview && typeof preview === "object") {
                            setQuoteExplosionPreviewByOutboundId((prev) => ({
                              ...prev,
                              [o.id]: preview as QuoteExplosionPreviewPayload,
                            }));
                          }
                        })()
                      }
                      className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-xs font-semibold text-violet-950 disabled:opacity-40"
                    >
                      Preview mapping
                    </button>
                    <button
                      type="button"
                      disabled={busy || !explosionPreview?.ready}
                      onClick={() =>
                        void (async () => {
                          const r = await runAction({
                            action: "explode_crm_quote_to_outbound",
                            outboundOrderId: o.id,
                            quoteExplosionConfirm: true,
                          });
                          if (r?.applied === true) {
                            setQuoteExplosionPreviewByOutboundId((prev) => {
                              const next = { ...prev };
                              delete next[o.id];
                              return next;
                            });
                          }
                        })()
                      }
                      className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Confirm explosion
                    </button>
                    {explosionPreview ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setQuoteExplosionPreviewByOutboundId((prev) => {
                            const next = { ...prev };
                            delete next[o.id];
                            return next;
                          })
                        }
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800"
                      >
                        Clear preview
                      </button>
                    ) : null}
                  </div>
                  {explosionPreview ? (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-violet-100 bg-white">
                      <table className="min-w-full text-left text-[11px]">
                        <thead className="border-b border-zinc-100 bg-zinc-50 font-medium uppercase text-zinc-500">
                          <tr>
                            <th className="px-2 py-1.5">Description</th>
                            <th className="px-2 py-1.5">SKU</th>
                            <th className="px-2 py-1.5 text-right">Qty</th>
                            <th className="px-2 py-1.5">Status</th>
                            <th className="px-2 py-1.5">Product</th>
                            <th className="px-2 py-1.5">Commercial (BF-22)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {explosionPreview.rows.map((row) => (
                            <tr key={row.quoteLineId} className="border-b border-zinc-50 last:border-0">
                              <td className="max-w-[10rem] px-2 py-1.5 text-zinc-900">{row.description}</td>
                              <td className="px-2 py-1.5 font-mono text-zinc-800">{row.inventorySku ?? "—"}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{row.quantity}</td>
                              <td className="px-2 py-1.5">{row.status}</td>
                              <td className="px-2 py-1.5 text-zinc-700">{row.productLabel ?? "—"}</td>
                              <td className="max-w-[14rem] px-2 py-1.5 align-top text-[10px] leading-snug text-zinc-700">
                                <div>
                                  ctr {row.contractUnitPrice ?? "—"} · ext {row.extendedContract ?? "—"}
                                </div>
                                {row.listUnitPrice != null ? (
                                  <div className="mt-0.5">
                                    list {row.listUnitPrice}
                                    {row.unitPriceDelta != null ? ` · Δ/unit ${row.unitPriceDelta}` : ""}
                                    {row.extendedList != null ? ` · ext list ${row.extendedList}` : ""}
                                  </div>
                                ) : null}
                                {row.priceTierLabel ? (
                                  <div className="mt-0.5 text-zinc-500">{row.priceTierLabel}</div>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="border-t border-zinc-100 px-2 py-2 text-[11px] text-zinc-600">
                        Quote lines: {explosionPreview.quoteLineCount}. Ready:{" "}
                        {explosionPreview.ready ? "yes" : "no — fix CRM quote line SKUs or division scope"}.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h2 className="mt-2 text-sm font-semibold text-zinc-900">Value-add / work orders</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Warehouse-scoped tickets with <span className="font-medium text-zinc-800">VALUE_ADD</span> and{" "}
          <span className="font-medium text-zinc-800">KIT_BUILD</span> (BF-62) tasks and optional multi-line{" "}
          <span className="font-medium text-zinc-800">BOM</span> snapshots (BF-18). Completing a task with material
          consumption posts an <span className="font-medium text-zinc-800">ADJUSTMENT</span> movement; BOM consumption
          uses <span className="font-medium text-zinc-800">referenceType WO_BOM_LINE</span> or{" "}
          <span className="font-medium text-zinc-800">KIT_BUILD_TASK</span> for kit assemblies.{" "}
          <span className="font-medium text-zinc-800">BF-26</span> adds CRM quote-line engineering BOM JSON (
          <span className="font-medium text-zinc-800">PATCH …/crm/quotes/…/lines/…</span>) plus WMS sync and estimate
          variance vs rolled-up CRM cents. Billing notes:{" "}
          <span className="font-medium text-zinc-800">docs/wms/WMS_VAS_WORK_ORDERS.md</span>, BF-09{" "}
          <span className="font-medium text-zinc-800">docs/wms/WMS_VAS_BF09.md</span>. Customer intake:{" "}
          <Link href="/wms/vas-intake" className="font-semibold text-[var(--arscmp-primary)] underline-offset-2 hover:underline">
            VAS intake
          </Link>
          .
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
            <label className="mt-2 block">
              <span className="text-[10px] font-medium uppercase text-zinc-500">CRM account (optional)</span>
              <select
                value={vasWoCrmAccountId}
                onChange={(e) => setVasWoCrmAccountId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {data.crmAccountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block">
              <span className="text-[10px] font-medium uppercase text-zinc-500">
                CRM quote line id (optional, BF-26 sync)
              </span>
              <input
                value={vasWoCrmQuoteLineId}
                onChange={(e) => setVasWoCrmQuoteLineId(e.target.value)}
                placeholder="Paste CrmQuoteLine id after CRM setup publishes BOM"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs"
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
                  workOrderCrmAccountId: vasWoCrmAccountId.trim() ? vasWoCrmAccountId.trim() : null,
                  crmQuoteLineId: vasWoCrmQuoteLineId.trim() ? vasWoCrmQuoteLineId.trim() : null,
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
          <div className="md:col-span-2 rounded-xl border border-zinc-100 bg-zinc-50/90 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Step 3 · Kit build (BF-62)
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Scaled BOM consumption from bin/lot picks plus finished-good posting to an output bin on complete (
              <span className="font-medium text-zinc-800">complete_kit_build_task</span>).
            </p>
            <label className="mt-2 block">
              <span className="text-[10px] font-medium uppercase text-zinc-500">Work order (with BOM)</span>
              <select
                value={kitBuildWoId}
                onChange={(e) => setKitBuildWoId(e.target.value)}
                className="mt-1 w-full max-w-xl rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Select OPEN / IN_PROGRESS work order</option>
                {workOrdersForWarehouse
                  .filter((wo) => wo.status === "OPEN" || wo.status === "IN_PROGRESS")
                  .filter((wo) => (wo.bomLines ?? []).length > 0)
                  .map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.workOrderNo} · {wo.title} ({wo.status})
                    </option>
                  ))}
              </select>
            </label>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="min-w-[14rem] flex-1">
                <span className="text-[10px] font-medium uppercase text-zinc-500">Output product (kit SKU)</span>
                <select
                  value={kitOutputProductId}
                  onChange={(e) => setKitOutputProductId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Select product</option>
                  {productPickOptionsForWarehouse.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.productCode || p.sku || "SKU").slice(0, 18)} · {p.name.slice(0, 48)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[14rem] flex-1">
                <span className="text-[10px] font-medium uppercase text-zinc-500">Output bin</span>
                <select
                  value={kitOutputBinId}
                  onChange={(e) => setKitOutputBinId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Select bin</option>
                  {binsForWarehouse.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <label>
                <span className="text-[10px] font-medium uppercase text-zinc-500">Kit quantity</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={kitBuildQtyStr}
                  onChange={(e) => setKitBuildQtyStr(e.target.value)}
                  className="mt-1 w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-[10px] font-medium uppercase text-zinc-500">
                  BOM scale (planned qty = N outputs)
                </span>
                <input
                  type="number"
                  step={1}
                  min={1}
                  value={kitBomRepStr}
                  onChange={(e) => setKitBomRepStr(e.target.value)}
                  className="mt-1 w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            {kitBuildSelectedWo ? (
              <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="border-b border-zinc-100 bg-zinc-50 font-medium uppercase text-zinc-500">
                    <tr>
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Component</th>
                      <th className="px-2 py-1.5 text-right">Remaining</th>
                      <th className="px-2 py-1.5 text-right">This build</th>
                      <th className="px-2 py-1.5">Pick balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(kitBuildSelectedWo.bomLines ?? []).map((bl) => {
                      const remaining = Number(bl.plannedQty) - Number(bl.consumedQty);
                      let buildCell = "—";
                      if (kitBuildPreview.status === "ok") {
                        const d = kitBuildPreview.deltas.get(bl.id);
                        buildCell = d ? d.toString() : "—";
                      } else if (kitBuildPreview.status === "delta_err") {
                        buildCell = "—";
                      }
                      const needPick =
                        kitBuildPreview.status === "ok" &&
                        kitBuildPreview.deltas.get(bl.id) &&
                        kitBuildPreview.deltas.get(bl.id)!.gt(0);
                      const balChoices = balancesForWarehouseOps.filter(
                        (b) =>
                          b.product.id === bl.componentProduct.id &&
                          Number(b.onHandQty) > 0 &&
                          !b.onHold,
                      );
                      return (
                        <tr key={bl.id} className="border-b border-zinc-50 align-top">
                          <td className="px-2 py-1.5 tabular-nums">{bl.lineNo}</td>
                          <td className="px-2 py-1.5">
                            {(bl.componentProduct.productCode || bl.componentProduct.sku || "—").slice(0, 14)}{" "}
                            <span className="text-zinc-600">· {bl.componentProduct.name.slice(0, 40)}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{Math.max(0, remaining).toFixed(3)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{buildCell}</td>
                          <td className="px-2 py-1.5">
                            {needPick ? (
                              <select
                                value={kitBuildBalanceByBomLineId[bl.id] ?? ""}
                                onChange={(e) =>
                                  setKitBuildBalanceByBomLineId((prev) => ({
                                    ...prev,
                                    [bl.id]: e.target.value,
                                  }))
                                }
                                className="max-w-[18rem] rounded border border-zinc-300 px-2 py-1 text-[11px]"
                              >
                                <option value="">Select balance</option>
                                {balChoices.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.bin.code} · on-hand {b.onHandQty}
                                    {b.lotCode ? ` · ${b.lotCode}` : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {kitBuildPreview.status === "delta_err" ? (
                  <p className="border-t border-zinc-100 px-2 py-2 text-[11px] text-rose-700">
                    {kitBuildPreview.message}
                  </p>
                ) : kitBuildPreview.status === "bad_qty" ? (
                  <p className="border-t border-zinc-100 px-2 py-2 text-[11px] text-zinc-600">Enter a kit quantity &gt; 0.</p>
                ) : kitBuildPreview.status === "bad_rep" ? (
                  <p className="border-t border-zinc-100 px-2 py-2 text-[11px] text-zinc-600">
                    BOM scale must be a positive integer.
                  </p>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              disabled={(() => {
                if (!canEdit || busy || !selectedWarehouseId || !kitBuildWoId) return true;
                if (!kitOutputProductId || !kitOutputBinId) return true;
                if (kitBuildPreview.status !== "ok") return true;
                for (const [bomLineId, d] of kitBuildPreview.deltas) {
                  if (d.lte(0)) continue;
                  const bid = kitBuildBalanceByBomLineId[bomLineId];
                  if (!bid?.trim()) return true;
                  const bal = balancesForWarehouseOps.find((b) => b.id === bid);
                  if (!bal) return true;
                }
                const kitLines: Array<{ bomLineId: string; binId: string; lotCode: string }> = [];
                for (const [bomLineId, d] of kitBuildPreview.deltas) {
                  if (d.lte(0)) continue;
                  const bal = balancesForWarehouseOps.find(
                    (b) => b.id === kitBuildBalanceByBomLineId[bomLineId],
                  );
                  if (!bal) return true;
                  const lotCode = bal.lotCode?.trim() ? bal.lotCode.trim() : FUNGIBLE_LOT_CODE;
                  kitLines.push({
                    bomLineId,
                    binId: bal.bin.id,
                    lotCode,
                  });
                }
                const v = validateKitBuildLinePicks(kitBuildPreview.deltas, kitLines);
                return !v.ok;
              })()}
              onClick={() => {
                if (kitBuildPreview.status !== "ok") return;
                const kitLines: Array<{ bomLineId: string; binId: string; lotCode: string }> = [];
                for (const [bomLineId, d] of kitBuildPreview.deltas) {
                  if (d.lte(0)) continue;
                  const bid = kitBuildBalanceByBomLineId[bomLineId];
                  const bal = balancesForWarehouseOps.find((b) => b.id === bid);
                  if (!bal) return;
                  const lotCode = bal.lotCode?.trim() ? bal.lotCode.trim() : FUNGIBLE_LOT_CODE;
                  kitLines.push({
                    bomLineId,
                    binId: bal.bin.id,
                    lotCode,
                  });
                }
                const v = validateKitBuildLinePicks(kitBuildPreview.deltas, kitLines);
                if (!v.ok) return;
                void runAction({
                  action: "create_kit_build_task",
                  workOrderId: kitBuildWoId,
                  kitOutputProductId,
                  kitOutputBinId,
                  kitBuildQuantity: kitBuildPreview.kitQty,
                  bomRepresentsOutputUnits: kitBuildPreview.bomRep,
                  kitBuildLines: kitLines,
                });
              }}
              className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Create KIT_BUILD task
            </button>
          </div>
        </div>
        {workOrdersForWarehouse.length > 0 ? (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Work orders (this warehouse)
            </p>
            <ul className="mt-2 space-y-2 text-xs text-zinc-700">
              {workOrdersForWarehouse.map((wo) => {
                const draft = woEstDraft[wo.id] ?? { m: "", l: "" };
                return (
                  <li key={wo.id} className="rounded-lg border border-zinc-100 bg-white px-3 py-2 shadow-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-medium text-zinc-900">{wo.workOrderNo}</span>
                      <span>{wo.title}</span>
                      <span className="text-zinc-500">{wo.status}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          wo.intakeChannel === "CUSTOMER_PORTAL"
                            ? "bg-violet-100 text-violet-900"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {wo.intakeChannel === "CUSTOMER_PORTAL" ? "Portal" : "Ops"}
                      </span>
                      {wo.crmAccount ? (
                        <span className="text-zinc-600">CRM: {wo.crmAccount.name}</span>
                      ) : null}
                    </div>
                    {canEdit && wo.status !== "DONE" && wo.status !== "CANCELLED" ? (
                      <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-zinc-50 pt-2">
                        <label className="min-w-[10rem] flex-1 text-[10px] font-medium text-zinc-600">
                          CRM quote line id (BF-26)
                          <input
                            value={woQuoteLineLinkDraft[wo.id] ?? ""}
                            onChange={(e) =>
                              setWoQuoteLineLinkDraft((prev) => ({
                                ...prev,
                                [wo.id]: e.target.value,
                              }))
                            }
                            placeholder="Paste CrmQuoteLine id"
                            className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 font-mono text-[11px]"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy || !(woQuoteLineLinkDraft[wo.id] ?? "").trim()}
                          onClick={() =>
                            void runAction({
                              action: "link_work_order_crm_quote_line",
                              workOrderId: wo.id,
                              crmQuoteLineId: (woQuoteLineLinkDraft[wo.id] ?? "").trim(),
                            })
                          }
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 disabled:opacity-40"
                        >
                          Save link
                        </button>
                        <button
                          type="button"
                          disabled={busy || !wo.crmQuoteLineId}
                          onClick={() =>
                            void runAction({
                              action: "link_work_order_crm_quote_line",
                              workOrderId: wo.id,
                              crmQuoteLineId: null,
                            })
                          }
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 disabled:opacity-40"
                        >
                          Unlink
                        </button>
                      </div>
                    ) : null}
                    {wo.crmQuoteLineId ? (
                      <div className="mt-1 text-[10px] text-zinc-500">
                        Linked CPQ line · CRM ECO{" "}
                        <span className="font-medium text-zinc-700">
                          {wo.crmEngineeringBomRevision ?? "—"}
                        </span>
                        {" · "}
                        CRM materials rollup{" "}
                        {wo.crmEngineeringBomMaterialsCents != null
                          ? `$${(wo.crmEngineeringBomMaterialsCents / 100).toFixed(2)}`
                          : "—"}
                        {" · "}
                        Last WMS sync{" "}
                        {wo.engineeringBomSyncedAt
                          ? new Date(wo.engineeringBomSyncedAt).toLocaleString()
                          : "—"}{" "}
                        ({wo.engineeringBomSyncedRevision ?? "—"})
                      </div>
                    ) : null}
                    {wo.materialsEstimateVsEngineeringVarianceCents != null ? (
                      <p className="mt-1 text-[10px] font-semibold text-zinc-800">
                        Δ Estimate − CRM engineering materials: $
                        {(wo.materialsEstimateVsEngineeringVarianceCents / 100).toFixed(2)}
                      </p>
                    ) : null}
                    {canEdit && wo.status !== "DONE" && wo.status !== "CANCELLED" ? (
                      <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-zinc-50 pt-2">
                        <label className="text-[10px] font-medium text-zinc-600">
                          Est. materials ($)
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={draft.m}
                            onChange={(e) =>
                              setWoEstDraft((prev) => ({
                                ...prev,
                                [wo.id]: { ...(prev[wo.id] ?? { m: "", l: "" }), m: e.target.value },
                              }))
                            }
                            className="mt-0.5 block w-28 rounded border border-zinc-300 px-2 py-1 tabular-nums"
                          />
                        </label>
                        <label className="text-[10px] font-medium text-zinc-600">
                          Labor (min)
                          <input
                            type="number"
                            step={1}
                            min={0}
                            value={draft.l}
                            onChange={(e) =>
                              setWoEstDraft((prev) => ({
                                ...prev,
                                [wo.id]: { ...(prev[wo.id] ?? { m: "", l: "" }), l: e.target.value },
                              }))
                            }
                            className="mt-0.5 block w-24 rounded border border-zinc-300 px-2 py-1 tabular-nums"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const mStr = draft.m.trim();
                            const lStr = draft.l.trim();
                            let estimatedMaterialsCents: number | null | undefined;
                            let estimatedLaborMinutes: number | null | undefined;
                            if (mStr === "") estimatedMaterialsCents = null;
                            else {
                              const v = Number(mStr);
                              if (!Number.isFinite(v) || v < 0) return;
                              estimatedMaterialsCents = Math.round(v * 100);
                            }
                            if (lStr === "") estimatedLaborMinutes = null;
                            else {
                              const v = Math.round(Number(lStr));
                              if (!Number.isFinite(v) || v < 0) return;
                              estimatedLaborMinutes = v;
                            }
                            void runAction({
                              action: "set_work_order_commercial_estimate",
                              workOrderId: wo.id,
                              estimatedMaterialsCents,
                              estimatedLaborMinutes,
                            });
                          }}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 disabled:opacity-40"
                        >
                          Save estimate
                        </button>
                      </div>
                    ) : null}
                    <div className="mt-2 border-t border-zinc-50 pt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        BOM lines
                      </p>
                      {(() => {
                        const bomLines = wo.bomLines ?? [];
                        const anyConsumed = bomLines.some((bl) => Number(bl.consumedQty) > 0);
                        const bomEditable =
                          canEdit &&
                          (wo.status === "OPEN" || wo.status === "IN_PROGRESS") &&
                          !anyConsumed;
                        const bomRows = woBomDraft[wo.id] ?? [{ productId: "", qty: "1" }];
                        return (
                          <>
                            {bomLines.length > 0 ? (
                              <table className="mt-1 w-full border-collapse text-[11px]">
                                <thead>
                                  <tr className="border-b border-zinc-100 text-left text-zinc-500">
                                    <th className="py-1 pr-2 font-medium">#</th>
                                    <th className="py-1 pr-2 font-medium">Component</th>
                                    <th className="py-1 pr-2 text-right font-medium">Planned</th>
                                    <th className="py-1 text-right font-medium">Consumed</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bomLines.map((bl) => {
                                    const remaining = Number(bl.plannedQty) - Number(bl.consumedQty);
                                    const canConsumeLine =
                                      canEdit &&
                                      (wo.status === "OPEN" || wo.status === "IN_PROGRESS") &&
                                      remaining > 0;
                                    const consumeDraft = woBomConsumeDraft[bl.id] ?? {
                                      balanceLineId: "",
                                      qty: "",
                                    };
                                    const balChoices = balancesForWarehouseOps.filter(
                                      (b) =>
                                        b.product.id === bl.componentProduct.id &&
                                        Number(b.onHandQty) > 0 &&
                                        !b.onHold,
                                    );
                                    return (
                                      <Fragment key={bl.id}>
                                        <tr className="border-b border-zinc-50 align-top">
                                          <td className="py-1 pr-2 tabular-nums">{bl.lineNo}</td>
                                          <td className="py-1 pr-2">
                                            {(bl.componentProduct.productCode ||
                                              bl.componentProduct.sku ||
                                              "—"
                                            ).slice(0, 16)}{" "}
                                            · {bl.componentProduct.name.slice(0, 48)}
                                          </td>
                                          <td className="py-1 pr-2 text-right tabular-nums">{bl.plannedQty}</td>
                                          <td className="py-1 text-right tabular-nums">{bl.consumedQty}</td>
                                        </tr>
                                        {canConsumeLine ? (
                                          <tr className="border-b border-zinc-100">
                                            <td className="pb-2" />
                                            <td className="pb-2" colSpan={3}>
                                              <div className="flex flex-wrap items-end gap-2 pl-1">
                                                <label className="text-[10px] text-zinc-600">
                                                  From balance
                                                  <select
                                                    value={consumeDraft.balanceLineId}
                                                    onChange={(e) =>
                                                      setWoBomConsumeDraft((prev) => ({
                                                        ...prev,
                                                        [bl.id]: {
                                                          ...(prev[bl.id] ?? {
                                                            balanceLineId: "",
                                                            qty: "",
                                                          }),
                                                          balanceLineId: e.target.value,
                                                        },
                                                      }))
                                                    }
                                                    className="mt-0.5 block max-w-[14rem] rounded border border-zinc-300 px-2 py-1 text-[11px]"
                                                  >
                                                    <option value="">Select balance</option>
                                                    {balChoices.map((b) => (
                                                      <option key={b.id} value={b.id}>
                                                        {b.bin.code} · on-hand {b.onHandQty}
                                                        {b.lotCode ? ` · ${b.lotCode}` : ""}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>
                                                <label className="text-[10px] text-zinc-600">
                                                  Qty
                                                  <input
                                                    type="number"
                                                    step="any"
                                                    min={0}
                                                    value={consumeDraft.qty}
                                                    onChange={(e) =>
                                                      setWoBomConsumeDraft((prev) => ({
                                                        ...prev,
                                                        [bl.id]: {
                                                          ...(prev[bl.id] ?? {
                                                            balanceLineId: "",
                                                            qty: "",
                                                          }),
                                                          qty: e.target.value,
                                                        },
                                                      }))
                                                    }
                                                    className="mt-0.5 block w-20 rounded border border-zinc-300 px-2 py-1 tabular-nums"
                                                  />
                                                </label>
                                                <button
                                                  type="button"
                                                  disabled={
                                                    busy ||
                                                    !consumeDraft.balanceLineId ||
                                                    !consumeDraft.qty.trim() ||
                                                    Number(consumeDraft.qty) <= 0
                                                  }
                                                  onClick={() => {
                                                    const bal = balancesForWarehouseOps.find(
                                                      (b) => b.id === consumeDraft.balanceLineId,
                                                    );
                                                    if (!bal) return;
                                                    void runAction({
                                                      action: "consume_work_order_bom_line",
                                                      bomLineId: bl.id,
                                                      binId: bal.bin.id,
                                                      quantity: Number(consumeDraft.qty),
                                                      lotCode: bal.lotCode || null,
                                                    });
                                                  }}
                                                  className="rounded-lg bg-[var(--arscmp-primary)] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                                                >
                                                  Post consume
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ) : null}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            ) : (
                              <p className="mt-1 text-[11px] text-zinc-500">No BOM lines yet.</p>
                            )}
                            {bomEditable ? (
                              <div className="mt-2 space-y-2 rounded-lg border border-zinc-100 bg-zinc-50/80 p-2">
                                <p className="text-[10px] font-medium text-zinc-600">
                                  Replace BOM snapshot (blocked after any consumption posts)
                                </p>
                                {bomRows.map((row, idx) => (
                                  <div key={idx} className="flex flex-wrap items-end gap-2">
                                    <label className="text-[10px] text-zinc-600">
                                      Component
                                      <select
                                        value={row.productId}
                                        onChange={(e) =>
                                          setWoBomDraft((prev) => {
                                            const cur = [...(prev[wo.id] ?? bomRows)];
                                            cur[idx] = { ...cur[idx], productId: e.target.value };
                                            return { ...prev, [wo.id]: cur };
                                          })
                                        }
                                        className="mt-0.5 block min-w-[10rem] rounded border border-zinc-300 px-2 py-1 text-[11px]"
                                      >
                                        <option value="">Select product</option>
                                        {productPickOptionsForWarehouse.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {(p.productCode || p.sku || "").slice(0, 12)} · {p.name.slice(0, 36)}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="text-[10px] text-zinc-600">
                                      Planned qty
                                      <input
                                        type="number"
                                        step="any"
                                        min={0}
                                        value={row.qty}
                                        onChange={(e) =>
                                          setWoBomDraft((prev) => {
                                            const cur = [...(prev[wo.id] ?? bomRows)];
                                            cur[idx] = { ...cur[idx], qty: e.target.value };
                                            return { ...prev, [wo.id]: cur };
                                          })
                                        }
                                        className="mt-0.5 block w-24 rounded border border-zinc-300 px-2 py-1 tabular-nums"
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      disabled={busy || bomRows.length <= 1}
                                      onClick={() =>
                                        setWoBomDraft((prev) => {
                                          const cur = [...(prev[wo.id] ?? bomRows)];
                                          cur.splice(idx, 1);
                                          return {
                                            ...prev,
                                            [wo.id]: cur.length ? cur : [{ productId: "", qty: "1" }],
                                          };
                                        })
                                      }
                                      className="rounded border border-zinc-300 px-2 py-1 text-[10px] font-semibold text-zinc-700 disabled:opacity-40"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={busy || !wo.crmQuoteLineId || !bomEditable}
                                    onClick={() =>
                                      void runAction({
                                        action: "sync_work_order_bom_from_crm_quote_line",
                                        workOrderId: wo.id,
                                      })
                                    }
                                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-[11px] font-semibold text-zinc-800 disabled:opacity-40"
                                  >
                                    Sync BOM from CRM
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      setWoBomDraft((prev) => ({
                                        ...prev,
                                        [wo.id]: [
                                          ...(prev[wo.id] ?? [{ productId: "", qty: "1" }]),
                                          { productId: "", qty: "1" },
                                        ],
                                      }))
                                    }
                                    className="rounded border border-zinc-300 px-2 py-1 text-[10px] font-semibold text-zinc-700"
                                  >
                                    Add line
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      const rows = woBomDraft[wo.id] ?? bomRows;
                                      const payload = rows
                                        .filter((r) => r.productId.trim())
                                        .map((r, i) => ({
                                          lineNo: i + 1,
                                          componentProductId: r.productId.trim(),
                                          plannedQty: Number(r.qty),
                                        }))
                                        .filter((r) => Number.isFinite(r.plannedQty) && r.plannedQty > 0);
                                      void runAction({
                                        action: "replace_work_order_bom_lines",
                                        workOrderId: wo.id,
                                        bomLines: payload,
                                      });
                                    }}
                                    className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                                  >
                                    Save BOM
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Wave picking · BF-56 batch path</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Auto-build pick waves from open order demand and current available stock in the selected warehouse,
          using the warehouse&apos;s{" "}
          <span className="font-medium text-zinc-800">pick allocation strategy</span> (Warehouse setup → Pick
          allocation policy). <span className="font-medium text-zinc-800">Batch (BF-56)</span> walks bins in cluster
          order and tags tasks with a <span className="font-medium text-zinc-800">batchGroupKey</span> (source bin) for
          cart-style picking — not AMR re-batch. <span className="font-medium text-zinc-800">BF-76</span> exports a
          deterministic bin visit sequence per wave (<span className="font-mono text-[11px]">GET …/pick-path-export</span>) —
          see <span className="font-medium">docs/wms/WMS_PICK_PATH_EXPORT_BF76.md</span>.
        </p>
        {selectedWarehouseId &&
        data.warehouses.find((w) => w.id === selectedWarehouseId)?.pickAllocationStrategy === "MANUAL_ONLY" ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            This warehouse is set to <span className="font-semibold">MANUAL_ONLY</span>: automated waves are
            disabled. Use <span className="font-medium">Create pick task</span> with explicit bins instead.
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            <span className="font-medium text-zinc-800">Pick wave mode (BF-56)</span>
            <select
              value={pickWavePickModeDraft}
              onChange={(e) =>
                setPickWavePickModeDraft(e.target.value as "SINGLE_ORDER" | "BATCH")
              }
              className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              <option value="SINGLE_ORDER">Single-order (default)</option>
              <option value="BATCH">Batch / cluster bin path</option>
            </select>
          </label>
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
                pickWavePickMode: pickWavePickModeDraft,
              })
            }
            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
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
                {wave.pickMode === "BATCH" ? (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                    Batch BF-56
                  </span>
                ) : null}
                <span className="text-zinc-500">{wave.warehouse.code || wave.warehouse.name}</span>
                <span className="text-zinc-500">
                  tasks {wave.taskCount} · open {wave.openTaskCount} · qty {wave.totalQty}
                </span>
                <a
                  href={`/api/wms/pick-path-export?waveId=${encodeURIComponent(wave.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  BF-76 JSON
                </a>
                <a
                  href={`/api/wms/pick-path-export?waveId=${encodeURIComponent(wave.id)}&format=csv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  BF-76 CSV
                </a>
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

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Stock transfer orders (BF-55)</h2>
          <a
            href={`/api/wms/stock-transfer-export?format=csv${selectedWarehouseId ? `&warehouseId=${encodeURIComponent(selectedWarehouseId)}` : ""}`}
            className="text-xs font-medium text-[var(--arscmp-primary)] underline"
          >
            Export STO CSV (BF-78)
          </a>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-600">
          Inter-site moves: <span className="font-medium">DRAFT</span> → <span className="font-medium">RELEASED</span> →{" "}
          <span className="font-medium">Ship</span> posts <span className="font-medium">STO_SHIP</span> and marks{" "}
          <span className="font-medium">IN_TRANSIT</span>. Set a receive bin per line in the destination warehouse, then{" "}
          <span className="font-medium">Receive</span> posts <span className="font-medium">STO_RECEIVE</span>. Rows below respect the
          warehouse filter when set.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
          <label className="text-xs text-zinc-600">
            From warehouse
            <select
              value={stoFromWh}
              onChange={(e) => {
                setStoFromWh(e.target.value);
                setStoSourceBalanceId("");
              }}
              className="mt-1 block min-w-[12rem] rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {(data?.warehouses ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code ?? w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            To warehouse
            <select
              value={stoToWh}
              onChange={(e) => setStoToWh(e.target.value)}
              className="mt-1 block min-w-[12rem] rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {(data?.warehouses ?? [])
                .filter((w) => !stoFromWh || w.id !== stoFromWh)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code ?? w.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            Source balance (bin · SKU · lot)
            <select
              value={stoSourceBalanceId}
              onChange={(e) => setStoSourceBalanceId(e.target.value)}
              className="mt-1 block min-w-[18rem] rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {(data?.balances ?? [])
                .filter((b) => !stoFromWh || b.warehouse.id === stoFromWh)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bin.code} · {(b.product.productCode || b.product.sku || "SKU").slice(0, 12)} · on-hand {b.onHandQty}
                    {b.lotCode ? ` · ${b.lotCode}` : ""}
                    {Boolean(b.onHold) ? " · HOLD" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            Qty
            <input
              value={stoQty}
              onChange={(e) => setStoQty(e.target.value)}
              className="mt-1 block w-24 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-zinc-600">
            Note (optional)
            <input
              value={stoNote}
              onChange={(e) => setStoNote(e.target.value)}
              className="mt-1 block min-w-[12rem] rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={!canEdit || busy || !stoFromWh || !stoToWh || !stoSourceBalanceId}
            onClick={() => {
              const bal = data.balances.find((x) => x.id === stoSourceBalanceId);
              if (!bal) return;
              const q = Number(stoQty);
              if (!Number.isFinite(q) || q <= 0) return;
              void runAction({
                action: "create_wms_stock_transfer",
                fromWarehouseId: stoFromWh,
                toWarehouseId: stoToWh,
                stockTransferLines: [
                  {
                    productId: bal.product.id,
                    fromBinId: bal.bin.id,
                    quantity: q,
                    lotCode: bal.lotCode || null,
                  },
                ],
                stockTransferNote: stoNote.trim() || null,
              });
            }}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Create STO (draft)
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {stockTransfersForWarehouse.length === 0 ? (
            <p className="text-xs text-zinc-500">No stock transfers for this warehouse filter.</p>
          ) : (
            stockTransfersForWarehouse.map((st) => (
              <div key={st.id} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-zinc-900">{st.referenceCode}</span>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-800">
                    {st.status}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {st.fromWarehouse.code ?? st.fromWarehouse.name} → {st.toWarehouse.code ?? st.toWarehouse.name}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                  {st.lines.map((ln) => (
                    <li key={ln.id}>
                      Line {ln.lineNo}: {(ln.product.productCode || ln.product.sku || "").slice(0, 16)} ord {ln.quantityOrdered}{" "}
                      ship {ln.quantityShipped} recv {ln.quantityReceived} · from {ln.fromBin.code}
                      {ln.toBin ? ` → to ${ln.toBin.code}` : " · receive bin unset"}
                    </li>
                  ))}
                </ul>
                <StoLandedCostBf78Panel
                  transferId={st.id}
                  landedCostNotesBf78={st.landedCostNotesBf78 ?? null}
                  landedCostNotesBf78Notice={st.landedCostNotesBf78Notice ?? null}
                  canEdit={canEdit}
                  busy={busy}
                  runAction={runAction}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {st.status === "DRAFT" && canEdit ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction({ action: "release_wms_stock_transfer", stockTransferId: st.id })}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40"
                      >
                        Release
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction({ action: "cancel_wms_stock_transfer", stockTransferId: st.id })}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                  {st.status === "RELEASED" && canEdit ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction({ action: "ship_wms_stock_transfer", stockTransferId: st.id })}
                        className="rounded-lg border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Ship (in transit)
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction({ action: "cancel_wms_stock_transfer", stockTransferId: st.id })}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                  {st.status === "IN_TRANSIT" && canEdit ? (
                    <>
                      {st.lines.map((ln) => (
                        <div key={ln.id} className="flex flex-wrap items-center gap-2 border-t border-zinc-200/80 pt-2 first:mt-2 first:border-t-0 first:pt-0">
                          <span className="text-[11px] font-medium text-zinc-600">Line {ln.lineNo} → receive bin</span>
                          <select
                            value={stoReceiveDraft[ln.id] ?? ln.toBin?.id ?? ""}
                            onChange={(e) => setStoReceiveDraft((m) => ({ ...m, [ln.id]: e.target.value }))}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs"
                          >
                            <option value="">Select bin ({st.toWarehouse.code ?? st.toWarehouse.name})</option>
                            {(data?.bins ?? [])
                              .filter((b) => b.warehouse.id === st.toWarehouse.id)
                              .map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.code}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            disabled={busy || !(stoReceiveDraft[ln.id] ?? ln.toBin?.id)}
                            onClick={() => {
                              const bid = stoReceiveDraft[ln.id] ?? ln.toBin?.id;
                              if (!bid) return;
                              void runAction({
                                action: "set_wms_stock_transfer_line",
                                stockTransferLineId: ln.id,
                                targetBinId: bid,
                              });
                            }}
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium disabled:opacity-40"
                          >
                            Save bin
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        disabled={busy || st.lines.some((ln) => !ln.toBin)}
                        onClick={() => void runAction({ action: "receive_wms_stock_transfer", stockTransferId: st.id })}
                        className="mt-2 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Receive all lines
                      </button>
                      <p className="mt-1 w-full text-[11px] text-zinc-500">
                        Save a destination bin for every line, then receive (single receive in minimal slice).
                      </p>
                    </>
                  ) : null}
                </div>
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

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h2 className="mt-2 text-sm font-semibold text-zinc-900">Cycle count program (BF-51)</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-600">
          Session header plus lines on bin/SKU balances (expected qty frozen when the line is added). Save counts per line,
          then submit. Non-zero variance requires a reason code; supervisor approves to post{" "}
          <span className="font-medium">ADJUSTMENT</span> movements.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[12rem] flex-col gap-1 text-xs text-zinc-600">
            Scope note (optional)
            <input
              value={bf51ScopeNote}
              onChange={(e) => setBf51ScopeNote(e.target.value)}
              placeholder="e.g. Zone A ABC audit"
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={!canEdit || busy || !selectedWarehouseId}
            onClick={() =>
              void runAction({
                action: "create_cycle_count_session",
                warehouseId: selectedWarehouseId,
                cycleCountScopeNote: bf51ScopeNote.trim() || null,
              })
            }
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            New session
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
          <select
            value={bf51AddBalanceId}
            onChange={(e) => setBf51AddBalanceId(e.target.value)}
            className="min-w-[14rem] rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Balance to add to an OPEN session</option>
            {balancesForWarehouseOps.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bin.code} · {(b.product.productCode || b.product.sku || "SKU").slice(0, 12)} · book {b.onHandQty}
                {b.lotCode ? ` · ${b.lotCode}` : ""}
                {Boolean(b.onHold) ? " · HOLD" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 space-y-4">
          {cycleSessionsForWarehouse.length === 0 ? (
            <p className="text-xs text-zinc-500">No structured cycle count sessions for this warehouse.</p>
          ) : (
            cycleSessionsForWarehouse.map((sess) => {
              const draftRow = (lnId: string, ln: (typeof sess.lines)[0]) => {
                const cur = bf51LineDraft[lnId];
                return {
                  counted: cur?.counted ?? ln.countedQty ?? ln.expectedQty,
                  reason: cur?.reason ?? ln.varianceReasonCode ?? "",
                  note: cur?.note ?? ln.varianceNote ?? "",
                };
              };
              const setDraft = (lnId: string, patch: Partial<{ counted: string; reason: string; note: string }>) => {
                setBf51LineDraft((m) => {
                  const base = m[lnId] ?? { counted: "", reason: "", note: "" };
                  return { ...m, [lnId]: { ...base, ...patch } };
                });
              };
              return (
                <div key={sess.id} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold text-zinc-900">{sess.referenceCode}</p>
                      <p className="text-[11px] text-zinc-500">
                        {sess.status} · created {new Date(sess.createdAt).toLocaleString()} · {sess.createdBy.name}
                      </p>
                      {sess.scopeNote ? (
                        <p className="mt-1 text-xs text-zinc-600">{sess.scopeNote}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sess.status === "OPEN" ? (
                        <>
                          <button
                            type="button"
                            disabled={!canEdit || busy || !bf51AddBalanceId}
                            onClick={() =>
                              void runAction({
                                action: "add_cycle_count_line",
                                cycleCountSessionId: sess.id,
                                balanceId: bf51AddBalanceId,
                              })
                            }
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40"
                          >
                            Add line
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit || busy || sess.lines.length === 0}
                            onClick={() =>
                              void runAction({
                                action: "submit_cycle_count",
                                cycleCountSessionId: sess.id,
                              })
                            }
                            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            Submit counts
                          </button>
                        </>
                      ) : null}
                      {sess.status === "SUBMITTED" ? (
                        <button
                          type="button"
                          disabled={
                            !canEdit ||
                            busy ||
                            !sess.lines.some((l) => l.status === "VARIANCE_PENDING")
                          }
                          onClick={() =>
                            void runAction({
                              action: "approve_cycle_count_variance",
                              cycleCountSessionId: sess.id,
                            })
                          }
                          className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          Approve variance
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {sess.lines.length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-500">No lines — add balances while session is OPEN.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 text-zinc-500">
                            <th className="py-1.5 pr-2 font-medium">Bin</th>
                            <th className="py-1.5 pr-2 font-medium">SKU</th>
                            <th className="py-1.5 pr-2 font-medium">Lot</th>
                            <th className="py-1.5 pr-2 font-medium">Expected</th>
                            <th className="py-1.5 pr-2 font-medium">Counted</th>
                            <th className="py-1.5 pr-2 font-medium">Reason</th>
                            <th className="py-1.5 pr-2 font-medium">Line status</th>
                            <th className="py-1.5 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {sess.lines.map((ln) => {
                            const d = draftRow(ln.id, ln);
                            const editable = sess.status === "OPEN" && ln.status === "PENDING_COUNT";
                            return (
                              <tr key={ln.id} className="border-b border-zinc-100 align-top">
                                <td className="py-2 pr-2 font-mono text-zinc-800">{ln.bin.code}</td>
                                <td className="py-2 pr-2 text-zinc-700">
                                  {(ln.product.productCode || ln.product.sku || ln.product.name).slice(0, 24)}
                                </td>
                                <td className="py-2 pr-2 font-mono text-zinc-600">{ln.lotCode || "—"}</td>
                                <td className="py-2 pr-2">{ln.expectedQty}</td>
                                <td className="py-2 pr-2">
                                  {editable ? (
                                    <input
                                      type="number"
                                      step="any"
                                      min={0}
                                      value={d.counted}
                                      onChange={(e) => setDraft(ln.id, { counted: e.target.value })}
                                      className="w-24 rounded border border-zinc-300 px-1 py-0.5 text-xs"
                                    />
                                  ) : (
                                    <span>{ln.countedQty ?? "—"}</span>
                                  )}
                                </td>
                                <td className="py-2 pr-2">
                                  {editable ? (
                                    <select
                                      value={d.reason}
                                      onChange={(e) => setDraft(ln.id, { reason: e.target.value })}
                                      className="max-w-[9rem] rounded border border-zinc-300 px-1 py-0.5 text-xs"
                                    >
                                      <option value="">—</option>
                                      {BF51_VARIANCE_REASONS.map((r) => (
                                        <option key={r} value={r}>
                                          {r}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span>{ln.varianceReasonCode ?? "—"}</span>
                                  )}
                                </td>
                                <td className="py-2 pr-2">
                                  <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-zinc-700 ring-1 ring-zinc-200">
                                    {ln.status}
                                  </span>
                                  {ln.inventoryMovementId ? (
                                    <span className="ml-1 font-mono text-[10px] text-zinc-400">
                                      mv {ln.inventoryMovementId.slice(0, 8)}…
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-2">
                                  {editable ? (
                                    <div className="flex flex-col gap-1">
                                      <input
                                        value={d.note}
                                        onChange={(e) => setDraft(ln.id, { note: e.target.value })}
                                        placeholder="Note"
                                        className="w-36 rounded border border-zinc-300 px-1 py-0.5 text-[11px]"
                                      />
                                      <button
                                        type="button"
                                        disabled={!canEdit || busy}
                                        onClick={() => {
                                          const countedNum = Number(d.counted);
                                          if (!Number.isFinite(countedNum) || countedNum < 0) return;
                                          void runAction({
                                            action: "set_cycle_count_line_count",
                                            cycleCountLineId: ln.id,
                                            countedQty: countedNum,
                                            cycleCountVarianceReasonCode: d.reason.trim() || null,
                                            varianceNote: d.note.trim() || null,
                                          });
                                        }}
                                        className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium disabled:opacity-40"
                                      >
                                        Save line
                                      </button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Labor variance (BF-77)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Recent <span className="font-medium">DONE</span> tasks where actual elapsed minutes exceed standard by the
          tenant excess threshold. Policy under Setup (
          <span className="font-medium">org.wms.setup → edit</span>).
        </p>
        {!data?.laborVarianceBf77 ? (
          <p className="mt-2 text-xs text-zinc-500">Loading…</p>
        ) : !data.laborVarianceBf77.policy.enabled ? (
          <p className="mt-2 text-xs text-zinc-500">Variance queue is disabled — enable BF-77 under Setup.</p>
        ) : data.laborVarianceBf77.exceptions.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No exceptions in the configured lookback.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <p className="text-[11px] text-zinc-500">
              Evaluated <span className="font-mono">{data.laborVarianceBf77.evaluatedAt.slice(0, 19)}</span> ·{" "}
              {data.laborVarianceBf77.exceptions.length} row(s)
            </p>
            <table className="mt-2 min-w-full text-left text-xs">
              <thead className="bg-zinc-100 text-[10px] uppercase text-zinc-600">
                <tr>
                  <th className="px-2 py-1">Task</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Warehouse</th>
                  <th className="px-2 py-1">Actual min</th>
                  <th className="px-2 py-1">Std min</th>
                  <th className="px-2 py-1">Δ%</th>
                  <th className="px-2 py-1">Completed</th>
                  <th className="px-2 py-1">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {data.laborVarianceBf77.exceptions.map((x) => (
                  <tr key={x.taskId}>
                    <td className="px-2 py-1 font-mono text-[11px]">{x.taskId.slice(0, 12)}…</td>
                    <td className="px-2 py-1">{x.taskType}</td>
                    <td className="px-2 py-1">{x.warehouseCode ?? x.warehouseName}</td>
                    <td className="px-2 py-1 tabular-nums">{x.actualMinutes}</td>
                    <td className="px-2 py-1 tabular-nums">{x.standardMinutes}</td>
                    <td className="px-2 py-1 tabular-nums text-amber-800">
                      +{x.variancePctVsStandard.toFixed(1)}%
                    </td>
                    <td className="px-2 py-1 text-zinc-600">{x.completedAt.slice(0, 19)}</td>
                    <td className="px-2 py-1 text-zinc-600">{x.completedBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Open tasks</h2>
          <div className="flex flex-wrap items-center gap-3">
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
                      | "VALUE_ADD"
                      | "KIT_BUILD",
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
                <option value="KIT_BUILD">
                  Kit build ({data.openTasks.filter((t) => t.taskType === "KIT_BUILD").length})
                </option>
              </select>
            </label>
            {openTaskTypeFilter === "REPLENISH" ? (
              <>
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  Tier
                  <select
                    value={replenishTierFilter}
                    onChange={(e) =>
                      setReplenishTierFilter(e.target.value as "" | "standard" | "exception")
                    }
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  >
                    <option value="">All replenishments</option>
                    <option value="standard">Standard (non-exception)</option>
                    <option value="exception">Exception queue only</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  Min priority
                  <input
                    value={replenishMinPriority}
                    onChange={(e) => setReplenishMinPriority(e.target.value)}
                    placeholder="e.g. 10"
                    inputMode="numeric"
                    className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
              </>
            ) : null}
          </div>
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
                {t.taskType === "REPLENISH" ? (
                  <span className="rounded bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                    pri {t.replenishmentPriority ?? "—"}
                    {t.replenishmentException ? " · exception" : ""}
                  </span>
                ) : null}
                {t.standardMinutes != null ? (
                  <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] text-sky-900">
                    Std {t.standardMinutes}m
                  </span>
                ) : null}
                {t.startedAt ? (
                  <span className="text-[11px] font-medium text-emerald-800">Timer on</span>
                ) : null}
                {t.wave?.pickMode === "BATCH" ? (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
                    Batch wave
                  </span>
                ) : null}
                {t.taskType === "PICK" && t.batchGroupKey && t.bin ? (
                  <span className="text-[11px] text-zinc-500" title={`batchGroupKey=${t.batchGroupKey}`}>
                    Cluster stop · bin {t.bin.code}
                  </span>
                ) : null}
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
                {t.taskType === "KIT_BUILD" ? (
                  <label className="flex min-w-[180px] max-w-full flex-1 flex-col gap-0.5 text-[11px] text-zinc-600 lg:min-w-[240px]">
                    BF-94 genealogy JSON (optional)
                    <textarea
                      rows={2}
                      value={kitBuildBf94JsonByTaskId[t.id] ?? ""}
                      onChange={(e) =>
                        setKitBuildBf94JsonByTaskId((m) => ({ ...m, [t.id]: e.target.value }))
                      }
                      placeholder='{"outputSerialNos":["FG-1"],"consumedSerials":[{"bomLineId":"…","serialNo":"C1"}]}'
                      className="rounded border border-zinc-300 px-2 py-1 font-mono text-[11px] text-zinc-800"
                    />
                  </label>
                ) : null}
                {(t.taskType === "VALUE_ADD" || t.taskType === "KIT_BUILD") && t.referenceId ? (
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
                {canEdit ? (
                  <button
                    type="button"
                    disabled={busy || Boolean(t.startedAt)}
                    onClick={() => void runAction({ action: "start_wms_task", taskId: t.id })}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                  >
                    {t.startedAt ? "Started" : "Start timer"}
                  </button>
                ) : null}
                {canEdit &&
                (t.taskType === "PUTAWAY" ||
                  t.taskType === "PICK" ||
                  t.taskType === "REPLENISH" ||
                  t.taskType === "CYCLE_COUNT" ||
                  t.taskType === "VALUE_ADD" ||
                  t.taskType === "KIT_BUILD") ? (
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
                      if (t.taskType === "KIT_BUILD") {
                        const extras: Record<string, unknown> = {};
                        const rawBf94 = kitBuildBf94JsonByTaskId[t.id]?.trim();
                        if (rawBf94) {
                          let parsed: unknown;
                          try {
                            parsed = JSON.parse(rawBf94);
                          } catch {
                            window.alert("BF-94 JSON is invalid — fix or clear before completing.");
                            return;
                          }
                          if (!parsed || typeof parsed !== "object") {
                            window.alert("BF-94 JSON must be an object.");
                            return;
                          }
                          const o = parsed as Record<string, unknown>;
                          if ("outputSerialNos" in o) {
                            if (!Array.isArray(o.outputSerialNos)) {
                              window.alert("BF-94 outputSerialNos must be an array.");
                              return;
                            }
                            extras.kitBuildBf94OutputSerialNos = o.outputSerialNos;
                          }
                          if ("consumedSerials" in o) {
                            if (!Array.isArray(o.consumedSerials)) {
                              window.alert("BF-94 consumedSerials must be an array.");
                              return;
                            }
                            extras.kitBuildBf94ConsumedSerials = o.consumedSerials;
                          }
                        }
                        void runAction({ action: "complete_kit_build_task", taskId: t.id, ...extras });
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
        {canEdit && !stockQtyEdit && (stockLotEdit || stockSerialEdit) ? (
          <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-950">Limited Stock workspace edit</p>
            <p className="mt-1 text-xs text-amber-900">
              {stockLotEdit ? (
                <>
                  Lot/batch master mutations (<span className="font-medium">org.wms.inventory.lot</span>) are enabled.{" "}
                </>
              ) : null}
              {stockSerialEdit ? (
                <>
                  Serialization registry mutations (<span className="font-medium">org.wms.inventory.serial</span>) are
                  enabled.{" "}
                </>
              ) : null}
              Balance holds, cycle counts, and saved ledger views require{" "}
              <span className="font-medium">org.wms.inventory → edit</span> (or legacy{" "}
              <span className="font-medium">org.wms → edit</span>). BF-58 restricted releases may use{" "}
              <span className="font-medium">org.wms.inventory.hold.release_quality</span> or{" "}
              <span className="font-medium">…release_compliance</span> → edit instead of full inventory edit.
            </p>
          </section>
        ) : null}
        <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Recall campaigns (BF-73)</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Draft a named scope (warehouse ids × product ids, optional lot codes), then materialize once to apply the BF-58 freeze payload across matching balances—same semantics as bulk{" "}
            <span className="font-medium">apply_inventory_freeze</span>. Close marks the campaign administratively complete; balance releases still use{" "}
            <span className="font-medium">release_inventory_freeze</span>.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-zinc-700">
                Campaign code
                <input
                  value={bf73RecallCode}
                  onChange={(e) => setBf73RecallCode(e.target.value)}
                  placeholder="e.g. RECALL-2026-A"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Title
                <input
                  value={bf73RecallTitle}
                  onChange={(e) => setBf73RecallTitle(e.target.value)}
                  placeholder="Short operator-facing title"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Note (optional)
                <textarea
                  value={bf73RecallNote}
                  onChange={(e) => setBf73RecallNote(e.target.value)}
                  rows={2}
                  placeholder="Extra context stored on the campaign row"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-zinc-700">
                Warehouse ids (comma / newline / space separated)
                <textarea
                  value={bf73RecallWarehouseIdsRaw}
                  onChange={(e) => setBf73RecallWarehouseIdsRaw(e.target.value)}
                  rows={3}
                  placeholder="Paste warehouse cuid ids"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs"
                />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Product ids (comma / newline / space separated)
                <textarea
                  value={bf73RecallProductIdsRaw}
                  onChange={(e) => setBf73RecallProductIdsRaw(e.target.value)}
                  rows={3}
                  placeholder="Paste product cuid ids"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs"
                />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Lot codes (optional — omit to freeze all lots in scope)
                <textarea
                  value={bf73RecallLotCodesRaw}
                  onChange={(e) => setBf73RecallLotCodesRaw(e.target.value)}
                  rows={2}
                  placeholder="Optional — narrows to listed lots only"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs"
                />
              </label>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-zinc-700">
              Hold reason code
              <select
                value={bf73RecallHoldReason}
                onChange={(e) => setBf73RecallHoldReason(e.target.value)}
                className="mt-1 block rounded border border-zinc-300 px-3 py-2 text-sm"
              >
                {WMS_INVENTORY_FREEZE_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Restricted release grant (optional)
              <select
                value={bf73RecallHoldGrant}
                onChange={(e) => setBf73RecallHoldGrant(e.target.value)}
                className="mt-1 block min-w-[14rem] rounded border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {WMS_INVENTORY_HOLD_RELEASE_GRANTS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!stockQtyEdit || busy}
              onClick={() => {
                const wh = splitRecallIdList(bf73RecallWarehouseIdsRaw);
                const pr = splitRecallIdList(bf73RecallProductIdsRaw);
                const lotsRaw = splitRecallIdList(bf73RecallLotCodesRaw);
                if (!bf73RecallCode.trim() || !bf73RecallTitle.trim()) {
                  window.alert("Campaign code and title are required.");
                  return;
                }
                void runAction({
                  action: "create_recall_campaign_bf73",
                  recallCampaignCode: bf73RecallCode.trim(),
                  recallCampaignTitle: bf73RecallTitle.trim(),
                  recallCampaignNote: bf73RecallNote.trim() || null,
                  recallScopeWarehouseIds: wh,
                  recallScopeProductIds: pr,
                  recallScopeLotCodes: lotsRaw.length ? lotsRaw : null,
                  recallHoldReasonCode: bf73RecallHoldReason,
                  recallHoldReleaseGrant: bf73RecallHoldGrant.trim() || null,
                }).then((res) => {
                  if (res?.id) window.alert(`Draft recall campaign created (id: ${String(res.id)}).`);
                });
              }}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Create draft campaign
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-600">
                  <th className="py-2 pr-3 font-semibold">Code</th>
                  <th className="py-2 pr-3 font-semibold">Title</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Frozen rows</th>
                  <th className="py-2 pr-3 font-semibold">Materialized</th>
                  <th className="py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recallCampaigns ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-3 text-zinc-500">
                      No recall campaigns yet.
                    </td>
                  </tr>
                ) : (
                  (data?.recallCampaigns ?? []).map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-3 font-mono text-[11px]">{c.campaignCode}</td>
                      <td className="py-2 pr-3">{c.title}</td>
                      <td className="py-2 pr-3">{c.status}</td>
                      <td className="py-2 pr-3">{c.frozenBalanceCount ?? "—"}</td>
                      <td className="py-2 pr-3">{c.materializedAt ? c.materializedAt.slice(0, 16) : "—"}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          {c.status === "DRAFT" ? (
                            <button
                              type="button"
                              disabled={!stockQtyEdit || busy}
                              onClick={() =>
                                void runAction({
                                  action: "materialize_recall_campaign_bf73",
                                  recallCampaignId: c.id,
                                }).then((res) => {
                                  if (res && typeof res.updatedCount === "number") {
                                    window.alert(`Materialized — inventory rows updated: ${res.updatedCount}`);
                                  }
                                })
                              }
                              className="rounded-lg border border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                            >
                              Materialize
                            </button>
                          ) : null}
                          {c.status !== "CLOSED" ? (
                            <button
                              type="button"
                              disabled={!stockQtyEdit || busy}
                              onClick={() => {
                                if (!window.confirm(`Close campaign ${c.campaignCode}?`)) return;
                                void runAction({
                                  action: "close_recall_campaign_bf73",
                                  recallCampaignId: c.id,
                                }).then((res) => {
                                  if (res?.ok) window.alert("Campaign closed.");
                                });
                              }}
                              className="rounded-lg border border-zinc-300 px-3 py-1 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
                            >
                              Close
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <h2 className="text-sm font-semibold text-zinc-900">Saved views</h2>
            <p className="mt-1 text-xs text-zinc-600">
              Save ledger filter combinations for faster operational review and repeatable stakeholder walkthroughs.
              {!stockQtyEdit ? " Saving and deleting views requires org.wms.inventory → edit." : ""}
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
            disabled={!stockQtyEdit || !selectedSavedViewId}
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
            disabled={!stockQtyEdit || !newSavedViewName.trim()}
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

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Availability</p>
        <h2 className="mt-2 text-sm font-semibold text-zinc-900">ATP & soft reservations (BF-36)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Soft reservations reduce ATP for picks, waves, and replenishment moves until they expire or are released.
          Default TTL is 3600s when omitted. BF-88 tiers adjust TTL/priority; optional pick floor lets allocation ignore
          low-priority holds while this ATP grid stays conservative (strict soft sum).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Warehouse</th>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1">On hand</th>
                <th className="px-2 py-1">Allocated</th>
                <th className="px-2 py-1">Soft res.</th>
                <th className="px-2 py-1">ATP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {atpRowsShown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-2 text-zinc-500">
                    No ATP rows (pick a warehouse above or add balances).
                  </td>
                </tr>
              ) : (
                atpRowsShown.map((r) => (
                  <tr key={`${r.warehouseId}-${r.productId}`}>
                    <td className="px-2 py-1">{r.warehouseLabel}</td>
                    <td className="px-2 py-1">
                      {r.product.productCode || r.product.sku || "—"} · {r.product.name}
                    </td>
                    <td className="px-2 py-1">{r.onHandQty}</td>
                    <td className="px-2 py-1">{r.allocatedQty}</td>
                    <td className="px-2 py-1">{r.softReservedQty}</td>
                    <td className="px-2 py-1 font-medium">{r.atpQty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-4">
          <select
            value={bf36SoftBalanceId}
            onChange={(e) => setBf36SoftBalanceId(e.target.value)}
            className="min-w-[14rem] rounded border border-zinc-300 px-3 py-2 text-sm"
            disabled={!data || balancesShown.length === 0}
          >
            <option value="">Balance row</option>
            {balancesShown.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bin.code} · {(b.product.productCode || b.product.sku || "SKU").slice(0, 14)} · eff{" "}
                {b.effectiveAvailableQty ?? b.availableQty}
              </option>
            ))}
          </select>
          <input
            value={bf36SoftQty}
            onChange={(e) => setBf36SoftQty(e.target.value)}
            placeholder="Qty"
            inputMode="decimal"
            className="w-24 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={bf36SoftTtl}
            onChange={(e) => setBf36SoftTtl(e.target.value)}
            placeholder="TTL sec"
            inputMode="numeric"
            className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={bf36SoftTierTag}
            onChange={(e) => setBf36SoftTierTag(e.target.value)}
            placeholder="BF-88 tier tag (opt)"
            className="min-w-[10rem] rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={
              !stockQtyEdit ||
              busy ||
              !bf36SoftBalanceId ||
              !Number.isFinite(Number(bf36SoftQty)) ||
              Number(bf36SoftQty) <= 0
            }
            onClick={() => {
              const ttlRaw = bf36SoftTtl.trim();
              void runAction({
                action: "create_soft_reservation",
                balanceId: bf36SoftBalanceId,
                quantity: Number(bf36SoftQty),
                ...(ttlRaw !== "" ? { softReservationTtlSeconds: Number(ttlRaw) } : {}),
                ...(bf36SoftTierTag.trim()
                  ? { softReservationTierTagBf88: bf36SoftTierTag.trim() }
                  : {}),
              });
            }}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Create soft reservation
          </button>
        </div>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Active reservations</h3>
        <div className="mt-2 max-h-48 overflow-auto rounded border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Expires</th>
                <th className="px-2 py-1">Qty</th>
                <th className="px-2 py-1">Pri</th>
                <th className="px-2 py-1">Bin</th>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {softReservationsShown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-2 text-zinc-500">
                    No active soft reservations.
                  </td>
                </tr>
              ) : (
                softReservationsShown.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-2 py-1 text-xs text-zinc-600">
                      {new Date(r.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1">{r.quantity}</td>
                    <td className="px-2 py-1 font-mono text-xs">{r.priorityBf88}</td>
                    <td className="px-2 py-1">{r.bin.code}</td>
                    <td className="px-2 py-1 text-xs">
                      {r.product.productCode || r.product.sku || "—"} · {r.product.name}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        disabled={!stockQtyEdit || busy}
                        onClick={() =>
                          void runAction({
                            action: "release_soft_reservation",
                            softReservationId: r.id,
                          })
                        }
                        className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800 disabled:opacity-40"
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Inventory serialization</p>
        <h2 className="mt-2 text-sm font-semibold text-zinc-900">Unit serial trace (BF-13)</h2>
        <p className="mt-1 max-w-3xl text-xs text-zinc-600">
          Register a unique serial per SKU (normalized uppercase token). Optionally point a serial at an inventory balance row,
          attach ledger movements for recall-style genealogy, and trace linked movements here. This does not replace ASN/carrier
          serialization or manufacturing-line issuance.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
          <label className="block min-w-[12rem] text-[11px] font-medium text-zinc-600">
            Product
            <select
              value={serialTraceDraftProductId}
              onChange={(e) => setSerialTraceDraftProductId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="">Select SKU…</option>
              {balanceProductOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[10rem] flex-1 text-[11px] font-medium text-zinc-600">
            Serial
            <input
              value={serialTraceDraftNo}
              onChange={(e) => setSerialTraceDraftNo(e.target.value)}
              placeholder="e.g. SN-ABC123"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy || !serialTraceDraftProductId.trim() || !serialTraceDraftNo.trim()}
            onClick={() => {
              setSerialTraceLookup({
                productId: serialTraceDraftProductId.trim(),
                serialNo: serialTraceDraftNo.trim(),
              });
            }}
            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Lookup trace
          </button>
          <button
            type="button"
            disabled={busy || !serialTraceLookup}
            onClick={() => setSerialTraceLookup(null)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
          >
            Clear trace query
          </button>
        </div>

        {serialTraceLookup && data.serialTrace ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
            {data.serialTrace.status === "bad_serial" ? (
              <p className="text-xs text-rose-700">{data.serialTrace.message}</p>
            ) : data.serialTrace.status === "product_denied" ? (
              <p className="text-xs text-zinc-600">Product not visible in your scope.</p>
            ) : data.serialTrace.status === "not_found" ? (
              <p className="text-xs text-zinc-600">
                No serial <span className="font-mono">{data.serialTrace.serialNo}</span> for this product.
              </p>
            ) : data.serialTrace.status === "ok" ? (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-2 text-zinc-800">
                  <span className="font-semibold">Serial:</span>
                  <span className="font-mono">{data.serialTrace.serial.serialNo}</span>
                  <span className="text-zinc-500">· {data.serialTrace.product.name}</span>
                </div>
                {data.serialTrace.serial.note ? (
                  <p className="text-zinc-600">Note: {data.serialTrace.serial.note}</p>
                ) : null}
                <div className="text-zinc-600">
                  Current balance pointer:{" "}
                  {data.serialTrace.currentBalance ? (
                    <span>
                      {data.serialTrace.currentBalance.warehouse.code ?? data.serialTrace.currentBalance.warehouse.name} /{" "}
                      {data.serialTrace.currentBalance.bin.code} · lot{" "}
                      <span className="font-mono">{data.serialTrace.currentBalance.lotCode || "—"}</span> · on hand{" "}
                      {data.serialTrace.currentBalance.onHandQty}
                    </span>
                  ) : (
                    <span className="text-zinc-500">none</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-zinc-800">Linked movements ({data.serialTrace.movements.length})</p>
                  {data.serialTrace.movements.length === 0 ? (
                    <p className="mt-1 text-zinc-500">None yet — use attach below.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-[720px] w-full border-collapse text-[11px]">
                        <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-[10px] uppercase text-zinc-600">
                          <tr>
                            <th className="px-2 py-1">Linked</th>
                            <th className="px-2 py-1">When</th>
                            <th className="px-2 py-1">Type</th>
                            <th className="px-2 py-1">Qty</th>
                            <th className="px-2 py-1">Ref</th>
                            <th className="px-2 py-1">Warehouse</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {data.serialTrace.movements.map((row) => (
                            <tr key={`${row.movement.id}-${row.linkedAt}`}>
                              <td className="px-2 py-1 text-zinc-500">{new Date(row.linkedAt).toLocaleString()}</td>
                              <td className="px-2 py-1 text-zinc-600">{new Date(row.movement.createdAt).toLocaleString()}</td>
                              <td className="px-2 py-1">{row.movement.movementType}</td>
                              <td className="px-2 py-1 tabular-nums">{row.movement.quantity}</td>
                              <td className="max-w-[10rem] truncate px-2 py-1 text-zinc-600" title={row.movement.referenceId ?? ""}>
                                {row.movement.referenceType ?? "—"} {row.movement.referenceId ? row.movement.referenceId.slice(0, 8) : ""}
                              </td>
                              <td className="px-2 py-1">{row.movement.warehouse.code ?? row.movement.warehouse.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {stockQtyEdit || stockSerialEdit ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 p-3">
              <p className="text-[11px] font-semibold text-zinc-800">Register serial</p>
              <select
                value={regSerialProductId}
                onChange={(e) => setRegSerialProductId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              >
                <option value="">Product…</option>
                {balanceProductOptions.map((p) => (
                  <option key={`reg-${p.id}`} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                value={regSerialNo}
                onChange={(e) => setRegSerialNo(e.target.value)}
                placeholder="Serial token"
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              />
              <input
                value={regSerialNote}
                onChange={(e) => setRegSerialNote(e.target.value)}
                placeholder="Optional note"
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={busy || !regSerialProductId.trim() || !regSerialNo.trim()}
                onClick={() =>
                  void runAction({
                    action: "register_inventory_serial",
                    productId: regSerialProductId.trim(),
                    inventorySerialNo: regSerialNo.trim(),
                    inventorySerialNote: regSerialNote.trim() || undefined,
                  })
                }
                className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Register
              </button>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3">
              <p className="text-[11px] font-semibold text-zinc-800">Attach to movement</p>
              <input
                value={attachSerialMovementId}
                onChange={(e) => setAttachSerialMovementId(e.target.value)}
                placeholder="InventoryMovement.id"
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-[11px]"
              />
              <select
                value={attachSerialProductId}
                onChange={(e) => setAttachSerialProductId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              >
                <option value="">Product…</option>
                {balanceProductOptions.map((p) => (
                  <option key={`att-${p.id}`} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                value={attachSerialNo}
                onChange={(e) => setAttachSerialNo(e.target.value)}
                placeholder="Serial token"
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={busy || !attachSerialMovementId.trim() || !attachSerialProductId.trim() || !attachSerialNo.trim()}
                onClick={() =>
                  void runAction({
                    action: "attach_inventory_serial_to_movement",
                    inventoryMovementId: attachSerialMovementId.trim(),
                    productId: attachSerialProductId.trim(),
                    inventorySerialNo: attachSerialNo.trim(),
                  })
                }
                className="mt-3 rounded-lg border border-zinc-300 px-3 py-2 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
              >
                Attach
              </button>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3">
              <p className="text-[11px] font-semibold text-zinc-800">Balance pointer</p>
              <select
                value={serialBalProductId}
                onChange={(e) => setSerialBalProductId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              >
                <option value="">Product…</option>
                {balanceProductOptions.map((p) => (
                  <option key={`bal-${p.id}`} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                value={serialBalNo}
                onChange={(e) => setSerialBalNo(e.target.value)}
                placeholder="Serial token"
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              />
              <input
                value={serialBalBalanceId}
                onChange={(e) => setSerialBalBalanceId(e.target.value)}
                placeholder="InventoryBalance.id (paste)"
                className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-[11px]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !serialBalProductId.trim() || !serialBalNo.trim() || !serialBalBalanceId.trim()}
                  onClick={() =>
                    void runAction({
                      action: "set_inventory_serial_balance",
                      productId: serialBalProductId.trim(),
                      inventorySerialNo: serialBalNo.trim(),
                      serialBalanceId: serialBalBalanceId.trim(),
                    })
                  }
                  className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  Set pointer
                </button>
                <button
                  type="button"
                  disabled={busy || !serialBalProductId.trim() || !serialBalNo.trim()}
                  onClick={() =>
                    void runAction({
                      action: "set_inventory_serial_balance",
                      productId: serialBalProductId.trim(),
                      inventorySerialNo: serialBalNo.trim(),
                      serialBalanceId: null,
                    })
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-[11px] font-medium text-zinc-800 disabled:opacity-40"
                >
                  Clear pointer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-zinc-500">
            Register / attach / balance mutations require{" "}
            <span className="font-medium">org.wms.inventory → edit</span>,{" "}
            <span className="font-medium">org.wms.inventory.serial → edit</span>, or legacy full WMS edit.
          </p>
        )}
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
            {data.movementCo2eHintMeta ? (
              <p className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-1.5 text-[11px] text-emerald-950/90">
                <span className="font-semibold">{data.movementCo2eHintMeta.schemaVersion}</span> —{" "}
                {data.movementCo2eHintMeta.methodology}
              </p>
            ) : null}
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
            <a
              href={buildMovementAuditChainBf82Url({
                warehouseId: selectedWarehouseId,
                movementType: movementTypeFilter,
                sinceIso: ledgerSince,
                untilIso: ledgerUntil,
                limit: ledgerLimit,
                sortBy: "",
                sortDir: "",
              })}
              target="_blank"
              rel="noreferrer"
              title="BF-82 — chronological SHA-256 chain JSON for the same warehouse/type/date/cap filters (ignores table sort)."
              className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800"
            >
              Audit chain JSON (BF-82)
            </a>
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
        {canEdit ? (
          <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
            <h3 className="text-xs font-semibold text-sky-900">BF-64 — Movement custody JSON</h3>
            <p className="mt-1 max-w-3xl text-[11px] text-sky-900/85">
              Attach a cold-chain segment to an inventory ledger row. When{" "}
              <span className="font-medium">referenceType</span> is SHIPMENT, breach audits attach{" "}
              <span className="font-medium">shipmentId</span> for Control Tower timeline context.
            </p>
            <label className="mt-2 block max-w-xl text-[11px] font-medium text-zinc-700">
              Movement id
              <input
                value={bf64MovementId}
                onChange={(e) => setBf64MovementId(e.target.value)}
                disabled={busy}
                className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1 font-mono text-[11px]"
                placeholder="InventoryMovement.id"
              />
            </label>
            <textarea
              value={bf64CustodyJson}
              onChange={(e) => setBf64CustodyJson(e.target.value)}
              disabled={busy}
              rows={2}
              className="mt-2 w-full max-w-2xl rounded-lg border border-sky-200 bg-white px-2 py-1.5 font-mono text-[11px]"
              placeholder='{"minTempC":2,"maxTempC":8,"probeTempC":9}'
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !bf64MovementId.trim()}
                onClick={() => {
                  const t = bf64CustodyJson.trim();
                  if (!t) {
                    window.alert("Paste JSON or use Clear movement custody.");
                    return;
                  }
                  let parsed: unknown;
                  try {
                    parsed = JSON.parse(t) as unknown;
                  } catch {
                    window.alert("Invalid JSON.");
                    return;
                  }
                  void runAction({
                    action: "set_inventory_movement_custody_segment_bf64",
                    inventoryMovementId: bf64MovementId.trim(),
                    custodySegmentJson: parsed,
                  });
                }}
                className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Apply to movement
              </button>
              <button
                type="button"
                disabled={busy || !bf64MovementId.trim()}
                onClick={() =>
                  void runAction({
                    action: "set_inventory_movement_custody_segment_bf64",
                    inventoryMovementId: bf64MovementId.trim(),
                    custodySegmentJson: null,
                  })
                }
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-[11px] font-medium text-sky-900 disabled:opacity-40"
              >
                Clear movement custody
              </button>
            </div>
          </div>
        ) : null}
        {canEdit ? (
          <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <h3 className="text-xs font-semibold text-emerald-950">BF-69 — Movement CO₂e hint</h3>
            <p className="mt-1 max-w-3xl text-[11px] text-emerald-950/85">
              Optional grams CO₂e per ledger row plus a small stub (mode / distance / note). Leave a field empty on
              Apply to leave that attribute unchanged; use the clear buttons to remove stored values.
            </p>
            <label className="mt-2 block max-w-xl text-[11px] font-medium text-zinc-700">
              Movement id
              <input
                value={bf69MovementId}
                onChange={(e) => setBf69MovementId(e.target.value)}
                disabled={busy}
                className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1 font-mono text-[11px]"
                placeholder="InventoryMovement.id"
              />
            </label>
            <label className="mt-2 block max-w-sm text-[11px] font-medium text-zinc-700">
              CO₂e estimate (grams)
              <input
                value={bf69Co2eGrams}
                onChange={(e) => setBf69Co2eGrams(e.target.value)}
                disabled={busy}
                inputMode="decimal"
                className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1 font-mono text-[11px]"
                placeholder="e.g. 1280"
              />
            </label>
            <textarea
              value={bf69StubJson}
              onChange={(e) => setBf69StubJson(e.target.value)}
              disabled={busy}
              rows={2}
              className="mt-2 w-full max-w-2xl rounded-lg border border-emerald-200 bg-white px-2 py-1.5 font-mono text-[11px]"
              placeholder='{"transportModeStub":"ROAD","distanceKm":120}'
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !bf69MovementId.trim()}
                onClick={() => {
                  const mid = bf69MovementId.trim();
                  const g = bf69Co2eGrams.trim();
                  const st = bf69StubJson.trim();
                  if (!g && !st) {
                    window.alert("Enter grams and/or stub JSON, or use a clear action.");
                    return;
                  }
                  const body: Record<string, unknown> = {
                    action: "set_inventory_movement_co2e_hint_bf69",
                    inventoryMovementId: mid,
                  };
                  if (g) {
                    const n = Number(g);
                    if (!Number.isFinite(n) || n < 0) {
                      window.alert("CO₂e grams must be a non-negative number.");
                      return;
                    }
                    body.co2eEstimateGrams = n;
                  }
                  if (st) {
                    let parsed: unknown;
                    try {
                      parsed = JSON.parse(st) as unknown;
                    } catch {
                      window.alert("Invalid stub JSON.");
                      return;
                    }
                    body.co2eStubJson = parsed;
                  }
                  void runAction(body);
                }}
                className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Apply CO₂e patch
              </button>
              <button
                type="button"
                disabled={busy || !bf69MovementId.trim()}
                onClick={() =>
                  void runAction({
                    action: "set_inventory_movement_co2e_hint_bf69",
                    inventoryMovementId: bf69MovementId.trim(),
                    co2eEstimateGrams: null,
                  })
                }
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-950 disabled:opacity-40"
              >
                Clear grams only
              </button>
              <button
                type="button"
                disabled={busy || !bf69MovementId.trim()}
                onClick={() =>
                  void runAction({
                    action: "set_inventory_movement_co2e_hint_bf69",
                    inventoryMovementId: bf69MovementId.trim(),
                    co2eStubJson: null,
                  })
                }
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-950 disabled:opacity-40"
              >
                Clear stub only
              </button>
              <button
                type="button"
                disabled={busy || !bf69MovementId.trim()}
                onClick={() =>
                  void runAction({
                    action: "set_inventory_movement_co2e_hint_bf69",
                    inventoryMovementId: bf69MovementId.trim(),
                    co2eEstimateGrams: null,
                    co2eStubJson: null,
                  })
                }
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-950 disabled:opacity-40"
              >
                Clear all CO₂e
              </button>
            </div>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">When</th>
                <th className="px-2 py-1">Movement id</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Qty</th>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1">Bin</th>
                <th className="px-2 py-1">Ref</th>
                <th className="px-2 py-1">Custody</th>
                <th className="px-2 py-1">CO₂e (g)</th>
                <th className="px-2 py-1">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {movementsShown.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-3 text-zinc-500">
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
                    <td className="px-2 py-1 font-mono text-[10px] text-zinc-500" title={m.id}>
                      {m.id.slice(0, 10)}…
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
                    <td className="px-2 py-1 text-xs text-zinc-600">
                      {m.custodySegmentJson != null ? (
                        <button
                          type="button"
                          className="rounded-full bg-sky-50 px-1.5 py-0.5 font-medium text-sky-900 hover:bg-sky-100"
                          title={JSON.stringify(m.custodySegmentJson).slice(0, 800)}
                          onClick={() => {
                            setBf64MovementId(m.id);
                            setBf64CustodyJson(JSON.stringify(m.custodySegmentJson, null, 0));
                          }}
                        >
                          Edit
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1 text-xs text-zinc-600">
                      {m.co2eEstimateGrams != null || m.co2eStubJson != null ? (
                        <button
                          type="button"
                          className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-950 hover:bg-emerald-100"
                          title={
                            [
                              m.co2eEstimateGrams != null ? `${m.co2eEstimateGrams} g` : "",
                              m.co2eStubJson != null ? JSON.stringify(m.co2eStubJson).slice(0, 400) : "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || ""
                          }
                          onClick={() => {
                            setBf69MovementId(m.id);
                            setBf69Co2eGrams(m.co2eEstimateGrams ?? "");
                            setBf69StubJson(
                              m.co2eStubJson != null ? JSON.stringify(m.co2eStubJson, null, 0) : "",
                            );
                          }}
                        >
                          {m.co2eEstimateGrams != null ? m.co2eEstimateGrams : "stub"}
                        </button>
                      ) : (
                        "—"
                      )}
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
          {stockLotEdit ? (
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
            <p className="text-xs text-zinc-500">
              org.wms.inventory.lot → edit (or broader inventory / legacy WMS edit) required to save lot batches.
            </p>
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
                      {stockLotEdit ? (
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
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold text-zinc-900">Stock balances</h2>
            <span className="text-[11px] text-zinc-600">
              <span className="font-medium text-zinc-700">BF-91</span> aging export{" "}
              <a
                href={inventoryAgingBf91ExportHref}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] text-[var(--arscmp-primary)] underline"
              >
                JSON
              </a>
              {" · "}
              <a
                href={inventoryAgingBf91CsvHref}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] text-[var(--arscmp-primary)] underline"
              >
                CSV
              </a>
            </span>
          </div>
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
            <label className="flex flex-col gap-1 text-xs text-zinc-600">
              Ownership (BF-79)
              <select
                value={balanceOwnershipBf79Mode}
                onChange={(e) =>
                  setBalanceOwnershipBf79Mode(e.target.value as "all" | "company" | "vendor")
                }
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              >
                <option value="all">All balances</option>
                <option value="company">Company-owned</option>
                <option value="vendor">Vendor / consignment</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-600">
              Supplier narrow
              <select
                value={balanceOwnershipBf79SupplierId}
                onChange={(e) => setBalanceOwnershipBf79SupplierId(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              >
                <option value="">Any supplier</option>
                {(data?.suppliersBf79 ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.code ?? "").trim() ? `${s.code} · ` : ""}
                    {s.name}
                  </option>
                ))}
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
        {data?.inventoryOwnershipBalanceFilterBf79 &&
        (data.inventoryOwnershipBalanceFilterBf79.mode !== "all" ||
          Boolean(data.inventoryOwnershipBalanceFilterBf79.supplierId)) ? (
          <p className="mb-2 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-950">
            Server filter BF-79:{" "}
            <span className="font-medium">{data.inventoryOwnershipBalanceFilterBf79.mode}</span>
            {data.inventoryOwnershipBalanceFilterBf79.supplierId
              ? ` · supplier id ${data.inventoryOwnershipBalanceFilterBf79.supplierId.slice(0, 10)}…`
              : null}
            .
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
                <th className="px-2 py-1">Soft res.</th>
                <th className="px-2 py-1">ATP (eff.)</th>
                <th className="px-2 py-1">Hold</th>
                <th className="px-2 py-1">Hold code</th>
                <th className="px-2 py-1">QC</th>
                <th className="px-2 py-1">Ownership BF-79</th>
                <th className="px-2 py-1">Balance id</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {balancesTableRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-2 py-3 text-zinc-500">
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
                    <td className="px-2 py-1 text-zinc-600">{b.softReservedQty ?? "0.000"}</td>
                    <td className="px-2 py-1 font-semibold text-zinc-900">
                      {b.effectiveAvailableQty ?? b.availableQty}
                    </td>
                    <td className="px-2 py-1 text-xs text-zinc-600">
                      {b.onHold ? (
                        <span title={b.holdReason ?? ""}>
                          Yes
                          {b.holdReleaseGrant ? " · restricted" : ""}
                        </span>
                      ) : (
                        "No"
                      )}
                    </td>
                    <td className="px-2 py-1 text-xs font-medium text-zinc-700">
                      {b.onHold && b.holdReasonCode ? (
                        <span
                          className="rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-950"
                          title={b.holdAppliedAt ? `Applied ${b.holdAppliedAt}` : ""}
                        >
                          {b.holdReasonCode}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">
                      {stockQtyEdit && !Boolean(b.onHold) ? (
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
                      {stockQtyEdit && !Boolean(b.onHold) ? (
                        <button
                          type="button"
                          disabled={busy}
                          title="BF-58 structured freeze (reason code + optional restricted release)"
                          onClick={() => {
                            const list = WMS_INVENTORY_FREEZE_REASON_CODES.join(", ");
                            const code =
                              typeof window !== "undefined"
                                ? window.prompt(`BF-58 hold reason code:\n${list}`, "QC_HOLD")
                                : null;
                            if (code === null) return;
                            const upper = code.trim().toUpperCase();
                            if (!([...WMS_INVENTORY_FREEZE_REASON_CODES] as string[]).includes(upper)) {
                              window.alert(`Invalid code. Use one of: ${list}`);
                              return;
                            }
                            const note =
                              typeof window !== "undefined"
                                ? window.prompt("Hold note (optional):", upper.replaceAll("_", " "))
                                : null;
                            if (note === null) return;
                            const g =
                              typeof window !== "undefined"
                                ? window.prompt(
                                    "Restricted release? blank = standard · 1 = quality officer · 2 = compliance",
                                    "",
                                  )
                                : null;
                            if (g === null) return;
                            let holdReleaseGrant: string | null = null;
                            if (g.trim() === "1") holdReleaseGrant = "org.wms.inventory.hold.release_quality";
                            if (g.trim() === "2") holdReleaseGrant = "org.wms.inventory.hold.release_compliance";
                            void runAction({
                              action: "apply_inventory_freeze",
                              balanceId: b.id,
                              holdReasonCode: upper,
                              holdReason: note.trim() || undefined,
                              holdReleaseGrant: holdReleaseGrant ?? undefined,
                            });
                          }}
                          className="ml-1 rounded border border-amber-700 px-2 py-0.5 text-xs font-semibold text-amber-950 disabled:opacity-40"
                        >
                          BF-58
                        </button>
                      ) : null}
                      {stockQtyEdit && b.onHold ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction({ action: "release_inventory_freeze", balanceId: b.id })
                          }
                          className="ml-1 rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800 disabled:opacity-40"
                        >
                          Clear
                        </button>
                      ) : null}
                    </td>
                    <td className="align-top px-2 py-1">
                      <BalanceOwnershipBf79Editor
                        balanceId={b.id}
                        supplier={b.inventoryOwnershipSupplierBf79 ?? null}
                        suppliers={data?.suppliersBf79 ?? []}
                        canEdit={stockQtyEdit}
                        busy={busy}
                        runAction={runAction}
                      />
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px] text-zinc-500" title={b.id}>
                      {b.id.slice(0, 10)}…
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
