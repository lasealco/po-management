import { Prisma } from "@prisma/client";

import { userHasGlobalGrant } from "@/lib/authz";
import { crmAccountInScope } from "@/lib/crm-scope";
import { movementLedgerWhere, type ParsedMovementLedgerQuery } from "@/lib/wms/movement-ledger-query";
import { FUNGIBLE_LOT_CODE, normalizeLotCode } from "@/lib/wms/lot-code";
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";
import { allowedNextWmsReceiveStatuses } from "@/lib/wms/wms-receive-status";
import { loadInventorySerialTrace, type SerialTraceQueryInput } from "@/lib/wms/inventory-serial-trace";
import { prisma } from "@/lib/prisma";

function andWhereClauses<T>(base: T, extra: object): T {
  if (!extra || Object.keys(extra).length === 0) return base;
  return { AND: [base, extra] } as T;
}

/** Serializable JSON for `GET /api/wms` (WMS client + pages). */
export async function getWmsDashboardPayload(
  tenantId: string,
  actorUserId: string,
  movementLedger?: ParsedMovementLedgerQuery | null,
  serialTraceQuery?: SerialTraceQueryInput | null,
) {
  const [canPickCrmAccounts, viewScope] = await Promise.all([
    userHasGlobalGrant(actorUserId, "org.crm", "view"),
    loadWmsViewReadScope(tenantId, actorUserId),
  ]);
  const crmAccountListWhere: Prisma.CrmAccountWhereInput = canPickCrmAccounts
    ? crmAccountInScope(tenantId, viewScope.crmAccess)
    : { tenantId };

  const recentMovementWhere = movementLedger
    ? movementLedgerWhere(tenantId, movementLedger)
    : { tenantId };
  const recentMovementTake = movementLedger?.limit ?? 80;
  const balanceWhere: Prisma.InventoryBalanceWhereInput = viewScope.inventoryProduct
    ? { AND: [{ tenantId }, { product: viewScope.inventoryProduct }] }
    : { tenantId };
  const replenRuleWhere: Prisma.ReplenishmentRuleWhereInput = viewScope.inventoryProduct
    ? { AND: [{ tenantId, isActive: true }, { product: viewScope.inventoryProduct }] }
    : { tenantId, isActive: true };
  const outboundWhere = andWhereClauses<Prisma.OutboundOrderWhereInput>(
    { tenantId, status: { in: ["DRAFT", "RELEASED", "PICKING", "PACKED"] } },
    viewScope.outboundOrder,
  );
  const openTaskWhere = andWhereClauses<Prisma.WmsTaskWhereInput>(
    { tenantId, status: "OPEN" },
    viewScope.wmsTask,
  );
  const openWaveWhere = andWhereClauses<Prisma.WmsWaveWhereInput>(
    { tenantId, status: { in: ["OPEN", "RELEASED"] } },
    viewScope.wmsWave,
  );
  const movementWhereForRows: Prisma.InventoryMovementWhereInput = viewScope.inventoryProduct
    ? { AND: [{ tenantId }, { product: viewScope.inventoryProduct }] }
    : { tenantId };
  const recentMovementScoped: Prisma.InventoryMovementWhereInput = viewScope.inventoryProduct
    ? { AND: [recentMovementWhere, { product: viewScope.inventoryProduct }] }
    : recentMovementWhere;

  const [
    warehouses,
    zones,
    bins,
    rules,
    outboundOrders,
    crmAccountOptions,
    crmQuoteOptions,
    balances,
    openTasks,
    waves,
    shipmentItems,
    inboundShipments,
    movementRows,
    recentMovements,
    recentMovementMatchedCount,
  ] = await Promise.all([
    prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, type: true, pickAllocationStrategy: true },
    }),
    prisma.warehouseZone.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ warehouse: { name: "asc" } }, { zoneType: "asc" }, { code: "asc" }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        parentZone: { select: { id: true, code: true, name: true } },
      },
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
      where: replenRuleWhere,
      orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, productCode: true, sku: true, name: true } },
        sourceZone: { select: { id: true, code: true, name: true } },
        targetZone: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.outboundOrder.findMany({
      where: outboundWhere,
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        crmAccount: { select: { id: true, name: true, legalName: true } },
        sourceCrmQuote: {
          select: { id: true, title: true, quoteNumber: true, status: true },
        },
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
    canPickCrmAccounts
      ? prisma.crmQuote.findMany({
          where: {
            tenantId,
            status: { in: ["SENT", "ACCEPTED"] },
            account: crmAccountListWhere,
          },
          orderBy: { updatedAt: "desc" },
          take: 200,
          select: {
            id: true,
            title: true,
            quoteNumber: true,
            status: true,
            accountId: true,
          },
        })
      : Promise.resolve([]),
    prisma.inventoryBalance.findMany({
      where: balanceWhere,
      orderBy: [{ warehouse: { name: "asc" } }, { bin: { code: "asc" } }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        bin: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, productCode: true, sku: true, name: true } },
      },
    }),
    prisma.wmsTask.findMany({
      where: openTaskWhere,
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
      where: openWaveWhere,
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
      where: { shipment: viewScope.shipment },
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
      where: viewScope.shipment,
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
        wmsReceiveStatus: true,
        wmsReceiveNote: true,
        wmsReceiveUpdatedAt: true,
        wmsReceiveUpdatedBy: { select: { id: true, name: true } },
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
        items: {
          select: {
            id: true,
            quantityShipped: true,
            quantityReceived: true,
            wmsVarianceDisposition: true,
            wmsVarianceNote: true,
            orderItem: { select: { lineNo: true, description: true } },
          },
        },
        wmsReceipts: {
          where: { status: "OPEN" },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            dockNote: true,
            dockReceivedAt: true,
            createdAt: true,
            lines: {
              select: {
                shipmentItemId: true,
                quantityReceived: true,
                wmsVarianceDisposition: true,
                wmsVarianceNote: true,
              },
            },
          },
        },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: movementWhereForRows,
      select: {
        referenceType: true,
        referenceId: true,
        movementType: true,
        quantity: true,
      },
    }),
    prisma.inventoryMovement.findMany({
      where: recentMovementScoped,
      orderBy: { createdAt: "desc" },
      take: recentMovementTake,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        bin: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, productCode: true, sku: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.inventoryMovement.count({ where: recentMovementScoped }),
  ]);

  const serialTrace =
    serialTraceQuery?.productId?.trim() && serialTraceQuery?.serialNoRaw?.trim()
      ? await loadInventorySerialTrace(tenantId, viewScope, {
          productId: serialTraceQuery.productId.trim(),
          serialNoRaw: serialTraceQuery.serialNoRaw.trim(),
        })
      : null;

  const lotBatchWhere: Prisma.WmsLotBatchWhereInput =
    viewScope.inventoryProduct != null
      ? { tenantId, product: viewScope.inventoryProduct }
      : { tenantId };

  const lotBatchesRaw = await prisma.wmsLotBatch.findMany({
    where: lotBatchWhere,
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    include: {
      product: { select: { id: true, productCode: true, sku: true, name: true } },
    },
  });

  const lotProfileMap = new Map<string, (typeof lotBatchesRaw)[number]>();
  for (const lb of lotBatchesRaw) {
    lotProfileMap.set(`${lb.productId}\t${normalizeLotCode(lb.lotCode)}`, lb);
  }

  const dockAppointmentsRaw = await prisma.wmsDockAppointment.findMany({
    where: { tenantId },
    orderBy: [{ windowStart: "asc" }],
    take: 80,
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
      shipment: {
        select: {
          id: true,
          shipmentNo: true,
          order: { select: { orderNumber: true } },
        },
      },
      outboundOrder: { select: { id: true, outboundNo: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  const workOrdersRaw = await prisma.wmsWorkOrder.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      workOrderNo: true,
      title: true,
      description: true,
      status: true,
      intakeChannel: true,
      estimatedMaterialsCents: true,
      estimatedLaborMinutes: true,
      completedAt: true,
      createdAt: true,
      warehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      crmAccount: { select: { id: true, name: true } },
    },
  });

  const replenSourceBinIds = new Set<string>();
  for (const t of openTasks) {
    if (t.taskType === "REPLENISH" && t.referenceId) replenSourceBinIds.add(t.referenceId);
  }
  const replenSourceBins =
    replenSourceBinIds.size === 0
      ? []
      : await prisma.warehouseBin.findMany({
          where: { tenantId, id: { in: [...replenSourceBinIds] } },
          select: { id: true, code: true, name: true },
        });
  const replenSourceBinById = new Map(replenSourceBins.map((b) => [b.id, b]));

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
      parentZoneId: z.parentZoneId,
      parentZone: z.parentZone
        ? { id: z.parentZone.id, code: z.parentZone.code, name: z.parentZone.name }
        : null,
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
    crmQuoteOptions,
    outboundOrders: outboundOrders.map((o) => ({
      id: o.id,
      outboundNo: o.outboundNo,
      customerRef: o.customerRef,
      asnReference: o.asnReference,
      requestedShipDate: o.requestedShipDate?.toISOString() ?? null,
      shipToName: o.shipToName,
      shipToCity: o.shipToCity,
      shipToCountryCode: o.shipToCountryCode,
      status: o.status,
      warehouse: o.warehouse,
      crmAccount: o.crmAccount,
      sourceQuote: o.sourceCrmQuote
        ? {
            id: o.sourceCrmQuote.id,
            title: o.sourceCrmQuote.title,
            quoteNumber: o.sourceCrmQuote.quoteNumber,
            status: o.sourceCrmQuote.status,
          }
        : null,
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
    balances: balances.map((b) => {
      const lc = normalizeLotCode(b.lotCode);
      const profileRow =
        lc !== FUNGIBLE_LOT_CODE ? lotProfileMap.get(`${b.product.id}\t${lc}`) ?? null : null;
      return {
        id: b.id,
        warehouse: b.warehouse,
        bin: b.bin,
        product: b.product,
        lotCode: b.lotCode,
        onHandQty: b.onHandQty.toString(),
        allocatedQty: b.allocatedQty.toString(),
        availableQty: new Prisma.Decimal(b.onHandQty).minus(b.allocatedQty).toString(),
        onHold: Boolean(b.onHold),
        holdReason: b.holdReason ?? null,
        lotBatchProfile: profileRow
          ? {
              expiryDate: profileRow.expiryDate?.toISOString().slice(0, 10) ?? null,
              countryOfOrigin: profileRow.countryOfOrigin ?? null,
              notes: profileRow.notes ?? null,
            }
          : null,
      };
    }),
    openTasks: openTasks.map((t) => {
      const sourceBin: { id: string; code: string; name: string } | null =
        t.taskType === "REPLENISH" && t.referenceId
          ? replenSourceBinById.get(t.referenceId) ?? null
          : null;
      return {
        id: t.id,
        taskType: t.taskType,
        quantity: t.quantity.toString(),
        warehouse: t.warehouse,
        bin: t.bin,
        sourceBin,
        product: t.product,
        shipment: t.shipment,
        order: t.order,
        wave: t.wave,
        note: t.note,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        lotCode: t.lotCode,
        createdAt: t.createdAt.toISOString(),
      };
    }),
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
        wmsReceiveStatus: s.wmsReceiveStatus,
        wmsReceiveNote: s.wmsReceiveNote,
        wmsReceiveUpdatedAt: s.wmsReceiveUpdatedAt?.toISOString() ?? null,
        wmsReceiveUpdatedBy: s.wmsReceiveUpdatedBy
          ? { id: s.wmsReceiveUpdatedBy.id, name: s.wmsReceiveUpdatedBy.name }
          : null,
        allowedReceiveActions: allowedNextWmsReceiveStatuses(s.wmsReceiveStatus),
        latestMilestone: m0
          ? {
              code: m0.code,
              source: m0.source,
              actualAt: m0.actualAt?.toISOString() ?? null,
              createdAt: m0.createdAt.toISOString(),
              note: m0.note,
            }
          : null,
        receiveLines: [...s.items]
          .sort((a, b) => a.orderItem.lineNo - b.orderItem.lineNo)
          .map((li) => ({
            shipmentItemId: li.id,
            lineNo: li.orderItem.lineNo,
            description: li.orderItem.description,
            quantityShipped: li.quantityShipped.toString(),
            quantityReceived: li.quantityReceived.toString(),
            wmsVarianceDisposition: li.wmsVarianceDisposition,
            wmsVarianceNote: li.wmsVarianceNote,
          })),
        openWmsReceipt: (() => {
          const r = s.wmsReceipts[0];
          if (!r) return null;
          return {
            id: r.id,
            status: r.status,
            dockNote: r.dockNote,
            dockReceivedAt: r.dockReceivedAt?.toISOString() ?? null,
            createdAt: r.createdAt.toISOString(),
            lines: r.lines.map((ln) => ({
              shipmentItemId: ln.shipmentItemId,
              quantityReceived: ln.quantityReceived.toString(),
              wmsVarianceDisposition: ln.wmsVarianceDisposition,
              wmsVarianceNote: ln.wmsVarianceNote,
            })),
          };
        })(),
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
    recentMovementsMeta: {
      limit: recentMovementTake,
      matchedCount: recentMovementMatchedCount,
      truncated: recentMovementMatchedCount > recentMovementTake,
    },
    dockAppointments: dockAppointmentsRaw.map((a) => ({
      id: a.id,
      warehouseId: a.warehouseId,
      warehouse: a.warehouse,
      dockCode: a.dockCode,
      windowStart: a.windowStart.toISOString(),
      windowEnd: a.windowEnd.toISOString(),
      direction: a.direction,
      status: a.status,
      note: a.note,
      carrierName: a.carrierName,
      carrierReference: a.carrierReference,
      trailerId: a.trailerId,
      gateCheckedInAt: a.gateCheckedInAt?.toISOString() ?? null,
      atDockAt: a.atDockAt?.toISOString() ?? null,
      departedAt: a.departedAt?.toISOString() ?? null,
      shipmentId: a.shipmentId,
      outboundOrderId: a.outboundOrderId,
      shipment:
        a.shipment != null
          ? {
              id: a.shipment.id,
              shipmentNo: a.shipment.shipmentNo,
              orderNumber: a.shipment.order.orderNumber,
            }
          : null,
      outboundNo: a.outboundOrder?.outboundNo ?? null,
      createdBy: { id: a.createdBy.id, name: a.createdBy.name },
    })),
    workOrders: workOrdersRaw.map((w) => ({
      id: w.id,
      workOrderNo: w.workOrderNo,
      title: w.title,
      description: w.description,
      status: w.status,
      intakeChannel: w.intakeChannel,
      estimatedMaterialsCents: w.estimatedMaterialsCents,
      estimatedLaborMinutes: w.estimatedLaborMinutes,
      completedAt: w.completedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      warehouse: w.warehouse,
      createdBy: w.createdBy,
      crmAccount: w.crmAccount,
    })),
    lotBatches: lotBatchesRaw.map((lb) => ({
      id: lb.id,
      productId: lb.productId,
      lotCode: lb.lotCode,
      product: lb.product,
      expiryDate: lb.expiryDate?.toISOString().slice(0, 10) ?? null,
      countryOfOrigin: lb.countryOfOrigin ?? null,
      notes: lb.notes ?? null,
      updatedAt: lb.updatedAt.toISOString(),
    })),
    serialTrace,
  };
}
