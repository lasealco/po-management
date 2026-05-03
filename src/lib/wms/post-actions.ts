import { NextResponse } from "next/server";

import { toApiErrorResponseFromStatus } from "@/app/api/_lib/api-error-contract";
import { Prisma, ShipmentMilestoneCode, type WmsOutboundLogisticsUnitKind, type WmsPickAllocationStrategy, type WmsReceiveStatus, type WmsInboundSubtype, type WmsReturnLineDisposition, type WmsShipmentItemVarianceDisposition, type WmsTaskType, type WmsWavePickMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { fetchWarehouseTopologyGraph } from "@/lib/wms/warehouse-topology-graph";

import { actorIsCustomerCrmScoped } from "@/lib/authz";

import {
  assertOutboundCrmAccountLinkable,
  assertOutboundSourceQuoteAttachable,
} from "./crm-account-link";
import {
  normalizeDockCode,
  normalizeDoorCode,
  parseDockYardMilestone,
  truncateDockTransportField,
  DOCK_TRANSPORT_LIMITS,
  DOCK_TMS_LIMITS,
} from "./dock-appointment";
import { parseTrailerChecklistJson, trailerChecklistAllowsDepart } from "./dock-trailer-checklist";
import {
  crossDockStagingFirstCmp,
  orderPickSlotsForWave,
  orderPickSlotsMinBinTouches,
  orderPickSlotsMinBinTouchesReservePickFace,
  type WavePickSlot,
} from "./allocation-strategy";
import {
  orderPickSlotsMinBinTouchesCubeAware,
  orderPickSlotsMinBinTouchesReservePickFaceCubeAware,
} from "./carton-cube-allocation";
import { sortReplenishmentRulesForBatch } from "./replenishment-batch";
import {
  buildForecastPriorityBoostByRuleId,
  parseWeekStartDateInput,
  utcIsoWeekMonday,
} from "./demand-forecast-replenish";
import { softReservedQtyByBalanceIds } from "./soft-reservation";
import { orderPickSlotsSolverPrototype } from "./pick-wave-solver-prototype";
import { batchPickVisitBinOrder, cloneWavePickSlotPools } from "./pick-wave-batch";
import { writeShipmentItemReceiveLineInTx } from "./inbound-receive-line-write";
import {
  evaluateShipmentReceiveAgainstAsnTolerance,
  generateDockGrnReference,
} from "./asn-receipt-tolerance";
import { evaluateCatchWeightAgainstTolerance } from "./catch-weight-receipt";
import { custodySegmentIndicatesBreach, parseCustodySegmentJsonForPatch } from "./custody-segment-bf64";
import {
  DAMAGE_CARRIER_CLAIM_REF_MAX,
  DAMAGE_CATEGORY_MAX,
  DAMAGE_DESCRIPTION_MAX,
  parseDamageExtraDetailJson,
  parseDamagePhotoUrlsForCreate,
} from "./damage-report-bf65";
import { parseManifestParcelIdsInput } from "./outbound-manifest-bf67";
import { buildReceivingAccrualSnapshotV1 } from "./receiving-accrual-staging";
import { canAdvanceReceiveStatusToReceiptComplete } from "./wms-receipt-close-policy";
import { resolveVarianceDisposition } from "./receive-line-variance";
import {
  parseLotBatchExpiryInput,
  requireNonFungibleLotBatchCode,
  truncateLotBatchCountry,
  truncateLotBatchNotes,
} from "./lot-batch-master";
import { FUNGIBLE_LOT_CODE, normalizeLotCode } from "./lot-code";
import { normalizeHoldReleaseGrantInput, normalizeInventoryFreezeReasonCode } from "./inventory-freeze-matrix";
import { canActorReleaseInventoryHold } from "./inventory-hold-release";
import {
  allocateUniqueStockTransferReferenceCode,
  parseStockTransferLineInput,
  truncateStockTransferNote,
  type ParsedStockTransferLineInput,
} from "./stock-transfer";
import { laborStandardMinutesSnapshot } from "./labor-standards";
import {
  collectDockDetentionAlerts,
  detectMilestonePhaseBreach,
  parseDockDetentionPolicy,
} from "./dock-detention";
import { InventorySerialNoError, normalizeInventorySerialNo } from "./inventory-serial-no";
import { explodeCrmQuoteToOutbound } from "./explode-crm-quote-to-outbound";
import { buildSscc18DemoFromOutbound } from "./gs1-sscc";
import { purchaseDemoParcelCarrierLabel } from "./carrier-label-demo-adapter";
import { carrierLabelPurchaseInputForOutbound, purchaseCarrierLabel } from "./carrier-label-purchase";
import {
  buildOutboundPackScanPlan,
  flattenPackScanExpectations,
  parsePackScanTokenArray,
} from "./pack-scan-verify";
import {
  normalizeOutboundLogisticsUnitScanCode,
  verifyOutboundPackScanResolved,
} from "./outbound-logistics-unit-scan";
import {
  assertAllowedOutboundWebhookUrl,
  parseOutboundWebhookEventTypes,
  scheduleEmitWmsOutboundWebhooks,
  signingSecretSuffixFromSecret,
} from "./outbound-webhook-dispatch";
import {
  generatePartnerApiKeyPlaintext,
  hashPartnerApiKey,
  parsePartnerApiKeyScopes,
  partnerApiKeyPublicPrefix,
} from "./partner-api-key";
import { syncOutboundOrderStatusAfterPick } from "./outbound-workflow";
import { warehouseZoneParentWouldCycle } from "./zone-hierarchy";
import { parseMmForWrite, resolveBinAisleFieldsForWrite } from "./warehouse-aisle";
import { nextWaveNo } from "./wave";
import {
  engineeringBomLinesToParsedWorkOrderLines,
  parseEngineeringBomLinesJson,
} from "./engineering-bom-sync";
import { parseConsumeWorkOrderBomQuantity, parseReplaceWorkOrderBomLinesPayload } from "./work-order-bom";
import { nextWorkOrderNo } from "./work-order-no";
import {
  computeKitBuildLineDeltas,
  parseKitBuildTaskNote,
  serializeKitBuildTaskPayload,
  validateKitBuildLinePicks,
} from "./kit-build";

import {
  customerReturnApplyQuarantineHold,
  customerReturnPutawayBlockedReason,
} from "./customer-return-policy";
import { substituteReceivingDispositionNoteTemplate } from "./receiving-disposition-template";
import {
  allocateUniqueCycleCountReferenceCode,
  cycleCountQtyVariance,
  isWmsCycleCountVarianceReasonCode,
  normalizeCycleCountVarianceReasonCode,
  parseCycleCountQty,
  truncateCycleCountNote,
  varianceRequiresReason,
} from "./cycle-count-session";
import { validateOutboundLuHierarchy } from "./outbound-lu-hierarchy";
import type { WmsBody } from "./wms-body";
import { loadWmsViewReadScope } from "./wms-read-scope";
import { allowedNextWmsReceiveStatuses, canTransitionWmsReceive, isWmsReceiveStatus } from "./wms-receive-status";

const BF43_LOGISTICS_UNIT_KINDS = new Set<string>([
  "PALLET",
  "CASE",
  "INNER_PACK",
  "EACH",
  "UNKNOWN",
]);

async function assertOutboundLuParentNoCycle(
  tx: Prisma.TransactionClient,
  childUnitId: string | undefined,
  proposedParentId: string | null,
): Promise<void> {
  if (!proposedParentId) return;
  let cur: string | null = proposedParentId;
  const seen = new Set<string>();
  while (cur) {
    if (childUnitId && cur === childUnitId) {
      throw new Error("parent_cycle");
    }
    if (seen.has(cur)) break;
    seen.add(cur);
    const parentRow: { parentUnitId: string | null } | null = await tx.wmsOutboundLogisticsUnit.findUnique({
      where: { id: cur },
      select: { parentUnitId: true },
    });
    cur = parentRow?.parentUnitId ?? null;
  }
}

async function releaseInventoryHoldForBalanceId(
  tenantId: string,
  actorId: string,
  balanceId: string,
): Promise<NextResponse | null> {
  const bal = await prisma.inventoryBalance.findFirst({
    where: { id: balanceId, tenantId },
    select: { id: true, onHold: true, holdReleaseGrant: true },
  });
  if (!bal) return toApiErrorResponseFromStatus("Balance row not found.", 404);
  if (!bal.onHold) return toApiErrorResponseFromStatus("Balance is not on hold.", 400);
  const rel = await canActorReleaseInventoryHold(actorId, bal.holdReleaseGrant);
  if (!rel.ok) return NextResponse.json({ error: rel.message }, { status: rel.status });
  await prisma.inventoryBalance.updateMany({
    where: { id: balanceId, tenantId },
    data: {
      onHold: false,
      holdReason: null,
      holdReasonCode: null,
      holdAppliedAt: null,
      holdAppliedById: null,
      holdReleaseGrant: null,
    },
  });
  return null;
}

function parseOptionalCatchWeightKgBf63(
  raw: unknown,
):
  | { ok: true; value: number | null | undefined }
  | { ok: false; response: NextResponse } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === "") return { ok: true, value: null };
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return {
      ok: false,
      response: toApiErrorResponseFromStatus(
        "catchWeightKg must be a non-negative number or null.",
        400,
      ),
    };
  }
  return { ok: true, value: n };
}

