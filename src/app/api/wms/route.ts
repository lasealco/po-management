import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type WmsBody = {
  action?: string;
  warehouseId?: string;
  code?: string;
  name?: string;
  shipmentItemId?: string;
  orderItemId?: string;
  productId?: string;
  taskId?: string;
  waveId?: string;
  binId?: string | null;
  quantity?: number;
  note?: string | null;
};

async function getTenant() {
  const tenant = await getDemoTenant();
  if (!tenant) return null;
  return tenant;
}

async function nextWaveNo(tenantId: string) {
  const stamp = Date.now().toString().slice(-6);
  let candidate = `WAVE-${stamp}`;
  for (let i = 0; i < 8; i += 1) {
    const exists = await prisma.wmsWave.findFirst({
      where: { tenantId, waveNo: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `WAVE-${stamp}-${i + 1}`;
  }
  return `WAVE-${stamp}-${Math.floor(Math.random() * 1000)}`;
}

export async function GET() {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const [warehouses, bins, balances, openTasks, waves, shipmentItems, orderItems, movementRows] =
    await Promise.all([
      prisma.warehouse.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, type: true },
      }),
      prisma.warehouseBin.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ warehouse: { name: "asc" } }, { code: "asc" }],
        include: { warehouse: { select: { id: true, name: true, code: true } } },
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ warehouse: { name: "asc" } }, { bin: { code: "asc" } }],
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          bin: { select: { id: true, code: true, name: true } },
          product: { select: { id: true, productCode: true, sku: true, name: true } },
        },
      }),
      prisma.wmsTask.findMany({
        where: { tenantId: tenant.id, status: "OPEN" },
        orderBy: { createdAt: "asc" },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          bin: { select: { id: true, code: true, name: true } },
          product: { select: { id: true, productCode: true, sku: true, name: true } },
          shipment: { select: { id: true, shipmentNo: true, status: true } },
          order: { select: { id: true, orderNumber: true } },
          wave: { select: { id: true, waveNo: true, status: true } },
        },
      }),
      prisma.wmsWave.findMany({
        where: { tenantId: tenant.id, status: { in: ["OPEN", "RELEASED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          tasks: {
            where: { taskType: "PICK" },
            select: { id: true, status: true, quantity: true },
          },
        },
      }),
      prisma.shipmentItem.findMany({
        where: { shipment: { order: { tenantId: tenant.id } } },
        orderBy: { shipment: { shippedAt: "desc" } },
        take: 200,
        include: {
          shipment: {
            select: {
              id: true,
              shipmentNo: true,
              status: true,
              order: { select: { id: true, orderNumber: true } },
            },
          },
          orderItem: {
            select: { id: true, lineNo: true, description: true, productId: true },
          },
        },
      }),
      prisma.purchaseOrderItem.findMany({
        where: { order: { tenantId: tenant.id, splitParentId: null }, productId: { not: null } },
        orderBy: { order: { createdAt: "desc" } },
        take: 200,
        include: {
          order: { select: { id: true, orderNumber: true, status: { select: { code: true } } } },
          product: { select: { id: true, productCode: true, sku: true, name: true } },
        },
      }),
      prisma.inventoryMovement.findMany({
        where: { tenantId: tenant.id },
        select: {
          referenceType: true,
          referenceId: true,
          movementType: true,
          quantity: true,
        },
      }),
    ]);

  const putawayByShipmentItem = new Map<string, number>();
  const pickedByOrderItem = new Map<string, number>();
  for (const mv of movementRows) {
    if (!mv.referenceId) continue;
    if (mv.referenceType === "SHIPMENT_ITEM" && mv.movementType === "PUTAWAY") {
      putawayByShipmentItem.set(
        mv.referenceId,
        (putawayByShipmentItem.get(mv.referenceId) ?? 0) + Number(mv.quantity),
      );
    }
    if (mv.referenceType === "ORDER_ITEM_PICK" && mv.movementType === "PICK") {
      pickedByOrderItem.set(
        mv.referenceId,
        (pickedByOrderItem.get(mv.referenceId) ?? 0) + Number(mv.quantity),
      );
    }
  }

  return NextResponse.json({
    warehouses,
    bins: bins.map((b) => ({ id: b.id, code: b.code, name: b.name, warehouse: b.warehouse })),
    balances: balances.map((b) => ({
      id: b.id,
      warehouse: b.warehouse,
      bin: b.bin,
      product: b.product,
      onHandQty: b.onHandQty.toString(),
      allocatedQty: b.allocatedQty.toString(),
      availableQty: new Prisma.Decimal(b.onHandQty).minus(b.allocatedQty).toString(),
    })),
    openTasks: openTasks.map((t) => ({
      id: t.id,
      taskType: t.taskType,
      quantity: t.quantity.toString(),
      warehouse: t.warehouse,
      bin: t.bin,
      product: t.product,
      shipment: t.shipment,
      order: t.order,
      wave: t.wave,
      note: t.note,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      createdAt: t.createdAt.toISOString(),
    })),
    waves: waves.map((w) => ({
      id: w.id,
      waveNo: w.waveNo,
      status: w.status,
      warehouse: w.warehouse,
      taskCount: w.tasks.length,
      openTaskCount: w.tasks.filter((t) => t.status === "OPEN").length,
      totalQty: w.tasks.reduce((s, t) => s + Number(t.quantity), 0).toFixed(3),
      createdAt: w.createdAt.toISOString(),
    })),
    putawayCandidates: shipmentItems
      .map((row) => {
        const baseQty =
          Number(row.quantityReceived) > 0 ? Number(row.quantityReceived) : Number(row.quantityShipped);
        const used = putawayByShipmentItem.get(row.id) ?? 0;
        const remaining = Math.max(0, baseQty - used);
        return {
          shipmentItemId: row.id,
          shipmentNo: row.shipment.shipmentNo,
          orderNumber: row.shipment.order.orderNumber,
          lineNo: row.orderItem.lineNo,
          description: row.orderItem.description,
          productId: row.orderItem.productId,
          remainingQty: remaining.toFixed(3),
          shipmentStatus: row.shipment.status,
        };
      })
      .filter((r) => Number(r.remainingQty) > 0 && r.productId),
    pickCandidates: orderItems
      .map((row) => {
        const picked = pickedByOrderItem.get(row.id) ?? 0;
        const remaining = Math.max(0, Number(row.quantity) - picked);
        return {
          orderItemId: row.id,
          orderNumber: row.order.orderNumber,
          lineNo: row.lineNo,
          description: row.description,
          product: row.product,
          remainingQty: remaining.toFixed(3),
        };
      })
      .filter((r) => Number(r.remainingQty) > 0 && r.product),
  });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.wms", "edit");
  if (gate) return gate;
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active actor." }, { status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as WmsBody;
  const action = input.action;

  if (action === "create_bin") {
    const warehouseId = input.warehouseId?.trim();
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    if (!warehouseId || !code || !name) {
      return NextResponse.json({ error: "warehouseId, code, name required." }, { status: 400 });
    }
    await prisma.warehouseBin.create({
      data: { tenantId: tenant.id, warehouseId, code, name },
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
      where: { id: shipmentItemId, shipment: { order: { tenantId: tenant.id } } },
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
        tenantId: tenant.id,
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
      where: { id: taskId, tenantId: tenant.id, status: "OPEN", taskType: "PUTAWAY" },
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
          tenantId: tenant.id,
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId,
          onHandQty: task.quantity,
        },
        update: { onHandQty: { increment: task.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId: tenant.id,
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
    const orderItemId = input.orderItemId?.trim();
    const warehouseId = input.warehouseId?.trim();
    const productId = input.productId?.trim();
    const binId = input.binId?.trim();
    const qty = Number(input.quantity);
    if (!orderItemId || !warehouseId || !productId || !binId || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "orderItemId, warehouseId, productId, binId, quantity required." }, { status: 400 });
    }
    const item = await prisma.purchaseOrderItem.findFirst({
      where: { id: orderItemId, order: { tenantId: tenant.id } },
      select: { id: true, orderId: true },
    });
    if (!item) return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.create({
        data: {
          tenantId: tenant.id,
          warehouseId,
          taskType: "PICK",
          orderId: item.orderId,
          productId,
          binId,
          referenceType: "ORDER_ITEM_PICK",
          referenceId: item.id,
          quantity: qty.toString(),
          note: input.note?.trim() || null,
          createdById: actorId,
        },
      });
      await tx.inventoryBalance.updateMany({
        where: { tenantId: tenant.id, warehouseId, binId, productId },
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
    const openOrderItems = await prisma.purchaseOrderItem.findMany({
      where: {
        order: { tenantId: tenant.id, splitParentId: null },
        productId: { not: null },
      },
      orderBy: { order: { createdAt: "desc" } },
      take: 300,
      include: {
        order: { select: { id: true } },
      },
    });
    const pickedMovements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId: tenant.id,
        referenceType: "ORDER_ITEM_PICK",
        referenceId: { in: openOrderItems.map((r) => r.id) },
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
      where: { tenantId: tenant.id, warehouseId },
      include: { bin: { select: { id: true, code: true } } },
    });
    const byProduct = new Map<string, Array<{ binId: string; available: number }>>();
    for (const row of balances) {
      const available = Number(row.onHandQty) - Number(row.allocatedQty);
      if (available <= 0) continue;
      const list = byProduct.get(row.productId) ?? [];
      list.push({ binId: row.binId, available });
      byProduct.set(row.productId, list);
    }
    for (const [, list] of byProduct) {
      list.sort((a, b) => b.available - a.available);
    }

    const waveNo = await nextWaveNo(tenant.id);
    const result = await prisma.$transaction(async (tx) => {
      const wave = await tx.wmsWave.create({
        data: {
          tenantId: tenant.id,
          warehouseId,
          waveNo,
          createdById: actorId,
        },
      });
      let createdTasks = 0;
      for (const item of openOrderItems) {
        if (!item.productId) continue;
        const alreadyPicked = pickedMap.get(item.id) ?? 0;
        let remaining = Math.max(0, Number(item.quantity) - alreadyPicked);
        if (remaining <= 0) continue;
        const binsForProduct = byProduct.get(item.productId) ?? [];
        for (const slot of binsForProduct) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, slot.available);
          if (take <= 0) continue;
          await tx.wmsTask.create({
            data: {
              tenantId: tenant.id,
              warehouseId,
              taskType: "PICK",
              orderId: item.orderId,
              waveId: wave.id,
              productId: item.productId,
              binId: slot.binId,
              referenceType: "ORDER_ITEM_PICK",
              referenceId: item.id,
              quantity: take.toString(),
              note: "Auto-allocated by wave",
              createdById: actorId,
            },
          });
          await tx.inventoryBalance.updateMany({
            where: {
              tenantId: tenant.id,
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
      where: { id: waveId, tenantId: tenant.id, status: "OPEN" },
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
          tenantId: tenant.id,
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
            tenantId: tenant.id,
            warehouseId: task.warehouseId,
            productId: task.productId,
            binId: task.binId,
          },
          select: { id: true, onHandQty: true, allocatedQty: true },
        });
        if (!bal || Number(bal.onHandQty) < Number(task.quantity)) continue;
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
            tenantId: tenant.id,
            warehouseId: task.warehouseId,
            binId: task.binId,
            productId: task.productId,
            movementType: "PICK",
            quantity: task.quantity,
            referenceType: "ORDER_ITEM_PICK",
            referenceId: task.referenceId,
            createdById: actorId,
            note: "Wave completed",
          },
        });
      }
      await tx.wmsWave.updateMany({
        where: { id: waveId, tenantId: tenant.id },
        data: { status: "DONE", completedAt: new Date() },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete_pick_task") {
    const taskId = input.taskId?.trim();
    if (!taskId) return NextResponse.json({ error: "taskId required." }, { status: 400 });
    const task = await prisma.wmsTask.findFirst({
      where: { id: taskId, tenantId: tenant.id, status: "OPEN", taskType: "PICK" },
      select: { id: true, warehouseId: true, productId: true, binId: true, quantity: true, referenceId: true },
    });
    if (!task || !task.productId || !task.binId) {
      return NextResponse.json({ error: "Pick task not found." }, { status: 404 });
    }
    const productId = task.productId;
    const binId = task.binId;
    await prisma.$transaction(async (tx) => {
      const bal = await tx.inventoryBalance.findFirst({
        where: { tenantId: tenant.id, warehouseId: task.warehouseId, binId, productId },
        select: { id: true, onHandQty: true, allocatedQty: true },
      });
      if (!bal) throw new Error("No inventory balance in selected bin.");
      if (Number(bal.onHandQty) < Number(task.quantity)) {
        throw new Error("Insufficient stock for pick.");
      }
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
          tenantId: tenant.id,
          warehouseId: task.warehouseId,
          binId,
          productId,
          movementType: "PICK",
          quantity: task.quantity,
          referenceType: "ORDER_ITEM_PICK",
          referenceId: task.referenceId,
          createdById: actorId,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported WMS action." }, { status: 400 });
}
