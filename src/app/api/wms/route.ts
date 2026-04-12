import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { nextWaveNo } from "@/lib/wms/wave";

type WmsBody = {
  action?: string;
  warehouseId?: string;
  code?: string;
  name?: string;
  zoneType?: "RECEIVING" | "PICKING" | "RESERVE" | "QUARANTINE" | "STAGING" | "SHIPPING";
  shipmentItemId?: string;
  orderItemId?: string;
  outboundOrderId?: string;
  outboundLineId?: string;
  productId?: string;
  taskId?: string;
  waveId?: string;
  binId?: string | null;
  sourceBinId?: string;
  targetBinId?: string;
  sourceZoneId?: string | null;
  targetZoneId?: string | null;
  customerRef?: string;
  shipToName?: string;
  shipToLine1?: string;
  shipToCity?: string;
  shipToCountryCode?: string;
  storageType?: "PALLET" | "FLOOR" | "SHELF" | "QUARANTINE" | "STAGING";
  isPickFace?: boolean;
  maxPallets?: number | null;
  minPickQty?: number;
  maxPickQty?: number;
  replenishQty?: number;
  lines?: Array<{ productId: string; quantity: number }>;
  quantity?: number;
  note?: string | null;
};

async function getTenant() {
  const tenant = await getDemoTenant();
  if (!tenant) return null;
  return tenant;
}