export async function handleWmsPost(
  tenantId: string,
  actorId: string,
  input: WmsBody,
): Promise<NextResponse> {
  const action = input.action;
  if (action === "set_warehouse_pick_allocation_strategy") {
    const warehouseId = input.warehouseId?.trim();
    const raw = input.pickAllocationStrategy;
    if (!warehouseId || !raw) {
      return toApiErrorResponseFromStatus("warehouseId and pickAllocationStrategy required.", 400);
    }
    const bf23ReservePickFaceDisabled = process.env.WMS_DISABLE_BF23_STRATEGY === "1";
    const bf33CubeAwareDisabled = process.env.WMS_DISABLE_BF33_CUBE_AWARE === "1";
    const allowed: WmsPickAllocationStrategy[] = [
      "MAX_AVAILABLE_FIRST",
      "FIFO_BY_BIN_CODE",
      "FEFO_BY_LOT_EXPIRY",
      "GREEDY_MIN_BIN_TOUCHES",
      "MANUAL_ONLY",
    ];
    if (!bf23ReservePickFaceDisabled) {
      allowed.splice(4, 0, "GREEDY_RESERVE_PICK_FACE");
    }
    const bf34SolverEnabled = process.env.WMS_ENABLE_BF34_SOLVER === "1";
    if (!bf33CubeAwareDisabled) {
      allowed.splice(
        allowed.indexOf("MANUAL_ONLY"),
        0,
        "GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE",
        "GREEDY_RESERVE_PICK_FACE_CUBE_AWARE",
      );
    }
    if (bf34SolverEnabled) {
      allowed.splice(
        allowed.indexOf("MANUAL_ONLY"),
        0,
        "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES",
        "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE",
      );
    }
    if (!allowed.includes(raw as WmsPickAllocationStrategy)) {
      return toApiErrorResponseFromStatus("Invalid pickAllocationStrategy.", 400);
    }
    const strategy = raw as WmsPickAllocationStrategy;
    const n = await prisma.warehouse.updateMany({
      where: { id: warehouseId, tenantId },
      data: { pickAllocationStrategy: strategy },
    });
    if (n.count === 0) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "set_warehouse_pick_wave_carton_units") {
    const warehouseId = input.warehouseId?.trim();
    if (!warehouseId) {
      return toApiErrorResponseFromStatus("warehouseId required.", 400);
    }
    if (input.pickWaveCartonUnits === undefined) {
      return toApiErrorResponseFromStatus(
        "pickWaveCartonUnits required — send a positive number or null to clear.",
        400,
      );
    }
    const rawCap = input.pickWaveCartonUnits;
    let pickWaveCartonUnits: Prisma.Decimal | null = null;
    if (rawCap !== null && rawCap !== "") {
      const capNum = Number(rawCap);
      if (!Number.isFinite(capNum) || capNum <= 0) {
        return toApiErrorResponseFromStatus("pickWaveCartonUnits must be a positive number or null.", 400);
      }
      pickWaveCartonUnits = new Prisma.Decimal(String(capNum));
    }
    const updated = await prisma.warehouse.updateMany({
      where: { id: warehouseId, tenantId },
      data: { pickWaveCartonUnits },
    });
    if (updated.count === 0) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "export_warehouse_topology_graph") {
    const warehouseId = input.warehouseId?.trim();
    if (!warehouseId) {
      return toApiErrorResponseFromStatus("warehouseId required.", 400);
    }
    const graph = await fetchWarehouseTopologyGraph({ tenantId, warehouseId });
    if (!graph) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }
    return NextResponse.json(graph);
  }

  if (action === "set_wms_labor_task_standard") {
    const rawType = input.laborTaskType?.trim().toUpperCase();
    const allTypes: WmsTaskType[] = ["PUTAWAY", "PICK", "REPLENISH", "CYCLE_COUNT", "VALUE_ADD", "KIT_BUILD"];
    if (!rawType || !allTypes.includes(rawType as WmsTaskType)) {
      return toApiErrorResponseFromStatus(
        "laborTaskType must be PUTAWAY, PICK, REPLENISH, CYCLE_COUNT, or VALUE_ADD.",
        400,
      );
    }
    const taskType = rawType as WmsTaskType;
    const minRaw = input.laborStandardMinutes;
    const minNum = typeof minRaw === "number" ? minRaw : Number(minRaw);
    if (!Number.isFinite(minNum) || minNum < 1 || minNum > 10_080) {
      return toApiErrorResponseFromStatus("laborStandardMinutes must be 1–10080.", 400);
    }
    const standardMinutes = Math.floor(minNum);
    await prisma.wmsLaborTaskStandard.upsert({
      where: { tenantId_taskType: { tenantId, taskType } },
      create: { tenantId, taskType, standardMinutes },
      update: { standardMinutes },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "start_wms_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) return toApiErrorResponseFromStatus("taskId required.", 400);
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN" },
      select: { id: true, startedAt: true },
    });
    if (!task) return toApiErrorResponseFromStatus("Open task not found.", 404);
    if (task.startedAt) {
      return NextResponse.json({ ok: true, alreadyStarted: true });
    }
    await prisma.wmsTask.update({
      where: { id: task.id },
      data: { startedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_zone") {
    const warehouseId = input.warehouseId?.trim();
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    const zoneType = input.zoneType;
    if (!warehouseId || !code || !name || !zoneType) {
      return toApiErrorResponseFromStatus("warehouseId, code, name and zoneType required.", 400);
    }
    await prisma.warehouseZone.create({
      data: {
        tenantId,
        warehouseId,
        code,
        name,
        zoneType,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_warehouse_aisle") {
    const warehouseId = input.warehouseId?.trim();
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    if (!warehouseId || !code || !name) {
      return toApiErrorResponseFromStatus("warehouseId, code, name required.", 400);
    }
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      select: { id: true },
    });
    if (!warehouse) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }

    let zoneId: string | null =
      input.primaryZoneId === undefined || input.primaryZoneId === null || String(input.primaryZoneId).trim() === ""
        ? null
        : String(input.primaryZoneId).trim();
    if (zoneId) {
      const zone = await prisma.warehouseZone.findFirst({
        where: { id: zoneId, tenantId, warehouseId },
        select: { id: true },
      });
      if (!zone) {
        return toApiErrorResponseFromStatus("primaryZoneId not found for warehouse.", 404);
      }
    }

    const lengthMm = parseMmForWrite(input.lengthMm);
    const widthMm = parseMmForWrite(input.widthMm);
    const originXMm = parseMmForWrite(input.originXMm);
    const originYMm = parseMmForWrite(input.originYMm);
    const originZMm = parseMmForWrite(input.originZMm);
    if (!lengthMm.ok || !widthMm.ok || !originXMm.ok || !originYMm.ok || !originZMm.ok) {
      return toApiErrorResponseFromStatus("Invalid millimetre geometry field.", 400);
    }

    await prisma.$transaction(async (tx) => {
      const row = await tx.warehouseAisle.create({
        data: {
          tenantId,
          warehouseId,
          code,
          name,
          zoneId,
          ...(lengthMm.value !== undefined ? { lengthMm: lengthMm.value } : {}),
          ...(widthMm.value !== undefined ? { widthMm: widthMm.value } : {}),
          ...(originXMm.value !== undefined ? { originXMm: originXMm.value } : {}),
          ...(originYMm.value !== undefined ? { originYMm: originYMm.value } : {}),
          ...(originZMm.value !== undefined ? { originZMm: originZMm.value } : {}),
        },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WAREHOUSE_AISLE",
          entityId: row.id,
          action: "warehouse_aisle_created",
          payload: { warehouseId, code },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "update_warehouse_aisle") {
    const aisleRowId = input.warehouseAisleId?.trim();
    if (!aisleRowId) {
      return toApiErrorResponseFromStatus("warehouseAisleId required.", 400);
    }

    const row = await prisma.warehouseAisle.findFirst({
      where: { id: aisleRowId, tenantId },
      select: { id: true, warehouseId: true },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Aisle not found.", 404);
    }

    const data: Prisma.WarehouseAisleUncheckedUpdateManyInput = {};

    if (input.name !== undefined) {
      const nextName = input.name?.trim();
      if (!nextName) {
        return toApiErrorResponseFromStatus("name cannot be empty.", 400);
      }
      data.name = nextName;
    }

    if (input.primaryZoneId !== undefined) {
      const raw = input.primaryZoneId;
      const zoneId =
        raw === null || String(raw).trim() === "" ? null : String(raw).trim();
      if (zoneId) {
        const zone = await prisma.warehouseZone.findFirst({
          where: { id: zoneId, tenantId, warehouseId: row.warehouseId },
          select: { id: true },
        });
        if (!zone) {
          return toApiErrorResponseFromStatus("primaryZoneId not found for warehouse.", 404);
        }
      }
      data.zoneId = zoneId;
    }

    const lengthMm = parseMmForWrite(input.lengthMm);
    const widthMm = parseMmForWrite(input.widthMm);
    const originXMm = parseMmForWrite(input.originXMm);
    const originYMm = parseMmForWrite(input.originYMm);
    const originZMm = parseMmForWrite(input.originZMm);
    if (!lengthMm.ok || !widthMm.ok || !originXMm.ok || !originYMm.ok || !originZMm.ok) {
      return toApiErrorResponseFromStatus("Invalid millimetre geometry field.", 400);
    }
    if (lengthMm.value !== undefined) data.lengthMm = lengthMm.value;
    if (widthMm.value !== undefined) data.widthMm = widthMm.value;
    if (originXMm.value !== undefined) data.originXMm = originXMm.value;
    if (originYMm.value !== undefined) data.originYMm = originYMm.value;
    if (originZMm.value !== undefined) data.originZMm = originZMm.value;

    if (typeof input.isActive === "boolean") {
      data.isActive = input.isActive;
    }

    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus("No updates supplied.", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.warehouseAisle.updateMany({
        where: { id: aisleRowId, tenantId },
        data,
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WAREHOUSE_AISLE",
          entityId: aisleRowId,
          action: "warehouse_aisle_updated",
          payload: { warehouseId: row.warehouseId, patchKeys: Object.keys(data) },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "set_zone_parent") {
    const zoneId = input.zoneId?.trim();
    if (!zoneId) {
      return toApiErrorResponseFromStatus("zoneId required.", 400);
    }
    if (input.parentZoneId === undefined) {
      return toApiErrorResponseFromStatus("parentZoneId required — pass null to clear.", 400);
    }
    const rawParent = input.parentZoneId;
    const parentZoneId =
      rawParent === null || String(rawParent).trim() === ""
        ? null
        : String(rawParent).trim();

    const zone = await prisma.warehouseZone.findFirst({
      where: { id: zoneId, tenantId },
      select: { id: true, warehouseId: true },
    });
    if (!zone) {
      return toApiErrorResponseFromStatus("Zone not found.", 404);
    }

    if (parentZoneId !== null) {
      const parent = await prisma.warehouseZone.findFirst({
        where: { id: parentZoneId, tenantId, warehouseId: zone.warehouseId },
        select: { id: true },
      });
      if (!parent) {
        return toApiErrorResponseFromStatus("Parent zone not found or wrong warehouse.", 404);
      }
    }

    const siblingRows = await prisma.warehouseZone.findMany({
      where: { tenantId, warehouseId: zone.warehouseId },
      select: { id: true, parentZoneId: true },
    });

    if (warehouseZoneParentWouldCycle(zoneId, parentZoneId, siblingRows)) {
      return toApiErrorResponseFromStatus("That parent assignment would create a zone hierarchy cycle.", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.warehouseZone.update({
        where: { id: zoneId },
        data: { parentZoneId },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WAREHOUSE_ZONE",
          entityId: zoneId,
          action: "zone_parent_updated",
          payload: { warehouseId: zone.warehouseId, parentZoneId },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "create_bin") {
    const warehouseId = input.warehouseId?.trim();
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    if (!warehouseId || !code || !name) {
      return toApiErrorResponseFromStatus("warehouseId, code, name required.", 400);
    }
    const rackCode = input.rackCode?.trim() || null;
    const bay = input.bay?.trim() || null;
    const level =
      typeof input.level === "number" && Number.isFinite(input.level)
        ? Math.max(1, Math.trunc(input.level))
        : null;
    const positionIndex =
      typeof input.positionIndex === "number" && Number.isFinite(input.positionIndex)
        ? Math.max(1, Math.trunc(input.positionIndex))
        : null;

    const rawAisleFk = input.warehouseAisleId?.trim();
    let aisleMaster: { id: string; warehouseId: string; code: string } | null = null;
    if (rawAisleFk) {
      aisleMaster = await prisma.warehouseAisle.findFirst({
        where: { id: rawAisleFk, tenantId, warehouseId },
        select: { id: true, warehouseId: true, code: true },
      });
      if (!aisleMaster) {
        return toApiErrorResponseFromStatus("warehouseAisleId not found.", 404);
      }
    }

    const resolvedAisle = resolveBinAisleFieldsForWrite({
      warehouseId,
      requestedWarehouseAisleId: rawAisleFk ?? null,
      requestedAisleLabel: input.aisle,
      aisleMaster,
    });
    if (!resolvedAisle.ok) {
      return toApiErrorResponseFromStatus(resolvedAisle.error, 400);
    }

    let capacityCubeCubicMm: number | undefined = undefined;
    if (input.capacityCubeCubicMm !== undefined && input.capacityCubeCubicMm !== null) {
      const n =
        typeof input.capacityCubeCubicMm === "number"
          ? input.capacityCubeCubicMm
          : Number(input.capacityCubeCubicMm);
      if (!Number.isFinite(n) || n < 0 || Math.trunc(n) !== n) {
        return toApiErrorResponseFromStatus(
          "capacityCubeCubicMm must be a non-negative integer when provided.",
          400,
        );
      }
      capacityCubeCubicMm = Math.trunc(n);
    }

    await prisma.warehouseBin.create({
      data: {
        tenantId,
        warehouseId,
        zoneId: input.targetZoneId?.trim() || null,
        code,
        name,
        storageType: input.storageType ?? "PALLET",
        isPickFace: Boolean(input.isPickFace),
        isCrossDockStaging: Boolean(input.isCrossDockStaging),
        maxPallets:
          typeof input.maxPallets === "number" && Number.isFinite(input.maxPallets)
            ? Math.max(0, Math.trunc(input.maxPallets))
            : null,
        rackCode,
        aisle: resolvedAisle.aisle,
        warehouseAisleId: resolvedAisle.warehouseAisleId,
        bay,
        level,
        positionIndex,
        ...(capacityCubeCubicMm !== undefined ? { capacityCubeCubicMm } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_bin_profile") {
    const binId = input.binId?.trim();
    if (!binId) return toApiErrorResponseFromStatus("binId required.", 400);

    const binRow = await prisma.warehouseBin.findFirst({
      where: { id: binId, tenantId },
      select: {
        id: true,
        warehouseId: true,
        aisle: true,
        warehouseAisleId: true,
      },
    });
    if (!binRow) {
      return toApiErrorResponseFromStatus("Bin not found.", 404);
    }

    const data: Prisma.WarehouseBinUncheckedUpdateManyInput = {
      zoneId: input.targetZoneId?.trim() || null,
      storageType: input.storageType ?? undefined,
      isPickFace: typeof input.isPickFace === "boolean" ? input.isPickFace : undefined,
      isCrossDockStaging:
        typeof input.isCrossDockStaging === "boolean" ? input.isCrossDockStaging : undefined,
      maxPallets:
        typeof input.maxPallets === "number" && Number.isFinite(input.maxPallets)
          ? Math.max(0, Math.trunc(input.maxPallets))
          : input.maxPallets === null
            ? null
            : undefined,
    };
    if (input.rackCode !== undefined) data.rackCode = input.rackCode?.trim() || null;
    if (input.bay !== undefined) data.bay = input.bay?.trim() || null;
    if (input.level !== undefined) {
      data.level =
        typeof input.level === "number" && Number.isFinite(input.level)
          ? Math.max(1, Math.trunc(input.level))
          : null;
    }
    if (input.positionIndex !== undefined) {
      data.positionIndex =
        typeof input.positionIndex === "number" && Number.isFinite(input.positionIndex)
          ? Math.max(1, Math.trunc(input.positionIndex))
          : null;
    }
    if (input.capacityCubeCubicMm !== undefined) {
      if (input.capacityCubeCubicMm === null) {
        data.capacityCubeCubicMm = null;
      } else {
        const n =
          typeof input.capacityCubeCubicMm === "number"
            ? input.capacityCubeCubicMm
            : Number(input.capacityCubeCubicMm);
        if (!Number.isFinite(n) || n < 0 || Math.trunc(n) !== n) {
          return toApiErrorResponseFromStatus(
            "capacityCubeCubicMm must be a non-negative integer or null.",
            400,
          );
        }
        data.capacityCubeCubicMm = Math.trunc(n);
      }
    }

    const aisleFkTouched = input.warehouseAisleId !== undefined;
    const aisleLabelTouched = input.aisle !== undefined;
    if (aisleFkTouched || aisleLabelTouched) {
      const nextFk = aisleFkTouched
        ? input.warehouseAisleId === null || String(input.warehouseAisleId).trim() === ""
          ? null
          : String(input.warehouseAisleId).trim()
        : binRow.warehouseAisleId;

      const nextLabel = aisleLabelTouched ? input.aisle?.trim() || null : binRow.aisle;

      let aisleMaster: { id: string; warehouseId: string; code: string } | null = null;
      if (nextFk) {
        aisleMaster = await prisma.warehouseAisle.findFirst({
          where: { id: nextFk, tenantId, warehouseId: binRow.warehouseId },
          select: { id: true, warehouseId: true, code: true },
        });
        if (!aisleMaster) {
          return toApiErrorResponseFromStatus("warehouseAisleId not found.", 404);
        }
      }

      const resolvedAisle = resolveBinAisleFieldsForWrite({
        warehouseId: binRow.warehouseId,
        requestedWarehouseAisleId: nextFk,
        requestedAisleLabel: nextLabel,
        aisleMaster,
      });
      if (!resolvedAisle.ok) {
        return toApiErrorResponseFromStatus(resolvedAisle.error, 400);
      }
      data.aisle = resolvedAisle.aisle;
      data.warehouseAisleId = resolvedAisle.warehouseAisleId;
    }

    await prisma.warehouseBin.updateMany({
      where: { id: binId, tenantId },
      data,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_product_carton_cube_hints") {
    const productId = input.productId?.trim();
    if (!productId) {
      return toApiErrorResponseFromStatus("productId required.", 400);
    }
    const row = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Product not found.", 404);
    }
    const data: Prisma.ProductUpdateManyMutationInput = {};

    const patchMm = (
      field: "cartonLengthMm" | "cartonWidthMm" | "cartonHeightMm",
      raw: unknown,
    ): NextResponse | undefined => {
      if (raw === undefined) return undefined;
      if (raw === null) {
        data[field] = null;
        return undefined;
      }
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || n <= 0 || Math.trunc(n) !== n) {
        return toApiErrorResponseFromStatus(`${field} must be a positive integer or null.`, 400);
      }
      data[field] = Math.trunc(n);
      return undefined;
    };

    const e1 = patchMm("cartonLengthMm", input.cartonLengthMm);
    if (e1) return e1;
    const e2 = patchMm("cartonWidthMm", input.cartonWidthMm);
    if (e2) return e2;
    const e3 = patchMm("cartonHeightMm", input.cartonHeightMm);
    if (e3) return e3;

    if (input.cartonUnitsPerMasterCarton !== undefined) {
      if (input.cartonUnitsPerMasterCarton === null) {
        data.cartonUnitsPerMasterCarton = null;
      } else {
        const n = Number(input.cartonUnitsPerMasterCarton);
        if (!Number.isFinite(n) || n <= 0) {
          return toApiErrorResponseFromStatus(
            "cartonUnitsPerMasterCarton must be a positive number or null.",
            400,
          );
        }
        data.cartonUnitsPerMasterCarton = n.toString();
      }
    }

    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus(
        "Send at least one of cartonLengthMm, cartonWidthMm, cartonHeightMm, cartonUnitsPerMasterCarton to update.",
        400,
      );
    }

    await prisma.product.updateMany({
      where: { id: productId, tenantId },
      data,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_product_catch_weight_bf63") {
    const productId = input.productId?.trim();
    if (!productId) {
      return toApiErrorResponseFromStatus("productId required.", 400);
    }
    const row = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Product not found.", 404);
    }

    const data: Prisma.ProductUpdateManyMutationInput = {};

    if (input.isCatchWeight !== undefined) {
      if (typeof input.isCatchWeight !== "boolean") {
        return toApiErrorResponseFromStatus("isCatchWeight must be a boolean when provided.", 400);
      }
      data.isCatchWeight = input.isCatchWeight;
    }

    if (input.catchWeightLabelHint !== undefined) {
      if (input.catchWeightLabelHint === null || String(input.catchWeightLabelHint).trim() === "") {
        data.catchWeightLabelHint = null;
      } else {
        data.catchWeightLabelHint = String(input.catchWeightLabelHint).trim().slice(0, 256);
      }
    }

    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus(
        "Send at least one of isCatchWeight, catchWeightLabelHint to update.",
        400,
      );
    }

    await prisma.product.updateMany({
      where: { id: productId, tenantId },
      data,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_outbound_order_cube_hint") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const exists = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      select: { id: true },
    });
    if (!exists) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (input.estimatedCubeCbm === undefined) {
      return toApiErrorResponseFromStatus(
        "estimatedCubeCbm required — send a non-negative number or null to clear.",
        400,
      );
    }
    let est: Prisma.Decimal | null = null;
    if (input.estimatedCubeCbm !== null) {
      const n = Number(input.estimatedCubeCbm);
      if (!Number.isFinite(n) || n < 0) {
        return toApiErrorResponseFromStatus("estimatedCubeCbm must be a non-negative number or null.", 400);
      }
      est = new Prisma.Decimal(String(n));
    }
    await prisma.outboundOrder.updateMany({
      where: { id: outboundOrderId, tenantId },
      data: { estimatedCubeCbm: est },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_outbound_manifest_parcel_ids_bf67") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const parsedIds = parseManifestParcelIdsInput(input.manifestParcelIds);
    if (!parsedIds.ok) {
      return toApiErrorResponseFromStatus(parsedIds.error, 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      select: { id: true, status: true },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (order.status === "CANCELLED") {
      return toApiErrorResponseFromStatus("Cannot set manifest parcels on a cancelled outbound.", 400);
    }
    const jsonValue: Prisma.InputJsonValue =
      parsedIds.ids.length > 0 ? (parsedIds.ids as Prisma.InputJsonValue) : [];
    await prisma.outboundOrder.update({
      where: { id: order.id },
      data: { manifestParcelIds: jsonValue },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_replenishment_rule") {
    const warehouseId = input.warehouseId?.trim();
    const productId = input.productId?.trim();
    const minPickQty = Number(input.minPickQty);
    const maxPickQty = Number(input.maxPickQty);
    const replenishQty = Number(input.replenishQty);
    if (
      !warehouseId ||
      !productId ||
      !Number.isFinite(minPickQty) ||
      !Number.isFinite(maxPickQty) ||
      !Number.isFinite(replenishQty)
    ) {
      return toApiErrorResponseFromStatus("warehouseId, productId, min/max/replenish quantities required.", 400);
    }
    if (minPickQty < 0 || maxPickQty <= 0 || replenishQty <= 0 || minPickQty > maxPickQty) {
      return toApiErrorResponseFromStatus("Invalid replenishment parameters.", 400);
    }

    let priorityForCreate = 0;
    let priorityForUpdate: number | undefined;
    if (input.priority !== undefined) {
      const p = Number(input.priority);
      if (!Number.isFinite(p) || Math.trunc(p) !== p) {
        return toApiErrorResponseFromStatus("priority must be an integer.", 400);
      }
      priorityForCreate = p;
      priorityForUpdate = p;
    }

    let maxTasksPerRunCreate: number | null = null;
    let maxTasksPerRunUpdate: number | null | undefined;
    if (input.maxTasksPerRun !== undefined) {
      if (input.maxTasksPerRun === null) {
        maxTasksPerRunCreate = null;
        maxTasksPerRunUpdate = null;
      } else {
        const cap = Number(input.maxTasksPerRun);
        if (!Number.isFinite(cap) || Math.trunc(cap) !== cap || cap < 0) {
          return toApiErrorResponseFromStatus("maxTasksPerRun must be null or a non-negative integer.", 400);
        }
        maxTasksPerRunCreate = cap;
        maxTasksPerRunUpdate = cap;
      }
    }

    let exceptionQueueCreate = false;
    let exceptionQueueUpdate: boolean | undefined;
    if (input.exceptionQueue !== undefined) {
      if (typeof input.exceptionQueue !== "boolean") {
        return toApiErrorResponseFromStatus("exceptionQueue must be a boolean.", 400);
      }
      exceptionQueueCreate = input.exceptionQueue;
      exceptionQueueUpdate = input.exceptionQueue;
    }

    await prisma.replenishmentRule.upsert({
      where: { warehouseId_productId: { warehouseId, productId } },
      create: {
        tenantId,
        warehouseId,
        productId,
        sourceZoneId: input.sourceZoneId?.trim() || null,
        targetZoneId: input.targetZoneId?.trim() || null,
        minPickQty: minPickQty.toString(),
        maxPickQty: maxPickQty.toString(),
        replenishQty: replenishQty.toString(),
        priority: priorityForCreate,
        maxTasksPerRun: maxTasksPerRunCreate,
        exceptionQueue: exceptionQueueCreate,
      },
      update: {
        sourceZoneId: input.sourceZoneId?.trim() || null,
        targetZoneId: input.targetZoneId?.trim() || null,
        minPickQty: minPickQty.toString(),
        maxPickQty: maxPickQty.toString(),
        replenishQty: replenishQty.toString(),
        isActive: true,
        ...(priorityForUpdate !== undefined ? { priority: priorityForUpdate } : {}),
        ...(maxTasksPerRunUpdate !== undefined ? { maxTasksPerRun: maxTasksPerRunUpdate } : {}),
        ...(exceptionQueueUpdate !== undefined ? { exceptionQueue: exceptionQueueUpdate } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "upsert_wms_demand_forecast_stub") {
    const warehouseId = input.warehouseId?.trim();
    const productId = input.productId?.trim();
    const forecastQty = Number(input.forecastQty);
    if (!warehouseId || !productId || !Number.isFinite(forecastQty) || forecastQty < 0) {
      return toApiErrorResponseFromStatus("warehouseId, productId, forecastQty (>= 0) required.", 400);
    }
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      select: { id: true },
    });
    if (!wh) return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    const prod = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!prod) return toApiErrorResponseFromStatus("Product not found.", 404);
    const weekParsed =
      input.weekStart !== undefined && String(input.weekStart).trim()
        ? parseWeekStartDateInput(String(input.weekStart).trim())
        : { ok: true as const, date: utcIsoWeekMonday() };
    if (!weekParsed.ok) return toApiErrorResponseFromStatus(weekParsed.error, 400);
    let note: string | null | undefined;
    if (input.note !== undefined) {
      note =
        input.note === null || input.note === ""
          ? null
          : String(input.note).trim().slice(0, 500) || null;
    }
    await prisma.wmsDemandForecastStub.upsert({
      where: {
        tenantId_warehouseId_productId_weekStart: {
          tenantId,
          warehouseId,
          productId,
          weekStart: weekParsed.date,
        },
      },
      create: {
        tenantId,
        warehouseId,
        productId,
        weekStart: weekParsed.date,
        forecastQty: forecastQty.toString(),
        note: note ?? null,
        createdById: actorId,
      },
      update: {
        forecastQty: forecastQty.toString(),
        ...(note !== undefined ? { note } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_replenishment_tasks") {
    const warehouseId = input.warehouseId?.trim();
    if (!warehouseId) return toApiErrorResponseFromStatus("warehouseId required.", 400);
    const weekStart = utcIsoWeekMonday();
    const [rules, balances, stubRows] = await Promise.all([
      prisma.replenishmentRule.findMany({
        where: { tenantId, warehouseId, isActive: true },
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId, warehouseId },
        include: { bin: { select: { id: true, zoneId: true, isPickFace: true } } },
      }),
      prisma.wmsDemandForecastStub.findMany({
        where: { tenantId, warehouseId, weekStart },
        select: { productId: true, forecastQty: true },
      }),
    ]);
    const forecastQtyByWarehouseProduct = new Map<string, number>();
    for (const s of stubRows) {
      forecastQtyByWarehouseProduct.set(`${warehouseId}\t${s.productId}`, Number(s.forecastQty));
    }
    const replenSoftMap = await softReservedQtyByBalanceIds(
      prisma,
      tenantId,
      balances.map((b) => b.id),
    );
    const forecastBoostByRuleId = buildForecastPriorityBoostByRuleId(
      rules,
      balances,
      replenSoftMap,
      forecastQtyByWarehouseProduct,
    );
    const sortedRules = sortReplenishmentRulesForBatch(rules, forecastBoostByRuleId);
    const createdPerRule = new Map<string, number>();
    let created = 0;
    await prisma.$transaction(async (tx) => {
      const stdRepl = await laborStandardMinutesSnapshot(tx, tenantId, "REPLENISH");
      const replStdField = stdRepl != null ? { standardMinutes: stdRepl } : {};
      for (const rule of sortedRules) {
        if (rule.maxTasksPerRun != null && rule.maxTasksPerRun <= 0) continue;
        const already = createdPerRule.get(rule.id) ?? 0;
        if (rule.maxTasksPerRun != null && already >= rule.maxTasksPerRun) continue;
        const pickBins = balances.filter(
          (b) =>
            normalizeLotCode(b.lotCode) === FUNGIBLE_LOT_CODE &&
            !b.onHold &&
            b.productId === rule.productId &&
            (rule.targetZoneId ? b.bin.zoneId === rule.targetZoneId : b.bin.isPickFace),
        );
        const pickOnHand = pickBins.reduce((s, b) => {
          const eff =
            Number(b.onHandQty) -
            Number(b.allocatedQty) -
            (replenSoftMap.get(b.id) ?? 0);
          return s + Math.max(0, eff);
        }, 0);
        if (pickOnHand >= Number(rule.minPickQty)) continue;
        const source = balances
          .filter(
            (b) =>
              normalizeLotCode(b.lotCode) === FUNGIBLE_LOT_CODE &&
              !b.onHold &&
              b.productId === rule.productId &&
              (rule.sourceZoneId ? b.bin.zoneId === rule.sourceZoneId : !b.bin.isPickFace) &&
              Number(b.onHandQty) - Number(b.allocatedQty) - (replenSoftMap.get(b.id) ?? 0) > 0,
          )
          .sort((a, b) => {
            const effA =
              Number(a.onHandQty) -
              Number(a.allocatedQty) -
              (replenSoftMap.get(a.id) ?? 0);
            const effB =
              Number(b.onHandQty) -
              Number(b.allocatedQty) -
              (replenSoftMap.get(b.id) ?? 0);
            return effB - effA;
          })[0];
        const target = pickBins.sort((a, b) => {
          const effA =
            Number(a.onHandQty) -
            Number(a.allocatedQty) -
            (replenSoftMap.get(a.id) ?? 0);
          const effB =
            Number(b.onHandQty) -
            Number(b.allocatedQty) -
            (replenSoftMap.get(b.id) ?? 0);
          return effA - effB;
        })[0];
        if (!source || !target) continue;
        const qty = Math.min(
          Number(rule.replenishQty),
          Math.max(
            0,
            Number(source.onHandQty) -
              Number(source.allocatedQty) -
              (replenSoftMap.get(source.id) ?? 0),
          ),
        );
        if (qty <= 0) continue;
        await tx.wmsTask.create({
          data: {
            tenantId,
            warehouseId,
            taskType: "REPLENISH",
            productId: rule.productId,
            binId: target.binId,
            referenceType: "REPLENISH_BIN",
            referenceId: source.binId,
            quantity: qty.toString(),
            note: "System replenishment",
            replenishmentRuleId: rule.id,
            replenishmentPriority: rule.priority + (forecastBoostByRuleId.get(rule.id) ?? 0),
            replenishmentException: rule.exceptionQueue,
            createdById: actorId,
            ...replStdField,
          },
        });
        createdPerRule.set(rule.id, already + 1);
        created += 1;
      }
    });
    return NextResponse.json({ ok: true, created });
  }

  if (action === "create_outbound_order") {
    const warehouseId = input.warehouseId?.trim();
    const lines = Array.isArray(input.lines) ? input.lines : [];
    if (!warehouseId) {
      return toApiErrorResponseFromStatus("warehouseId required.", 400);
    }
    const crmRaw = input.crmAccountId;
    const crmAccountId =
      crmRaw === null || crmRaw === undefined ? null : String(crmRaw).trim() || null;
    if (!crmAccountId) {
      return toApiErrorResponseFromStatus("crmAccountId is required.", 400);
    }
    const gate = await assertOutboundCrmAccountLinkable(tenantId, actorId, crmAccountId);
    if (!gate.ok) {
      return toApiErrorResponseFromStatus(gate.error, gate.status);
    }
    const crmAccount = await prisma.crmAccount.findFirst({
      where: { id: crmAccountId, tenantId },
      select: { id: true, name: true },
    });
    if (!crmAccount) {
      return toApiErrorResponseFromStatus("CRM account not found.", 404);
    }
    let sourceCrmQuoteId: string | null = null;
    const sqRaw = input.sourceCrmQuoteId;
    if (sqRaw !== undefined && sqRaw !== null && String(sqRaw).trim()) {
      const qGate = await assertOutboundSourceQuoteAttachable(
        tenantId,
        actorId,
        String(sqRaw).trim(),
        crmAccountId,
      );
      if (!qGate.ok) {
        return toApiErrorResponseFromStatus(qGate.error, qGate.status);
      }
      sourceCrmQuoteId = String(sqRaw).trim();
    }
    const lineCreates = lines
      .map((l, idx) => ({
        lineNo: idx + 1,
        tenantId,
        productId: String(l.productId ?? "").trim(),
        quantity: Number(l.quantity),
      }))
      .filter((l) => l.productId && l.quantity > 0)
      .map((l, idx) => ({
        lineNo: idx + 1,
        tenantId,
        productId: l.productId,
        quantity: l.quantity.toString(),
      }));
    if (lineCreates.length === 0 && !sourceCrmQuoteId) {
      return toApiErrorResponseFromStatus(
        "Provide at least one line with productId and quantity, or a sourceCrmQuoteId (BF-14 empty shell → explode quote lines).",
        400,
      );
    }
    const outboundNo = `OUT-${Date.now().toString().slice(-8)}`;
    let requestedShipDate: Date | null | undefined;
    if (input.requestedShipDate !== undefined) {
      const raw = input.requestedShipDate;
      if (raw === null || raw === "") {
        requestedShipDate = null;
      } else {
        const d = new Date(String(raw).trim());
        if (Number.isNaN(d.getTime())) {
          return toApiErrorResponseFromStatus("Invalid requestedShipDate.", 400);
        }
        requestedShipDate = d;
      }
    }
    const created = await prisma.outboundOrder.create({
      data: {
        tenantId,
        warehouseId,
        outboundNo,
        crmAccountId,
        ...(sourceCrmQuoteId ? { sourceCrmQuoteId } : {}),
        customerRef: input.customerRef?.trim() || null,
        asnReference:
          input.asnReference !== undefined
            ? input.asnReference?.trim()
              ? input.asnReference.trim()
              : null
            : undefined,
        shipToName: crmAccount.name,
        shipToLine1: null,
        shipToCity: null,
        shipToCountryCode: null,
        ...(input.requestedShipDate !== undefined ? { requestedShipDate } : {}),
        notes: input.note?.trim() || null,
        createdById: actorId,
        ...(lineCreates.length ? { lines: { create: lineCreates } } : {}),
      },
      select: { id: true, outboundNo: true },
    });
    return NextResponse.json({ ok: true, outboundOrder: created });
  }

  if (action === "set_outbound_order_asn_fields") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      select: { id: true, status: true },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (
      order.status === "SHIPPED" ||
      order.status === "CANCELLED" ||
      order.status === "PACKED"
    ) {
      return toApiErrorResponseFromStatus(
        "Cannot edit outbound ASN fields after pack, when shipped, or when cancelled.",
        400,
      );
    }
    const data: Prisma.OutboundOrderUpdateInput = {};
    if (input.asnReference !== undefined) {
      data.asnReference = input.asnReference?.trim() ? input.asnReference.trim() : null;
    }
    if (input.requestedShipDate !== undefined) {
      const raw = input.requestedShipDate;
      if (raw === null || raw === "") {
        data.requestedShipDate = null;
      } else {
        const d = new Date(String(raw).trim());
        if (Number.isNaN(d.getTime())) {
          return toApiErrorResponseFromStatus("Invalid requestedShipDate.", 400);
        }
        data.requestedShipDate = d;
      }
    }
    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus("No outbound ASN fields to update.", 400);
    }
    await prisma.outboundOrder.update({
      where: { id: order.id },
      data,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_outbound_crm_account") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const crmRaw = input.crmAccountId;
    const crmAccountId =
      crmRaw === null || crmRaw === undefined ? null : String(crmRaw).trim() || null;
    if (crmAccountId) {
      const gate = await assertOutboundCrmAccountLinkable(tenantId, actorId, crmAccountId);
      if (!gate.ok) {
        return toApiErrorResponseFromStatus(gate.error, gate.status);
      }
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      select: { id: true, status: true, sourceCrmQuoteId: true },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (
      order.status === "SHIPPED" ||
      order.status === "CANCELLED" ||
      order.status === "PACKED"
    ) {
      return toApiErrorResponseFromStatus("Cannot change CRM link after pack, on shipped, or on cancelled orders.", 400);
    }
    let clearSourceQuote = false;
    if (!crmAccountId) {
      clearSourceQuote = true;
    } else if (order.sourceCrmQuoteId) {
      const qRow = await prisma.crmQuote.findFirst({
        where: { id: order.sourceCrmQuoteId, tenantId },
        select: { accountId: true },
      });
      if (!qRow || qRow.accountId !== crmAccountId) {
        clearSourceQuote = true;
      }
    }
    await prisma.outboundOrder.update({
      where: { id: order.id },
      data: {
        crmAccountId,
        ...(clearSourceQuote ? { sourceCrmQuoteId: null } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "explode_crm_quote_to_outbound") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const confirm = input.quoteExplosionConfirm === true;
    const viewScope = await loadWmsViewReadScope(tenantId, actorId);
    const result = await explodeCrmQuoteToOutbound({
      tenantId,
      actorId,
      outboundOrderId,
      outboundScope: viewScope.outboundOrder,
      productScope: viewScope.inventoryProduct,
      confirm,
    });
    if (!result.ok) {
      return toApiErrorResponseFromStatus(result.error, result.status);
    }
    return NextResponse.json({
      ok: true,
      preview: result.preview,
      applied: result.applied,
      ...(typeof result.createdLineCount === "number"
        ? { createdLineCount: result.createdLineCount }
        : {}),
    });
  }

  if (action === "release_outbound_order") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    await prisma.outboundOrder.updateMany({
      where: { id: outboundOrderId, tenantId, status: "DRAFT" },
      data: { status: "RELEASED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_putaway_task") {
    const shipmentItemId = input.shipmentItemId?.trim();
    const warehouseId = input.warehouseId?.trim();
    const qty = Number(input.quantity);
    if (!shipmentItemId || !warehouseId || !Number.isFinite(qty) || qty <= 0) {
      return toApiErrorResponseFromStatus("shipmentItemId, warehouseId, quantity required.", 400);
    }
    const item = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipment: { order: { tenantId } } },
      include: {
        shipment: { select: { id: true, orderId: true, wmsInboundSubtype: true } },
        orderItem: { select: { productId: true } },
      },
    });
    if (!item?.orderItem.productId) {
      return toApiErrorResponseFromStatus("Invalid shipment line.", 400);
    }
    const putawayBlock = customerReturnPutawayBlockedReason(
      item.shipment.wmsInboundSubtype,
      item.wmsReturnDisposition,
    );
    if (putawayBlock) {
      return toApiErrorResponseFromStatus(putawayBlock, 400);
    }
    const stdPut = await laborStandardMinutesSnapshot(prisma, tenantId, "PUTAWAY");
    const putStdField = stdPut != null ? { standardMinutes: stdPut } : {};
    await prisma.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PUTAWAY",
        shipmentId: item.shipment.id,
        orderId: item.shipment.orderId,
        productId: item.orderItem.productId,
        binId: input.binId?.trim() || null,
        referenceType: "SHIPMENT_ITEM",
        referenceId: item.id,
        quantity: qty.toString(),
        note: input.note?.trim() || null,
        createdById: actorId,
        ...putStdField,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_putaway_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) return toApiErrorResponseFromStatus("taskId required.", 400);
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "PUTAWAY" },
      select: {
        id: true,
        warehouseId: true,
        productId: true,
        quantity: true,
        referenceId: true,
        binId: true,
        referenceType: true,
      },
    });
    if (!task || !task.productId || !task.referenceId) {
      return toApiErrorResponseFromStatus("Putaway task not found.", 404);
    }
    const productId = task.productId;
    const referenceId = task.referenceId;
    const targetBinId = input.binId?.trim() || task.binId;
    if (!targetBinId) return toApiErrorResponseFromStatus("binId required.", 400);
    const targetLot = normalizeLotCode(input.lotCode);

    let putawayReturnSubtype: WmsInboundSubtype = "STANDARD";
    let putawayReturnDisposition: WmsReturnLineDisposition | null = null;
    if (task.referenceType === "SHIPMENT_ITEM") {
      const si = await prisma.shipmentItem.findFirst({
        where: { id: referenceId, shipment: { order: { tenantId } } },
        select: {
          wmsReturnDisposition: true,
          shipment: { select: { wmsInboundSubtype: true } },
        },
      });
      if (si) {
        putawayReturnSubtype = si.shipment.wmsInboundSubtype;
        putawayReturnDisposition = si.wmsReturnDisposition;
      }
    }
    const putawayBlock = customerReturnPutawayBlockedReason(putawayReturnSubtype, putawayReturnDisposition);
    if (putawayBlock) {
      return toApiErrorResponseFromStatus(putawayBlock, 400);
    }
    const applyQcHold = customerReturnApplyQuarantineHold(putawayReturnSubtype, putawayReturnDisposition);

    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.update({
        where: { id: task.id },
        data: { status: "DONE", binId: targetBinId, completedAt: new Date(), completedById: actorId },
      });
      await tx.inventoryBalance.upsert({
        where: {
          warehouseId_binId_productId_lotCode: {
            warehouseId: task.warehouseId,
            binId: targetBinId,
            productId,
            lotCode: targetLot,
          },
        },
        create: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId,
          lotCode: targetLot,
          onHandQty: task.quantity,
          ...(applyQcHold
            ? {
                onHold: true,
                holdReason: "Customer return — quarantine (BF-41)",
                holdReasonCode: "CUSTOMER_RETURN",
                holdAppliedAt: new Date(),
                holdAppliedById: actorId,
                holdReleaseGrant: null,
              }
            : {}),
        },
        update: {
          onHandQty: { increment: task.quantity },
          ...(applyQcHold
            ? {
                onHold: true,
                holdReason: "Customer return — quarantine (BF-41)",
                holdReasonCode: "CUSTOMER_RETURN",
                holdAppliedAt: new Date(),
                holdAppliedById: actorId,
                holdReleaseGrant: null,
              }
            : {}),
        },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId,
          movementType: "PUTAWAY",
          quantity: task.quantity,
          referenceType: "SHIPMENT_ITEM",
          referenceId,
          createdById: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_pick_task") {
    const outboundLineId = input.outboundLineId?.trim();
    const warehouseId = input.warehouseId?.trim();
    const productId = input.productId?.trim();
    const binId = input.binId?.trim();
    const qty = Number(input.quantity);
    if (!outboundLineId || !warehouseId || !productId || !binId || !Number.isFinite(qty) || qty <= 0) {
      return toApiErrorResponseFromStatus("outboundLineId, warehouseId, productId, binId, quantity required.", 400);
    }
    const item = await prisma.outboundOrderLine.findFirst({
      where: { id: outboundLineId, tenantId },
      select: { id: true, outboundOrderId: true },
    });
    if (!item) return toApiErrorResponseFromStatus("Outbound line not found.", 404);
    const taskLot = normalizeLotCode(input.lotCode);
    const bal = await prisma.inventoryBalance.findFirst({
      where: { tenantId, warehouseId, binId, productId, lotCode: taskLot },
      select: { id: true, onHandQty: true, allocatedQty: true, onHold: true },
    });
    if (!bal) {
      return toApiErrorResponseFromStatus("No inventory balance for bin/product/lot.", 404);
    }
    if (bal.onHold) {
      return toApiErrorResponseFromStatus("Cannot allocate pick: bin/product is on hold.", 400);
    }
    const softPickMap = await softReservedQtyByBalanceIds(prisma, tenantId, [bal.id]);
    const softPick = softPickMap.get(bal.id) ?? 0;
    const effectivePick = Number(bal.onHandQty) - Number(bal.allocatedQty) - softPick;
    if (qty > effectivePick) {
      return toApiErrorResponseFromStatus(
        `Insufficient ATP for pick (effective available ${effectivePick}).`,
        400,
      );
    }
    await prisma.$transaction(async (tx) => {
      const stdPickOne = await laborStandardMinutesSnapshot(tx, tenantId, "PICK");
      const pickStdOne = stdPickOne != null ? { standardMinutes: stdPickOne } : {};
      await tx.wmsTask.create({
        data: {
          tenantId,
          warehouseId,
          taskType: "PICK",
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: item.id,
          productId,
          binId,
          lotCode: taskLot,
          quantity: qty.toString(),
          note: input.note?.trim() || null,
          createdById: actorId,
          ...pickStdOne,
        },
      });
      await tx.inventoryBalance.updateMany({
        where: { tenantId, warehouseId, binId, productId, lotCode: taskLot },
        data: { allocatedQty: { increment: qty.toString() } },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_pick_wave") {
    const warehouseId = input.warehouseId?.trim();
    if (!warehouseId) {
      return toApiErrorResponseFromStatus("warehouseId required.", 400);
    }
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      select: { pickAllocationStrategy: true, pickWaveCartonUnits: true },
    });
    if (!warehouse) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }
    if (warehouse.pickAllocationStrategy === "MANUAL_ONLY") {
      return toApiErrorResponseFromStatus(
        "Automated pick waves are disabled for this warehouse (MANUAL_ONLY strategy). Create pick tasks explicitly instead.",
        400,
      );
    }
    const allocationStrategy = warehouse.pickAllocationStrategy;
    const cartonCapRaw = warehouse.pickWaveCartonUnits;
    const cartonCap =
      cartonCapRaw != null && Number(cartonCapRaw) > 0 ? Number(cartonCapRaw) : null;

    if (
      allocationStrategy === "GREEDY_RESERVE_PICK_FACE" &&
      process.env.WMS_DISABLE_BF23_STRATEGY === "1"
    ) {
      return toApiErrorResponseFromStatus(
        "GREEDY_RESERVE_PICK_FACE is disabled for this deployment (WMS_DISABLE_BF23_STRATEGY=1). Pick another strategy or unset the env flag.",
        400,
      );
    }

    if (
      (allocationStrategy === "GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE" ||
        allocationStrategy === "GREEDY_RESERVE_PICK_FACE_CUBE_AWARE") &&
      process.env.WMS_DISABLE_BF33_CUBE_AWARE === "1"
    ) {
      return toApiErrorResponseFromStatus(
        "Cube-aware greedy strategies are disabled for this deployment (WMS_DISABLE_BF33_CUBE_AWARE=1). Pick another strategy or unset the env flag.",
        400,
      );
    }

    const bf34SolverEnabled = process.env.WMS_ENABLE_BF34_SOLVER === "1";
    if (
      (allocationStrategy === "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES" ||
        allocationStrategy === "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE") &&
      !bf34SolverEnabled
    ) {
      return toApiErrorResponseFromStatus(
        "Solver prototype strategies require WMS_ENABLE_BF34_SOLVER=1 on this deployment.",
        400,
      );
    }

    const rawPickMode = input.pickWavePickMode ?? input.pickMode;
    const pickMode: WmsWavePickMode =
      typeof rawPickMode === "string" && rawPickMode.trim().toUpperCase() === "BATCH"
        ? "BATCH"
        : "SINGLE_ORDER";
    if (
      pickMode === "BATCH" &&
      (allocationStrategy === "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES" ||
        allocationStrategy === "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE")
    ) {
      return toApiErrorResponseFromStatus(
        "Batch pick waves are not supported with solver prototype allocation strategies. Use pickMode SINGLE_ORDER.",
        400,
      );
    }

    const openLines = await prisma.outboundOrderLine.findMany({
      where: {
        tenantId,
        outboundOrder: { warehouseId, status: { in: ["RELEASED", "PICKING"] } },
      },
      orderBy: { outboundOrder: { createdAt: "desc" } },
      take: 300,
      include: {
        outboundOrder: { select: { id: true } },
        product: {
          select: {
            cartonLengthMm: true,
            cartonWidthMm: true,
            cartonHeightMm: true,
            cartonUnitsPerMasterCarton: true,
          },
        },
      },
    });
    const pickedMovements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: { in: openLines.map((r) => r.id) },
        movementType: "PICK",
      },
      select: { referenceId: true, quantity: true },
    });
    const pickedMap = new Map<string, number>();
    for (const mv of pickedMovements) {
      if (!mv.referenceId) continue;
      pickedMap.set(
        mv.referenceId,
        (pickedMap.get(mv.referenceId) ?? 0) + Number(mv.quantity),
      );
    }
    const byProduct = new Map<string, WavePickSlot[]>();

    if (allocationStrategy === "FEFO_BY_LOT_EXPIRY") {
      const balancesAll = await prisma.inventoryBalance.findMany({
        where: { tenantId, warehouseId },
        include: { bin: { select: { id: true, code: true, isPickFace: true, isCrossDockStaging: true, capacityCubeCubicMm: true } } },
      });
      const softWaveMap = await softReservedQtyByBalanceIds(
        prisma,
        tenantId,
        balancesAll.map((b) => b.id),
      );
      const productIds = [...new Set(balancesAll.map((b) => b.productId))];
      const batchRows =
        productIds.length === 0
          ? []
          : await prisma.wmsLotBatch.findMany({
              where: { tenantId, productId: { in: productIds } },
              select: { productId: true, lotCode: true, expiryDate: true },
            });
      const expiryMsByProductLot = new Map<string, number>();
      for (const br of batchRows) {
        const lc = normalizeLotCode(br.lotCode);
        const key = `${br.productId}\t${lc}`;
        const ms = br.expiryDate ? br.expiryDate.getTime() : Number.MAX_SAFE_INTEGER - 1;
        expiryMsByProductLot.set(key, ms);
      }
      for (const row of balancesAll) {
        if (row.onHold) continue;
        const softW = softWaveMap.get(row.id) ?? 0;
        const available =
          Number(row.onHandQty) - Number(row.allocatedQty) - softW;
        if (available <= 0) continue;
        const lc = normalizeLotCode(row.lotCode);
        const expirySortMs =
          lc === FUNGIBLE_LOT_CODE
            ? Number.MAX_SAFE_INTEGER
            : (expiryMsByProductLot.get(`${row.productId}\t${lc}`) ?? Number.MAX_SAFE_INTEGER - 1);
        const list = byProduct.get(row.productId) ?? [];
        list.push({
          binId: row.binId,
          binCode: row.bin.code,
          available,
          lotCode: lc,
          expirySortMs,
          isPickFace: row.bin.isPickFace,
          isCrossDockStaging: row.bin.isCrossDockStaging,
          binCapacityCubeMm3: row.bin.capacityCubeCubicMm ?? null,
        });
        byProduct.set(row.productId, list);
      }
    } else {
      const balances = await prisma.inventoryBalance.findMany({
        where: { tenantId, warehouseId, lotCode: FUNGIBLE_LOT_CODE },
        include: { bin: { select: { id: true, code: true, isPickFace: true, isCrossDockStaging: true, capacityCubeCubicMm: true } } },
      });
      const softWaveMap = await softReservedQtyByBalanceIds(
        prisma,
        tenantId,
        balances.map((b) => b.id),
      );
      for (const row of balances) {
        if (row.onHold) continue;
        const softW = softWaveMap.get(row.id) ?? 0;
        const available =
          Number(row.onHandQty) - Number(row.allocatedQty) - softW;
        if (available <= 0) continue;
        const list = byProduct.get(row.productId) ?? [];
        list.push({
          binId: row.binId,
          binCode: row.bin.code,
          available,
          lotCode: FUNGIBLE_LOT_CODE,
          expirySortMs: 0,
          isPickFace: row.bin.isPickFace,
          isCrossDockStaging: row.bin.isCrossDockStaging,
          binCapacityCubeMm3: row.bin.capacityCubeCubicMm ?? null,
        });
        byProduct.set(row.productId, list);
      }
    }

    for (const [productId, list] of byProduct) {
      if (
        allocationStrategy === "GREEDY_MIN_BIN_TOUCHES" ||
        allocationStrategy === "GREEDY_RESERVE_PICK_FACE" ||
        allocationStrategy === "GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE" ||
        allocationStrategy === "GREEDY_RESERVE_PICK_FACE_CUBE_AWARE" ||
        allocationStrategy === "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES" ||
        allocationStrategy === "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE"
      ) {
        list.sort(
          (a, b) =>
            crossDockStagingFirstCmp(a, b) ||
            a.binCode.localeCompare(b.binCode) ||
            a.binId.localeCompare(b.binId),
        );
        byProduct.set(productId, list);
      } else {
        byProduct.set(productId, orderPickSlotsForWave(allocationStrategy, list));
      }
    }

    const waveNo = await nextWaveNo(tenantId);
    const waveNote = [
      `Wave allocation (${allocationStrategy})`,
      cartonCap != null ? `cartonCap=${cartonCap}` : null,
      pickMode === "BATCH" ? `pickMode=BATCH` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const result = await prisma.$transaction(async (tx) => {
      const wave = await tx.wmsWave.create({
        data: {
          tenantId,
          warehouseId,
          waveNo,
          createdById: actorId,
          pickMode,
        },
      });
      const stdPickWave = await laborStandardMinutesSnapshot(tx, tenantId, "PICK");
      const pickStdWave = stdPickWave != null ? { standardMinutes: stdPickWave } : {};
      let createdTasks = 0;
      if (pickMode === "SINGLE_ORDER") {
        for (const item of openLines) {
          if (!item.productId) continue;
          const alreadyPicked = pickedMap.get(item.id) ?? 0;
          let remaining = Math.max(0, Number(item.quantity) - Number(item.pickedQty) - alreadyPicked);
          if (remaining <= 0) continue;
          const binsRaw = byProduct.get(item.productId) ?? [];
          const productHints = item.product;
          let binsForProduct: WavePickSlot[];
          if (allocationStrategy === "GREEDY_RESERVE_PICK_FACE_CUBE_AWARE") {
            binsForProduct = orderPickSlotsMinBinTouchesReservePickFaceCubeAware(binsRaw, remaining, productHints);
          } else if (allocationStrategy === "GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE") {
            binsForProduct = orderPickSlotsMinBinTouchesCubeAware(binsRaw, remaining, productHints);
          } else if (allocationStrategy === "GREEDY_RESERVE_PICK_FACE") {
            binsForProduct = orderPickSlotsMinBinTouchesReservePickFace(binsRaw, remaining);
          } else if (allocationStrategy === "GREEDY_MIN_BIN_TOUCHES") {
            binsForProduct = orderPickSlotsMinBinTouches(binsRaw, remaining);
          } else if (allocationStrategy === "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE") {
            binsForProduct = orderPickSlotsSolverPrototype(binsRaw, remaining, "BF23_RESERVE_PICK_FACE");
          } else if (allocationStrategy === "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES") {
            binsForProduct = orderPickSlotsSolverPrototype(binsRaw, remaining, "BF15");
          } else {
            binsForProduct = binsRaw;
          }
          for (const slot of binsForProduct) {
            if (remaining <= 0) break;
            let take = Math.min(remaining, slot.available);
            if (cartonCap != null) take = Math.min(take, cartonCap);
            if (take <= 0) continue;
            await tx.wmsTask.create({
              data: {
                tenantId,
                warehouseId,
                taskType: "PICK",
                waveId: wave.id,
                productId: item.productId,
                binId: slot.binId,
                lotCode: slot.lotCode,
                referenceType: "OUTBOUND_LINE_PICK",
                referenceId: item.id,
                quantity: take.toString(),
                note: waveNote,
                createdById: actorId,
                ...pickStdWave,
              },
            });
            await tx.inventoryBalance.updateMany({
              where: {
                tenantId,
                warehouseId,
                binId: slot.binId,
                productId: item.productId,
                lotCode: slot.lotCode,
              },
              data: { allocatedQty: { increment: take.toString() } },
            });
            slot.available -= take;
            remaining -= take;
            createdTasks += 1;
          }
        }
      } else {
        const lineRemaining = new Map<string, number>();
        for (const item of openLines) {
          if (!item.productId) continue;
          const alreadyPicked = pickedMap.get(item.id) ?? 0;
          const rem = Math.max(0, Number(item.quantity) - Number(item.pickedQty) - alreadyPicked);
          if (rem > 0) lineRemaining.set(item.id, rem);
        }
        const mutablePools = cloneWavePickSlotPools(byProduct);
        const visitBins = batchPickVisitBinOrder(mutablePools);
        for (const binId of visitBins) {
          for (const item of openLines) {
            if (!item.productId) continue;
            const rem = lineRemaining.get(item.id) ?? 0;
            if (rem <= 0) continue;
            const slots = mutablePools.get(item.productId);
            if (!slots) continue;
            const slot = slots.find((s) => s.binId === binId && s.available > 0);
            if (!slot) continue;
            let take = Math.min(rem, slot.available);
            if (cartonCap != null) take = Math.min(take, cartonCap);
            if (take <= 0) continue;
            await tx.wmsTask.create({
              data: {
                tenantId,
                warehouseId,
                taskType: "PICK",
                waveId: wave.id,
                productId: item.productId,
                binId: slot.binId,
                lotCode: slot.lotCode,
                referenceType: "OUTBOUND_LINE_PICK",
                referenceId: item.id,
                quantity: take.toString(),
                note: waveNote,
                batchGroupKey: binId,
                createdById: actorId,
                ...pickStdWave,
              },
            });
            await tx.inventoryBalance.updateMany({
              where: {
                tenantId,
                warehouseId,
                binId: slot.binId,
                productId: item.productId,
                lotCode: slot.lotCode,
              },
              data: { allocatedQty: { increment: take.toString() } },
            });
            slot.available -= take;
            lineRemaining.set(item.id, rem - take);
            createdTasks += 1;
          }
        }
      }
      return { waveId: wave.id, waveNo: wave.waveNo, createdTasks };
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "release_wave") {
    const waveId = input.waveId?.trim() || "";
    if (!waveId) return toApiErrorResponseFromStatus("waveId required.", 400);
    await prisma.wmsWave.updateMany({
      where: { id: waveId, tenantId, status: "OPEN" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_wave") {
    const waveId = input.waveId?.trim() || "";
    if (!waveId) return toApiErrorResponseFromStatus("waveId required.", 400);
    await prisma.$transaction(async (tx) => {
      const tasks = await tx.wmsTask.findMany({
        where: {
          tenantId,
          waveId,
          taskType: "PICK",
          status: "OPEN",
        },
        select: {
          id: true,
          warehouseId: true,
          productId: true,
          binId: true,
          quantity: true,
          referenceId: true,
          lotCode: true,
        },
      });
      for (const task of tasks) {
        if (!task.productId || !task.binId) continue;
        const bal = await tx.inventoryBalance.findFirst({
          where: {
            tenantId,
            warehouseId: task.warehouseId,
            productId: task.productId,
            binId: task.binId,
            lotCode: task.lotCode,
          },
          select: { id: true, onHandQty: true, allocatedQty: true, onHold: true },
        });
        if (!bal || bal.onHold || Number(bal.onHandQty) < Number(task.quantity)) continue;
        await tx.wmsTask.update({
          where: { id: task.id },
          data: { status: "DONE", completedAt: new Date(), completedById: actorId },
        });
        await tx.inventoryBalance.update({
          where: { id: bal.id },
          data: {
            onHandQty: { decrement: task.quantity },
            allocatedQty: { decrement: task.quantity },
          },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            warehouseId: task.warehouseId,
            binId: task.binId,
            productId: task.productId,
            movementType: "PICK",
            quantity: task.quantity,
            referenceType: "OUTBOUND_LINE_PICK",
            referenceId: task.referenceId,
            createdById: actorId,
            note: "Wave completed",
          },
        });
        if (task.referenceId) {
          await tx.outboundOrderLine.updateMany({
            where: { id: task.referenceId, tenantId },
            data: { pickedQty: { increment: task.quantity } },
          });
        }
      }
      await tx.wmsWave.updateMany({
        where: { id: waveId, tenantId },
        data: { status: "DONE", completedAt: new Date() },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_pick_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) return toApiErrorResponseFromStatus("taskId required.", 400);
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "PICK" },
      select: { id: true, warehouseId: true, productId: true, binId: true, quantity: true, referenceId: true, lotCode: true },
    });
    if (!task || !task.productId || !task.binId) {
      return toApiErrorResponseFromStatus("Pick task not found.", 404);
    }
    const productId = task.productId;
    const binId = task.binId;
    const balPre = await prisma.inventoryBalance.findFirst({
      where: {
        tenantId,
        warehouseId: task.warehouseId,
        binId,
        productId,
        lotCode: task.lotCode,
      },
      select: { id: true, onHandQty: true, allocatedQty: true, onHold: true },
    });
    if (!balPre) {
      return toApiErrorResponseFromStatus("No inventory balance in selected bin.", 400);
    }
    if (balPre.onHold) {
      return toApiErrorResponseFromStatus("Cannot complete pick: bin/product is on hold. Clear the hold first.", 400);
    }
    if (Number(balPre.onHandQty) < Number(task.quantity)) {
      return toApiErrorResponseFromStatus("Insufficient stock for pick.", 400);
    }
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.update({
        where: { id: task.id },
        data: { status: "DONE", completedAt: new Date(), completedById: actorId },
      });
      await tx.inventoryBalance.update({
        where: { id: balPre.id },
        data: {
          onHandQty: { decrement: task.quantity },
          allocatedQty: { decrement: task.quantity },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: task.warehouseId,
          binId,
          productId,
          movementType: "PICK",
          quantity: task.quantity,
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: task.referenceId,
          createdById: actorId,
        },
      });
      if (task.referenceId) {
        await tx.outboundOrderLine.updateMany({
          where: { id: task.referenceId, tenantId },
          data: { pickedQty: { increment: task.quantity } },
        });
      }
    });
    await syncOutboundOrderStatusAfterPick(tenantId, task.referenceId);
    return NextResponse.json({ ok: true });
  }

  if (action === "upsert_outbound_logistics_unit_bf43") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      select: { id: true, status: true },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (order.status === "SHIPPED" || order.status === "CANCELLED") {
      return toApiErrorResponseFromStatus(
        "Cannot edit logistics units on SHIPPED or CANCELLED outbound orders.",
        400,
      );
    }
    const scanRaw = input.logisticsUnitScanCode?.trim();
    if (!scanRaw) {
      return toApiErrorResponseFromStatus("logisticsUnitScanCode required.", 400);
    }
    const normalizedScan = normalizeOutboundLogisticsUnitScanCode(scanRaw);
    if (!normalizedScan) {
      return toApiErrorResponseFromStatus("logisticsUnitScanCode invalid after normalization.", 400);
    }

    const kindRaw = String(input.logisticsUnitKind ?? "UNKNOWN").trim().toUpperCase();
    if (!BF43_LOGISTICS_UNIT_KINDS.has(kindRaw)) {
      return toApiErrorResponseFromStatus("logisticsUnitKind invalid.", 400);
    }
    const kind = kindRaw as WmsOutboundLogisticsUnitKind;

    const parentUnitIdRaw = input.logisticsUnitParentId?.trim();
    const parentUnitId = parentUnitIdRaw ? parentUnitIdRaw : null;

    const lineIdRaw = input.logisticsOutboundOrderLineId?.trim();
    const outboundOrderLineId = lineIdRaw ? lineIdRaw : null;

    let containedQty: Prisma.Decimal | null = null;
    if (outboundOrderLineId) {
      const cqRaw = input.logisticsContainedQty;
      const n =
        cqRaw === undefined || cqRaw === null || cqRaw === "" ? NaN : Number(cqRaw);
      if (!Number.isFinite(n) || n <= 0) {
        return toApiErrorResponseFromStatus(
          "logisticsContainedQty must be a positive number when logisticsOutboundOrderLineId is set.",
          400,
        );
      }
      containedQty = new Prisma.Decimal(String(n));
    } else if (
      input.logisticsContainedQty !== undefined &&
      input.logisticsContainedQty !== null &&
      String(input.logisticsContainedQty).trim() !== ""
    ) {
      return toApiErrorResponseFromStatus(
        "logisticsContainedQty must be omitted when no logisticsOutboundOrderLineId.",
        400,
      );
    }

    const unitId = input.logisticsUnitId?.trim();

    try {
      await prisma.$transaction(async (tx) => {
        if (parentUnitId) {
          const parent = await tx.wmsOutboundLogisticsUnit.findFirst({
            where: { id: parentUnitId, tenantId, outboundOrderId },
            select: { id: true },
          });
          if (!parent) {
            throw Object.assign(new Error("bad_parent"), { status: 400 });
          }
        }

        if (outboundOrderLineId) {
          const line = await tx.outboundOrderLine.findFirst({
            where: { id: outboundOrderLineId, tenantId, outboundOrderId },
            select: { id: true },
          });
          if (!line) {
            throw Object.assign(new Error("bad_line"), { status: 400 });
          }
        }

        if (unitId) {
          const existing = await tx.wmsOutboundLogisticsUnit.findFirst({
            where: { id: unitId, tenantId, outboundOrderId },
          });
          if (!existing) {
            throw Object.assign(new Error("not_found"), { status: 404 });
          }
          if (parentUnitId === unitId) {
            throw Object.assign(new Error("self_parent"), { status: 400 });
          }
          await assertOutboundLuParentNoCycle(tx, unitId, parentUnitId);

          if (normalizedScan !== existing.scanCode) {
            const clash = await tx.wmsOutboundLogisticsUnit.findFirst({
              where: {
                tenantId,
                outboundOrderId,
                scanCode: normalizedScan,
                NOT: { id: unitId },
              },
              select: { id: true },
            });
            if (clash) {
              throw Object.assign(new Error("dup_scan"), { status: 400 });
            }
          }

          await tx.wmsOutboundLogisticsUnit.update({
            where: { id: unitId },
            data: {
              scanCode: normalizedScan,
              kind,
              parentUnitId,
              outboundOrderLineId,
              containedQty,
            },
          });
        } else {
          await assertOutboundLuParentNoCycle(tx, undefined, parentUnitId);
          await tx.wmsOutboundLogisticsUnit.upsert({
            where: {
              tenantId_outboundOrderId_scanCode: {
                tenantId,
                outboundOrderId,
                scanCode: normalizedScan,
              },
            },
            create: {
              tenantId,
              outboundOrderId,
              scanCode: normalizedScan,
              kind,
              parentUnitId,
              outboundOrderLineId,
              containedQty,
            },
            update: {
              kind,
              parentUnitId,
              outboundOrderLineId,
              containedQty,
            },
          });
        }

        await tx.ctAuditLog.create({
          data: {
            tenantId,
            entityType: "OUTBOUND_ORDER",
            entityId: outboundOrderId,
            action: "bf43_outbound_logistics_unit_upserted",
            payload: {
              logisticsUnitId: unitId ?? null,
              scanCode: normalizedScan,
              kind: kindRaw,
            },
            actorUserId: actorId,
          },
        });
      });
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err?.status === 400 && err.message === "bad_parent") {
        return toApiErrorResponseFromStatus("logisticsUnitParentId not found on this outbound.", 400);
      }
      if (err?.status === 400 && err.message === "bad_line") {
        return toApiErrorResponseFromStatus(
          "logisticsOutboundOrderLineId not found on this outbound.",
          400,
        );
      }
      if (err?.status === 404 && err.message === "not_found") {
        return toApiErrorResponseFromStatus("logisticsUnitId not found.", 404);
      }
      if (err?.status === 400 && err.message === "self_parent") {
        return toApiErrorResponseFromStatus("logisticsUnitParentId cannot equal logisticsUnitId.", 400);
      }
      if (err?.status === 400 && err.message === "dup_scan") {
        return toApiErrorResponseFromStatus("Another logistics unit already uses this scan code.", 400);
      }
      if ((e as Error)?.message === "parent_cycle") {
        return toApiErrorResponseFromStatus("Parent assignment would create a cycle.", 400);
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "delete_outbound_logistics_unit_bf43") {
    const outboundOrderId = input.outboundOrderId?.trim();
    const logisticsUnitId = input.logisticsUnitId?.trim();
    if (!outboundOrderId || !logisticsUnitId) {
      return toApiErrorResponseFromStatus("outboundOrderId and logisticsUnitId required.", 400);
    }
    const row = await prisma.wmsOutboundLogisticsUnit.findFirst({
      where: { id: logisticsUnitId, tenantId, outboundOrderId },
      select: {
        id: true,
        outboundOrder: { select: { status: true } },
      },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Logistics unit not found.", 404);
    }
    if (row.outboundOrder.status === "SHIPPED" || row.outboundOrder.status === "CANCELLED") {
      return toApiErrorResponseFromStatus(
        "Cannot delete logistics units on SHIPPED or CANCELLED outbound orders.",
        400,
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.wmsOutboundLogisticsUnit.delete({ where: { id: logisticsUnitId } });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "OUTBOUND_ORDER",
          entityId: outboundOrderId,
          action: "bf43_outbound_logistics_unit_deleted",
          payload: { logisticsUnitId },
          actorUserId: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "validate_outbound_lu_hierarchy") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      select: { id: true },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    const luRows = await prisma.wmsOutboundLogisticsUnit.findMany({
      where: { tenantId, outboundOrderId },
      select: {
        id: true,
        parentUnitId: true,
        scanCode: true,
        outboundOrderLineId: true,
        containedQty: true,
      },
    });
    const v = validateOutboundLuHierarchy(
      luRows.map((r) => ({
        id: r.id,
        parentUnitId: r.parentUnitId,
        scanCode: r.scanCode,
        outboundOrderLineId: r.outboundOrderLineId,
        containedQty: r.containedQty != null ? r.containedQty.toString() : null,
      })),
    );
    return NextResponse.json({
      ok: v.ok,
      errors: v.errors,
      warnings: v.warnings,
      ssccFailures: v.ssccFailures,
      unitCount: luRows.length,
    });
  }

  if (action === "validate_outbound_pack_scan") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { lines: { include: { product: true } } },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (
      order.status !== "RELEASED" &&
      order.status !== "PICKING" &&
      order.status !== "PACKED"
    ) {
      return toApiErrorResponseFromStatus(
        "Pack scan validation applies when the order is RELEASED, PICKING, or PACKED.",
        400,
      );
    }
    const tokens = parsePackScanTokenArray(input.packScanTokens);
    const plan =
      order.status === "PACKED"
        ? buildOutboundPackScanPlan(
            order.lines.map((l) => ({ pickedQty: Number(l.packedQty), product: l.product })),
          )
        : buildOutboundPackScanPlan(
            order.lines.map((l) => ({ pickedQty: Number(l.pickedQty), product: l.product })),
          );
    const flat = flattenPackScanExpectations(plan);
    const result = await verifyOutboundPackScanResolved(tenantId, outboundOrderId, flat, tokens);
    return NextResponse.json({
      ok: result.ok,
      missing: result.missing,
      unexpected: result.unexpected,
      plan,
      expectedTotal: flat.length,
      scannedTotal: tokens.length,
    });
  }

  if (action === "request_demo_carrier_label") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (order.status === "CANCELLED") {
      return toApiErrorResponseFromStatus("Cancelled outbound cannot request labels.", 400);
    }
    const prefixRaw = process.env.NEXT_PUBLIC_WMS_SSCC_COMPANY_PREFIX?.trim() ?? "";
    const sscc =
      prefixRaw && /^[0-9]{7,10}$/.test(prefixRaw)
        ? buildSscc18DemoFromOutbound(order.id, prefixRaw)
        : null;
    const purchaseInput = carrierLabelPurchaseInputForOutbound(order, sscc);
    const demo = purchaseDemoParcelCarrierLabel(purchaseInput);
    return NextResponse.json({ ok: true, ...demo });
  }

  if (action === "purchase_carrier_label") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (
      order.status !== "RELEASED" &&
      order.status !== "PICKING" &&
      order.status !== "PACKED"
    ) {
      return toApiErrorResponseFromStatus(
        "Carrier label purchase applies when the order is RELEASED, PICKING, or PACKED.",
        400,
      );
    }
    const prefixRaw = process.env.NEXT_PUBLIC_WMS_SSCC_COMPANY_PREFIX?.trim() ?? "";
    const sscc =
      prefixRaw && /^[0-9]{7,10}$/.test(prefixRaw)
        ? buildSscc18DemoFromOutbound(order.id, prefixRaw)
        : null;
    const purchaseInput = carrierLabelPurchaseInputForOutbound(order, sscc);
    let result;
    try {
      result = await purchaseCarrierLabel(purchaseInput);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Carrier label purchase failed.";
      return toApiErrorResponseFromStatus(msg, 502);
    }

    await prisma.$transaction(async (tx) => {
      await tx.outboundOrder.update({
        where: { id: order.id },
        data: {
          carrierTrackingNo: result.trackingNo,
          carrierLabelAdapterId: result.adapterId,
          carrierLabelPurchasedAt: new Date(),
        },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "OUTBOUND_ORDER",
          entityId: order.id,
          action: "outbound_carrier_label_purchased",
          payload: {
            outboundNo: order.outboundNo,
            warehouseId: order.warehouseId,
            adapterId: result.adapterId,
            trackingNo: result.trackingNo,
          },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "mark_outbound_packed") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { lines: { include: { product: true } } },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (order.status !== "RELEASED" && order.status !== "PICKING") {
      return toApiErrorResponseFromStatus("Pack is only allowed when the order is RELEASED or PICKING.", 400);
    }
    const allPicked = order.lines.every((l) => Number(l.pickedQty) >= Number(l.quantity));
    if (!allPicked) {
      return toApiErrorResponseFromStatus("All lines must be fully picked before packing.", 400);
    }

    const requirePackScan = process.env.WMS_REQUIRE_PACK_SCAN === "1";
    const tokens = parsePackScanTokenArray(input.packScanTokens);
    if (requirePackScan && tokens.length === 0) {
      return toApiErrorResponseFromStatus(
        "packScanTokens required when WMS_REQUIRE_PACK_SCAN=1 (scanner wedge or manual list).",
        400,
      );
    }
    const plan = buildOutboundPackScanPlan(
      order.lines.map((l) => ({ pickedQty: Number(l.pickedQty), product: l.product })),
    );
    const flat = flattenPackScanExpectations(plan);
    if (tokens.length > 0) {
      const scanResult = await verifyOutboundPackScanResolved(tenantId, outboundOrderId, flat, tokens);
      if (!scanResult.ok) {
        return toApiErrorResponseFromStatus(
          `Pack scan mismatch. Missing: ${scanResult.missing.slice(0, 12).join(", ") || "—"}; unexpected: ${scanResult.unexpected.slice(0, 12).join(", ") || "—"}`,
          400,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        await tx.outboundOrderLine.update({
          where: { id: line.id },
          data: { packedQty: line.pickedQty },
        });
      }
      await tx.outboundOrder.update({
        where: { id: order.id },
        data: { status: "PACKED" },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "OUTBOUND_ORDER",
          entityId: order.id,
          action: "outbound_mark_packed",
          payload: {
            outboundNo: order.outboundNo,
            warehouseId: order.warehouseId,
            packScanVerified: tokens.length > 0 || requirePackScan,
          },
          actorUserId: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_outbound_shipped") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { lines: { include: { product: true } } },
    });
    if (!order) {
      return toApiErrorResponseFromStatus("Outbound order not found.", 404);
    }
    if (order.status !== "PACKED") {
      return toApiErrorResponseFromStatus("Ship is only allowed when the order is PACKED.", 400);
    }
    const allPacked = order.lines.every((l) => Number(l.packedQty) >= Number(l.quantity));
    if (!allPacked) {
      return toApiErrorResponseFromStatus("All lines must be fully packed.", 400);
    }

    const enforceSscc = process.env.WMS_ENFORCE_SSCC === "1";
    if (enforceSscc) {
      const luRows = await prisma.wmsOutboundLogisticsUnit.findMany({
        where: { tenantId, outboundOrderId },
        select: {
          id: true,
          parentUnitId: true,
          scanCode: true,
          outboundOrderLineId: true,
          containedQty: true,
        },
      });
      if (luRows.length > 0) {
        const v = validateOutboundLuHierarchy(
          luRows.map((r) => ({
            id: r.id,
            parentUnitId: r.parentUnitId,
            scanCode: r.scanCode,
            outboundOrderLineId: r.outboundOrderLineId,
            containedQty: r.containedQty != null ? r.containedQty.toString() : null,
          })),
        );
        if (!v.ok) {
          return toApiErrorResponseFromStatus(
            `WMS_ENFORCE_SSCC=1: logistics unit validation failed — ${v.errors.slice(0, 6).join("; ")}`,
            400,
          );
        }
      }
    }

    const requireShipScan = process.env.WMS_REQUIRE_SHIP_SCAN === "1";
    const shipTokens = parsePackScanTokenArray(input.shipScanTokens);
    if (requireShipScan && shipTokens.length === 0) {
      return toApiErrorResponseFromStatus(
        "shipScanTokens required when WMS_REQUIRE_SHIP_SCAN=1 (scanner wedge or manual list).",
        400,
      );
    }
    const shipPlan = buildOutboundPackScanPlan(
      order.lines.map((l) => ({ pickedQty: Number(l.packedQty), product: l.product })),
    );
    const shipFlat = flattenPackScanExpectations(shipPlan);
    if (shipTokens.length > 0) {
      const shipScanResult = await verifyOutboundPackScanResolved(
        tenantId,
        outboundOrderId,
        shipFlat,
        shipTokens,
      );
      if (!shipScanResult.ok) {
        return toApiErrorResponseFromStatus(
          `Ship scan mismatch. Missing: ${shipScanResult.missing.slice(0, 12).join(", ") || "—"}; unexpected: ${shipScanResult.unexpected.slice(0, 12).join(", ") || "—"}`,
          400,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        const shipDelta = new Prisma.Decimal(line.packedQty).minus(line.shippedQty);
        if (shipDelta.lte(0)) continue;
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            warehouseId: order.warehouseId,
            binId: null,
            productId: line.productId,
            movementType: "SHIPMENT",
            quantity: shipDelta,
            referenceType: "OUTBOUND_LINE_SHIP",
            referenceId: line.id,
            createdById: actorId,
            note: `Outbound ${order.outboundNo} shipped`,
          },
        });
        await tx.outboundOrderLine.update({
          where: { id: line.id },
          data: { shippedQty: line.packedQty },
        });
      }
      await tx.outboundOrder.update({
        where: { id: order.id },
        data: { status: "SHIPPED" },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "OUTBOUND_ORDER",
          entityId: order.id,
          action: "outbound_mark_shipped",
          payload: {
            outboundNo: order.outboundNo,
            warehouseId: order.warehouseId,
            shipScanVerified: shipTokens.length > 0 || requireShipScan,
          },
          actorUserId: actorId,
        },
      });
    });
    scheduleEmitWmsOutboundWebhooks(tenantId, "OUTBOUND_SHIPPED", order.id, {
      outboundOrderId: order.id,
      outboundNo: order.outboundNo,
      warehouseId: order.warehouseId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_shipment_inbound_fields") {
    const shipmentId = input.shipmentId?.trim();
    if (!shipmentId) {
      return toApiErrorResponseFromStatus("shipmentId required.", 400);
    }
    const shipment = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: { id: true },
    });
    if (!shipment) {
      return toApiErrorResponseFromStatus("Shipment not found.", 404);
    }
    const data: Prisma.ShipmentUpdateInput = {};
    let shipmentCustodyBreachForAudit: Prisma.InputJsonValue | null = null;
    if (input.asnReference !== undefined) {
      data.asnReference = input.asnReference?.trim() ? input.asnReference.trim() : null;
    }
    if (input.asnQtyTolerancePct !== undefined) {
      const rawTol = input.asnQtyTolerancePct;
      if (rawTol === null || rawTol === "") {
        data.asnQtyTolerancePct = null;
      } else {
        const n = typeof rawTol === "number" ? rawTol : Number(rawTol);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return toApiErrorResponseFromStatus("asnQtyTolerancePct must be between 0 and 100.", 400);
        }
        data.asnQtyTolerancePct = n;
      }
    }
    if (input.catchWeightTolerancePct !== undefined) {
      const rawCw = input.catchWeightTolerancePct;
      if (rawCw === null || rawCw === "") {
        data.catchWeightTolerancePct = null;
      } else {
        const n = typeof rawCw === "number" ? rawCw : Number(rawCw);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return toApiErrorResponseFromStatus("catchWeightTolerancePct must be between 0 and 100.", 400);
        }
        data.catchWeightTolerancePct = n;
      }
    }
    if (input.expectedReceiveAt !== undefined) {
      const raw = input.expectedReceiveAt;
      if (raw === null || raw === "") {
        data.expectedReceiveAt = null;
      } else {
        const d = new Date(String(raw).trim());
        if (Number.isNaN(d.getTime())) {
          return toApiErrorResponseFromStatus("Invalid expectedReceiveAt.", 400);
        }
        data.expectedReceiveAt = d;
      }
    }
    if (input.wmsCrossDock !== undefined) {
      data.wmsCrossDock = Boolean(input.wmsCrossDock);
    }
    if (input.wmsFlowThrough !== undefined) {
      data.wmsFlowThrough = Boolean(input.wmsFlowThrough);
    }
    if (input.wmsInboundSubtype !== undefined) {
      const raw = String(input.wmsInboundSubtype).trim().toUpperCase();
      if (raw !== "STANDARD" && raw !== "CUSTOMER_RETURN") {
        return toApiErrorResponseFromStatus("wmsInboundSubtype must be STANDARD or CUSTOMER_RETURN.", 400);
      }
      data.wmsInboundSubtype = raw as WmsInboundSubtype;
      if (raw === "STANDARD") {
        data.wmsRmaReference = null;
        data.returnSourceOutboundOrder = { disconnect: true };
      }
    }
    if (input.wmsRmaReference !== undefined) {
      data.wmsRmaReference =
        input.wmsRmaReference === null || String(input.wmsRmaReference).trim() === ""
          ? null
          : String(input.wmsRmaReference).trim().slice(0, 128);
    }
    if (input.returnSourceOutboundOrderId !== undefined) {
      const oid = String(input.returnSourceOutboundOrderId ?? "").trim();
      if (!oid) {
        data.returnSourceOutboundOrder = { disconnect: true };
      } else {
        const ob = await prisma.outboundOrder.findFirst({
          where: { id: oid, tenantId },
          select: { id: true },
        });
        if (!ob) {
          return toApiErrorResponseFromStatus("returnSourceOutboundOrderId not found for tenant.", 404);
        }
        data.returnSourceOutboundOrder = { connect: { id: oid } };
      }
    }
    if (input.custodySegmentJson !== undefined) {
      const seg = parseCustodySegmentJsonForPatch(input.custodySegmentJson);
      if (!seg.ok) {
        return toApiErrorResponseFromStatus(seg.message, 400);
      }
      if (seg.mode === "clear") {
        data.custodySegmentJson = Prisma.DbNull;
      } else if (seg.mode === "set") {
        data.custodySegmentJson = seg.value;
        if (custodySegmentIndicatesBreach(seg.value as unknown)) {
          shipmentCustodyBreachForAudit = seg.value;
        }
      }
    }
    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus(
        "Provide inbound fields to update (ASN, receive timing, BF-31 / BF-63 tolerance %, BF-37 tags, BF-41 return subtype / RMA / outbound link, BF-64 custody JSON).",
        400,
      );
    }
    await prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipment.id },
        data,
        select: {
          id: true,
          wmsReceiveStatus: true,
          asnReference: true,
          expectedReceiveAt: true,
        },
      });
      if (
        updated.wmsReceiveStatus === "NOT_TRACKED" &&
        (updated.asnReference || updated.expectedReceiveAt)
      ) {
        await tx.shipment.update({
          where: { id: updated.id },
          data: {
            wmsReceiveStatus: "EXPECTED",
            wmsReceiveUpdatedAt: new Date(),
            wmsReceiveUpdatedById: actorId,
          },
        });
        await tx.ctAuditLog.create({
          data: {
            tenantId,
            shipmentId: updated.id,
            entityType: "SHIPMENT",
            entityId: updated.id,
            action: "wms_receive_transition",
            payload: {
              from: "NOT_TRACKED",
              to: "EXPECTED",
              source: "inbound_fields",
            },
            actorUserId: actorId,
          },
        });
      }
      if (shipmentCustodyBreachForAudit) {
        await tx.ctAuditLog.create({
          data: {
            tenantId,
            shipmentId: shipment.id,
            entityType: "SHIPMENT",
            entityId: shipment.id,
            action: "cold_chain_custody_breach_bf64",
            payload: {
              custodySegmentJson: shipmentCustodyBreachForAudit,
              source: "set_shipment_inbound_fields",
            },
            actorUserId: actorId,
          },
        });
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_wms_receiving_status") {
    const shipmentId = input.shipmentId?.trim();
    const rawTo = input.toStatus?.trim();
    if (!shipmentId || !rawTo) {
      return toApiErrorResponseFromStatus("shipmentId and toStatus required.", 400);
    }
    if (!isWmsReceiveStatus(rawTo)) {
      return toApiErrorResponseFromStatus("Invalid toStatus.", 400);
    }
    const toStatus = rawTo as WmsReceiveStatus;

    const shipmentRow = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: { id: true, wmsReceiveStatus: true },
    });
    if (!shipmentRow) {
      return toApiErrorResponseFromStatus("Shipment not found.", 404);
    }
    const fromStatus = shipmentRow.wmsReceiveStatus;
    if (!canTransitionWmsReceive(fromStatus, toStatus)) {
      const allowed = allowedNextWmsReceiveStatuses(fromStatus);
      return toApiErrorResponseFromStatus(
        `Invalid receiving transition ${fromStatus} → ${toStatus}. Allowed: ${allowed.join(", ") || "(none)"}.`,
        400,
      );
    }
    const notePayload =
      input.note !== undefined
        ? input.note === null || String(input.note).trim() === ""
          ? null
          : String(input.note).trim().slice(0, 4000)
        : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentRow.id },
        data: {
          wmsReceiveStatus: toStatus,
          wmsReceiveUpdatedAt: new Date(),
          wmsReceiveUpdatedById: actorId,
          ...(notePayload !== undefined ? { wmsReceiveNote: notePayload } : {}),
        },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: shipmentRow.id,
          entityType: "SHIPMENT",
          entityId: shipmentRow.id,
          action: "wms_receive_transition",
          payload: {
            from: fromStatus,
            to: toStatus,
            source: "set_wms_receiving_status",
            ...(notePayload !== undefined ? { note: notePayload } : {}),
          },
          actorUserId: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_shipment_item_receive_line") {
    const shipmentItemId = input.shipmentItemId?.trim();
    const rawRecv = input.receivedQty;
    if (!shipmentItemId || rawRecv === undefined || rawRecv === null) {
      return toApiErrorResponseFromStatus("shipmentItemId and receivedQty required.", 400);
    }
    const receivedQty = Number(rawRecv);
    if (!Number.isFinite(receivedQty) || receivedQty < 0) {
      return toApiErrorResponseFromStatus("receivedQty must be a non-negative number.", 400);
    }

    const item = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipment: { order: { tenantId } } },
      select: {
        id: true,
        shipmentId: true,
        quantityShipped: true,
      },
    });
    if (!item) {
      return toApiErrorResponseFromStatus("Shipment item not found.", 404);
    }

    const shipped = Number(item.quantityShipped);
    const disposition = resolveVarianceDisposition(shipped, receivedQty, input.varianceDisposition ?? null);

    const rawNote = input.varianceNote;
    const varianceNotePayload =
      rawNote === undefined
        ? undefined
        : rawNote === null || String(rawNote).trim() === ""
          ? null
          : String(rawNote).trim().slice(0, 1000);

    const cwParsed = parseOptionalCatchWeightKgBf63(input.catchWeightKg);
    if (!cwParsed.ok) return cwParsed.response;
    const catchWeightKg = cwParsed.value;

    await prisma.$transaction(async (tx) => {
      await writeShipmentItemReceiveLineInTx(
        tx,
        tenantId,
        actorId,
        {
          itemId: item.id,
          shipmentId: item.shipmentId,
          quantityShipped: shipped,
          receivedQty,
          disposition,
          varianceNotePayload,
          ...(catchWeightKg !== undefined ? { catchWeightKg } : {}),
        },
        { source: "set_shipment_item_receive_line" },
      );
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "set_shipment_item_catch_weight") {
    const shipmentItemId = input.shipmentItemId?.trim();
    if (!shipmentItemId) {
      return toApiErrorResponseFromStatus("shipmentItemId required.", 400);
    }
    if (input.catchWeightKg === undefined) {
      return toApiErrorResponseFromStatus("catchWeightKg required (number or null to clear).", 400);
    }
    const cwParsed = parseOptionalCatchWeightKgBf63(input.catchWeightKg);
    if (!cwParsed.ok) return cwParsed.response;
    const kg = cwParsed.value;

    const row = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipment: { order: { tenantId } } },
      select: { id: true, shipmentId: true },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Shipment item not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipmentItem.update({
        where: { id: row.id },
        data: { catchWeightKg: kg == null ? null : kg.toFixed(3) },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: row.shipmentId,
          entityType: "SHIPMENT_ITEM",
          entityId: row.id,
          action: "catch_weight_kg_set",
          payload: { catchWeightKg: kg },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "set_shipment_item_return_disposition") {
    const shipmentItemId = input.shipmentItemId?.trim();
    const dispRaw = input.wmsReturnDisposition?.trim().toUpperCase();
    if (
      !shipmentItemId ||
      (dispRaw !== "RESTOCK" && dispRaw !== "SCRAP" && dispRaw !== "QUARANTINE")
    ) {
      return toApiErrorResponseFromStatus(
        "shipmentItemId and wmsReturnDisposition (RESTOCK, SCRAP, or QUARANTINE) required.",
        400,
      );
    }

    const row = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipment: { order: { tenantId } } },
      select: {
        id: true,
        shipmentId: true,
        shipment: { select: { wmsInboundSubtype: true } },
      },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Shipment item not found.", 404);
    }
    if (row.shipment.wmsInboundSubtype !== "CUSTOMER_RETURN") {
      return toApiErrorResponseFromStatus(
        "Return disposition applies only when shipment inbound subtype is CUSTOMER_RETURN (BF-41).",
        400,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipmentItem.update({
        where: { id: row.id },
        data: { wmsReturnDisposition: dispRaw as WmsReturnLineDisposition },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: row.shipmentId,
          entityType: "SHIPMENT_ITEM",
          entityId: row.id,
          action: "customer_return_line_disposition_set",
          payload: { wmsReturnDisposition: dispRaw },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "create_wms_receiving_disposition_template") {
    const codeRaw =
      input.receivingDispositionTemplateCode?.trim() ?? input.templateCode?.trim() ?? "";
    const title =
      input.receivingDispositionTemplateTitle?.trim() ?? input.templateTitle?.trim() ?? "";
    const noteTemplate =
      input.receivingDispositionNoteTemplate?.trim() ?? input.noteTemplate?.trim() ?? "";
    if (!codeRaw || !title || !noteTemplate) {
      return toApiErrorResponseFromStatus(
        "receivingDispositionTemplateCode, receivingDispositionTemplateTitle, and receivingDispositionNoteTemplate required.",
        400,
      );
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(codeRaw)) {
      return toApiErrorResponseFromStatus(
        "receivingDispositionTemplateCode must be 1–64 characters [A-Za-z0-9_-].",
        400,
      );
    }
    if (title.length > 256 || noteTemplate.length > 2000) {
      return toApiErrorResponseFromStatus("Title or note template exceeds max length.", 400);
    }
    let suggested: WmsShipmentItemVarianceDisposition | null = null;
    if (input.receivingDispositionTemplateSuggestedVarianceDisposition !== undefined) {
      const raw = input.receivingDispositionTemplateSuggestedVarianceDisposition;
      if (raw !== null && raw !== "") {
        const u = String(raw).trim().toUpperCase();
        if (
          u !== "MATCH" &&
          u !== "SHORT" &&
          u !== "OVER" &&
          u !== "DAMAGED" &&
          u !== "OTHER"
        ) {
          return toApiErrorResponseFromStatus(
            "receivingDispositionTemplateSuggestedVarianceDisposition must be MATCH, SHORT, OVER, DAMAGED, or OTHER.",
            400,
          );
        }
        suggested = u as WmsShipmentItemVarianceDisposition;
      }
    }
    try {
      const row = await prisma.wmsReceivingDispositionTemplate.create({
        data: {
          tenantId,
          code: codeRaw,
          title,
          noteTemplate,
          suggestedVarianceDisposition: suggested,
        },
        select: { id: true },
      });
      await prisma.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WMS_RECEIVING_DISPOSITION_TEMPLATE",
          entityId: row.id,
          action: "receiving_disposition_template_created",
          payload: { code: codeRaw },
          actorUserId: actorId,
        },
      });
      return NextResponse.json({ ok: true, receivingDispositionTemplateId: row.id });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return toApiErrorResponseFromStatus(
          "Template code already exists for this tenant.",
          409,
        );
      }
      throw e;
    }
  }

  if (action === "update_wms_receiving_disposition_template") {
    const tid = input.receivingDispositionTemplateId?.trim();
    if (!tid) {
      return toApiErrorResponseFromStatus("receivingDispositionTemplateId required.", 400);
    }
    const existing = await prisma.wmsReceivingDispositionTemplate.findFirst({
      where: { id: tid, tenantId },
      select: { id: true },
    });
    if (!existing) {
      return toApiErrorResponseFromStatus("Template not found.", 404);
    }
    const data: Prisma.WmsReceivingDispositionTemplateUpdateInput = {};
    const title =
      input.receivingDispositionTemplateTitle !== undefined
        ? String(input.receivingDispositionTemplateTitle ?? "").trim()
        : undefined;
    if (title !== undefined) {
      if (!title || title.length > 256) {
        return toApiErrorResponseFromStatus("receivingDispositionTemplateTitle invalid.", 400);
      }
      data.title = title;
    }
    const noteTemplate =
      input.receivingDispositionNoteTemplate !== undefined
        ? String(input.receivingDispositionNoteTemplate ?? "").trim()
        : undefined;
    if (noteTemplate !== undefined) {
      if (!noteTemplate || noteTemplate.length > 2000) {
        return toApiErrorResponseFromStatus("receivingDispositionNoteTemplate invalid.", 400);
      }
      data.noteTemplate = noteTemplate;
    }
    if (input.receivingDispositionTemplateSuggestedVarianceDisposition !== undefined) {
      const raw = input.receivingDispositionTemplateSuggestedVarianceDisposition;
      if (raw === null || raw === "") {
        data.suggestedVarianceDisposition = null;
      } else {
        const u = String(raw).trim().toUpperCase();
        if (
          u !== "MATCH" &&
          u !== "SHORT" &&
          u !== "OVER" &&
          u !== "DAMAGED" &&
          u !== "OTHER"
        ) {
          return toApiErrorResponseFromStatus(
            "receivingDispositionTemplateSuggestedVarianceDisposition invalid.",
            400,
          );
        }
        data.suggestedVarianceDisposition = u as WmsShipmentItemVarianceDisposition;
      }
    }
    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus("Provide fields to update.", 400);
    }
    await prisma.wmsReceivingDispositionTemplate.update({
      where: { id: tid },
      data,
    });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_RECEIVING_DISPOSITION_TEMPLATE",
        entityId: tid,
        action: "receiving_disposition_template_updated",
        payload: { keys: Object.keys(data) },
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_wms_receiving_disposition_template") {
    const tid = input.receivingDispositionTemplateId?.trim();
    if (!tid) {
      return toApiErrorResponseFromStatus("receivingDispositionTemplateId required.", 400);
    }
    const existing = await prisma.wmsReceivingDispositionTemplate.findFirst({
      where: { id: tid, tenantId },
      select: { id: true, code: true },
    });
    if (!existing) {
      return toApiErrorResponseFromStatus("Template not found.", 404);
    }
    await prisma.wmsReceivingDispositionTemplate.delete({ where: { id: tid } });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_RECEIVING_DISPOSITION_TEMPLATE",
        entityId: tid,
        action: "receiving_disposition_template_deleted",
        payload: { code: existing.code },
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_wms_outbound_webhook_subscription_bf44") {
    const urlRaw = input.webhookUrl?.trim();
    const secretRaw = input.webhookSigningSecret?.trim();
    const types = parseOutboundWebhookEventTypes(input.webhookEventTypes);
    if (!urlRaw || !secretRaw || types.length === 0) {
      return toApiErrorResponseFromStatus(
        "webhookUrl, webhookSigningSecret, and non-empty webhookEventTypes required.",
        400,
      );
    }
    if (secretRaw.length < 8 || secretRaw.length > 256) {
      return toApiErrorResponseFromStatus("webhookSigningSecret must be 8–256 characters.", 400);
    }
    try {
      assertAllowedOutboundWebhookUrl(urlRaw);
    } catch {
      return toApiErrorResponseFromStatus(
        "webhookUrl must be https, or http on localhost / 127.0.0.1 only.",
        400,
      );
    }
    const suffix = signingSecretSuffixFromSecret(secretRaw);
    const row = await prisma.wmsOutboundWebhookSubscription.create({
      data: {
        tenantId,
        url: urlRaw.slice(0, 2048),
        signingSecret: secretRaw,
        signingSecretSuffix: suffix,
        eventTypes: types,
        isActive: input.webhookIsActive !== false,
      },
      select: { id: true },
    });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_OUTBOUND_WEBHOOK_SUBSCRIPTION",
        entityId: row.id,
        action: "bf44_webhook_subscription_created",
        payload: { eventTypes: types },
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true, webhookSubscriptionId: row.id });
  }

  if (action === "update_wms_outbound_webhook_subscription_bf44") {
    const sid = input.webhookSubscriptionId?.trim();
    if (!sid) {
      return toApiErrorResponseFromStatus("webhookSubscriptionId required.", 400);
    }
    const existing = await prisma.wmsOutboundWebhookSubscription.findFirst({
      where: { id: sid, tenantId },
      select: { id: true },
    });
    if (!existing) {
      return toApiErrorResponseFromStatus("Webhook subscription not found.", 404);
    }
    const data: Prisma.WmsOutboundWebhookSubscriptionUpdateInput = {};
    if (input.webhookUrl !== undefined) {
      const urlRaw = String(input.webhookUrl ?? "").trim();
      if (!urlRaw) {
        return toApiErrorResponseFromStatus("webhookUrl cannot be empty.", 400);
      }
      try {
        assertAllowedOutboundWebhookUrl(urlRaw);
      } catch {
        return toApiErrorResponseFromStatus(
          "webhookUrl must be https, or http on localhost / 127.0.0.1 only.",
          400,
        );
      }
      data.url = urlRaw.slice(0, 2048);
    }
    if (input.webhookSigningSecret !== undefined && String(input.webhookSigningSecret).trim() !== "") {
      const secretRaw = String(input.webhookSigningSecret).trim();
      if (secretRaw.length < 8 || secretRaw.length > 256) {
        return toApiErrorResponseFromStatus("webhookSigningSecret must be 8–256 characters.", 400);
      }
      data.signingSecret = secretRaw;
      data.signingSecretSuffix = signingSecretSuffixFromSecret(secretRaw);
    }
    if (input.webhookEventTypes !== undefined) {
      const types = parseOutboundWebhookEventTypes(input.webhookEventTypes);
      if (types.length === 0) {
        return toApiErrorResponseFromStatus("webhookEventTypes must be a non-empty array.", 400);
      }
      data.eventTypes = { set: types };
    }
    if (input.webhookIsActive !== undefined) {
      data.isActive = Boolean(input.webhookIsActive);
    }
    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus(
        "Provide webhookUrl, webhookSigningSecret, webhookEventTypes, and/or webhookIsActive.",
        400,
      );
    }
    await prisma.wmsOutboundWebhookSubscription.update({ where: { id: sid }, data });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_OUTBOUND_WEBHOOK_SUBSCRIPTION",
        entityId: sid,
        action: "bf44_webhook_subscription_updated",
        payload: { keys: Object.keys(data) },
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_wms_outbound_webhook_subscription_bf44") {
    const sid = input.webhookSubscriptionId?.trim();
    if (!sid) {
      return toApiErrorResponseFromStatus("webhookSubscriptionId required.", 400);
    }
    const existing = await prisma.wmsOutboundWebhookSubscription.findFirst({
      where: { id: sid, tenantId },
      select: { id: true },
    });
    if (!existing) {
      return toApiErrorResponseFromStatus("Webhook subscription not found.", 404);
    }
    await prisma.wmsOutboundWebhookSubscription.delete({ where: { id: sid } });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_OUTBOUND_WEBHOOK_SUBSCRIPTION",
        entityId: sid,
        action: "bf44_webhook_subscription_deleted",
        payload: {},
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_wms_partner_api_key_bf45") {
    const labelRaw = input.partnerApiKeyLabel?.trim();
    const label =
      labelRaw && labelRaw.length > 0 ? labelRaw.slice(0, 120) : "Partner integration";
    const scopes = parsePartnerApiKeyScopes(input.partnerApiKeyScopes);
    if (scopes.length === 0) {
      return toApiErrorResponseFromStatus(
        "partnerApiKeyScopes must include at least one scope.",
        400,
      );
    }
    const plaintext = generatePartnerApiKeyPlaintext();
    const keyHash = hashPartnerApiKey(plaintext);
    const keyPrefix = partnerApiKeyPublicPrefix(plaintext);
    const row = await prisma.wmsPartnerApiKey.create({
      data: {
        tenantId,
        label,
        keyPrefix,
        keyHash,
        scopes,
      },
      select: { id: true },
    });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_PARTNER_API_KEY",
        entityId: row.id,
        action: "bf45_partner_api_key_created",
        payload: { scopes },
        actorUserId: actorId,
      },
    });
    return NextResponse.json({
      ok: true,
      partnerApiKeyId: row.id,
      apiKeyPlaintext: plaintext,
      keyPrefix,
    });
  }

  if (action === "revoke_wms_partner_api_key_bf45") {
    const kid = input.partnerApiKeyId?.trim();
    if (!kid) {
      return toApiErrorResponseFromStatus("partnerApiKeyId required.", 400);
    }
    const existing = await prisma.wmsPartnerApiKey.findFirst({
      where: { id: kid, tenantId },
      select: { id: true },
    });
    if (!existing) {
      return toApiErrorResponseFromStatus("Partner API key not found.", 404);
    }
    await prisma.wmsPartnerApiKey.update({
      where: { id: kid },
      data: { isActive: false },
    });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_PARTNER_API_KEY",
        entityId: kid,
        action: "bf45_partner_api_key_revoked",
        payload: {},
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_shipment_item_qa_sampling_bf42") {
    const shipmentItemId = input.shipmentItemId?.trim();
    if (!shipmentItemId) {
      return toApiErrorResponseFromStatus("shipmentItemId required.", 400);
    }
    const row = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipment: { order: { tenantId } } },
      select: { id: true, shipmentId: true },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Shipment item not found.", 404);
    }
    const data: Prisma.ShipmentItemUpdateInput = {};
    if (input.wmsQaSamplingSkipLot !== undefined) {
      data.wmsQaSamplingSkipLot = Boolean(input.wmsQaSamplingSkipLot);
    }
    if (input.wmsQaSamplingPct !== undefined) {
      const rawPct = input.wmsQaSamplingPct;
      if (rawPct === null || rawPct === "") {
        data.wmsQaSamplingPct = null;
      } else {
        const n = typeof rawPct === "number" ? rawPct : Number(rawPct);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return toApiErrorResponseFromStatus("wmsQaSamplingPct must be between 0 and 100.", 400);
        }
        data.wmsQaSamplingPct = n;
      }
    }
    if (input.wmsReceivingDispositionTemplateId !== undefined) {
      const oid = String(input.wmsReceivingDispositionTemplateId ?? "").trim();
      if (!oid) {
        data.wmsReceivingDispositionTemplate = { disconnect: true };
      } else {
        const tpl = await prisma.wmsReceivingDispositionTemplate.findFirst({
          where: { id: oid, tenantId },
          select: { id: true },
        });
        if (!tpl) {
          return toApiErrorResponseFromStatus("wmsReceivingDispositionTemplateId not found.", 404);
        }
        data.wmsReceivingDispositionTemplate = { connect: { id: oid } };
      }
    }
    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus(
        "Provide wmsQaSamplingSkipLot, wmsQaSamplingPct, and/or wmsReceivingDispositionTemplateId.",
        400,
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.shipmentItem.update({ where: { id: row.id }, data });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: row.shipmentId,
          entityType: "SHIPMENT_ITEM",
          entityId: row.id,
          action: "shipment_item_qa_sampling_bf42_set",
          payload: {
            wmsQaSamplingSkipLot: input.wmsQaSamplingSkipLot,
            wmsQaSamplingPct: input.wmsQaSamplingPct,
            wmsReceivingDispositionTemplateId: input.wmsReceivingDispositionTemplateId,
          },
          actorUserId: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "apply_wms_disposition_template_to_shipment_item") {
    const shipmentItemId = input.shipmentItemId?.trim();
    if (!shipmentItemId) {
      return toApiErrorResponseFromStatus("shipmentItemId required.", 400);
    }
    const tplIdRaw = input.receivingDispositionTemplateId?.trim() ?? "";
    const row = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipment: { order: { tenantId } } },
      select: {
        id: true,
        shipmentId: true,
        quantityShipped: true,
        quantityReceived: true,
        wmsReceivingDispositionTemplateId: true,
        orderItem: {
          select: {
            lineNo: true,
            product: { select: { sku: true, productCode: true } },
          },
        },
        shipment: {
          select: {
            asnReference: true,
            order: { select: { orderNumber: true } },
          },
        },
      },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Shipment item not found.", 404);
    }
    const resolvedTplId = tplIdRaw || row.wmsReceivingDispositionTemplateId || "";
    if (!resolvedTplId) {
      return toApiErrorResponseFromStatus(
        "Provide receivingDispositionTemplateId or set a default template on the line first.",
        400,
      );
    }
    const tpl = await prisma.wmsReceivingDispositionTemplate.findFirst({
      where: { id: resolvedTplId, tenantId },
      select: { id: true, noteTemplate: true, code: true },
    });
    if (!tpl) {
      return toApiErrorResponseFromStatus("Disposition template not found.", 404);
    }
    const sku =
      row.orderItem.product?.sku?.trim() ||
      row.orderItem.product?.productCode?.trim() ||
      "";
    const note = substituteReceivingDispositionNoteTemplate(tpl.noteTemplate, {
      lineNo: row.orderItem.lineNo,
      qtyShipped: row.quantityShipped.toString(),
      qtyReceived: row.quantityReceived.toString(),
      productSku: sku,
      asnReference: row.shipment.asnReference?.trim() ?? "",
      orderNumber: row.shipment.order.orderNumber,
    });
    await prisma.$transaction(async (tx) => {
      await tx.shipmentItem.update({
        where: { id: row.id },
        data: { wmsVarianceNote: note },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: row.shipmentId,
          entityType: "SHIPMENT_ITEM",
          entityId: row.id,
          action: "bf42_disposition_template_applied",
          payload: {
            receivingDispositionTemplateId: tpl.id,
            templateCode: tpl.code,
          },
          actorUserId: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_wms_receipt") {
    const shipmentId = input.shipmentId?.trim();
    if (!shipmentId) {
      return toApiErrorResponseFromStatus("shipmentId required.", 400);
    }
    const ship = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: { id: true },
    });
    if (!ship) {
      return toApiErrorResponseFromStatus("Shipment not found.", 404);
    }

    const existingOpen = await prisma.wmsReceipt.findFirst({
      where: { tenantId, shipmentId, status: "OPEN" },
      select: { id: true },
    });
    if (existingOpen) {
      return NextResponse.json({ ok: true, receiptId: existingOpen.id });
    }

    let receiptDockReceivedAt: Date | undefined;
    if (input.receiptDockReceivedAt !== undefined && input.receiptDockReceivedAt !== null) {
      const raw = String(input.receiptDockReceivedAt).trim();
      if (raw === "") {
        receiptDockReceivedAt = undefined;
      } else {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          return toApiErrorResponseFromStatus("Invalid receiptDockReceivedAt.", 400);
        }
        receiptDockReceivedAt = parsed;
      }
    }

    const receiptDockNote =
      input.receiptDockNote !== undefined
        ? input.receiptDockNote === null || String(input.receiptDockNote).trim() === ""
          ? null
          : String(input.receiptDockNote).trim().slice(0, 2000)
        : undefined;

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.wmsReceipt.create({
        data: {
          tenantId,
          shipmentId,
          createdByUserId: actorId,
          ...(receiptDockNote !== undefined ? { dockNote: receiptDockNote } : {}),
          ...(receiptDockReceivedAt !== undefined ? { dockReceivedAt: receiptDockReceivedAt } : {}),
        },
        select: { id: true, shipmentId: true },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: row.shipmentId,
          entityType: "SHIPMENT",
          entityId: row.id,
          action: "wms_receipt_created",
          payload: { wmsReceiptId: row.id },
          actorUserId: actorId,
        },
      });
      return row;
    });

    return NextResponse.json({ ok: true, receiptId: created.id });
  }

  if (action === "evaluate_wms_receipt_asn_tolerance") {
    const shipmentId = input.shipmentId?.trim();
    if (!shipmentId) {
      return toApiErrorResponseFromStatus("shipmentId required.", 400);
    }
    const ship = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: {
        id: true,
        asnQtyTolerancePct: true,
        catchWeightTolerancePct: true,
        items: {
          select: {
            id: true,
            quantityShipped: true,
            quantityReceived: true,
            cargoGrossWeightKg: true,
            catchWeightKg: true,
            orderItem: {
              select: { product: { select: { isCatchWeight: true } } },
            },
          },
        },
      },
    });
    if (!ship) {
      return toApiErrorResponseFromStatus("Shipment not found.", 404);
    }
    const tol = ship.asnQtyTolerancePct != null ? Number(ship.asnQtyTolerancePct) : null;
    const ev = evaluateShipmentReceiveAgainstAsnTolerance(
      ship.items.map((it) => ({
        shipmentItemId: it.id,
        quantityShipped: Number(it.quantityShipped),
        quantityReceived: Number(it.quantityReceived),
      })),
      tol,
    );
    const cwTol =
      ship.catchWeightTolerancePct != null ? Number(ship.catchWeightTolerancePct) : null;
    const cwEv = evaluateCatchWeightAgainstTolerance(
      ship.items.map((it) => ({
        shipmentItemId: it.id,
        isCatchWeightProduct: Boolean(it.orderItem?.product?.isCatchWeight),
        declaredKg: it.cargoGrossWeightKg != null ? Number(it.cargoGrossWeightKg) : null,
        receivedKg: it.catchWeightKg != null ? Number(it.catchWeightKg) : null,
      })),
      cwTol,
    );
    return NextResponse.json({
      ok: true,
      shipmentId: ship.id,
      tolerancePct: ev.tolerancePct,
      policyApplied: ev.policyApplied,
      withinTolerance: ev.withinTolerance,
      lines: ev.lines.map((l) => ({
        shipmentItemId: l.shipmentItemId,
        quantityShipped: l.quantityShipped.toFixed(3),
        quantityReceived: l.quantityReceived.toFixed(3),
        deltaAbs: l.deltaAbs,
        deltaPctOfShipped: l.deltaPctOfShipped != null ? Number(l.deltaPctOfShipped.toFixed(6)) : null,
        ok: l.ok,
      })),
      catchWeight: {
        tolerancePct: cwEv.tolerancePct,
        policyApplied: cwEv.policyApplied,
        withinTolerance: cwEv.withinTolerance,
        lines: cwEv.lines.map((l) => ({
          shipmentItemId: l.shipmentItemId,
          isCatchWeightProduct: l.isCatchWeightProduct,
          declaredKg: l.declaredKg,
          receivedKg: l.receivedKg,
          deltaAbsKg: l.deltaAbsKg,
          deltaPctOfDeclared:
            l.deltaPctOfDeclared != null ? Number(l.deltaPctOfDeclared.toFixed(6)) : null,
          skipped: l.skipped,
          ok: l.ok,
        })),
      },
    });
  }

  if (action === "close_wms_receipt") {
    const receiptId = input.receiptId?.trim();
    if (!receiptId) {
      return toApiErrorResponseFromStatus("receiptId required.", 400);
    }
    const receiptCompleteOnClose = Boolean(input.receiptCompleteOnClose);
    const requireWithinAsnToleranceForAdvance = Boolean(input.requireWithinAsnToleranceForAdvance);
    const blockCloseIfOutsideTolerance = Boolean(input.blockCloseIfOutsideTolerance);
    const requireWithinCatchWeightForAdvance = Boolean(input.requireWithinCatchWeightForAdvance);
    const blockCloseIfOutsideCatchWeight = Boolean(input.blockCloseIfOutsideCatchWeight);
    const generateGrn = Boolean(input.generateGrn);

    let explicitGrn: string | null | undefined;
    if (input.grnReference !== undefined) {
      explicitGrn =
        input.grnReference === null || String(input.grnReference).trim() === ""
          ? null
          : String(input.grnReference).trim().slice(0, 128);
    }

    const rec = await prisma.wmsReceipt.findFirst({
      where: { id: receiptId, tenantId },
      select: {
        id: true,
        status: true,
        grnReference: true,
        shipmentId: true,
        shipment: {
          select: {
            id: true,
            customerCrmAccountId: true,
            wmsReceiveStatus: true,
            asnQtyTolerancePct: true,
            catchWeightTolerancePct: true,
            shipmentNo: true,
            asnReference: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                currency: true,
              },
            },
            items: {
              select: {
                id: true,
                quantityShipped: true,
                quantityReceived: true,
                cargoGrossWeightKg: true,
                catchWeightKg: true,
                wmsVarianceDisposition: true,
                orderItem: {
                  select: {
                    productId: true,
                    product: {
                      select: {
                        id: true,
                        sku: true,
                        productCode: true,
                        name: true,
                        isCatchWeight: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!rec) {
      return toApiErrorResponseFromStatus("Receipt not found.", 404);
    }
    if (rec.status !== "OPEN") {
      return NextResponse.json({ ok: true, alreadyClosed: true });
    }

    const tol =
      rec.shipment.asnQtyTolerancePct != null ? Number(rec.shipment.asnQtyTolerancePct) : null;
    const toleranceEval = evaluateShipmentReceiveAgainstAsnTolerance(
      rec.shipment.items.map((it) => ({
        shipmentItemId: it.id,
        quantityShipped: Number(it.quantityShipped),
        quantityReceived: Number(it.quantityReceived),
      })),
      tol,
    );

    const cwTol =
      rec.shipment.catchWeightTolerancePct != null
        ? Number(rec.shipment.catchWeightTolerancePct)
        : null;
    const catchWeightEval = evaluateCatchWeightAgainstTolerance(
      rec.shipment.items.map((it) => ({
        shipmentItemId: it.id,
        isCatchWeightProduct: Boolean(it.orderItem?.product?.isCatchWeight),
        declaredKg: it.cargoGrossWeightKg != null ? Number(it.cargoGrossWeightKg) : null,
        receivedKg: it.catchWeightKg != null ? Number(it.catchWeightKg) : null,
      })),
      cwTol,
    );

    if (blockCloseIfOutsideTolerance && toleranceEval.policyApplied && !toleranceEval.withinTolerance) {
      return toApiErrorResponseFromStatus(
        "Receipt close blocked: inbound lines are outside configured ASN qty tolerance (BF-31).",
        400,
      );
    }

    if (
      blockCloseIfOutsideCatchWeight &&
      catchWeightEval.policyApplied &&
      !catchWeightEval.withinTolerance
    ) {
      return toApiErrorResponseFromStatus(
        "Receipt close blocked: catch-weight lines are outside configured kg tolerance (BF-63).",
        400,
      );
    }

    const closedAt = new Date();
    const grnResolved = generateGrn
      ? generateDockGrnReference(rec.id, closedAt)
      : explicitGrn !== undefined
        ? explicitGrn
        : undefined;

    const grnForStaging =
      grnResolved !== undefined ? grnResolved : rec.grnReference ?? null;

    const shouldAdvanceReceiveStatus =
      receiptCompleteOnClose &&
      (!requireWithinAsnToleranceForAdvance ||
        !toleranceEval.policyApplied ||
        toleranceEval.withinTolerance) &&
      (!requireWithinCatchWeightForAdvance ||
        !catchWeightEval.policyApplied ||
        catchWeightEval.withinTolerance);

    const receiveStatusSkippedDueToTolerance =
      receiptCompleteOnClose &&
      requireWithinAsnToleranceForAdvance &&
      toleranceEval.policyApplied &&
      !toleranceEval.withinTolerance;

    const receiveStatusSkippedDueToCatchWeight =
      receiptCompleteOnClose &&
      requireWithinCatchWeightForAdvance &&
      catchWeightEval.policyApplied &&
      !catchWeightEval.withinTolerance;

    let receiveStatusAdvanced = false;
    await prisma.$transaction(async (tx) => {
      await tx.wmsReceipt.update({
        where: { id: rec.id },
        data: {
          status: "CLOSED",
          closedAt,
          closedByUserId: actorId,
          ...(grnResolved !== undefined ? { grnReference: grnResolved } : {}),
        },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: rec.shipmentId,
          entityType: "SHIPMENT",
          entityId: rec.id,
          action: "wms_receipt_closed",
          payload: {
            wmsReceiptId: rec.id,
            ...(receiptCompleteOnClose ? { receiptCompleteOnCloseRequested: true } : {}),
            ...(grnResolved != null ? { grnReference: grnResolved } : {}),
            asnTolerancePolicyApplied: toleranceEval.policyApplied,
            asnToleranceWithin: toleranceEval.withinTolerance,
            ...(tol != null ? { asnQtyTolerancePct: tol } : {}),
            ...(receiveStatusSkippedDueToTolerance ? { receiveStatusSkippedDueToTolerance: true } : {}),
            catchWeightPolicyApplied: catchWeightEval.policyApplied,
            catchWeightWithin: catchWeightEval.withinTolerance,
            ...(cwTol != null ? { catchWeightTolerancePct: cwTol } : {}),
            ...(receiveStatusSkippedDueToCatchWeight
              ? { receiveStatusSkippedDueToCatchWeight: true }
              : {}),
          },
          actorUserId: actorId,
        },
      });

      if (shouldAdvanceReceiveStatus) {
        const fromStatus = rec.shipment.wmsReceiveStatus;
        if (canAdvanceReceiveStatusToReceiptComplete(fromStatus)) {
          await tx.shipment.update({
            where: { id: rec.shipmentId },
            data: {
              wmsReceiveStatus: "RECEIPT_COMPLETE",
              wmsReceiveUpdatedAt: new Date(),
              wmsReceiveUpdatedById: actorId,
            },
          });
          await tx.ctAuditLog.create({
            data: {
              tenantId,
              shipmentId: rec.shipmentId,
              entityType: "SHIPMENT",
              entityId: rec.shipmentId,
              action: "wms_receive_transition",
              payload: {
                from: fromStatus,
                to: "RECEIPT_COMPLETE",
                source: "close_wms_receipt",
                wmsReceiptId: rec.id,
              },
              actorUserId: actorId,
            },
          });
          receiveStatusAdvanced = true;
        }
      }

      const accrualSnapshot = buildReceivingAccrualSnapshotV1({
        closedAt,
        grnReference: grnForStaging,
        shipment: rec.shipment,
      });
      await tx.wmsReceivingAccrualStaging.create({
        data: {
          tenantId,
          wmsReceiptId: rec.id,
          shipmentId: rec.shipmentId,
          crmAccountId: rec.shipment.customerCrmAccountId,
          warehouseId: null,
          snapshotJson: accrualSnapshot as unknown as Prisma.InputJsonValue,
        },
      });
    });

    scheduleEmitWmsOutboundWebhooks(tenantId, "RECEIPT_CLOSED", rec.id, {
      wmsReceiptId: rec.id,
      shipmentId: rec.shipmentId,
      shipmentNo: rec.shipment.shipmentNo,
      asnReference: rec.shipment.asnReference,
      grnReference: grnForStaging,
      receiveStatusAdvanced,
      closedAt: closedAt.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      receiveStatusAdvanced,
      grnReference: grnForStaging,
      receivingAccrualStagingCreated: true,
      withinAsnTolerance: toleranceEval.policyApplied ? toleranceEval.withinTolerance : null,
      receiveStatusSkippedDueToTolerance,
      withinCatchWeightTolerance: catchWeightEval.policyApplied
        ? catchWeightEval.withinTolerance
        : null,
      receiveStatusSkippedDueToCatchWeight,
    });
  }

  if (action === "set_wms_receipt_line") {
    const receiptId = input.receiptId?.trim();
    const shipmentItemId = input.shipmentItemId?.trim();
    const rawRecv = input.receivedQty;
    if (!receiptId || !shipmentItemId || rawRecv === undefined || rawRecv === null) {
      return toApiErrorResponseFromStatus("receiptId, shipmentItemId and receivedQty required.", 400);
    }
    const receivedQty = Number(rawRecv);
    if (!Number.isFinite(receivedQty) || receivedQty < 0) {
      return toApiErrorResponseFromStatus("receivedQty must be a non-negative number.", 400);
    }

    const receipt = await prisma.wmsReceipt.findFirst({
      where: { id: receiptId, tenantId },
      select: { id: true, status: true, shipmentId: true },
    });
    if (!receipt) {
      return toApiErrorResponseFromStatus("Receipt not found.", 404);
    }
    if (receipt.status !== "OPEN") {
      return toApiErrorResponseFromStatus("Receipt is not open.", 400);
    }

    const item = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipmentId: receipt.shipmentId, shipment: { order: { tenantId } } },
      select: {
        id: true,
        shipmentId: true,
        quantityShipped: true,
      },
    });
    if (!item) {
      return toApiErrorResponseFromStatus("Shipment item not found for this receipt.", 404);
    }

    const shipped = Number(item.quantityShipped);
    const disposition = resolveVarianceDisposition(shipped, receivedQty, input.varianceDisposition ?? null);

    const rawNote = input.varianceNote;
    const varianceNotePayload =
      rawNote === undefined
        ? undefined
        : rawNote === null || String(rawNote).trim() === ""
          ? null
          : String(rawNote).trim().slice(0, 1000);

    const cwParsed = parseOptionalCatchWeightKgBf63(input.catchWeightKg);
    if (!cwParsed.ok) return cwParsed.response;
    const catchWeightKg = cwParsed.value;

    const qtyStr = receivedQty.toFixed(3);

    await prisma.$transaction(async (tx) => {
      await tx.wmsReceiptLine.upsert({
        where: {
          receiptId_shipmentItemId: { receiptId: receipt.id, shipmentItemId: item.id },
        },
        create: {
          receiptId: receipt.id,
          shipmentItemId: item.id,
          quantityReceived: qtyStr,
          wmsVarianceDisposition: disposition,
          ...(varianceNotePayload !== undefined ? { wmsVarianceNote: varianceNotePayload } : {}),
        },
        update: {
          quantityReceived: qtyStr,
          wmsVarianceDisposition: disposition,
          ...(varianceNotePayload !== undefined ? { wmsVarianceNote: varianceNotePayload } : {}),
        },
      });

      await writeShipmentItemReceiveLineInTx(
        tx,
        tenantId,
        actorId,
        {
          itemId: item.id,
          shipmentId: item.shipmentId,
          quantityShipped: shipped,
          receivedQty,
          disposition,
          varianceNotePayload,
          ...(catchWeightKg !== undefined ? { catchWeightKg } : {}),
        },
        { wmsReceiptId: receipt.id, source: "set_wms_receipt_line" },
      );
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "set_wms_lot_batch") {
    const productId = input.productId?.trim();
    if (!productId) {
      return toApiErrorResponseFromStatus("productId required.", 400);
    }

    let lotCode: string;
    try {
      lotCode = requireNonFungibleLotBatchCode(input.lotCode);
    } catch (e) {
      return toApiErrorResponseFromStatus(e instanceof Error ? e.message : "Invalid lotCode.", 400);
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!product) {
      return toApiErrorResponseFromStatus("Product not found.", 404);
    }

    let expiryParsed;
    try {
      expiryParsed = parseLotBatchExpiryInput(input.batchExpiryDate as string | null | undefined);
    } catch (e) {
      return toApiErrorResponseFromStatus(
        e instanceof Error ? e.message : "Invalid batchExpiryDate.",
        400,
      );
    }

    const countryParsed = truncateLotBatchCountry(
      input.batchCountryOfOrigin as string | null | undefined,
    );
    const notesParsed = truncateLotBatchNotes(input.batchNotes as string | null | undefined);

    const row = await prisma.$transaction(async (tx) => {
      const upserted = await tx.wmsLotBatch.upsert({
        where: {
          tenantId_productId_lotCode: { tenantId, productId, lotCode },
        },
        create: {
          tenantId,
          productId,
          lotCode,
          expiryDate: expiryParsed.mode === "set" ? expiryParsed.date : null,
          countryOfOrigin: countryParsed !== undefined ? countryParsed : null,
          notes: notesParsed !== undefined ? notesParsed : null,
        },
        update: {
          ...(expiryParsed.mode !== "omit"
            ? {
                expiryDate:
                  expiryParsed.mode === "clear" ? null : expiryParsed.mode === "set" ? expiryParsed.date : null,
              }
            : {}),
          ...(countryParsed !== undefined ? { countryOfOrigin: countryParsed } : {}),
          ...(notesParsed !== undefined ? { notes: notesParsed } : {}),
        },
      });

      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WMS_LOT_BATCH",
          entityId: upserted.id,
          action: "lot_batch_upserted",
          payload: {
            productId,
            lotCode,
            expiryDate: upserted.expiryDate?.toISOString().slice(0, 10) ?? null,
            countryOfOrigin: upserted.countryOfOrigin,
          },
          actorUserId: actorId,
        },
      });
      return upserted;
    });

    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "set_inventory_movement_custody_segment_bf64") {
    const movementId = input.inventoryMovementId?.trim();
    if (!movementId) {
      return toApiErrorResponseFromStatus("inventoryMovementId required.", 400);
    }
    if (input.custodySegmentJson === undefined) {
      return toApiErrorResponseFromStatus(
        "custodySegmentJson required (object or null to clear).",
        400,
      );
    }
    const seg = parseCustodySegmentJsonForPatch(input.custodySegmentJson);
    if (!seg.ok) {
      return toApiErrorResponseFromStatus(seg.message, 400);
    }
    if (seg.mode === "omit") {
      return toApiErrorResponseFromStatus(
        "custodySegmentJson required (object or null to clear).",
        400,
      );
    }

    const row = await prisma.inventoryMovement.findFirst({
      where: { id: movementId, tenantId },
      select: { id: true, referenceType: true, referenceId: true },
    });
    if (!row) {
      return toApiErrorResponseFromStatus("Inventory movement not found.", 404);
    }

    const updateData: Prisma.InventoryMovementUpdateInput =
      seg.mode === "clear"
        ? { custodySegmentJson: Prisma.DbNull }
        : { custodySegmentJson: seg.value };

    const linkShipmentId =
      row.referenceType === "SHIPMENT" && row.referenceId?.trim()
        ? row.referenceId.trim()
        : null;
    const breachPayload =
      seg.mode === "set" && custodySegmentIndicatesBreach(seg.value as unknown)
        ? seg.value
        : null;

    await prisma.$transaction(async (tx) => {
      await tx.inventoryMovement.update({
        where: { id: row.id },
        data: updateData,
      });
      if (breachPayload != null) {
        await tx.ctAuditLog.create({
          data: {
            tenantId,
            shipmentId: linkShipmentId,
            entityType: "INVENTORY_MOVEMENT",
            entityId: row.id,
            action: "cold_chain_custody_breach_bf64",
            payload: {
              inventoryMovementId: row.id,
              custodySegmentJson: breachPayload as Prisma.InputJsonValue,
            },
            actorUserId: actorId,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "create_wms_damage_report_bf65") {
    const rawCtx = input.damageReportContext;
    if (rawCtx !== "RECEIVING" && rawCtx !== "PACKING") {
      return toApiErrorResponseFromStatus("damageReportContext must be RECEIVING or PACKING.", 400);
    }
    const shipmentIdIn = input.shipmentId?.trim() ?? "";
    const outboundOrderIdIn = input.outboundOrderId?.trim() ?? "";
    if (rawCtx === "RECEIVING") {
      if (!shipmentIdIn) {
        return toApiErrorResponseFromStatus("shipmentId required for RECEIVING context.", 400);
      }
      if (outboundOrderIdIn) {
        return toApiErrorResponseFromStatus("outboundOrderId must be omitted for RECEIVING context.", 400);
      }
    } else {
      if (!outboundOrderIdIn) {
        return toApiErrorResponseFromStatus("outboundOrderId required for PACKING context.", 400);
      }
      if (shipmentIdIn) {
        return toApiErrorResponseFromStatus("shipmentId must be omitted for PACKING context.", 400);
      }
    }

    const statusRaw = input.damageReportStatus;
    const status =
      statusRaw === "SUBMITTED"
        ? "SUBMITTED"
        : statusRaw === "DRAFT" || statusRaw === undefined
          ? "DRAFT"
          : null;
    if (!status) {
      return toApiErrorResponseFromStatus("damageReportStatus must be DRAFT or SUBMITTED.", 400);
    }

    const photos = parseDamagePhotoUrlsForCreate(input.damagePhotoUrls);
    if (!photos.ok) {
      return toApiErrorResponseFromStatus(photos.message, 400);
    }

    let extraDetailValue: Prisma.InputJsonValue | null | undefined = undefined;
    if (input.damageExtraDetailJson !== undefined) {
      const ex = parseDamageExtraDetailJson(input.damageExtraDetailJson);
      if (!ex.ok) {
        return toApiErrorResponseFromStatus(ex.message, 400);
      }
      extraDetailValue = ex.value;
    }

    const category = input.damageCategory?.trim().slice(0, DAMAGE_CATEGORY_MAX) || null;
    const descRaw = input.damageDescription?.trim() ?? "";
    if (descRaw.length > DAMAGE_DESCRIPTION_MAX) {
      return toApiErrorResponseFromStatus(
        `damageDescription must be at most ${DAMAGE_DESCRIPTION_MAX} characters.`,
        400,
      );
    }
    const description = descRaw.length > 0 ? descRaw : null;

    const claimRef =
      input.carrierClaimReference?.trim().slice(0, DAMAGE_CARRIER_CLAIM_REF_MAX) || null;

    let shipmentId: string | null = null;
    let outboundOrderId: string | null = null;
    let shipmentItemId: string | null = null;

    if (rawCtx === "RECEIVING") {
      const ship = await prisma.shipment.findFirst({
        where: { id: shipmentIdIn, order: { tenantId } },
        select: { id: true },
      });
      if (!ship) {
        return toApiErrorResponseFromStatus("Shipment not found for tenant.", 404);
      }
      shipmentId = ship.id;

      const itemIdRaw = input.shipmentItemId?.trim() ?? "";
      if (itemIdRaw) {
        const line = await prisma.shipmentItem.findFirst({
          where: { id: itemIdRaw, shipmentId: ship.id },
          select: { id: true },
        });
        if (!line) {
          return toApiErrorResponseFromStatus("shipmentItemId not found on shipment.", 404);
        }
        shipmentItemId = line.id;
      }
    } else {
      const ob = await prisma.outboundOrder.findFirst({
        where: { id: outboundOrderIdIn, tenantId },
        select: { id: true },
      });
      if (!ob) {
        return toApiErrorResponseFromStatus("Outbound order not found for tenant.", 404);
      }
      outboundOrderId = ob.id;
      if (input.shipmentItemId?.trim()) {
        return toApiErrorResponseFromStatus("shipmentItemId applies only to RECEIVING context.", 400);
      }
    }

    const row = await prisma.wmsDamageReport.create({
      data: {
        tenantId,
        context: rawCtx,
        status,
        shipmentId,
        outboundOrderId,
        shipmentItemId,
        damageCategory: category,
        description,
        photoUrlsJson: photos.urls,
        ...(extraDetailValue === undefined
          ? {}
          : {
              extraDetailJson:
                extraDetailValue === null ? Prisma.JsonNull : extraDetailValue,
            }),
        carrierClaimReference: claimRef,
        createdById: actorId,
      },
      select: { id: true },
    });

    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        shipmentId,
        entityType: "WMS_DAMAGE_REPORT",
        entityId: row.id,
        action: "wms_damage_report_created_bf65",
        payload: {
          context: rawCtx,
          shipmentId,
          outboundOrderId,
          shipmentItemId,
        },
        actorUserId: actorId,
      },
    });

    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "register_inventory_serial") {
    const productId = input.productId?.trim();
    const rawSn = input.inventorySerialNo?.trim();
    if (!productId || !rawSn) {
      return toApiErrorResponseFromStatus("productId and inventorySerialNo required.", 400);
    }
    let serialNo: string;
    try {
      serialNo = normalizeInventorySerialNo(rawSn);
    } catch (e) {
      return toApiErrorResponseFromStatus(
        e instanceof InventorySerialNoError ? e.message : "Invalid inventorySerialNo.",
        400,
      );
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!product) {
      return toApiErrorResponseFromStatus("Product not found.", 404);
    }

    const rawNote = input.inventorySerialNote;
    const noteParsed =
      rawNote === undefined
        ? undefined
        : rawNote === null || String(rawNote).trim() === ""
          ? null
          : String(rawNote).trim().slice(0, 500);

    try {
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.wmsInventorySerial.create({
          data: {
            tenantId,
            productId: product.id,
            serialNo,
            ...(noteParsed !== undefined ? { note: noteParsed } : {}),
          },
          select: { id: true, serialNo: true },
        });
        await tx.ctAuditLog.create({
          data: {
            tenantId,
            entityType: "WMS_INVENTORY_SERIAL",
            entityId: created.id,
            action: "inventory_serial_registered",
            payload: { productId: product.id, serialNo: created.serialNo },
            actorUserId: actorId,
          },
        });
        return created;
      });
      return NextResponse.json({ ok: true, id: row.id });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return toApiErrorResponseFromStatus("Serial already registered for this product.", 409);
      }
      throw e;
    }
  }

  if (action === "set_inventory_serial_balance") {
    const sid = input.inventorySerialId?.trim();
    const pid = input.productId?.trim();
    const rawSn = input.inventorySerialNo?.trim();
    if (!sid && (!pid || !rawSn)) {
      return toApiErrorResponseFromStatus(
        "inventorySerialId or (productId and inventorySerialNo) required.",
        400,
      );
    }
    if (!("serialBalanceId" in input)) {
      return toApiErrorResponseFromStatus(
        "serialBalanceId required (balance row id, or null to clear pointer).",
        400,
      );
    }

    let serialRow: { id: string; productId: string } | null = null;
    if (sid) {
      serialRow = await prisma.wmsInventorySerial.findFirst({
        where: { id: sid, tenantId },
        select: { id: true, productId: true },
      });
    } else if (pid && rawSn) {
      let serialNo: string;
      try {
        serialNo = normalizeInventorySerialNo(rawSn);
      } catch (e) {
        return toApiErrorResponseFromStatus(
          e instanceof InventorySerialNoError ? e.message : "Invalid inventorySerialNo.",
          400,
        );
      }
      serialRow = await prisma.wmsInventorySerial.findFirst({
        where: { tenantId, productId: pid, serialNo },
        select: { id: true, productId: true },
      });
    }
    if (!serialRow) {
      return toApiErrorResponseFromStatus("Serial not found.", 404);
    }

    const balRaw = input.serialBalanceId;
    if (balRaw === null) {
      await prisma.$transaction(async (tx) => {
        await tx.wmsInventorySerial.update({
          where: { id: serialRow!.id },
          data: { currentBalanceId: null },
        });
        await tx.ctAuditLog.create({
          data: {
            tenantId,
            entityType: "WMS_INVENTORY_SERIAL",
            entityId: serialRow!.id,
            action: "inventory_serial_balance_cleared",
            payload: {},
            actorUserId: actorId,
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    const balanceId = typeof balRaw === "string" ? balRaw.trim() : "";
    if (!balanceId) {
      return toApiErrorResponseFromStatus("serialBalanceId must be a non-empty string or null.", 400);
    }

    const balance = await prisma.inventoryBalance.findFirst({
      where: { id: balanceId, tenantId, productId: serialRow.productId },
      select: { id: true },
    });
    if (!balance) {
      return toApiErrorResponseFromStatus("Balance not found for this product.", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wmsInventorySerial.update({
        where: { id: serialRow!.id },
        data: { currentBalanceId: balance.id },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WMS_INVENTORY_SERIAL",
          entityId: serialRow!.id,
          action: "inventory_serial_balance_set",
          payload: { balanceId: balance.id },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "attach_inventory_serial_to_movement") {
    const movementId = input.inventoryMovementId?.trim();
    if (!movementId) {
      return toApiErrorResponseFromStatus("inventoryMovementId required.", 400);
    }

    const sid = input.inventorySerialId?.trim();
    const pid = input.productId?.trim();
    const rawSn = input.inventorySerialNo?.trim();
    if (!sid && (!pid || !rawSn)) {
      return toApiErrorResponseFromStatus(
        "inventorySerialId or (productId and inventorySerialNo) required.",
        400,
      );
    }

    let serialRow: { id: string; productId: string } | null = null;
    if (sid) {
      serialRow = await prisma.wmsInventorySerial.findFirst({
        where: { id: sid, tenantId },
        select: { id: true, productId: true },
      });
    } else if (pid && rawSn) {
      let serialNo: string;
      try {
        serialNo = normalizeInventorySerialNo(rawSn);
      } catch (e) {
        return toApiErrorResponseFromStatus(
          e instanceof InventorySerialNoError ? e.message : "Invalid inventorySerialNo.",
          400,
        );
      }
      serialRow = await prisma.wmsInventorySerial.findFirst({
        where: { tenantId, productId: pid, serialNo },
        select: { id: true, productId: true },
      });
    }
    if (!serialRow) {
      return toApiErrorResponseFromStatus("Serial not found.", 404);
    }

    const movement = await prisma.inventoryMovement.findFirst({
      where: { id: movementId, tenantId },
      select: { id: true, productId: true },
    });
    if (!movement) {
      return toApiErrorResponseFromStatus("Movement not found.", 404);
    }
    if (movement.productId !== serialRow.productId) {
      return toApiErrorResponseFromStatus("Movement product does not match serial.", 400);
    }

    const existing = await prisma.wmsInventorySerialMovement.findFirst({
      where: { serialId: serialRow.id, inventoryMovementId: movement.id },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.wmsInventorySerialMovement.create({
        data: { serialId: serialRow!.id, inventoryMovementId: movement.id },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WMS_INVENTORY_SERIAL",
          entityId: serialRow!.id,
          action: "inventory_serial_movement_linked",
          payload: { inventoryMovementId: movement.id },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "set_wms_dock_detention_policy") {
    if (input.dockDetentionPolicyClear === true) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { wmsDockDetentionPolicyJson: Prisma.JsonNull },
      });
      return NextResponse.json({ ok: true });
    }
    if (typeof input.dockDetentionEnabled !== "boolean") {
      return toApiErrorResponseFromStatus(
        "dockDetentionEnabled (boolean) required, or dockDetentionPolicyClear true.",
        400,
      );
    }
    const draft: Record<string, unknown> = { enabled: input.dockDetentionEnabled };
    if (input.dockDetentionFreeGateToDockMinutes !== undefined) {
      draft.freeMinutesGateToDock = Number(input.dockDetentionFreeGateToDockMinutes);
    }
    if (input.dockDetentionFreeDockToDepartMinutes !== undefined) {
      draft.freeMinutesDockToDepart = Number(input.dockDetentionFreeDockToDepartMinutes);
    }
    const parsed = parseDockDetentionPolicy(draft);
    if (!parsed.ok) {
      return toApiErrorResponseFromStatus(parsed.error, 400);
    }
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        wmsDockDetentionPolicyJson: {
          enabled: parsed.value.enabled,
          freeMinutesGateToDock: parsed.value.freeMinutesGateToDock,
          freeMinutesDockToDepart: parsed.value.freeMinutesDockToDepart,
        },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_dock_appointment") {
    const warehouseId = input.warehouseId?.trim();
    const dockCodeRaw = input.dockCode?.trim();
    const dockDirection = input.dockDirection;
    const shipmentId = input.shipmentId?.trim();
    const outboundOrderId = input.outboundOrderId?.trim();
    const dockWindowStart = input.dockWindowStart?.trim();
    const dockWindowEnd = input.dockWindowEnd?.trim();
    const apptNote = input.note?.trim();

    if (!warehouseId || !dockCodeRaw || !dockDirection || !dockWindowStart || !dockWindowEnd) {
      return toApiErrorResponseFromStatus(
        "warehouseId, dockCode, dockDirection, dockWindowStart and dockWindowEnd required.",
        400,
      );
    }
    if (dockDirection !== "INBOUND" && dockDirection !== "OUTBOUND") {
      return toApiErrorResponseFromStatus("dockDirection must be INBOUND or OUTBOUND.", 400);
    }

    const hasShip = Boolean(shipmentId);
    const hasOut = Boolean(outboundOrderId);
    if (hasShip === hasOut) {
      return toApiErrorResponseFromStatus("Provide exactly one of shipmentId or outboundOrderId.", 400);
    }

    const windowStart = new Date(dockWindowStart);
    const windowEnd = new Date(dockWindowEnd);
    if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
      return toApiErrorResponseFromStatus("Invalid dock window datetimes.", 400);
    }
    if (windowEnd <= windowStart) {
      return toApiErrorResponseFromStatus("dockWindowEnd must be after dockWindowStart.", 400);
    }

    const dockCode = normalizeDockCode(dockCodeRaw);
    if (!dockCode) {
      return toApiErrorResponseFromStatus("dockCode required.", 400);
    }

    let doorCodeValue: string | null | undefined = undefined;
    if ("doorCode" in input) {
      const dr = input.doorCode;
      if (dr === null || dr === undefined || String(dr).trim() === "") {
        doorCodeValue = null;
      } else {
        const normalized = normalizeDoorCode(String(dr));
        doorCodeValue = normalized || null;
      }
    }

    let trailerChecklistCreate: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined = undefined;
    if ("trailerChecklistJson" in input && input.trailerChecklistJson !== undefined) {
      const rawChk = input.trailerChecklistJson;
      if (rawChk === null) {
        trailerChecklistCreate = Prisma.DbNull;
      } else {
        const parsedChk = parseTrailerChecklistJson(rawChk);
        if (!parsedChk.ok) {
          return toApiErrorResponseFromStatus(parsedChk.error, 400);
        }
        trailerChecklistCreate = parsedChk.value;
      }
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      select: { id: true },
    });
    if (!warehouse) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }

    if (shipmentId) {
      const ship = await prisma.shipment.findFirst({
        where: { id: shipmentId, order: { tenantId } },
        select: { id: true },
      });
      if (!ship) {
        return toApiErrorResponseFromStatus("Shipment not found.", 404);
      }
      if (dockDirection !== "INBOUND") {
        return toApiErrorResponseFromStatus("Inbound appointments must use dockDirection INBOUND.", 400);
      }
    }

    if (outboundOrderId) {
      const orderRow = await prisma.outboundOrder.findFirst({
        where: { id: outboundOrderId, tenantId },
        select: { id: true, warehouseId: true },
      });
      if (!orderRow) {
        return toApiErrorResponseFromStatus("Outbound order not found.", 404);
      }
      if (dockDirection !== "OUTBOUND") {
        return toApiErrorResponseFromStatus("Outbound appointments must use dockDirection OUTBOUND.", 400);
      }
      if (orderRow.warehouseId !== warehouseId) {
        return toApiErrorResponseFromStatus(
          "warehouseId must match the outbound order warehouse.",
          400,
        );
      }
    }

    const overlap = await prisma.wmsDockAppointment.findFirst({
      where: {
        tenantId,
        warehouseId,
        dockCode,
        status: "SCHEDULED",
        AND: [{ windowStart: { lt: windowEnd } }, { windowEnd: { gt: windowStart } }],
      },
    });
    if (overlap) {
      return toApiErrorResponseFromStatus(
        "Dock window overlaps an existing scheduled appointment for this dock.",
        409,
      );
    }

    await prisma.wmsDockAppointment.create({
      data: {
        tenantId,
        warehouseId,
        dockCode,
        windowStart,
        windowEnd,
        direction: dockDirection,
        shipmentId: shipmentId ?? null,
        outboundOrderId: outboundOrderId ?? null,
        note: apptNote ? apptNote.slice(0, 500) : null,
        ...(doorCodeValue !== undefined ? { doorCode: doorCodeValue } : {}),
        ...(trailerChecklistCreate !== undefined
          ? { trailerChecklistJson: trailerChecklistCreate }
          : {}),
        carrierName: truncateDockTransportField(input.carrierName, DOCK_TRANSPORT_LIMITS.carrierName),
        carrierReference: truncateDockTransportField(input.carrierReference, DOCK_TRANSPORT_LIMITS.carrierReference),
        trailerId: truncateDockTransportField(input.trailerId, DOCK_TRANSPORT_LIMITS.trailerId),
        createdById: actorId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel_dock_appointment") {
    const dockAppointmentId = input.dockAppointmentId?.trim();
    if (!dockAppointmentId) {
      return toApiErrorResponseFromStatus("dockAppointmentId required.", 400);
    }
    const existing = await prisma.wmsDockAppointment.findFirst({
      where: { id: dockAppointmentId, tenantId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return toApiErrorResponseFromStatus("Appointment not found.", 404);
    }
    if (existing.status !== "SCHEDULED") {
      return toApiErrorResponseFromStatus("Only SCHEDULED appointments can be cancelled.", 400);
    }
    await prisma.wmsDockAppointment.update({
      where: { id: existing.id },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_dock_appointment_bf38") {
    const dockAppointmentId = input.dockAppointmentId?.trim();
    if (!dockAppointmentId) {
      return toApiErrorResponseFromStatus("dockAppointmentId required.", 400);
    }
    const existingAppt = await prisma.wmsDockAppointment.findFirst({
      where: { id: dockAppointmentId, tenantId },
      select: { id: true, status: true, shipmentId: true },
    });
    if (!existingAppt) {
      return toApiErrorResponseFromStatus("Appointment not found.", 404);
    }
    if (existingAppt.status === "CANCELLED") {
      return toApiErrorResponseFromStatus("Cancelled appointments cannot be edited.", 400);
    }

    const data: Prisma.WmsDockAppointmentUpdateInput = {};
    if ("doorCode" in input) {
      const dr = input.doorCode;
      if (dr === null || dr === undefined || String(dr).trim() === "") {
        data.doorCode = null;
      } else {
        const normalized = normalizeDoorCode(String(dr));
        data.doorCode = normalized || null;
      }
    }
    if ("trailerChecklistJson" in input && input.trailerChecklistJson !== undefined) {
      const rawChk = input.trailerChecklistJson;
      if (rawChk === null) {
        data.trailerChecklistJson = Prisma.JsonNull;
      } else {
        const parsedChk = parseTrailerChecklistJson(rawChk);
        if (!parsedChk.ok) {
          return toApiErrorResponseFromStatus(parsedChk.error, 400);
        }
        data.trailerChecklistJson = parsedChk.value;
      }
    }

    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus(
        "Provide doorCode and/or trailerChecklistJson (null clears each when included).",
        400,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.wmsDockAppointment.update({
        where: { id: existingAppt.id },
        data,
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: existingAppt.shipmentId,
          entityType: "WMS_DOCK_APPOINTMENT",
          entityId: existingAppt.id,
          action: "dock_bf38_updated",
          payload: {
            doorCode: "doorCode" in data ? data.doorCode : undefined,
            checklistTouched: "trailerChecklistJson" in data,
          },
          actorUserId: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_dock_appointment_transport") {
    const dockAppointmentId = input.dockAppointmentId?.trim();
    if (!dockAppointmentId) {
      return toApiErrorResponseFromStatus("dockAppointmentId required.", 400);
    }
    const existingAppt = await prisma.wmsDockAppointment.findFirst({
      where: { id: dockAppointmentId, tenantId },
      select: { id: true, status: true, shipmentId: true },
    });
    if (!existingAppt) {
      return toApiErrorResponseFromStatus("Appointment not found.", 404);
    }
    if (existingAppt.status === "CANCELLED") {
      return toApiErrorResponseFromStatus("Cancelled appointments cannot be edited.", 400);
    }

    const updatePayload: {
      carrierName?: string | null;
      carrierReference?: string | null;
      trailerId?: string | null;
    } = {};
    if ("carrierName" in input) {
      updatePayload.carrierName = truncateDockTransportField(input.carrierName, DOCK_TRANSPORT_LIMITS.carrierName);
    }
    if ("carrierReference" in input) {
      updatePayload.carrierReference = truncateDockTransportField(
        input.carrierReference,
        DOCK_TRANSPORT_LIMITS.carrierReference,
      );
    }
    if ("trailerId" in input) {
      updatePayload.trailerId = truncateDockTransportField(input.trailerId, DOCK_TRANSPORT_LIMITS.trailerId);
    }
    if (
      updatePayload.carrierName === undefined &&
      updatePayload.carrierReference === undefined &&
      updatePayload.trailerId === undefined
    ) {
      return toApiErrorResponseFromStatus(
        "Provide at least one of carrierName, carrierReference, trailerId (null clears).",
        400,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.wmsDockAppointment.update({
        where: { id: existingAppt.id },
        data: updatePayload,
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: existingAppt.shipmentId,
          entityType: "WMS_DOCK_APPOINTMENT",
          entityId: existingAppt.id,
          action: "dock_transport_updated",
          payload: updatePayload,
          actorUserId: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_dock_appointment_tms_refs") {
    const dockAppointmentId = input.dockAppointmentId?.trim();
    if (!dockAppointmentId) {
      return toApiErrorResponseFromStatus("dockAppointmentId required.", 400);
    }
    const existingAppt = await prisma.wmsDockAppointment.findFirst({
      where: { id: dockAppointmentId, tenantId },
      select: { id: true, status: true, shipmentId: true },
    });
    if (!existingAppt) {
      return toApiErrorResponseFromStatus("Appointment not found.", 404);
    }
    if (existingAppt.status === "CANCELLED") {
      return toApiErrorResponseFromStatus("Cancelled appointments cannot be edited.", 400);
    }

    const updatePayload: {
      tmsLoadId?: string | null;
      tmsCarrierBookingRef?: string | null;
    } = {};
    if ("tmsLoadId" in input) {
      updatePayload.tmsLoadId = truncateDockTransportField(input.tmsLoadId, DOCK_TMS_LIMITS.tmsLoadId);
    }
    if ("tmsCarrierBookingRef" in input) {
      updatePayload.tmsCarrierBookingRef = truncateDockTransportField(
        input.tmsCarrierBookingRef,
        DOCK_TMS_LIMITS.tmsCarrierBookingRef,
      );
    }
    if (updatePayload.tmsLoadId === undefined && updatePayload.tmsCarrierBookingRef === undefined) {
      return toApiErrorResponseFromStatus(
        "Provide at least one of tmsLoadId, tmsCarrierBookingRef (null clears).",
        400,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.wmsDockAppointment.update({
        where: { id: existingAppt.id },
        data: updatePayload,
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: existingAppt.shipmentId,
          entityType: "WMS_DOCK_APPOINTMENT",
          entityId: existingAppt.id,
          action: "dock_tms_refs_updated",
          payload: updatePayload,
          actorUserId: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "record_dock_appointment_yard_milestone") {
    const dockAppointmentId = input.dockAppointmentId?.trim();
    const milestone = parseDockYardMilestone(input.yardMilestone);
    if (!dockAppointmentId) {
      return toApiErrorResponseFromStatus("dockAppointmentId required.", 400);
    }
    if (!milestone) {
      return toApiErrorResponseFromStatus("yardMilestone must be GATE_IN, AT_DOCK, or DEPARTED.", 400);
    }

    const rawOccurred = input.yardOccurredAt?.trim();
    const occurredAt = rawOccurred ? new Date(rawOccurred) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      return toApiErrorResponseFromStatus("Invalid yardOccurredAt.", 400);
    }

    const existingRow = await prisma.wmsDockAppointment.findFirst({
      where: { id: dockAppointmentId, tenantId },
      select: {
        id: true,
        status: true,
        shipmentId: true,
        doorCode: true,
        trailerChecklistJson: true,
        gateCheckedInAt: true,
        atDockAt: true,
      },
    });
    if (!existingRow) {
      return toApiErrorResponseFromStatus("Appointment not found.", 404);
    }
    if (existingRow.status !== "SCHEDULED") {
      return toApiErrorResponseFromStatus("Only SCHEDULED appointments can record yard milestones.", 400);
    }

    if (
      milestone === "AT_DOCK" &&
      process.env.WMS_BF38_REQUIRE_DOOR_BEFORE_AT_DOCK === "1" &&
      !existingRow.doorCode?.trim()
    ) {
      return toApiErrorResponseFromStatus(
        "Assign door (BF-38 doorCode) before recording AT_DOCK, or unset WMS_BF38_REQUIRE_DOOR_BEFORE_AT_DOCK.",
        400,
      );
    }

    if (milestone === "DEPARTED" && !trailerChecklistAllowsDepart(existingRow.trailerChecklistJson)) {
      return toApiErrorResponseFromStatus(
        "Complete required trailer checklist items before recording DEPARTED (BF-38).",
        400,
      );
    }

    const milestoneData: Prisma.WmsDockAppointmentUpdateInput =
      milestone === "GATE_IN"
        ? { gateCheckedInAt: occurredAt }
        : milestone === "AT_DOCK"
          ? { atDockAt: occurredAt }
          : { departedAt: occurredAt, status: "COMPLETED" };

    const tenantDetentionRow = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { wmsDockDetentionPolicyJson: true },
    });
    const detentionParsed = parseDockDetentionPolicy(tenantDetentionRow?.wmsDockDetentionPolicyJson);
    const detentionPolicyForEval = detentionParsed.ok
      ? detentionParsed.value
      : { enabled: false, freeMinutesGateToDock: 120, freeMinutesDockToDepart: 240 };

    await prisma.$transaction(async (tx) => {
      await tx.wmsDockAppointment.update({
        where: { id: existingRow.id },
        data: milestoneData,
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: existingRow.shipmentId,
          entityType: "WMS_DOCK_APPOINTMENT",
          entityId: existingRow.id,
          action: "dock_yard_milestone",
          payload: { milestone, occurredAt: occurredAt.toISOString() },
          actorUserId: actorId,
        },
      });

      const breach =
        milestone === "AT_DOCK" || milestone === "DEPARTED"
          ? detectMilestonePhaseBreach({
              policy: detentionPolicyForEval,
              milestone,
              occurredAt,
              gateCheckedInAt: existingRow.gateCheckedInAt,
              atDockAt: milestone === "DEPARTED" ? existingRow.atDockAt : null,
            })
          : null;
      if (breach) {
        await tx.ctAuditLog.create({
          data: {
            tenantId,
            shipmentId: existingRow.shipmentId,
            entityType: "WMS_DOCK_APPOINTMENT",
            entityId: existingRow.id,
            action: "dock_detention_breach",
            payload: {
              phase: breach.phase,
              actualMinutes: breach.actualMinutes,
              limitMinutes: breach.limitMinutes,
              milestone,
              occurredAt: occurredAt.toISOString(),
            },
            actorUserId: actorId,
          },
        });
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "record_shipment_milestone") {
    const shipmentId = input.shipmentId?.trim();
    const rawCode = input.milestoneCode?.trim();
    if (!shipmentId || !rawCode) {
      return toApiErrorResponseFromStatus("shipmentId and milestoneCode required.", 400);
    }
    if (!Object.values(ShipmentMilestoneCode).includes(rawCode as ShipmentMilestoneCode)) {
      return toApiErrorResponseFromStatus("Invalid milestoneCode.", 400);
    }
    const code = rawCode as ShipmentMilestoneCode;
    const shipment = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: { id: true },
    });
    if (!shipment) {
      return toApiErrorResponseFromStatus("Shipment not found.", 404);
    }
    await prisma.shipmentMilestone.create({
      data: {
        shipmentId: shipment.id,
        code,
        note: input.note?.trim() || null,
        updatedById: actorId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "apply_inventory_freeze") {
    const reasonParsed = normalizeInventoryFreezeReasonCode(
      input.holdReasonCode ?? input.inventoryFreezeReasonCode,
    );
    if (!reasonParsed.ok) {
      return toApiErrorResponseFromStatus(reasonParsed.error, 400);
    }
    const grantParsed = normalizeHoldReleaseGrantInput(input.holdReleaseGrant);
    if (!grantParsed.ok) {
      return toApiErrorResponseFromStatus(grantParsed.error, 400);
    }
    const rawNote =
      input.holdReason?.trim() ||
      input.freezeNote?.trim() ||
      reasonParsed.code.replaceAll("_", " ");
    const note = rawNote.slice(0, 500);
    const now = new Date();
    const data = {
      onHold: true,
      holdReason: note,
      holdReasonCode: reasonParsed.code,
      holdAppliedAt: now,
      holdAppliedById: actorId,
      holdReleaseGrant: grantParsed.grant,
    };
    const balanceId = input.balanceId?.trim();
    if (balanceId) {
      const n = await prisma.inventoryBalance.updateMany({
        where: { id: balanceId, tenantId },
        data,
      });
      if (n.count === 0) return toApiErrorResponseFromStatus("Balance row not found.", 404);
      return NextResponse.json({ ok: true, updatedCount: n.count });
    }
    const wh = input.freezeScopeWarehouseId?.trim();
    const pid = input.freezeScopeProductId?.trim();
    if (!wh || !pid) {
      return toApiErrorResponseFromStatus(
        "balanceId or (freezeScopeWarehouseId + freezeScopeProductId) required.",
        400,
      );
    }
    const whRow = await prisma.warehouse.findFirst({
      where: { id: wh, tenantId },
      select: { id: true },
    });
    if (!whRow) return toApiErrorResponseFromStatus("freezeScopeWarehouseId not found.", 404);
    const prodRow = await prisma.product.findFirst({
      where: { id: pid, tenantId },
      select: { id: true },
    });
    if (!prodRow) return toApiErrorResponseFromStatus("freezeScopeProductId not found.", 404);
    const whereBal: Prisma.InventoryBalanceWhereInput = {
      tenantId,
      warehouseId: wh,
      productId: pid,
    };
    if (input.freezeScopeLotCode !== undefined && input.freezeScopeLotCode !== null) {
      whereBal.lotCode = normalizeLotCode(input.freezeScopeLotCode);
    }
    const n = await prisma.inventoryBalance.updateMany({ where: whereBal, data });
    return NextResponse.json({ ok: true, updatedCount: n.count });
  }

  if (action === "set_balance_hold") {
    const balanceId = input.balanceId?.trim();
    if (!balanceId) {
      return toApiErrorResponseFromStatus("balanceId required.", 400);
    }
    const reason = input.holdReason?.trim() || "On hold";
    const n = await prisma.inventoryBalance.updateMany({
      where: { id: balanceId, tenantId },
      data: {
        onHold: true,
        holdReason: reason.slice(0, 500),
        holdReasonCode: "OTHER",
        holdAppliedAt: new Date(),
        holdAppliedById: actorId,
        holdReleaseGrant: null,
      },
    });
    if (n.count === 0) return toApiErrorResponseFromStatus("Balance row not found.", 404);
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_balance_hold") {
    const balanceId = input.balanceId?.trim();
    if (!balanceId) {
      return toApiErrorResponseFromStatus("balanceId required.", 400);
    }
    const errRes = await releaseInventoryHoldForBalanceId(tenantId, actorId, balanceId);
    if (errRes) return errRes;
    return NextResponse.json({ ok: true });
  }

  if (action === "release_inventory_freeze") {
    const balanceId = input.balanceId?.trim();
    if (!balanceId) {
      return toApiErrorResponseFromStatus("balanceId required.", 400);
    }
    const errRes = await releaseInventoryHoldForBalanceId(tenantId, actorId, balanceId);
    if (errRes) return errRes;
    return NextResponse.json({ ok: true });
  }

  if (action === "create_soft_reservation") {
    const balanceId = input.balanceId?.trim();
    const qty = Number(input.quantity);
    if (!balanceId || !Number.isFinite(qty) || qty <= 0) {
      return toApiErrorResponseFromStatus("balanceId and positive quantity required.", 400);
    }
    const bal = await prisma.inventoryBalance.findFirst({
      where: { id: balanceId, tenantId },
      select: {
        id: true,
        warehouseId: true,
        onHandQty: true,
        allocatedQty: true,
        onHold: true,
      },
    });
    if (!bal) return toApiErrorResponseFromStatus("Balance row not found.", 404);
    if (bal.onHold) {
      return toApiErrorResponseFromStatus("Cannot soft-reserve: balance is on hold.", 400);
    }
    const softMap = await softReservedQtyByBalanceIds(prisma, tenantId, [bal.id]);
    const existingSoft = softMap.get(bal.id) ?? 0;
    const effective = Number(bal.onHandQty) - Number(bal.allocatedQty) - existingSoft;
    if (qty > effective) {
      return toApiErrorResponseFromStatus(
        `Insufficient ATP for soft reservation (effective available ${effective}).`,
        400,
      );
    }

    let expiresAt: Date;
    const iso = input.softReservationExpiresAt?.trim();
    if (iso) {
      expiresAt = new Date(iso);
      if (!Number.isFinite(expiresAt.getTime())) {
        return toApiErrorResponseFromStatus(
          "softReservationExpiresAt must be a valid ISO datetime.",
          400,
        );
      }
      if (expiresAt.getTime() <= Date.now()) {
        return toApiErrorResponseFromStatus("softReservationExpiresAt must be in the future.", 400);
      }
    } else {
      const ttl =
        input.softReservationTtlSeconds !== undefined
          ? Number(input.softReservationTtlSeconds)
          : 3600;
      if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 86400 * 366) {
        return toApiErrorResponseFromStatus(
          "softReservationTtlSeconds must be between 1 and 366 days.",
          400,
        );
      }
      expiresAt = new Date(Date.now() + ttl * 1000);
    }

    const refType = input.softReservationRefType?.trim() || null;
    const refId = input.softReservationRefId?.trim() || null;
    const note = input.softReservationNote?.trim().slice(0, 500) || null;

    const row = await prisma.wmsInventorySoftReservation.create({
      data: {
        tenantId,
        warehouseId: bal.warehouseId,
        inventoryBalanceId: bal.id,
        quantity: qty.toString(),
        expiresAt,
        referenceType: refType,
        referenceId: refId,
        note,
        createdById: actorId,
      },
      select: { id: true, expiresAt: true },
    });
    return NextResponse.json({
      ok: true,
      reservationId: row.id,
      expiresAt: row.expiresAt.toISOString(),
    });
  }

  if (action === "release_soft_reservation") {
    const reservationId = input.softReservationId?.trim();
    if (!reservationId) {
      return toApiErrorResponseFromStatus("softReservationId required.", 400);
    }
    const n = await prisma.wmsInventorySoftReservation.deleteMany({
      where: { id: reservationId, tenantId },
    });
    if (n.count === 0) return toApiErrorResponseFromStatus("Soft reservation not found.", 404);
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_replenish_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) return toApiErrorResponseFromStatus("taskId required.", 400);
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "REPLENISH" },
      select: {
        id: true,
        warehouseId: true,
        productId: true,
        quantity: true,
        binId: true,
        referenceId: true,
      },
    });
    if (!task?.productId || !task.binId || !task.referenceId) {
      return toApiErrorResponseFromStatus("Replenish task not found.", 404);
    }
    const productId = task.productId;
    const targetBinId = task.binId;
    const sourceBinId = task.referenceId;
    const qty = Number(task.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return toApiErrorResponseFromStatus("Invalid task quantity.", 400);
    }
    const sourceBalPre = await prisma.inventoryBalance.findFirst({
      where: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: sourceBinId,
        productId,
        lotCode: FUNGIBLE_LOT_CODE,
      },
      select: { id: true, onHandQty: true, allocatedQty: true },
    });
    if (!sourceBalPre) {
      return toApiErrorResponseFromStatus("Source bin has no balance row.", 400);
    }
    const replenSoftSingle = await softReservedQtyByBalanceIds(prisma, tenantId, [sourceBalPre.id]);
    const softRepl = replenSoftSingle.get(sourceBalPre.id) ?? 0;
    const movable =
      Number(sourceBalPre.onHandQty) - Number(sourceBalPre.allocatedQty) - softRepl;
    const moveQty = Math.min(qty, Math.max(0, movable));
    if (moveQty <= 0) {
      return toApiErrorResponseFromStatus("No available quantity to move from source bin.", 400);
    }
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.update({
        where: { id: task.id },
        data: {
          status: "DONE",
          quantity: moveQty.toString(),
          completedAt: new Date(),
          completedById: actorId,
        },
      });
      await tx.inventoryBalance.update({
        where: { id: sourceBalPre.id },
        data: { onHandQty: { decrement: moveQty.toString() } },
      });
      await tx.inventoryBalance.upsert({
        where: {
          warehouseId_binId_productId_lotCode: {
            warehouseId: task.warehouseId,
            binId: targetBinId,
            productId,
            lotCode: FUNGIBLE_LOT_CODE,
          },
        },
        create: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId,
          lotCode: FUNGIBLE_LOT_CODE,
          onHandQty: moveQty.toString(),
        },
        update: { onHandQty: { increment: moveQty.toString() } },
      });
      const neg = (-moveQty).toString();
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: sourceBinId,
          productId,
          movementType: "ADJUSTMENT",
          quantity: neg,
          referenceType: "REPLENISH_TASK",
          referenceId: task.id,
          note: "Replenish out",
          createdById: actorId,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId,
          movementType: "ADJUSTMENT",
          quantity: moveQty.toString(),
          referenceType: "REPLENISH_TASK",
          referenceId: task.id,
          note: "Replenish in",
          createdById: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_cycle_count_task") {
    const balanceId = input.balanceId?.trim();
    if (!balanceId) {
      return toApiErrorResponseFromStatus("balanceId required.", 400);
    }
    const row = await prisma.inventoryBalance.findFirst({
      where: { id: balanceId, tenantId },
      select: {
        id: true,
        warehouseId: true,
        binId: true,
        productId: true,
        onHandQty: true,
      },
    });
    if (!row) return toApiErrorResponseFromStatus("Balance not found.", 404);
    const stdCc = await laborStandardMinutesSnapshot(prisma, tenantId, "CYCLE_COUNT");
    const ccStd = stdCc != null ? { standardMinutes: stdCc } : {};
    await prisma.wmsTask.create({
      data: {
        tenantId,
        warehouseId: row.warehouseId,
        taskType: "CYCLE_COUNT",
        binId: row.binId,
        productId: row.productId,
        referenceType: "INVENTORY_BALANCE",
        referenceId: row.id,
        quantity: row.onHandQty,
        note: input.note?.trim() || "Cycle count (book qty in task.quantity)",
        createdById: actorId,
        ...ccStd,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_cycle_count_task") {
    const taskId = input.taskId?.trim();
    const counted = Number(input.countedQty);
    if (!taskId || !Number.isFinite(counted) || counted < 0) {
      return toApiErrorResponseFromStatus("taskId and countedQty (>=0) required.", 400);
    }
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "CYCLE_COUNT" },
      select: {
        id: true,
        warehouseId: true,
        binId: true,
        productId: true,
        quantity: true,
        referenceId: true,
      },
    });
    if (!task?.productId || !task.binId || !task.referenceId) {
      return toApiErrorResponseFromStatus("Cycle count task not found.", 404);
    }
    const ccProductId = task.productId;
    const balanceRowId = task.referenceId;
    const book = Number(task.quantity);
    const variance = counted - book;
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.update({
        where: { id: task.id },
        data: { status: "DONE", completedAt: new Date(), completedById: actorId },
      });
      if (variance !== 0) {
        await tx.inventoryBalance.updateMany({
          where: { id: balanceRowId, tenantId },
          data: { onHandQty: { increment: variance.toString() } },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            warehouseId: task.warehouseId,
            binId: task.binId,
            productId: ccProductId,
            movementType: "ADJUSTMENT",
            quantity: variance.toString(),
            referenceType: "CYCLE_COUNT_TASK",
            referenceId: task.id,
            note: `Count variance (book ${book} → counted ${counted})`,
            createdById: actorId,
          },
        });
      }
    });
    return NextResponse.json({ ok: true, bookQty: book, countedQty: counted, variance });
  }

  if (action === "create_cycle_count_session") {
    const warehouseId = input.warehouseId?.trim();
    if (!warehouseId) {
      return toApiErrorResponseFromStatus("warehouseId required.", 400);
    }
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      select: { id: true },
    });
    if (!wh) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }
    const scopeNote = truncateCycleCountNote(input.cycleCountScopeNote ?? undefined);
    const session = await prisma.$transaction(async (tx) => {
      const referenceCode = await allocateUniqueCycleCountReferenceCode(tx);
      return tx.wmsCycleCountSession.create({
        data: {
          tenantId,
          warehouseId,
          referenceCode,
          scopeNote,
          createdById: actorId,
        },
        select: { id: true, referenceCode: true },
      });
    });
    return NextResponse.json({
      ok: true,
      cycleCountSessionId: session.id,
      referenceCode: session.referenceCode,
    });
  }

  if (action === "add_cycle_count_line") {
    const sessionId = input.cycleCountSessionId?.trim();
    const balanceId = input.balanceId?.trim();
    if (!sessionId || !balanceId) {
      return toApiErrorResponseFromStatus("cycleCountSessionId and balanceId required.", 400);
    }
    const session = await prisma.wmsCycleCountSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { id: true, warehouseId: true, status: true },
    });
    if (!session || session.status !== "OPEN") {
      return toApiErrorResponseFromStatus("Cycle count session not found or not OPEN.", 404);
    }
    const bal = await prisma.inventoryBalance.findFirst({
      where: { id: balanceId, tenantId, warehouseId: session.warehouseId },
      select: {
        id: true,
        binId: true,
        productId: true,
        lotCode: true,
        onHandQty: true,
      },
    });
    if (!bal) {
      return toApiErrorResponseFromStatus("Balance not found for this session warehouse.", 404);
    }
    try {
      const line = await prisma.wmsCycleCountLine.create({
        data: {
          tenantId,
          sessionId: session.id,
          inventoryBalanceId: bal.id,
          binId: bal.binId,
          productId: bal.productId,
          lotCode: bal.lotCode,
          expectedQty: bal.onHandQty,
        },
        select: { id: true },
      });
      return NextResponse.json({ ok: true, cycleCountLineId: line.id });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
        return toApiErrorResponseFromStatus("That balance is already on this cycle count.", 409);
      }
      throw e;
    }
  }

  if (action === "set_cycle_count_line_count") {
    const lineId = input.cycleCountLineId?.trim();
    const counted = parseCycleCountQty(input.countedQty);
    if (!lineId || counted === null) {
      return toApiErrorResponseFromStatus("cycleCountLineId and countedQty (>=0) required.", 400);
    }
    const normReason = normalizeCycleCountVarianceReasonCode(input.cycleCountVarianceReasonCode ?? undefined);
    if (normReason != null && !isWmsCycleCountVarianceReasonCode(normReason)) {
      return toApiErrorResponseFromStatus(
        "Invalid cycleCountVarianceReasonCode (SHRINK, DAMAGE, DATA_ENTRY, FOUND, OTHER).",
        400,
      );
    }
    const varianceNote = truncateCycleCountNote(input.varianceNote ?? input.note);
    const line = await prisma.wmsCycleCountLine.findFirst({
      where: { id: lineId, tenantId },
      include: { session: { select: { status: true } } },
    });
    if (!line || line.session.status !== "OPEN") {
      return toApiErrorResponseFromStatus("Line not found or session not OPEN.", 404);
    }
    if (line.status !== "PENDING_COUNT") {
      return toApiErrorResponseFromStatus("Line is no longer editable.", 400);
    }
    await prisma.wmsCycleCountLine.update({
      where: { id: line.id },
      data: {
        countedQty: counted.toString(),
        varianceReasonCode: normReason,
        varianceNote,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "submit_cycle_count") {
    const sessionId = input.cycleCountSessionId?.trim();
    if (!sessionId) {
      return toApiErrorResponseFromStatus("cycleCountSessionId required.", 400);
    }
    const session = await prisma.wmsCycleCountSession.findFirst({
      where: { id: sessionId, tenantId, status: "OPEN" },
      include: { lines: true },
    });
    if (!session) {
      return toApiErrorResponseFromStatus("Cycle count session not found or not OPEN.", 404);
    }
    if (session.lines.length === 0) {
      return toApiErrorResponseFromStatus("Add at least one line before submitting.", 400);
    }
    for (const ln of session.lines) {
      if (ln.countedQty == null) {
        return toApiErrorResponseFromStatus(
          `Line ${ln.id.slice(0, 8)}… missing countedQty — use set_cycle_count_line_count.`,
          400,
        );
      }
      const expected = Number(ln.expectedQty);
      const counted = Number(ln.countedQty);
      if (varianceRequiresReason(expected, counted)) {
        const code = ln.varianceReasonCode?.trim();
        if (!code || !isWmsCycleCountVarianceReasonCode(code)) {
          return toApiErrorResponseFromStatus(
            "Variance lines require cycleCountVarianceReasonCode (SHRINK, DAMAGE, DATA_ENTRY, FOUND, OTHER) via set_cycle_count_line_count.",
            400,
          );
        }
      }
    }
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      let anyVariance = false;
      for (const ln of session.lines) {
        const expected = Number(ln.expectedQty);
        const counted = Number(ln.countedQty!);
        const v = cycleCountQtyVariance(expected, counted);
        if (v === 0) {
          await tx.wmsCycleCountLine.update({
            where: { id: ln.id },
            data: { status: "MATCH_CLOSED" },
          });
        } else {
          anyVariance = true;
          await tx.wmsCycleCountLine.update({
            where: { id: ln.id },
            data: { status: "VARIANCE_PENDING" },
          });
        }
      }
      if (anyVariance) {
        await tx.wmsCycleCountSession.update({
          where: { id: session.id },
          data: { status: "SUBMITTED", submittedAt: now },
        });
      } else {
        await tx.wmsCycleCountSession.update({
          where: { id: session.id },
          data: { status: "CLOSED", submittedAt: now, closedAt: now },
        });
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve_cycle_count_variance") {
    const sessionId = input.cycleCountSessionId?.trim();
    if (!sessionId) {
      return toApiErrorResponseFromStatus("cycleCountSessionId required.", 400);
    }
    const session = await prisma.wmsCycleCountSession.findFirst({
      where: { id: sessionId, tenantId, status: "SUBMITTED" },
      include: { lines: true },
    });
    if (!session) {
      return toApiErrorResponseFromStatus("Cycle count session not found or not SUBMITTED.", 404);
    }
    const pending = session.lines.filter((l) => l.status === "VARIANCE_PENDING");
    if (pending.length === 0) {
      return toApiErrorResponseFromStatus("No variance lines awaiting approval.", 400);
    }
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      for (const ln of pending) {
        const expected = Number(ln.expectedQty);
        const counted = Number(ln.countedQty!);
        const variance = cycleCountQtyVariance(expected, counted);
        if (variance === 0) continue;
        await tx.inventoryBalance.updateMany({
          where: { id: ln.inventoryBalanceId, tenantId },
          data: { onHandQty: { increment: variance.toString() } },
        });
        const movement = await tx.inventoryMovement.create({
          data: {
            tenantId,
            warehouseId: session.warehouseId,
            binId: ln.binId,
            productId: ln.productId,
            movementType: "ADJUSTMENT",
            quantity: variance.toString(),
            referenceType: "WMS_CYCLE_COUNT_LINE",
            referenceId: ln.id,
            note: `BF-51 cycle count (${ln.varianceReasonCode ?? "OTHER"}): book ${expected} → counted ${counted}`,
            createdById: actorId,
          },
          select: { id: true },
        });
        await tx.wmsCycleCountLine.update({
          where: { id: ln.id },
          data: { status: "VARIANCE_POSTED", inventoryMovementId: movement.id },
        });
      }
      await tx.wmsCycleCountSession.update({
        where: { id: session.id },
        data: { status: "CLOSED", closedAt: now },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_work_order") {
    const warehouseId = input.warehouseId?.trim();
    const title = input.workOrderTitle?.trim();
    if (!warehouseId || !title) {
      return toApiErrorResponseFromStatus("warehouseId and workOrderTitle required.", 400);
    }
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      select: { id: true },
    });
    if (!wh) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }
    let crmAccountId: string | null = input.workOrderCrmAccountId?.trim() || null;
    if (crmAccountId) {
      const acct = await prisma.crmAccount.findFirst({
        where: { id: crmAccountId, tenantId },
        select: { id: true },
      });
      if (!acct) {
        return toApiErrorResponseFromStatus("CRM account not found.", 404);
      }
    } else {
      crmAccountId = null;
    }
    let crmQuoteLineId: string | null = input.crmQuoteLineId?.trim() || null;
    if (crmQuoteLineId) {
      const qLine = await prisma.crmQuoteLine.findFirst({
        where: { id: crmQuoteLineId, quote: { tenantId } },
        select: { id: true, quote: { select: { accountId: true } } },
      });
      if (!qLine) {
        return toApiErrorResponseFromStatus("CRM quote line not found.", 404);
      }
      if (crmAccountId && qLine.quote.accountId !== crmAccountId) {
        return toApiErrorResponseFromStatus(
          "CRM quote line must belong to the same account as workOrderCrmAccountId.",
          400,
        );
      }
    } else {
      crmQuoteLineId = null;
    }
    const workOrderNo = await nextWorkOrderNo(tenantId);
    const desc = input.workOrderDescription?.trim();
    const row = await prisma.wmsWorkOrder.create({
      data: {
        tenantId,
        warehouseId,
        workOrderNo,
        title: title.slice(0, 200),
        description: desc ? desc.slice(0, 8000) : null,
        intakeChannel: "OPS",
        crmAccountId,
        crmQuoteLineId,
        createdById: actorId,
      },
      select: { id: true, workOrderNo: true },
    });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_WORK_ORDER",
        entityId: row.id,
        action: "work_order_created",
        payload: {
          workOrderNo: row.workOrderNo,
          warehouseId,
          intakeChannel: "OPS",
          crmAccountId,
          crmQuoteLineId,
        },
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true, workOrderId: row.id, workOrderNo: row.workOrderNo });
  }

  if (action === "request_customer_vas_work_order") {
    const warehouseId = input.warehouseId?.trim();
    const title = input.workOrderTitle?.trim();
    const crmAccountId = input.crmAccountId?.trim();
    if (!warehouseId || !title || !crmAccountId) {
      return toApiErrorResponseFromStatus("warehouseId, workOrderTitle, and crmAccountId required.", 400);
    }
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      select: { id: true },
    });
    if (!wh) {
      return toApiErrorResponseFromStatus("Warehouse not found.", 404);
    }
    const acct = await prisma.crmAccount.findFirst({
      where: { id: crmAccountId, tenantId },
      select: { id: true },
    });
    if (!acct) {
      return toApiErrorResponseFromStatus("CRM account not found.", 404);
    }
    if (await actorIsCustomerCrmScoped(actorId)) {
      const portalActor = await prisma.user.findFirst({
        where: { id: actorId, tenantId },
        select: { customerCrmAccountId: true },
      });
      if (!portalActor?.customerCrmAccountId || portalActor.customerCrmAccountId !== crmAccountId) {
        return toApiErrorResponseFromStatus(
          "Customer portal users may only submit intake for their assigned CRM account.",
          403,
        );
      }
    }
    const workOrderNo = await nextWorkOrderNo(tenantId);
    const desc = input.workOrderDescription?.trim();
    const row = await prisma.wmsWorkOrder.create({
      data: {
        tenantId,
        warehouseId,
        workOrderNo,
        title: title.slice(0, 200),
        description: desc ? desc.slice(0, 8000) : null,
        intakeChannel: "CUSTOMER_PORTAL",
        crmAccountId,
        createdById: actorId,
      },
      select: { id: true, workOrderNo: true },
    });
    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_WORK_ORDER",
        entityId: row.id,
        action: "work_order_created",
        payload: {
          workOrderNo: row.workOrderNo,
          warehouseId,
          intakeChannel: "CUSTOMER_PORTAL",
          crmAccountId,
        },
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true, workOrderId: row.id, workOrderNo: row.workOrderNo });
  }

  if (action === "set_work_order_commercial_estimate") {
    const workOrderId = input.workOrderId?.trim();
    if (!workOrderId) {
      return toApiErrorResponseFromStatus("workOrderId required.", 400);
    }
    const wo = await prisma.wmsWorkOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true },
    });
    if (!wo) {
      return toApiErrorResponseFromStatus("Work order not found.", 404);
    }

    const matsRaw = input.estimatedMaterialsCents;
    const laborRaw = input.estimatedLaborMinutes;
    let touched = false;
    const data: {
      estimatedMaterialsCents?: number | null;
      estimatedLaborMinutes?: number | null;
    } = {};

    if (matsRaw !== undefined) {
      touched = true;
      if (matsRaw === null) {
        data.estimatedMaterialsCents = null;
      } else {
        const n = typeof matsRaw === "number" ? matsRaw : Number(matsRaw);
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
          return toApiErrorResponseFromStatus("estimatedMaterialsCents must be a non-negative integer (cents).", 400);
        }
        data.estimatedMaterialsCents = n;
      }
    }
    if (laborRaw !== undefined) {
      touched = true;
      if (laborRaw === null) {
        data.estimatedLaborMinutes = null;
      } else {
        const n = typeof laborRaw === "number" ? laborRaw : Number(laborRaw);
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
          return toApiErrorResponseFromStatus("estimatedLaborMinutes must be a non-negative integer.", 400);
        }
        data.estimatedLaborMinutes = n;
      }
    }
    if (!touched) {
      return toApiErrorResponseFromStatus(
        "Provide estimatedMaterialsCents and/or estimatedLaborMinutes (use null to clear a field).",
        400,
      );
    }

    await prisma.wmsWorkOrder.update({
      where: { id: workOrderId },
      data,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_value_add_task") {
    const workOrderId = input.workOrderId?.trim();
    if (!workOrderId) {
      return toApiErrorResponseFromStatus("workOrderId required.", 400);
    }
    const wo = await prisma.wmsWorkOrder.findFirst({
      where: {
        id: workOrderId,
        tenantId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: { id: true, warehouseId: true },
    });
    if (!wo) {
      return toApiErrorResponseFromStatus("Work order not found or not open.", 404);
    }

    const productId = input.productId?.trim();
    const binId = input.binId?.trim();
    const hasMaterial = Boolean(productId && binId);
    const qtyRaw = input.quantity;
    const qtyNum =
      qtyRaw === undefined || qtyRaw === null ? 0 : typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw);

    if (hasMaterial) {
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        return toApiErrorResponseFromStatus("quantity must be > 0 when productId and binId are set.", 400);
      }
      const materialLot = normalizeLotCode(input.lotCode);
      const bal = await prisma.inventoryBalance.findFirst({
        where: {
          tenantId,
          warehouseId: wo.warehouseId,
          binId,
          productId,
          lotCode: materialLot,
        },
        select: { id: true, onHandQty: true },
      });
      if (!bal) {
        return toApiErrorResponseFromStatus("No inventory balance for product/bin in this warehouse.", 400);
      }
      if (Number(bal.onHandQty) < qtyNum) {
        return toApiErrorResponseFromStatus("Insufficient on-hand qty for requested VAS consumption.", 400);
      }
    } else {
      if (productId || binId) {
        return toApiErrorResponseFromStatus("Provide both productId and binId for material consumption, or neither for labor-only.", 400);
      }
      if (qtyRaw !== undefined && qtyRaw !== null && qtyNum !== 0) {
        return toApiErrorResponseFromStatus("Labor-only VALUE_ADD tasks must omit quantity or use 0.", 400);
      }
    }

    const taskLotCode = hasMaterial ? normalizeLotCode(input.lotCode) : FUNGIBLE_LOT_CODE;

    await prisma.$transaction(async (tx) => {
      const stdVas = await laborStandardMinutesSnapshot(tx, tenantId, "VALUE_ADD");
      const vasStd = stdVas != null ? { standardMinutes: stdVas } : {};
      await tx.wmsTask.create({
        data: {
          tenantId,
          warehouseId: wo.warehouseId,
          taskType: "VALUE_ADD",
          referenceType: "WMS_WORK_ORDER",
          referenceId: wo.id,
          productId: productId || null,
          binId: binId || null,
          lotCode: taskLotCode,
          quantity: hasMaterial ? qtyNum.toString() : "0",
          note: input.note?.trim() ? input.note.trim().slice(0, 500) : null,
          createdById: actorId,
          ...vasStd,
        },
      });
      await tx.wmsWorkOrder.update({
        where: { id: wo.id },
        data: { status: "IN_PROGRESS" },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_value_add_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) {
      return toApiErrorResponseFromStatus("taskId required.", 400);
    }
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "VALUE_ADD" },
      select: {
        id: true,
        warehouseId: true,
        productId: true,
        binId: true,
        quantity: true,
        referenceType: true,
        referenceId: true,
        note: true,
        lotCode: true,
      },
    });
    if (!task || task.referenceType !== "WMS_WORK_ORDER" || !task.referenceId) {
      return toApiErrorResponseFromStatus("VALUE_ADD task not found.", 404);
    }
    const woId = task.referenceId;
    const wo = await prisma.wmsWorkOrder.findFirst({
      where: { id: woId, tenantId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true },
    });
    if (!wo) {
      return toApiErrorResponseFromStatus("Work order not found or closed.", 404);
    }

    const qty = Number(task.quantity);
    const hasMaterials = Boolean(task.productId && task.binId && qty > 0);

    if (hasMaterials) {
      const balPre = await prisma.inventoryBalance.findFirst({
        where: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: task.binId!,
          productId: task.productId!,
          lotCode: task.lotCode,
        },
        select: { id: true, onHandQty: true, onHold: true },
      });
      if (!balPre || balPre.onHold) {
        return toApiErrorResponseFromStatus("Cannot complete VALUE_ADD: bin/product missing or on hold.", 400);
      }
      if (Number(balPre.onHandQty) < qty) {
        return toApiErrorResponseFromStatus("Insufficient stock for VAS consumption.", 400);
      }
    }

    await prisma.$transaction(async (tx) => {
      if (hasMaterials) {
        await tx.inventoryBalance.updateMany({
          where: {
            tenantId,
            warehouseId: task.warehouseId,
            binId: task.binId!,
            productId: task.productId!,
            lotCode: task.lotCode,
          },
          data: { onHandQty: { decrement: qty.toString() } },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            warehouseId: task.warehouseId,
            binId: task.binId!,
            productId: task.productId!,
            movementType: "ADJUSTMENT",
            quantity: qty.toString(),
            referenceType: "VALUE_ADD_TASK",
            referenceId: task.id,
            note: task.note?.trim() || "VAS material consumption",
            createdById: actorId,
          },
        });
      }

      await tx.wmsTask.update({
        where: { id: task.id },
        data: { status: "DONE", completedAt: new Date(), completedById: actorId },
      });

      const remainingOpen = await tx.wmsTask.count({
        where: {
          tenantId,
          referenceType: "WMS_WORK_ORDER",
          referenceId: woId,
          taskType: "VALUE_ADD",
          status: "OPEN",
        },
      });

      if (remainingOpen === 0) {
        await tx.wmsWorkOrder.update({
          where: { id: woId },
          data: { status: "DONE", completedAt: new Date() },
        });
      }

      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WMS_WORK_ORDER",
          entityId: woId,
          action: "value_add_task_completed",
          payload: {
            taskId: task.id,
            consumedQty: hasMaterials ? qty : 0,
            movementType: hasMaterials ? "ADJUSTMENT" : null,
          },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "create_kit_build_task") {
    const workOrderId = input.workOrderId?.trim();
    const kitOutputProductId = input.kitOutputProductId?.trim();
    const kitOutputBinId = input.kitOutputBinId?.trim();
    const kitQty = Number(input.kitBuildQuantity);
    const bomRepRaw = input.bomRepresentsOutputUnits;
    const bomRep = bomRepRaw === undefined || bomRepRaw === null ? 1 : Number(bomRepRaw);

    if (!workOrderId || !kitOutputProductId || !kitOutputBinId) {
      return toApiErrorResponseFromStatus(
        "workOrderId, kitOutputProductId, and kitOutputBinId required.",
        400,
      );
    }
    if (!Number.isFinite(kitQty) || kitQty <= 0) {
      return toApiErrorResponseFromStatus("kitBuildQuantity must be > 0.", 400);
    }
    if (!Number.isInteger(bomRep) || bomRep < 1) {
      return toApiErrorResponseFromStatus("bomRepresentsOutputUnits must be a positive integer.", 400);
    }

    const linesRaw = input.kitBuildLines;
    if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
      return toApiErrorResponseFromStatus("kitBuildLines required (non-empty array).", 400);
    }

    const wo = await prisma.wmsWorkOrder.findFirst({
      where: {
        id: workOrderId,
        tenantId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        warehouseId: true,
        bomLines: {
          orderBy: { lineNo: "asc" },
          select: { id: true, componentProductId: true, plannedQty: true, consumedQty: true },
        },
      },
    });
    if (!wo) {
      return toApiErrorResponseFromStatus("Work order not found or not open.", 404);
    }
    if (wo.bomLines.length === 0) {
      return toApiErrorResponseFromStatus("Work order has no BOM lines.", 400);
    }

    const kitBuildLinesParsed: Array<{ bomLineId: string; binId: string; lotCode: string }> = [];
    for (let i = 0; i < linesRaw.length; i++) {
      const row = linesRaw[i];
      if (!row || typeof row !== "object") {
        return toApiErrorResponseFromStatus(`kitBuildLines[${i}] must be an object.`, 400);
      }
      const o = row as Record<string, unknown>;
      const bomLineId = typeof o.bomLineId === "string" ? o.bomLineId.trim() : "";
      const binId = typeof o.binId === "string" ? o.binId.trim() : "";
      if (!bomLineId || !binId) {
        return toApiErrorResponseFromStatus(`kitBuildLines[${i}] needs bomLineId and binId.`, 400);
      }
      const lotCode = o.lotCode !== undefined && o.lotCode !== null ? normalizeLotCode(String(o.lotCode)) : FUNGIBLE_LOT_CODE;
      kitBuildLinesParsed.push({ bomLineId, binId, lotCode });
    }

    const bomLineById = new Map(wo.bomLines.map((l) => [l.id, l]));
    for (const p of kitBuildLinesParsed) {
      if (!bomLineById.has(p.bomLineId)) {
        return toApiErrorResponseFromStatus("kitBuildLines references unknown bomLineId.", 400);
      }
    }

    const deltaRes = computeKitBuildLineDeltas(wo.bomLines, kitQty, bomRep);
    if (!deltaRes.ok) return toApiErrorResponseFromStatus(deltaRes.message, 400);
    const pickVal = validateKitBuildLinePicks(deltaRes.deltas, kitBuildLinesParsed);
    if (!pickVal.ok) return toApiErrorResponseFromStatus(pickVal.message, 400);

    const outProd = await prisma.product.findFirst({
      where: { id: kitOutputProductId, tenantId },
      select: { id: true },
    });
    if (!outProd) return toApiErrorResponseFromStatus("kitOutputProductId not found.", 404);

    const outBin = await prisma.warehouseBin.findFirst({
      where: { id: kitOutputBinId, tenantId, warehouseId: wo.warehouseId },
      select: { id: true },
    });
    if (!outBin) return toApiErrorResponseFromStatus("kitOutputBinId not found in work order warehouse.", 404);

    for (const p of kitBuildLinesParsed) {
      const line = bomLineById.get(p.bomLineId)!;
      const delta = deltaRes.deltas.get(p.bomLineId)!;
      if (delta.lte(0)) continue;

      const bin = await prisma.warehouseBin.findFirst({
        where: { id: p.binId, tenantId, warehouseId: wo.warehouseId },
        select: { id: true },
      });
      if (!bin) return toApiErrorResponseFromStatus("Component bin not in work order warehouse.", 404);

      const bal = await prisma.inventoryBalance.findFirst({
        where: {
          tenantId,
          warehouseId: wo.warehouseId,
          binId: p.binId,
          productId: line.componentProductId,
          lotCode: p.lotCode,
        },
        select: { onHandQty: true, onHold: true },
      });
      if (!bal || bal.onHold) {
        return toApiErrorResponseFromStatus(
          "Component balance missing, wrong product/lot, or on hold.",
          400,
        );
      }
      if (new Prisma.Decimal(bal.onHandQty).lt(delta)) {
        return toApiErrorResponseFromStatus("Insufficient component stock for kit build.", 400);
      }
    }

    const note = serializeKitBuildTaskPayload({
      v: 1,
      bomRepresentsOutputUnits: bomRep,
      lines: kitBuildLinesParsed,
    });

    await prisma.$transaction(async (tx) => {
      const stdKb = await laborStandardMinutesSnapshot(tx, tenantId, "KIT_BUILD");
      const kbStd = stdKb != null ? { standardMinutes: stdKb } : {};
      await tx.wmsTask.create({
        data: {
          tenantId,
          warehouseId: wo.warehouseId,
          taskType: "KIT_BUILD",
          referenceType: "WMS_WORK_ORDER",
          referenceId: wo.id,
          productId: kitOutputProductId,
          binId: kitOutputBinId,
          lotCode: FUNGIBLE_LOT_CODE,
          quantity: kitQty.toString(),
          note,
          createdById: actorId,
          ...kbStd,
        },
      });
      await tx.wmsWorkOrder.update({
        where: { id: wo.id },
        data: { status: "IN_PROGRESS" },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "complete_kit_build_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) return toApiErrorResponseFromStatus("taskId required.", 400);

    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "KIT_BUILD" },
      select: {
        id: true,
        warehouseId: true,
        productId: true,
        binId: true,
        quantity: true,
        referenceType: true,
        referenceId: true,
        note: true,
      },
    });
    if (!task || task.referenceType !== "WMS_WORK_ORDER" || !task.referenceId) {
      return toApiErrorResponseFromStatus("KIT_BUILD task not found.", 404);
    }
    const kitOutProductId = task.productId;
    const kitOutBinId = task.binId;
    if (!kitOutProductId || !kitOutBinId) {
      return toApiErrorResponseFromStatus("KIT_BUILD task missing output product or bin.", 400);
    }

    const kitQty = Number(task.quantity);
    if (!Number.isFinite(kitQty) || kitQty <= 0) {
      return toApiErrorResponseFromStatus("Invalid kit task quantity.", 400);
    }

    const payload = parseKitBuildTaskNote(task.note);
    if (!payload) {
      return toApiErrorResponseFromStatus("KIT_BUILD task is missing structured note payload.", 400);
    }

    const woId = task.referenceId;
    const wo = await prisma.wmsWorkOrder.findFirst({
      where: { id: woId, tenantId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: {
        id: true,
        warehouseId: true,
        bomLines: {
          orderBy: { lineNo: "asc" },
          select: { id: true, componentProductId: true, plannedQty: true, consumedQty: true },
        },
      },
    });
    if (!wo || wo.warehouseId !== task.warehouseId) {
      return toApiErrorResponseFromStatus("Work order not found or closed.", 404);
    }

    const deltaRes = computeKitBuildLineDeltas(wo.bomLines, kitQty, payload.bomRepresentsOutputUnits);
    if (!deltaRes.ok) return toApiErrorResponseFromStatus(deltaRes.message, 400);
    const pickVal = validateKitBuildLinePicks(deltaRes.deltas, payload.lines);
    if (!pickVal.ok) return toApiErrorResponseFromStatus(pickVal.message, 400);

    const bomLineById = new Map(wo.bomLines.map((l) => [l.id, l]));
    const pickByLine = new Map(payload.lines.map((l) => [l.bomLineId, l]));

    for (const line of wo.bomLines) {
      const delta = deltaRes.deltas.get(line.id)!;
      if (delta.lte(0)) continue;
      const p = pickByLine.get(line.id)!;
      const bal = await prisma.inventoryBalance.findFirst({
        where: {
          tenantId,
          warehouseId: wo.warehouseId,
          binId: p.binId,
          productId: line.componentProductId,
          lotCode: p.lotCode,
        },
        select: { onHandQty: true, onHold: true },
      });
      if (!bal || bal.onHold || new Prisma.Decimal(bal.onHandQty).lt(delta)) {
        return toApiErrorResponseFromStatus("Insufficient component stock to complete kit build.", 400);
      }
    }

    const outBalPre = await prisma.inventoryBalance.findFirst({
      where: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: kitOutBinId,
        productId: kitOutProductId,
        lotCode: FUNGIBLE_LOT_CODE,
      },
      select: { id: true, onHold: true },
    });
    if (outBalPre?.onHold) {
      return toApiErrorResponseFromStatus("Output bin balance is on hold.", 400);
    }

    await prisma.$transaction(async (tx) => {
      for (const line of wo.bomLines) {
        const delta = deltaRes.deltas.get(line.id)!;
        if (delta.lte(0)) continue;
        const p = pickByLine.get(line.id)!;
        const qtyStr = delta.toFixed();
        await tx.inventoryBalance.updateMany({
          where: {
            tenantId,
            warehouseId: wo.warehouseId,
            binId: p.binId,
            productId: line.componentProductId,
            lotCode: p.lotCode,
          },
          data: { onHandQty: { decrement: qtyStr } },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            warehouseId: wo.warehouseId,
            binId: p.binId,
            productId: line.componentProductId,
            movementType: "ADJUSTMENT",
            quantity: qtyStr,
            referenceType: "KIT_BUILD_TASK",
            referenceId: task.id,
            note: "Kit build component consumption",
            createdById: actorId,
          },
        });
        await tx.wmsWorkOrderBomLine.update({
          where: { id: line.id },
          data: { consumedQty: { increment: qtyStr } },
        });
      }

      await tx.inventoryBalance.upsert({
        where: {
          warehouseId_binId_productId_lotCode: {
            warehouseId: task.warehouseId,
            binId: kitOutBinId,
            productId: kitOutProductId,
            lotCode: FUNGIBLE_LOT_CODE,
          },
        },
        create: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: kitOutBinId,
          productId: kitOutProductId,
          lotCode: FUNGIBLE_LOT_CODE,
          onHandQty: kitQty.toString(),
        },
        update: { onHandQty: { increment: kitQty.toString() } },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: kitOutBinId,
          productId: kitOutProductId,
          movementType: "ADJUSTMENT",
          quantity: kitQty.toString(),
          referenceType: "KIT_BUILD_TASK",
          referenceId: task.id,
          note: "Kit build output",
          createdById: actorId,
        },
      });

      await tx.wmsTask.update({
        where: { id: task.id },
        data: { status: "DONE", completedAt: new Date(), completedById: actorId },
      });

      const refreshed = await tx.wmsWorkOrderBomLine.findMany({
        where: { workOrderId: woId, tenantId },
        select: { plannedQty: true, consumedQty: true },
      });
      const allDone = refreshed.every((r) =>
        new Prisma.Decimal(r.consumedQty).equals(new Prisma.Decimal(r.plannedQty)),
      );
      if (allDone) {
        await tx.wmsWorkOrder.update({
          where: { id: woId },
          data: { status: "DONE", completedAt: new Date() },
        });
      }

      await tx.ctAuditLog.create({
        data: {
          tenantId,
          entityType: "WMS_WORK_ORDER",
          entityId: woId,
          action: "kit_build_task_completed",
          payload: { taskId: task.id, kitQty, outputProductId: kitOutProductId },
          actorUserId: actorId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "link_work_order_crm_quote_line") {
    const workOrderId = input.workOrderId?.trim();
    if (!workOrderId) {
      return toApiErrorResponseFromStatus("workOrderId required.", 400);
    }

    const wo = await prisma.wmsWorkOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true, crmAccountId: true },
    });
    if (!wo) {
      return toApiErrorResponseFromStatus("Work order not found.", 404);
    }

    const rawLineId = input.crmQuoteLineId;
    if (rawLineId === undefined) {
      return toApiErrorResponseFromStatus("crmQuoteLineId required (string id or null to unlink).", 400);
    }

    if (rawLineId === null || String(rawLineId).trim() === "") {
      await prisma.wmsWorkOrder.update({
        where: { id: workOrderId },
        data: {
          crmQuoteLineId: null,
          engineeringBomSyncedRevision: null,
          engineeringBomSyncedAt: null,
        },
      });
      return NextResponse.json({ ok: true });
    }

    const crmQuoteLineId = String(rawLineId).trim();
    const line = await prisma.crmQuoteLine.findFirst({
      where: { id: crmQuoteLineId, quote: { tenantId } },
      select: { id: true, quote: { select: { accountId: true } } },
    });
    if (!line) {
      return toApiErrorResponseFromStatus("CRM quote line not found.", 404);
    }
    if (wo.crmAccountId && line.quote.accountId !== wo.crmAccountId) {
      return toApiErrorResponseFromStatus(
        "Quote line must belong to the same CRM account as this work order.",
        400,
      );
    }

    await prisma.wmsWorkOrder.update({
      where: { id: workOrderId },
      data: { crmQuoteLineId: line.id },
    });

    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_WORK_ORDER",
        entityId: workOrderId,
        action: "work_order_crm_quote_line_linked",
        payload: { quoteLineId: line.id },
        actorUserId: actorId,
      },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "sync_work_order_bom_from_crm_quote_line") {
    const workOrderId = input.workOrderId?.trim();
    if (!workOrderId) {
      return toApiErrorResponseFromStatus("workOrderId required.", 400);
    }

    const wo = await prisma.wmsWorkOrder.findFirst({
      where: {
        id: workOrderId,
        tenantId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: { id: true, crmQuoteLineId: true },
    });
    if (!wo) {
      return toApiErrorResponseFromStatus("Work order not found or not open.", 404);
    }
    if (!wo.crmQuoteLineId) {
      return toApiErrorResponseFromStatus(
        "Link a CRM quote line before syncing engineering BOM.",
        400,
      );
    }

    const ql = await prisma.crmQuoteLine.findFirst({
      where: { id: wo.crmQuoteLineId, quote: { tenantId } },
      select: {
        id: true,
        engineeringBomLines: true,
        engineeringBomRevision: true,
      },
    });
    if (!ql) {
      return toApiErrorResponseFromStatus("Linked CRM quote line not found.", 404);
    }

    const parsedRows = parseEngineeringBomLinesJson(ql.engineeringBomLines);
    if (!parsedRows.ok) {
      return toApiErrorResponseFromStatus(parsedRows.message, 400);
    }

    const built = await engineeringBomLinesToParsedWorkOrderLines(tenantId, parsedRows.lines);
    if (!built.ok) {
      return toApiErrorResponseFromStatus(built.message, 400);
    }

    const consumed = await prisma.wmsWorkOrderBomLine.findFirst({
      where: {
        workOrderId,
        tenantId,
        consumedQty: { gt: new Prisma.Decimal(0) },
      },
      select: { id: true },
    });
    if (consumed) {
      return toApiErrorResponseFromStatus(
        "Cannot sync BOM after a line has consumed quantity.",
        400,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.wmsWorkOrderBomLine.deleteMany({ where: { workOrderId, tenantId } });
      if (built.lines.length > 0) {
        await tx.wmsWorkOrderBomLine.createMany({
          data: built.lines.map((l) => ({
            tenantId,
            workOrderId,
            lineNo: l.lineNo,
            componentProductId: l.componentProductId,
            plannedQty: l.plannedQty,
            lineNote: l.lineNote,
          })),
        });
      }
      const rev =
        ql.engineeringBomRevision?.trim().slice(0, 128) || null;
      await tx.wmsWorkOrder.update({
        where: { id: workOrderId },
        data: {
          engineeringBomSyncedRevision: rev,
          engineeringBomSyncedAt: new Date(),
        },
      });
    });

    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_WORK_ORDER",
        entityId: workOrderId,
        action: "work_order_engineering_bom_synced",
        payload: {
          quoteLineId: ql.id,
          revision: ql.engineeringBomRevision ?? null,
          lineCount: built.lines.length,
        },
        actorUserId: actorId,
      },
    });

    return NextResponse.json({ ok: true, lineCount: built.lines.length });
  }

  if (action === "replace_work_order_bom_lines") {
    const workOrderId = input.workOrderId?.trim();
    if (!workOrderId) {
      return toApiErrorResponseFromStatus("workOrderId required.", 400);
    }
    const parsed = parseReplaceWorkOrderBomLinesPayload(input.bomLines);
    if (!parsed.ok) {
      return toApiErrorResponseFromStatus(parsed.message, 400);
    }

    const wo = await prisma.wmsWorkOrder.findFirst({
      where: {
        id: workOrderId,
        tenantId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (!wo) {
      return toApiErrorResponseFromStatus("Work order not found or not open.", 404);
    }

    const consumed = await prisma.wmsWorkOrderBomLine.findFirst({
      where: {
        workOrderId,
        tenantId,
        consumedQty: { gt: new Prisma.Decimal(0) },
      },
      select: { id: true },
    });
    if (consumed) {
      return toApiErrorResponseFromStatus(
        "Cannot replace BOM after a line has consumed quantity.",
        400,
      );
    }

    const productIds = [...new Set(parsed.lines.map((l) => l.componentProductId))];
    const products =
      productIds.length === 0
        ? []
        : await prisma.product.findMany({
            where: { tenantId, id: { in: productIds } },
            select: { id: true },
          });
    if (products.length !== productIds.length) {
      return toApiErrorResponseFromStatus("One or more component products not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wmsWorkOrderBomLine.deleteMany({ where: { workOrderId, tenantId } });
      if (parsed.lines.length > 0) {
        await tx.wmsWorkOrderBomLine.createMany({
          data: parsed.lines.map((l) => ({
            tenantId,
            workOrderId,
            lineNo: l.lineNo,
            componentProductId: l.componentProductId,
            plannedQty: l.plannedQty,
            lineNote: l.lineNote,
          })),
        });
      }
    });

    await prisma.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "WMS_WORK_ORDER",
        entityId: workOrderId,
        action: "work_order_bom_replaced",
        payload: { lineCount: parsed.lines.length },
        actorUserId: actorId,
      },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "consume_work_order_bom_line") {
    const bomLineId = input.bomLineId?.trim();
    const binId = input.binId?.trim();
    if (!bomLineId || !binId) {
      return toApiErrorResponseFromStatus("bomLineId and binId required.", 400);
    }
    const qtyParsed = parseConsumeWorkOrderBomQuantity(input.quantity);
    if (!qtyParsed.ok) {
      return toApiErrorResponseFromStatus(qtyParsed.message, 400);
    }
    const qtyDec = qtyParsed.qty;
    const qtyStr = qtyDec.toFixed();
    const lot = normalizeLotCode(input.lotCode);

    try {
      await prisma.$transaction(async (tx) => {
        const line = await tx.wmsWorkOrderBomLine.findFirst({
          where: { id: bomLineId, tenantId },
          select: {
            id: true,
            workOrderId: true,
            componentProductId: true,
            plannedQty: true,
            consumedQty: true,
          },
        });
        if (!line) {
          throw new Error("__WMS_BOM_CONSUME__:NOT_FOUND");
        }

        const woRow = await tx.wmsWorkOrder.findFirst({
          where: {
            id: line.workOrderId,
            tenantId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          select: { id: true, warehouseId: true },
        });
        if (!woRow) {
          throw new Error("__WMS_BOM_CONSUME__:WO_CLOSED");
        }

        const newConsumed = new Prisma.Decimal(line.consumedQty).add(qtyDec);
        if (newConsumed.gt(new Prisma.Decimal(line.plannedQty))) {
          throw new Error("__WMS_BOM_CONSUME__:OVER_CONSUME");
        }

        const bin = await tx.warehouseBin.findFirst({
          where: { id: binId, tenantId },
          select: { warehouseId: true },
        });
        if (!bin) {
          throw new Error("__WMS_BOM_CONSUME__:BAD_BIN");
        }
        if (bin.warehouseId !== woRow.warehouseId) {
          throw new Error("__WMS_BOM_CONSUME__:BAD_BIN");
        }

        const bal = await tx.inventoryBalance.findFirst({
          where: {
            tenantId,
            warehouseId: woRow.warehouseId,
            binId,
            productId: line.componentProductId,
            lotCode: lot,
          },
          select: { onHandQty: true, onHold: true },
        });
        if (!bal) {
          throw new Error("__WMS_BOM_CONSUME__:BAD_BAL");
        }
        if (bal.onHold) {
          throw new Error("__WMS_BOM_CONSUME__:BAD_BAL");
        }
        if (new Prisma.Decimal(bal.onHandQty).lt(qtyDec)) {
          throw new Error("__WMS_BOM_CONSUME__:NO_STOCK");
        }

        await tx.inventoryBalance.updateMany({
          where: {
            tenantId,
            warehouseId: woRow.warehouseId,
            binId,
            productId: line.componentProductId,
            lotCode: lot,
          },
          data: { onHandQty: { decrement: qtyStr } },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            warehouseId: woRow.warehouseId,
            binId,
            productId: line.componentProductId,
            movementType: "ADJUSTMENT",
            quantity: qtyStr,
            referenceType: "WO_BOM_LINE",
            referenceId: bomLineId,
            note: "VAS BOM line consumption",
            createdById: actorId,
          },
        });
        await tx.wmsWorkOrderBomLine.update({
          where: { id: bomLineId },
          data: { consumedQty: newConsumed },
        });

        await tx.ctAuditLog.create({
          data: {
            tenantId,
            entityType: "WMS_WORK_ORDER",
            entityId: woRow.id,
            action: "work_order_bom_line_consumed",
            payload: { bomLineId, quantity: qtyStr, binId, referenceType: "WO_BOM_LINE" },
            actorUserId: actorId,
          },
        });
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      const code = msg.startsWith("__WMS_BOM_CONSUME__:") ? msg.slice("__WMS_BOM_CONSUME__:".length) : "";
      if (code === "NOT_FOUND") return toApiErrorResponseFromStatus("BOM line not found.", 404);
      if (code === "WO_CLOSED") return toApiErrorResponseFromStatus("Work order not found or closed.", 404);
      if (code === "OVER_CONSUME") {
        return toApiErrorResponseFromStatus(
          "Consume quantity exceeds remaining planned qty on BOM line.",
          400,
        );
      }
      if (code === "BAD_BIN") return toApiErrorResponseFromStatus("Bin not found or not in work order warehouse.", 404);
      if (code === "BAD_BAL") {
        return toApiErrorResponseFromStatus(
          "Cannot consume: balance missing, wrong product/lot, or on hold.",
          400,
        );
      }
      if (code === "NO_STOCK") return toApiErrorResponseFromStatus("Insufficient stock for BOM consumption.", 400);
      throw e;
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "create_wms_stock_transfer") {
    const fromWarehouseId = input.fromWarehouseId?.trim();
    const toWarehouseId = input.toWarehouseId?.trim();
    if (!fromWarehouseId || !toWarehouseId) {
      return toApiErrorResponseFromStatus("fromWarehouseId and toWarehouseId required.", 400);
    }
    if (fromWarehouseId === toWarehouseId) {
      return toApiErrorResponseFromStatus("Stock transfer requires two different warehouses.", 400);
    }
    const linesRaw = input.stockTransferLines;
    if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
      return toApiErrorResponseFromStatus("stockTransferLines required (non-empty array).", 400);
    }
    if (linesRaw.length > 80) {
      return toApiErrorResponseFromStatus("Too many stock transfer lines.", 400);
    }
    const parsedLines: ParsedStockTransferLineInput[] = [];
    for (let i = 0; i < linesRaw.length; i++) {
      const p = parseStockTransferLineInput(linesRaw[i]);
      if (!p) {
        return toApiErrorResponseFromStatus(
          "Each stockTransferLines row needs productId, fromBinId, positive quantity.",
          400,
        );
      }
      parsedLines.push(p);
    }
    const note = truncateStockTransferNote(input.note ?? input.stockTransferNote);
    const customRefRaw = input.stockTransferReferenceCode?.trim();
    const customRef = customRefRaw && customRefRaw.length > 0 ? customRefRaw : null;
    if (customRef && customRef.length > 64) {
      return toApiErrorResponseFromStatus("stockTransferReferenceCode max 64 chars.", 400);
    }

    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: fromWarehouseId, tenantId }, select: { id: true } }),
      prisma.warehouse.findFirst({ where: { id: toWarehouseId, tenantId }, select: { id: true } }),
    ]);
    if (!fromWh || !toWh) return toApiErrorResponseFromStatus("Warehouse not found.", 404);

    for (let i = 0; i < parsedLines.length; i++) {
      const ln = parsedLines[i];
      const bin = await prisma.warehouseBin.findFirst({
        where: { id: ln.fromBinId, tenantId, warehouseId: fromWarehouseId },
        select: { id: true },
      });
      if (!bin) {
        return toApiErrorResponseFromStatus(`Line ${i + 1}: fromBinId not in from warehouse.`, 400);
      }
      const bal = await prisma.inventoryBalance.findFirst({
        where: {
          tenantId,
          warehouseId: fromWarehouseId,
          binId: ln.fromBinId,
          productId: ln.productId,
          lotCode: ln.lotCode,
        },
        select: { id: true, onHandQty: true, allocatedQty: true, onHold: true },
      });
      if (!bal || bal.onHold) {
        return toApiErrorResponseFromStatus(`Line ${i + 1}: no balance row or on hold.`, 400);
      }
      const softMap = await softReservedQtyByBalanceIds(prisma, tenantId, [bal.id]);
      const soft = softMap.get(bal.id) ?? 0;
      const eff = new Prisma.Decimal(bal.onHandQty).minus(bal.allocatedQty).minus(soft);
      if (eff.lt(ln.quantity)) {
        return toApiErrorResponseFromStatus(`Line ${i + 1}: insufficient available quantity at source bin.`, 400);
      }
    }

    try {
      const transfer = await prisma.$transaction(async (tx) => {
        let referenceCode: string;
        if (customRef) {
          const clash = await tx.wmsStockTransfer.findUnique({
            where: { referenceCode: customRef },
            select: { id: true },
          });
          if (clash) throw new Error("__STO__:REF_CLASH");
          referenceCode = customRef;
        } else {
          referenceCode = await allocateUniqueStockTransferReferenceCode(tx);
        }
        const header = await tx.wmsStockTransfer.create({
          data: {
            tenantId,
            referenceCode,
            fromWarehouseId,
            toWarehouseId,
            status: "DRAFT",
            note,
            createdById: actorId,
          },
        });
        for (let i = 0; i < parsedLines.length; i++) {
          const ln = parsedLines[i];
          await tx.wmsStockTransferLine.create({
            data: {
              tenantId,
              transferId: header.id,
              lineNo: i + 1,
              productId: ln.productId,
              lotCode: ln.lotCode,
              quantityOrdered: ln.quantity.toString(),
              fromBinId: ln.fromBinId,
            },
          });
        }
        return header;
      });
      return NextResponse.json({ ok: true, stockTransferId: transfer.id, referenceCode: transfer.referenceCode });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "__STO__:REF_CLASH") {
        return toApiErrorResponseFromStatus("stockTransferReferenceCode already in use.", 409);
      }
      throw e;
    }
  }

  if (action === "release_wms_stock_transfer") {
    const sid = input.stockTransferId?.trim();
    if (!sid) return toApiErrorResponseFromStatus("stockTransferId required.", 400);
    const u = await prisma.wmsStockTransfer.updateMany({
      where: { id: sid, tenantId, status: "DRAFT" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
    if (u.count === 0) return toApiErrorResponseFromStatus("Transfer not found or not DRAFT.", 400);
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel_wms_stock_transfer") {
    const sid = input.stockTransferId?.trim();
    if (!sid) return toApiErrorResponseFromStatus("stockTransferId required.", 400);
    const u = await prisma.wmsStockTransfer.updateMany({
      where: { id: sid, tenantId, status: { in: ["DRAFT", "RELEASED"] } },
      data: { status: "CANCELLED" },
    });
    if (u.count === 0) {
      return toApiErrorResponseFromStatus(
        "Transfer not found or cannot cancel (not DRAFT/RELEASED, or already shipped).",
        400,
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "set_wms_stock_transfer_line") {
    const lineId = input.stockTransferLineId?.trim();
    const targetBinId = input.targetBinId?.trim();
    if (!lineId || !targetBinId) {
      return toApiErrorResponseFromStatus("stockTransferLineId and targetBinId required.", 400);
    }
    const line = await prisma.wmsStockTransferLine.findFirst({
      where: { id: lineId, tenantId },
      include: { transfer: { select: { id: true, toWarehouseId: true, status: true } } },
    });
    if (!line) return toApiErrorResponseFromStatus("Line not found.", 404);
    if (line.transfer.status !== "RELEASED" && line.transfer.status !== "IN_TRANSIT") {
      return toApiErrorResponseFromStatus("Transfer must be RELEASED or IN_TRANSIT to set receive bin.", 400);
    }
    const bin = await prisma.warehouseBin.findFirst({
      where: { id: targetBinId, tenantId, warehouseId: line.transfer.toWarehouseId },
      select: { id: true },
    });
    if (!bin) {
      return toApiErrorResponseFromStatus("targetBinId must be in the transfer destination warehouse.", 400);
    }
    await prisma.wmsStockTransferLine.update({
      where: { id: lineId },
      data: { toBinId: targetBinId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "ship_wms_stock_transfer") {
    const sid = input.stockTransferId?.trim();
    if (!sid) return toApiErrorResponseFromStatus("stockTransferId required.", 400);
    const tr = await prisma.wmsStockTransfer.findFirst({
      where: { id: sid, tenantId, status: "RELEASED" },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });
    if (!tr) return toApiErrorResponseFromStatus("Transfer not found or not RELEASED.", 400);
    for (const line of tr.lines) {
      if (new Prisma.Decimal(line.quantityShipped).gt(0)) {
        return toApiErrorResponseFromStatus("Transfer already shipped — refresh state.", 400);
      }
    }
    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.wmsStockTransfer.findFirst({
          where: { id: sid, tenantId, status: "RELEASED" },
          include: { lines: { orderBy: { lineNo: "asc" } } },
        });
        if (!fresh) throw new Error("__STO__:GONE");
        for (const line of fresh.lines) {
          const qtyOrd = new Prisma.Decimal(line.quantityOrdered);
          const bal = await tx.inventoryBalance.findFirst({
            where: {
              tenantId,
              warehouseId: fresh.fromWarehouseId,
              binId: line.fromBinId,
              productId: line.productId,
              lotCode: line.lotCode,
            },
            select: { id: true, onHandQty: true, allocatedQty: true, onHold: true },
          });
          if (!bal || bal.onHold) throw new Error("__STO__:BAD_BAL");
          const softMap = await softReservedQtyByBalanceIds(tx, tenantId, [bal.id]);
          const soft = softMap.get(bal.id) ?? 0;
          const eff = new Prisma.Decimal(bal.onHandQty).minus(bal.allocatedQty).minus(soft);
          if (eff.lt(qtyOrd)) throw new Error("__STO__:SHORT");
          await tx.inventoryBalance.update({
            where: { id: bal.id },
            data: { onHandQty: { decrement: qtyOrd.toString() } },
          });
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              warehouseId: fresh.fromWarehouseId,
              binId: line.fromBinId,
              productId: line.productId,
              movementType: "STO_SHIP",
              quantity: qtyOrd.toString(),
              referenceType: "WMS_STOCK_TRANSFER",
              referenceId: fresh.id,
              note: `STO line ${line.lineNo}`,
              createdById: actorId,
            },
          });
          await tx.wmsStockTransferLine.update({
            where: { id: line.id },
            data: { quantityShipped: qtyOrd.toString() },
          });
        }
        await tx.wmsStockTransfer.update({
          where: { id: fresh.id },
          data: { status: "IN_TRANSIT", shippedAt: new Date() },
        });
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "__STO__:GONE") return toApiErrorResponseFromStatus("Transfer state changed — retry.", 409);
      if (msg === "__STO__:BAD_BAL") {
        return toApiErrorResponseFromStatus("Cannot ship: balance missing or on hold.", 400);
      }
      if (msg === "__STO__:SHORT") {
        return toApiErrorResponseFromStatus("Cannot ship: insufficient available quantity.", 400);
      }
      throw e;
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "receive_wms_stock_transfer") {
    const sid = input.stockTransferId?.trim();
    if (!sid) return toApiErrorResponseFromStatus("stockTransferId required.", 400);
    const tr = await prisma.wmsStockTransfer.findFirst({
      where: { id: sid, tenantId, status: "IN_TRANSIT" },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });
    if (!tr) return toApiErrorResponseFromStatus("Transfer not found or not IN_TRANSIT.", 400);
    for (const line of tr.lines) {
      if (!line.toBinId) {
        return toApiErrorResponseFromStatus(
          `Line ${line.lineNo}: set receive bin via set_wms_stock_transfer_line first.`,
          400,
        );
      }
      const qs = new Prisma.Decimal(line.quantityShipped);
      const qr = new Prisma.Decimal(line.quantityReceived);
      if (qs.lte(0)) {
        return toApiErrorResponseFromStatus(`Line ${line.lineNo}: invalid shipped quantity.`, 400);
      }
      if (qr.gt(0)) {
        return toApiErrorResponseFromStatus("Transfer already received (minimal slice: single receive).", 400);
      }
    }
    await prisma.$transaction(async (tx) => {
      for (const line of tr.lines) {
        const qty = new Prisma.Decimal(line.quantityShipped);
        const destBinId = line.toBinId as string;
        await tx.inventoryBalance.upsert({
          where: {
            warehouseId_binId_productId_lotCode: {
              warehouseId: tr.toWarehouseId,
              binId: destBinId,
              productId: line.productId,
              lotCode: line.lotCode,
            },
          },
          create: {
            tenantId,
            warehouseId: tr.toWarehouseId,
            binId: destBinId,
            productId: line.productId,
            lotCode: line.lotCode,
            onHandQty: qty.toString(),
          },
          update: { onHandQty: { increment: qty.toString() } },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            warehouseId: tr.toWarehouseId,
            binId: destBinId,
            productId: line.productId,
            movementType: "STO_RECEIVE",
            quantity: qty.toString(),
            referenceType: "WMS_STOCK_TRANSFER",
            referenceId: tr.id,
            note: `STO line ${line.lineNo} receive`,
            createdById: actorId,
          },
        });
        await tx.wmsStockTransferLine.update({
          where: { id: line.id },
          data: { quantityReceived: qty.toString() },
        });
      }
      await tx.wmsStockTransfer.update({
        where: { id: tr.id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
    });
    return NextResponse.json({ ok: true });
  }

  return toApiErrorResponseFromStatus("Unsupported WMS action.", 400);
}
