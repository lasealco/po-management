import { NextResponse } from "next/server";

import { toApiErrorResponseFromStatus } from "@/app/api/_lib/api-error-contract";
import { Prisma, ShipmentMilestoneCode, type WmsPickAllocationStrategy, type WmsReceiveStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { assertOutboundCrmAccountLinkable } from "./crm-account-link";
import { normalizeDockCode } from "./dock-appointment";
import { orderPickSlotsForWave, type WavePickSlot } from "./allocation-strategy";
import { resolveVarianceDisposition } from "./receive-line-variance";
import {
  parseLotBatchExpiryInput,
  requireNonFungibleLotBatchCode,
  truncateLotBatchCountry,
  truncateLotBatchNotes,
} from "./lot-batch-master";
import { FUNGIBLE_LOT_CODE, normalizeLotCode } from "./lot-code";
import { syncOutboundOrderStatusAfterPick } from "./outbound-workflow";
import { warehouseZoneParentWouldCycle } from "./zone-hierarchy";
import { nextWaveNo } from "./wave";
import { nextWorkOrderNo } from "./work-order-no";

import type { WmsBody } from "./wms-body";
import { allowedNextWmsReceiveStatuses, canTransitionWmsReceive, isWmsReceiveStatus } from "./wms-receive-status";

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
    const allowed: WmsPickAllocationStrategy[] = [
      "MAX_AVAILABLE_FIRST",
      "FIFO_BY_BIN_CODE",
      "FEFO_BY_LOT_EXPIRY",
      "MANUAL_ONLY",
    ];
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
    const aisle = input.aisle?.trim() || null;
    const bay = input.bay?.trim() || null;
    const level =
      typeof input.level === "number" && Number.isFinite(input.level)
        ? Math.max(1, Math.trunc(input.level))
        : null;
    const positionIndex =
      typeof input.positionIndex === "number" && Number.isFinite(input.positionIndex)
        ? Math.max(1, Math.trunc(input.positionIndex))
        : null;

    await prisma.warehouseBin.create({
      data: {
        tenantId,
        warehouseId,
        zoneId: input.targetZoneId?.trim() || null,
        code,
        name,
        storageType: input.storageType ?? "PALLET",
        isPickFace: Boolean(input.isPickFace),
        maxPallets:
          typeof input.maxPallets === "number" && Number.isFinite(input.maxPallets)
            ? Math.max(0, Math.trunc(input.maxPallets))
            : null,
        rackCode,
        aisle,
        bay,
        level,
        positionIndex,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_bin_profile") {
    const binId = input.binId?.trim();
    if (!binId) return toApiErrorResponseFromStatus("binId required.", 400);
    const data: Prisma.WarehouseBinUncheckedUpdateManyInput = {
      zoneId: input.targetZoneId?.trim() || null,
      storageType: input.storageType ?? undefined,
      isPickFace: typeof input.isPickFace === "boolean" ? input.isPickFace : undefined,
      maxPallets:
        typeof input.maxPallets === "number" && Number.isFinite(input.maxPallets)
          ? Math.max(0, Math.trunc(input.maxPallets))
          : input.maxPallets === null
            ? null
            : undefined,
    };
    if (input.rackCode !== undefined) data.rackCode = input.rackCode?.trim() || null;
    if (input.aisle !== undefined) data.aisle = input.aisle?.trim() || null;
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
    await prisma.warehouseBin.updateMany({
      where: { id: binId, tenantId },
      data,
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
      },
      update: {
        sourceZoneId: input.sourceZoneId?.trim() || null,
        targetZoneId: input.targetZoneId?.trim() || null,
        minPickQty: minPickQty.toString(),
        maxPickQty: maxPickQty.toString(),
        replenishQty: replenishQty.toString(),
        isActive: true,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_replenishment_tasks") {
    const warehouseId = input.warehouseId?.trim();
    if (!warehouseId) return toApiErrorResponseFromStatus("warehouseId required.", 400);
    const [rules, balances] = await Promise.all([
      prisma.replenishmentRule.findMany({
        where: { tenantId, warehouseId, isActive: true },
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId, warehouseId },
        include: { bin: { select: { id: true, zoneId: true, isPickFace: true } } },
      }),
    ]);
    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const rule of rules) {
        const pickBins = balances.filter(
          (b) =>
            normalizeLotCode(b.lotCode) === FUNGIBLE_LOT_CODE &&
            !b.onHold &&
            b.productId === rule.productId &&
            (rule.targetZoneId ? b.bin.zoneId === rule.targetZoneId : b.bin.isPickFace),
        );
        const pickOnHand = pickBins.reduce((s, b) => s + Number(b.onHandQty), 0);
        if (pickOnHand >= Number(rule.minPickQty)) continue;
        const source = balances
          .filter(
            (b) =>
              normalizeLotCode(b.lotCode) === FUNGIBLE_LOT_CODE &&
              !b.onHold &&
              b.productId === rule.productId &&
              (rule.sourceZoneId ? b.bin.zoneId === rule.sourceZoneId : !b.bin.isPickFace) &&
              Number(b.onHandQty) - Number(b.allocatedQty) > 0,
          )
          .sort(
            (a, b) =>
              Number(b.onHandQty) - Number(b.allocatedQty) - (Number(a.onHandQty) - Number(a.allocatedQty)),
          )[0];
        const target = pickBins.sort((a, b) => Number(a.onHandQty) - Number(b.onHandQty))[0];
        if (!source || !target) continue;
        const qty = Math.min(
          Number(rule.replenishQty),
          Math.max(0, Number(source.onHandQty) - Number(source.allocatedQty)),
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
            createdById: actorId,
          },
        });
        created += 1;
      }
    });
    return NextResponse.json({ ok: true, created });
  }

  if (action === "create_outbound_order") {
    const warehouseId = input.warehouseId?.trim();
    const lines = Array.isArray(input.lines) ? input.lines : [];
    if (!warehouseId || lines.length === 0) {
      return toApiErrorResponseFromStatus("warehouseId and lines required.", 400);
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
        lines: {
          create: lines
            .map((l, idx) => ({
              lineNo: idx + 1,
              tenantId,
              productId: l.productId,
              quantity: Number(l.quantity).toString(),
            }))
            .filter((l) => l.productId && Number(l.quantity) > 0),
        },
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
      return toApiErrorResponseFromStatus("Cannot change CRM link after pack, on shipped, or on cancelled orders.", 400);
    }
    await prisma.outboundOrder.update({
      where: { id: order.id },
      data: { crmAccountId },
    });
    return NextResponse.json({ ok: true });
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
        shipment: { select: { id: true, orderId: true } },
        orderItem: { select: { productId: true } },
      },
    });
    if (!item?.orderItem.productId) {
      return toApiErrorResponseFromStatus("Invalid shipment line.", 400);
    }
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
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_putaway_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) return toApiErrorResponseFromStatus("taskId required.", 400);
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "PUTAWAY" },
      select: { id: true, warehouseId: true, productId: true, quantity: true, referenceId: true, binId: true },
    });
    if (!task || !task.productId || !task.referenceId) {
      return toApiErrorResponseFromStatus("Putaway task not found.", 404);
    }
    const productId = task.productId;
    const referenceId = task.referenceId;
    const targetBinId = input.binId?.trim() || task.binId;
    if (!targetBinId) return toApiErrorResponseFromStatus("binId required.", 400);
    const targetLot = normalizeLotCode(input.lotCode);
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
        },
        update: { onHandQty: { increment: task.quantity } },
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
    await prisma.$transaction(async (tx) => {
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
      select: { pickAllocationStrategy: true },
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

    const openLines = await prisma.outboundOrderLine.findMany({
      where: {
        tenantId,
        outboundOrder: { warehouseId, status: { in: ["RELEASED", "PICKING"] } },
      },
      orderBy: { outboundOrder: { createdAt: "desc" } },
      take: 300,
      include: { outboundOrder: { select: { id: true } } },
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
        include: { bin: { select: { id: true, code: true } } },
      });
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
        const available = Number(row.onHandQty) - Number(row.allocatedQty);
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
        });
        byProduct.set(row.productId, list);
      }
    } else {
      const balances = await prisma.inventoryBalance.findMany({
        where: { tenantId, warehouseId, lotCode: FUNGIBLE_LOT_CODE },
        include: { bin: { select: { id: true, code: true } } },
      });
      for (const row of balances) {
        if (row.onHold) continue;
        const available = Number(row.onHandQty) - Number(row.allocatedQty);
        if (available <= 0) continue;
        const list = byProduct.get(row.productId) ?? [];
        list.push({
          binId: row.binId,
          binCode: row.bin.code,
          available,
          lotCode: FUNGIBLE_LOT_CODE,
          expirySortMs: 0,
        });
        byProduct.set(row.productId, list);
      }
    }

    for (const [productId, list] of byProduct) {
      byProduct.set(productId, orderPickSlotsForWave(allocationStrategy, list));
    }

    const waveNo = await nextWaveNo(tenantId);
    const waveNote = `Wave allocation (${allocationStrategy})`;
    const result = await prisma.$transaction(async (tx) => {
      const wave = await tx.wmsWave.create({
        data: {
          tenantId,
          warehouseId,
          waveNo,
          createdById: actorId,
        },
      });
      let createdTasks = 0;
      for (const item of openLines) {
        if (!item.productId) continue;
        const alreadyPicked = pickedMap.get(item.id) ?? 0;
        let remaining = Math.max(0, Number(item.quantity) - Number(item.pickedQty) - alreadyPicked);
        if (remaining <= 0) continue;
        const binsForProduct = byProduct.get(item.productId) ?? [];
        for (const slot of binsForProduct) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, slot.available);
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

  if (action === "mark_outbound_packed") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return toApiErrorResponseFromStatus("outboundOrderId required.", 400);
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { lines: true },
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
      include: { lines: true },
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
          },
          actorUserId: actorId,
        },
      });
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
    if (input.asnReference !== undefined) {
      data.asnReference = input.asnReference?.trim() ? input.asnReference.trim() : null;
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
    if (Object.keys(data).length === 0) {
      return toApiErrorResponseFromStatus("Provide asnReference and/or expectedReceiveAt to update.", 400);
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

    const qtyStr = receivedQty.toFixed(3);

    await prisma.$transaction(async (tx) => {
      await tx.shipmentItem.update({
        where: { id: item.id },
        data: {
          quantityReceived: qtyStr,
          wmsVarianceDisposition: disposition,
          ...(varianceNotePayload !== undefined ? { wmsVarianceNote: varianceNotePayload } : {}),
        },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId,
          shipmentId: item.shipmentId,
          entityType: "SHIPMENT_ITEM",
          entityId: item.id,
          action: "inbound_receive_line_updated",
          payload: {
            quantityShipped: shipped,
            quantityReceived: receivedQty,
            disposition,
            ...(varianceNotePayload !== undefined && varianceNotePayload !== null ? { note: varianceNotePayload } : {}),
          },
          actorUserId: actorId,
        },
      });
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

  if (action === "set_balance_hold") {
    const balanceId = input.balanceId?.trim();
    if (!balanceId) {
      return toApiErrorResponseFromStatus("balanceId required.", 400);
    }
    const reason = input.holdReason?.trim() || "On hold";
    const n = await prisma.inventoryBalance.updateMany({
      where: { id: balanceId, tenantId },
      data: { onHold: true, holdReason: reason.slice(0, 500) },
    });
    if (n.count === 0) return toApiErrorResponseFromStatus("Balance row not found.", 404);
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_balance_hold") {
    const balanceId = input.balanceId?.trim();
    if (!balanceId) {
      return toApiErrorResponseFromStatus("balanceId required.", 400);
    }
    const n = await prisma.inventoryBalance.updateMany({
      where: { id: balanceId, tenantId },
      data: { onHold: false, holdReason: null },
    });
    if (n.count === 0) return toApiErrorResponseFromStatus("Balance row not found.", 404);
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
    const movable = Number(sourceBalPre.onHandQty) - Number(sourceBalPre.allocatedQty);
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
    const workOrderNo = await nextWorkOrderNo(tenantId);
    const desc = input.workOrderDescription?.trim();
    const row = await prisma.wmsWorkOrder.create({
      data: {
        tenantId,
        warehouseId,
        workOrderNo,
        title: title.slice(0, 200),
        description: desc ? desc.slice(0, 8000) : null,
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
        payload: { workOrderNo: row.workOrderNo, warehouseId },
        actorUserId: actorId,
      },
    });
    return NextResponse.json({ ok: true, workOrderId: row.id, workOrderNo: row.workOrderNo });
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

  return toApiErrorResponseFromStatus("Unsupported WMS action.", 400);
}
