import { Prisma } from "@prisma/client";

import { userHasGlobalGrant } from "@/lib/authz";
import { crmTenantFilter } from "@/lib/crm-scope";
import { movementLedgerWhere, type ParsedMovementLedgerQuery } from "@/lib/wms/movement-ledger-query";
import { prisma } from "@/lib/prisma";

/** Serializable JSON for `GET /api/wms` (WMS client + pages). */
export async function getWmsDashboardPayload(
  tenantId: string,
  actorUserId: string,
  movementLedger?: ParsedMovementLedgerQuery | null,
) {
  const canPickCrmAccounts = await userHasGlobalGrant(actorUserId, "org.crm", "view");
  let crmAccountListWhere: { tenantId: string; ownerUserId?: string } = { tenantId };
  if (canPickCrmAccounts) {
    const scope = await crmTenantFilter(tenantId, actorUserId);
    if ("ownerUserId" in scope && scope.ownerUserId) {
      crmAccountListWhere = { tenantId, ownerUserId: scope.ownerUserId };
    }
  }

  const recentMovementWhere = movementLedger
    ? movementLedgerWhere(tenantId, movementLedger)
    : { tenantId };
  const recentMovementTake = movementLedger?.limit ?? 80;

  const [
    warehouses,
    zones,
    bins,
    rules,
    outboundOrders,
    crmAccountOptions,
    balances,
    openTasks,
    waves,
    shipmentItems,
    inboundShipments,
    movementRows,
    recentMovements,
  ] = await Promise.all([
    prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.warehouseZone.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ warehouse: { name: "asc" } }, { zoneType: "asc" }, { code: "asc" }],
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    }),
    prisma.warehouseBin.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ warehouse: { name: "asc" } }, { code: "asc" }],
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        zone: { select: { id: true, code: true, name: true, zoneType: true } },
      },
    }),
    prisma.replenishmentRule.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, productCode: true, sku: true, name: true } },
        sourceZone: { select: { id: true, code: true, name: true } },
        targetZone: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.outboundOrder.findMany({
      where: { tenantId, status: { in: ["DRAFT", "RELEASED", "PICKING", "PACKED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        crmAccount: { select: { id: true, name: true, legalName: true } },
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            product: { select: { id: true, productCode: true, sku: true, name: true } },
          },
        },
      },
    }),
    canPickCrmAccounts
      ? prisma.crmAccount.findMany({
          where: crmAccountListWhere,
          orderBy: { name: "asc" },
          take: 200,
          select: { id: true, name: true, legalName: true },
        })
      : Promise.resolve([]),
    prisma.inventoryBalance.findMany({
      where: { tenantId },
      orderBy: [{ warehouse: { name: "asc" } }, { bin: { code: "asc" } }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        bin: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, productCode: true, sku: true, name: true } },
      },
    }),
    prisma.wmsTask.findMany({
      where: { tenantId, status: "OPEN" },
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
      where: { tenantId, status: { in: ["OPEN", "RELEASED"] } },
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
      where: { shipment: { order: { tenantId } } },
      orderBy: { shipment: { shippedAt: "desc" } },
      take: 200,
      include: {
        shipment: {
          select: {
            id: true,
            shipmentNo: true,
            status: true,
            asnReference: true,
            expectedReceiveAt: true,
            order: { select: { id: true, orderNumber: true } },
          },
        },
        orderItem: {
          select: { id: true, lineNo: true, description: true, productId: true },
        },
      },
    }),
    prisma.shipment.findMany({
      where: { order: { tenantId } },
      orderBy: { shippedAt: "desc" },
      take: 35,
      select: {
        id: true,
        shipmentNo: true,
        status: true,
        asnReference: true,
        expectedReceiveAt: true,
        shippedAt: true,
        receivedAt: true,
        order: { select: { orderNumber: true } },
        _count: { select: { items: true } },
        milestones: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            code: true,
            source: true,
            actualAt: true,
            createdAt: true,
            note: true,
          },
        },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: { tenantId },
      select: {
        referenceType: true,
        referenceId: true,
        movementType: true,
        quantity: true,
      },
    }),
    prisma.inventoryMovement.findMany({
      where: recentMovementWhere,
      orderBy: { createdAt: "desc" },
      take: recentMovementTake,
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

  return {
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
      rackCode: b.rackCode,
      aisle: b.aisle,
      bay: b.bay,
      level: b.level,
      positionIndex: b.positionIndex,
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
    crmAccountOptions,
    outboundOrders: outboundOrders.map((o) => ({
      id: o.id,
      outboundNo: o.outboundNo,
      customerRef: o.customerRef,
      shipToName: o.shipToName,
      shipToCity: o.shipToCity,
      shipToCountryCode: o.shipToCountryCode,
      status: o.status,
      warehouse: o.warehouse,
      crmAccount: o.crmAccount,
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
      onHold: Boolean(b.onHold),
      holdReason: b.holdReason ?? null,
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
    inboundShipments: inboundShipments.map((s) => {
      const m0 = s.milestones[0];
      return {
        id: s.id,
        shipmentNo: s.shipmentNo,
        status: s.status,
        asnReference: s.asnReference,
        expectedReceiveAt: s.expectedReceiveAt?.toISOString() ?? null,
        shippedAt: s.shippedAt.toISOString(),
        receivedAt: s.receivedAt?.toISOString() ?? null,
        orderNumber: s.order.orderNumber,
        itemCount: s._count.items,
        latestMilestone: m0
          ? {
              code: m0.code,
              source: m0.source,
              actualAt: m0.actualAt?.toISOString() ?? null,
              createdAt: m0.createdAt.toISOString(),
              note: m0.note,
            }
          : null,
      };
    }),
    putawayCandidates: shipmentItems
      .map((row) => {
        const baseQty =
          Number(row.quantityReceived) > 0 ? Number(row.quantityReceived) : Number(row.quantityShipped);
        const used = putawayByShipmentItem.get(row.id) ?? 0;
        const remaining = Math.max(0, baseQty - used);
        return {
          shipmentItemId: row.id,
          shipmentId: row.shipment.id,
          shipmentNo: row.shipment.shipmentNo,
          orderNumber: row.shipment.order.orderNumber,
          lineNo: row.orderItem.lineNo,
          description: row.orderItem.description,
          productId: row.orderItem.productId,
          remainingQty: remaining.toFixed(3),
          shipmentStatus: row.shipment.status,
          asnReference: row.shipment.asnReference,
          expectedReceiveAt: row.shipment.expectedReceiveAt?.toISOString() ?? null,
        };
      })
      .filter((r) => Number(r.remainingQty) > 0 && r.productId),
    pickCandidates: outboundOrders
      .filter((o) => o.status === "RELEASED" || o.status === "PICKING")
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
  };
}
