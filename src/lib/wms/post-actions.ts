import { NextResponse } from "next/server";
import { Prisma, ShipmentMilestoneCode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { assertOutboundCrmAccountLinkable } from "./crm-account-link";
import { syncOutboundOrderStatusAfterPick } from "./outbound-workflow";
import { nextWaveNo } from "./wave";

import type { WmsBody } from "./wms-body";

export async function handleWmsPost(
  tenantId: string,
  actorId: string,
  input: WmsBody,
): Promise<NextResponse> {
  const action = input.action;
  if (action === "create_zone") {
    const warehouseId = input.warehouseId?.trim();
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    const zoneType = input.zoneType;
    if (!warehouseId || !code || !name || !zoneType) {
      return NextResponse.json(
        { error: "warehouseId, code, name and zoneType required." },
        { status: 400 },
      );
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

  if (action === "create_bin") {
    const warehouseId = input.warehouseId?.trim();
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    if (!warehouseId || !code || !name) {
      return NextResponse.json({ error: "warehouseId, code, name required." }, { status: 400 });
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
        maxPallets:
          typeof input.maxPallets === "number" && Number.isFinite(input.maxPallets)
            ? Math.max(0, Math.trunc(input.maxPallets))
            : null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_bin_profile") {
    const binId = input.binId?.trim();
    if (!binId) return NextResponse.json({ error: "binId required." }, { status: 400 });
    await prisma.warehouseBin.updateMany({
      where: { id: binId, tenantId },
      data: {
        zoneId: input.targetZoneId?.trim() || null,
        storageType: input.storageType ?? undefined,
        isPickFace: typeof input.isPickFace === "boolean" ? input.isPickFace : undefined,
        maxPallets:
          typeof input.maxPallets === "number" && Number.isFinite(input.maxPallets)
            ? Math.max(0, Math.trunc(input.maxPallets))
            : input.maxPallets === null
              ? null
              : undefined,
      },
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
      return NextResponse.json(
        { error: "warehouseId, productId, min/max/replenish quantities required." },
        { status: 400 },
      );
    }
    if (minPickQty < 0 || maxPickQty <= 0 || replenishQty <= 0 || minPickQty > maxPickQty) {
      return NextResponse.json({ error: "Invalid replenishment parameters." }, { status: 400 });
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
    if (!warehouseId) return NextResponse.json({ error: "warehouseId required." }, { status: 400 });
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
            !b.onHold &&
            b.productId === rule.productId &&
            (rule.targetZoneId ? b.bin.zoneId === rule.targetZoneId : b.bin.isPickFace),
        );
        const pickOnHand = pickBins.reduce((s, b) => s + Number(b.onHandQty), 0);
        if (pickOnHand >= Number(rule.minPickQty)) continue;
        const source = balances
          .filter(
            (b) =>
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
      return NextResponse.json({ error: "warehouseId and lines required." }, { status: 400 });
    }
    const crmRaw = input.crmAccountId;
    const crmAccountId =
      crmRaw === null || crmRaw === undefined ? null : String(crmRaw).trim() || null;
    if (crmAccountId) {
      const gate = await assertOutboundCrmAccountLinkable(tenantId, actorId, crmAccountId);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
      }
    }
    const outboundNo = `OUT-${Date.now().toString().slice(-8)}`;
    const created = await prisma.outboundOrder.create({
      data: {
        tenantId,
        warehouseId,
        outboundNo,
        crmAccountId,
        customerRef: input.customerRef?.trim() || null,
        shipToName: input.shipToName?.trim() || null,
        shipToLine1: input.shipToLine1?.trim() || null,
        shipToCity: input.shipToCity?.trim() || null,
        shipToCountryCode: input.shipToCountryCode?.trim().toUpperCase() || null,
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

  if (action === "set_outbound_crm_account") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return NextResponse.json({ error: "outboundOrderId required." }, { status: 400 });
    }
    const crmRaw = input.crmAccountId;
    const crmAccountId =
      crmRaw === null || crmRaw === undefined ? null : String(crmRaw).trim() || null;
    if (crmAccountId) {
      const gate = await assertOutboundCrmAccountLinkable(tenantId, actorId, crmAccountId);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
      }
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      select: { id: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Outbound order not found." }, { status: 404 });
    }
    if (
      order.status === "SHIPPED" ||
      order.status === "CANCELLED" ||
      order.status === "PACKED"
    ) {
      return NextResponse.json(
        { error: "Cannot change CRM link after pack, on shipped, or on cancelled orders." },
        { status: 400 },
      );
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
      return NextResponse.json({ error: "outboundOrderId required." }, { status: 400 });
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
      return NextResponse.json({ error: "shipmentItemId, warehouseId, quantity required." }, { status: 400 });
    }
    const item = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipment: { order: { tenantId } } },
      include: {
        shipment: { select: { id: true, orderId: true } },
        orderItem: { select: { productId: true } },
      },
    });
    if (!item?.orderItem.productId) {
      return NextResponse.json({ error: "Invalid shipment line." }, { status: 400 });
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
    if (!taskId) return NextResponse.json({ error: "taskId required." }, { status: 400 });
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "PUTAWAY" },
      select: { id: true, warehouseId: true, productId: true, quantity: true, referenceId: true, binId: true },
    });
    if (!task || !task.productId || !task.referenceId) {
      return NextResponse.json({ error: "Putaway task not found." }, { status: 404 });
    }
    const productId = task.productId;
    const referenceId = task.referenceId;
    const targetBinId = input.binId?.trim() || task.binId;
    if (!targetBinId) return NextResponse.json({ error: "binId required." }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.update({
        where: { id: task.id },
        data: { status: "DONE", binId: targetBinId, completedAt: new Date(), completedById: actorId },
      });
      await tx.inventoryBalance.upsert({
        where: {
          warehouseId_binId_productId: {
            warehouseId: task.warehouseId,
            binId: targetBinId,
            productId,
          },
        },
        create: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId,
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
      return NextResponse.json({ error: "outboundLineId, warehouseId, productId, binId, quantity required." }, { status: 400 });
    }
    const item = await prisma.outboundOrderLine.findFirst({
      where: { id: outboundLineId, tenantId },
      select: { id: true, outboundOrderId: true },
    });
    if (!item) return NextResponse.json({ error: "Outbound line not found." }, { status: 404 });
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
          quantity: qty.toString(),
          note: input.note?.trim() || null,
          createdById: actorId,
        },
      });
      await tx.inventoryBalance.updateMany({
        where: { tenantId, warehouseId, binId, productId },
        data: { allocatedQty: { increment: qty.toString() } },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_pick_wave") {
    const warehouseId = input.warehouseId?.trim();
    if (!warehouseId) {
      return NextResponse.json({ error: "warehouseId required." }, { status: 400 });
    }
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
    const balances = await prisma.inventoryBalance.findMany({
      where: { tenantId, warehouseId },
      include: { bin: { select: { id: true, code: true } } },
    });
    const byProduct = new Map<string, Array<{ binId: string; available: number }>>();
    for (const row of balances) {
      if (row.onHold) continue;
      const available = Number(row.onHandQty) - Number(row.allocatedQty);
      if (available <= 0) continue;
      const list = byProduct.get(row.productId) ?? [];
      list.push({ binId: row.binId, available });
      byProduct.set(row.productId, list);
    }
    for (const [, list] of byProduct) {
      list.sort((a, b) => b.available - a.available);
    }

    const waveNo = await nextWaveNo(tenantId);
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
              referenceType: "OUTBOUND_LINE_PICK",
              referenceId: item.id,
              quantity: take.toString(),
              note: "Auto-allocated by wave",
              createdById: actorId,
            },
          });
          await tx.inventoryBalance.updateMany({
            where: {
              tenantId,
              warehouseId,
              binId: slot.binId,
              productId: item.productId,
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
    if (!waveId) return NextResponse.json({ error: "waveId required." }, { status: 400 });
    await prisma.wmsWave.updateMany({
      where: { id: waveId, tenantId, status: "OPEN" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_wave") {
    const waveId = input.waveId?.trim() || "";
    if (!waveId) return NextResponse.json({ error: "waveId required." }, { status: 400 });
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
    if (!taskId) return NextResponse.json({ error: "taskId required." }, { status: 400 });
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId, status: "OPEN", taskType: "PICK" },
      select: { id: true, warehouseId: true, productId: true, binId: true, quantity: true, referenceId: true },
    });
    if (!task || !task.productId || !task.binId) {
      return NextResponse.json({ error: "Pick task not found." }, { status: 404 });
    }
    const productId = task.productId;
    const binId = task.binId;
    const balPre = await prisma.inventoryBalance.findFirst({
      where: { tenantId, warehouseId: task.warehouseId, binId, productId },
      select: { id: true, onHandQty: true, allocatedQty: true, onHold: true },
    });
    if (!balPre) {
      return NextResponse.json({ error: "No inventory balance in selected bin." }, { status: 400 });
    }
    if (balPre.onHold) {
      return NextResponse.json(
        { error: "Cannot complete pick: bin/product is on hold. Clear the hold first." },
        { status: 400 },
      );
    }
    if (Number(balPre.onHandQty) < Number(task.quantity)) {
      return NextResponse.json({ error: "Insufficient stock for pick." }, { status: 400 });
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
      return NextResponse.json({ error: "outboundOrderId required." }, { status: 400 });
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { lines: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Outbound order not found." }, { status: 404 });
    }
    if (order.status !== "RELEASED" && order.status !== "PICKING") {
      return NextResponse.json(
        { error: "Pack is only allowed when the order is RELEASED or PICKING." },
        { status: 400 },
      );
    }
    const allPicked = order.lines.every((l) => Number(l.pickedQty) >= Number(l.quantity));
    if (!allPicked) {
      return NextResponse.json(
        { error: "All lines must be fully picked before packing." },
        { status: 400 },
      );
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
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_outbound_shipped") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return NextResponse.json({ error: "outboundOrderId required." }, { status: 400 });
    }
    const order = await prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { lines: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Outbound order not found." }, { status: 404 });
    }
    if (order.status !== "PACKED") {
      return NextResponse.json(
        { error: "Ship is only allowed when the order is PACKED." },
        { status: 400 },
      );
    }
    const allPacked = order.lines.every((l) => Number(l.packedQty) >= Number(l.quantity));
    if (!allPacked) {
      return NextResponse.json({ error: "All lines must be fully packed." }, { status: 400 });
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
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_shipment_inbound_fields") {
    const shipmentId = input.shipmentId?.trim();
    if (!shipmentId) {
      return NextResponse.json({ error: "shipmentId required." }, { status: 400 });
    }
    const shipment = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: { id: true },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
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
          return NextResponse.json({ error: "Invalid expectedReceiveAt." }, { status: 400 });
        }
        data.expectedReceiveAt = d;
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Provide asnReference and/or expectedReceiveAt to update." },
        { status: 400 },
      );
    }
    await prisma.shipment.update({
      where: { id: shipment.id },
      data,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "record_shipment_milestone") {
    const shipmentId = input.shipmentId?.trim();
    const rawCode = input.milestoneCode?.trim();
    if (!shipmentId || !rawCode) {
      return NextResponse.json(
        { error: "shipmentId and milestoneCode required." },
        { status: 400 },
      );
    }
    if (!Object.values(ShipmentMilestoneCode).includes(rawCode as ShipmentMilestoneCode)) {
      return NextResponse.json({ error: "Invalid milestoneCode." }, { status: 400 });
    }
    const code = rawCode as ShipmentMilestoneCode;
    const shipment = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: { id: true },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
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
      return NextResponse.json({ error: "balanceId required." }, { status: 400 });
    }
    const reason = input.holdReason?.trim() || "On hold";
    const n = await prisma.inventoryBalance.updateMany({
      where: { id: balanceId, tenantId },
      data: { onHold: true, holdReason: reason.slice(0, 500) },
    });
    if (n.count === 0) return NextResponse.json({ error: "Balance row not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_balance_hold") {
    const balanceId = input.balanceId?.trim();
    if (!balanceId) {
      return NextResponse.json({ error: "balanceId required." }, { status: 400 });
    }
    const n = await prisma.inventoryBalance.updateMany({
      where: { id: balanceId, tenantId },
      data: { onHold: false, holdReason: null },
    });
    if (n.count === 0) return NextResponse.json({ error: "Balance row not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_replenish_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) return NextResponse.json({ error: "taskId required." }, { status: 400 });
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
      return NextResponse.json({ error: "Replenish task not found." }, { status: 404 });
    }
    const productId = task.productId;
    const targetBinId = task.binId;
    const sourceBinId = task.referenceId;
    const qty = Number(task.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Invalid task quantity." }, { status: 400 });
    }
    const sourceBalPre = await prisma.inventoryBalance.findFirst({
      where: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: sourceBinId,
        productId,
      },
      select: { id: true, onHandQty: true, allocatedQty: true },
    });
    if (!sourceBalPre) {
      return NextResponse.json({ error: "Source bin has no balance row." }, { status: 400 });
    }
    const movable = Number(sourceBalPre.onHandQty) - Number(sourceBalPre.allocatedQty);
    const moveQty = Math.min(qty, Math.max(0, movable));
    if (moveQty <= 0) {
      return NextResponse.json({ error: "No available quantity to move from source bin." }, { status: 400 });
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
          warehouseId_binId_productId: {
            warehouseId: task.warehouseId,
            binId: targetBinId,
            productId,
          },
        },
        create: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId,
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
      return NextResponse.json({ error: "balanceId required." }, { status: 400 });
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
    if (!row) return NextResponse.json({ error: "Balance not found." }, { status: 404 });
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
      return NextResponse.json({ error: "taskId and countedQty (>=0) required." }, { status: 400 });
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
      return NextResponse.json({ error: "Cycle count task not found." }, { status: 404 });
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

  return NextResponse.json({ error: "Unsupported WMS action." }, { status: 400 });
}