export async function GET() {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const [
    warehouses,
    zones,
    bins,
    rules,
    outboundOrders,
    balances,
    openTasks,
    waves,
    shipmentItems,
    movementRows,
    recentMovements,
  ] = await Promise.all([
      prisma.warehouse.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, type: true },
      }),
      prisma.warehouseZone.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ warehouse: { name: "asc" } }, { zoneType: "asc" }, { code: "asc" }],
        include: { warehouse: { select: { id: true, code: true, name: true } } },
      }),
      prisma.warehouseBin.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ warehouse: { name: "asc" } }, { code: "asc" }],
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          zone: { select: { id: true, code: true, name: true, zoneType: true } },
        },
      }),
      prisma.replenishmentRule.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          product: { select: { id: true, productCode: true, sku: true, name: true } },
          sourceZone: { select: { id: true, code: true, name: true } },
          targetZone: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.outboundOrder.findMany({
        where: { tenantId: tenant.id, status: { in: ["DRAFT", "RELEASED", "PICKING"] } },
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: {
            orderBy: { lineNo: "asc" },
            include: {
              product: { select: { id: true, productCode: true, sku: true, name: true } },
            },
          },
        },
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
      prisma.inventoryMovement.findMany({
        where: { tenantId: tenant.id },
        select: {
          referenceType: true,
          referenceId: true,
          movementType: true,
          quantity: true,
        },
      }),
      prisma.inventoryMovement.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          bin: { select: { id: true, code: true, name: true } },
          product: { select: { id: true, productCode: true, sku: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

  const putawayByShipmentItem = new Map<string, number>();
  const pickedByOutboundLine = new Map<string, number>();
  for (const mv of movementRows) {
    if (!mv.referenceId) continue;
    if (mv.referenceType === "SHIPMENT_ITEM" && mv.movementType === "PUTAWAY") {
      putawayByShipmentItem.set(
        mv.referenceId,
        (putawayByShipmentItem.get(mv.referenceId) ?? 0) + Number(mv.quantity),
      );
    }
    if (mv.referenceType === "OUTBOUND_LINE_PICK" && mv.movementType === "PICK") {
      pickedByOutboundLine.set(
        mv.referenceId,
        (pickedByOutboundLine.get(mv.referenceId) ?? 0) + Number(mv.quantity),
      );
    }
  }

  return NextResponse.json({
    warehouses,
    zones: zones.map((z) => ({
      id: z.id,
      code: z.code,
      name: z.name,
      zoneType: z.zoneType,
      warehouse: z.warehouse,
    })),
    bins: bins.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      storageType: b.storageType,
      isPickFace: b.isPickFace,
      maxPallets: b.maxPallets,
      warehouse: b.warehouse,
      zone: b.zone,
    })),
    replenishmentRules: rules.map((r) => ({
      id: r.id,
      warehouse: r.warehouse,
      product: r.product,
      sourceZone: r.sourceZone,
      targetZone: r.targetZone,
      minPickQty: r.minPickQty.toString(),
      maxPickQty: r.maxPickQty.toString(),
      replenishQty: r.replenishQty.toString(),
      isActive: r.isActive,
    })),
    outboundOrders: outboundOrders.map((o) => ({
      id: o.id,
      outboundNo: o.outboundNo,
      customerRef: o.customerRef,
      shipToName: o.shipToName,
      shipToCity: o.shipToCity,
      shipToCountryCode: o.shipToCountryCode,
      status: o.status,
      warehouse: o.warehouse,
      lines: o.lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        product: l.product,
        quantity: l.quantity.toString(),
        pickedQty: l.pickedQty.toString(),
        packedQty: l.packedQty.toString(),
        shippedQty: l.shippedQty.toString(),
      })),
    })),
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
    pickCandidates: outboundOrders
      .flatMap((o) =>
        o.lines.map((line) => {
          const moved = pickedByOutboundLine.get(line.id) ?? 0;
          const remaining = Math.max(0, Number(line.quantity) - Number(line.pickedQty) - moved);
          return {
            outboundOrderId: o.id,
            outboundNo: o.outboundNo,
            outboundLineId: line.id,
            lineNo: line.lineNo,
            description: line.product.name,
            product: line.product,
            remainingQty: remaining.toFixed(3),
          };
        }),
      )
      .filter((r) => Number(r.remainingQty) > 0 && r.product),
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      movementType: m.movementType,
      quantity: m.quantity.toString(),
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
      warehouse: m.warehouse,
      bin: m.bin,
      product: m.product,
      createdBy: m.createdBy,
    })),
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
        tenantId: tenant.id,
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
        tenantId: tenant.id,
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
      where: { id: binId, tenantId: tenant.id },
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
        tenantId: tenant.id,
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
        where: { tenantId: tenant.id, warehouseId, isActive: true },
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId: tenant.id, warehouseId },
        include: { bin: { select: { id: true, zoneId: true, isPickFace: true } } },
      }),
    ]);
    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const rule of rules) {
        const pickBins = balances.filter(
          (b) =>
            b.productId === rule.productId &&
            (rule.targetZoneId ? b.bin.zoneId === rule.targetZoneId : b.bin.isPickFace),
        );
        const pickOnHand = pickBins.reduce((s, b) => s + Number(b.onHandQty), 0);
        if (pickOnHand >= Number(rule.minPickQty)) continue;
        const source = balances
          .filter(
            (b) =>
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
            tenantId: tenant.id,
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
    const outboundNo = `OUT-${Date.now().toString().slice(-8)}`;
    const created = await prisma.outboundOrder.create({
      data: {
        tenantId: tenant.id,
        warehouseId,
        outboundNo,
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
              tenantId: tenant.id,
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

  if (action === "release_outbound_order") {
    const outboundOrderId = input.outboundOrderId?.trim();
    if (!outboundOrderId) {
      return NextResponse.json({ error: "outboundOrderId required." }, { status: 400 });
    }
    await prisma.outboundOrder.updateMany({
      where: { id: outboundOrderId, tenantId: tenant.id, status: "DRAFT" },
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
    const outboundLineId = input.outboundLineId?.trim();
    const warehouseId = input.warehouseId?.trim();
    const productId = input.productId?.trim();
    const binId = input.binId?.trim();
    const qty = Number(input.quantity);
    if (!outboundLineId || !warehouseId || !productId || !binId || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "outboundLineId, warehouseId, productId, binId, quantity required." }, { status: 400 });
    }
    const item = await prisma.outboundOrderLine.findFirst({
      where: { id: outboundLineId, tenantId: tenant.id },
      select: { id: true, outboundOrderId: true },
    });
    if (!item) return NextResponse.json({ error: "Outbound line not found." }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.create({
        data: {
          tenantId: tenant.id,
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
    const openLines = await prisma.outboundOrderLine.findMany({
      where: {
        tenantId: tenant.id,
        outboundOrder: { warehouseId, status: { in: ["RELEASED", "PICKING"] } },
      },
      orderBy: { outboundOrder: { createdAt: "desc" } },
      take: 300,
      include: { outboundOrder: { select: { id: true } } },
    });
    const pickedMovements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId: tenant.id,
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
              tenantId: tenant.id,
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
            referenceType: "OUTBOUND_LINE_PICK",
            referenceId: task.referenceId,
            createdById: actorId,
            note: "Wave completed",
          },
        });
        if (task.referenceId) {
          await tx.outboundOrderLine.updateMany({
            where: { id: task.referenceId, tenantId: tenant.id },
            data: { pickedQty: { increment: task.quantity } },
          });
        }
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
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: task.referenceId,
          createdById: actorId,
        },
      });
      if (task.referenceId) {
        await tx.outboundOrderLine.updateMany({
          where: { id: task.referenceId, tenantId: tenant.id },
          data: { pickedQty: { increment: task.quantity } },
        });
      }
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported WMS action." }, { status: 400 });
}
