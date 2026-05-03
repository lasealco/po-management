import { Prisma } from "@prisma/client";

import { userHasGlobalGrant } from "@/lib/authz";
import { crmAccountInScope } from "@/lib/crm-scope";
import { movementLedgerWhere, type ParsedMovementLedgerQuery } from "@/lib/wms/movement-ledger-query";
import { trailerChecklistFromDb } from "@/lib/wms/dock-trailer-checklist";
import { collectDockDetentionAlerts, parseDockDetentionPolicy } from "@/lib/wms/dock-detention";
import {
  forecastGapQty,
  forecastPriorityBoostFromGap,
  pickFaceEffectiveOnHandForReplenRule,
  utcIsoWeekMonday,
} from "@/lib/wms/demand-forecast-replenish";
import { FUNGIBLE_LOT_CODE, normalizeLotCode } from "@/lib/wms/lot-code";
import { softReservedQtyByBalanceIds } from "@/lib/wms/soft-reservation";
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";
import { allowedNextWmsReceiveStatuses } from "@/lib/wms/wms-receive-status";
import { loadInventorySerialTrace, type SerialTraceQueryInput } from "@/lib/wms/inventory-serial-trace";
import { buildOutboundPackScanPlan } from "@/lib/wms/pack-scan-verify";
import { manifestParcelIdsFromDbJson } from "@/lib/wms/outbound-manifest-bf67";
import {
  CO2E_HINT_METHODOLOGY,
  CO2E_HINT_SCHEMA_VERSION,
} from "@/lib/wms/carbon-intensity-bf69";
import { prisma } from "@/lib/prisma";

const WMS_PRODUCT_REF_SELECT = {
  id: true,
  productCode: true,
  sku: true,
  name: true,
  cartonLengthMm: true,
  cartonWidthMm: true,
  cartonHeightMm: true,
  cartonUnitsPerMasterCarton: true,
  isCatchWeight: true,
  catchWeightLabelHint: true,
  wmsCo2eFactorGramsPerKgKm: true,
} satisfies Prisma.ProductSelect;

function mapWmsProductJson(p: {
  id: string;
  productCode: string | null;
  sku: string | null;
  name: string;
  cartonLengthMm: number | null;
  cartonWidthMm: number | null;
  cartonHeightMm: number | null;
  cartonUnitsPerMasterCarton: Prisma.Decimal | null;
  isCatchWeight: boolean;
  catchWeightLabelHint: string | null;
  wmsCo2eFactorGramsPerKgKm: Prisma.Decimal | null;
}) {
  return {
    id: p.id,
    productCode: p.productCode,
    sku: p.sku,
    name: p.name,
    cartonLengthMm: p.cartonLengthMm,
    cartonWidthMm: p.cartonWidthMm,
    cartonHeightMm: p.cartonHeightMm,
    cartonUnitsPerMasterCarton:
      p.cartonUnitsPerMasterCarton != null ? p.cartonUnitsPerMasterCarton.toString() : null,
    isCatchWeight: p.isCatchWeight,
    catchWeightLabelHint: p.catchWeightLabelHint,
    wmsCo2eFactorGramsPerKgKm:
      p.wmsCo2eFactorGramsPerKgKm != null ? p.wmsCo2eFactorGramsPerKgKm.toString() : null,
  };
}

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
  const forecastWeekStart = utcIsoWeekMonday();

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
    aisles,
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
    laborStandards,
    tenantDockPolicy,
    demandForecastStubsRaw,
  ] = await Promise.all([
    prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, type: true, pickAllocationStrategy: true, pickWaveCartonUnits: true },
    }),
    prisma.warehouseZone.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ warehouse: { name: "asc" } }, { zoneType: "asc" }, { code: "asc" }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        parentZone: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.warehouseAisle.findMany({
      where: { tenantId },
      orderBy: [{ warehouse: { name: "asc" } }, { code: "asc" }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        zone: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.warehouseBin.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ warehouse: { name: "asc" } }, { code: "asc" }],
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        zone: { select: { id: true, code: true, name: true, zoneType: true } },
        warehouseAisle: { select: { id: true, code: true } },
      },
    }),
    prisma.replenishmentRule.findMany({
      where: replenRuleWhere,
      orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        product: { select: WMS_PRODUCT_REF_SELECT },
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
          select: {
            id: true,
            lineNo: true,
            quantity: true,
            pickedQty: true,
            packedQty: true,
            shippedQty: true,
            commercialUnitPrice: true,
            commercialListUnitPrice: true,
            commercialPriceTierLabel: true,
            commercialExtendedAmount: true,
            product: { select: WMS_PRODUCT_REF_SELECT },
          },
        },
        logisticsUnits: {
          orderBy: { scanCode: "asc" },
          select: {
            id: true,
            scanCode: true,
            kind: true,
            parentUnitId: true,
            outboundOrderLineId: true,
            containedQty: true,
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
        bin: { select: { id: true, code: true, name: true, zoneId: true, isPickFace: true } },
        product: { select: WMS_PRODUCT_REF_SELECT },
      },
    }),
    prisma.wmsTask.findMany({
      where: openTaskWhere,
      orderBy: { createdAt: "asc" },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        bin: { select: { id: true, code: true, name: true } },
        product: { select: WMS_PRODUCT_REF_SELECT },
        shipment: { select: { id: true, shipmentNo: true, status: true } },
        order: { select: { id: true, orderNumber: true } },
        wave: { select: { id: true, waveNo: true, status: true, pickMode: true } },
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
        asnQtyTolerancePct: true,
        catchWeightTolerancePct: true,
        custodySegmentJson: true,
        wmsCrossDock: true,
        wmsFlowThrough: true,
        wmsInboundSubtype: true,
        wmsRmaReference: true,
        returnSourceOutboundOrderId: true,
        shippedAt: true,
        receivedAt: true,
        wmsReceiveStatus: true,
        wmsReceiveNote: true,
        wmsReceiveUpdatedAt: true,
        wmsReceiveUpdatedBy: { select: { id: true, name: true } },
        order: { select: { orderNumber: true } },
        returnSourceOutboundOrder: { select: { id: true, outboundNo: true } },
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
            cargoGrossWeightKg: true,
            catchWeightKg: true,
            wmsVarianceDisposition: true,
            wmsVarianceNote: true,
            wmsReturnDisposition: true,
            wmsQaSamplingSkipLot: true,
            wmsQaSamplingPct: true,
            wmsReceivingDispositionTemplateId: true,
            wmsReceivingDispositionTemplate: {
              select: { id: true, code: true, title: true },
            },
            orderItem: {
              select: {
                lineNo: true,
                description: true,
                productId: true,
                product: {
                  select: {
                    sku: true,
                    productCode: true,
                    isCatchWeight: true,
                    catchWeightLabelHint: true,
                  },
                },
              },
            },
          },
        },
        wmsReceipts: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            status: true,
            dockNote: true,
            grnReference: true,
            dockReceivedAt: true,
            createdAt: true,
            closedAt: true,
            closedBy: { select: { id: true, name: true } },
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
        product: { select: WMS_PRODUCT_REF_SELECT },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.inventoryMovement.count({ where: recentMovementScoped }),
    prisma.wmsLaborTaskStandard.findMany({
      where: { tenantId },
      orderBy: { taskType: "asc" },
      select: { taskType: true, standardMinutes: true, updatedAt: true },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { wmsDockDetentionPolicyJson: true },
    }),
    prisma.wmsDemandForecastStub.findMany({
      where: {
        tenantId,
        weekStart: forecastWeekStart,
        ...(viewScope.inventoryProduct ? { product: viewScope.inventoryProduct } : {}),
      },
      orderBy: [{ warehouseId: "asc" }, { productId: "asc" }],
      take: 500,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        product: { select: WMS_PRODUCT_REF_SELECT },
      },
    }),
  ]);

  const inboundAsnAdvises = await prisma.wmsInboundAsnAdvise.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      externalAsnId: true,
      asnReference: true,
      expectedReceiveAt: true,
      linesJson: true,
      shipmentId: true,
      purchaseOrderId: true,
      warehouseId: true,
      createdAt: true,
      updatedAt: true,
      warehouse: { select: { id: true, code: true, name: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
      shipment: { select: { id: true, shipmentNo: true } },
    },
  });

  const scanEventBatches = await prisma.wmsScanEventBatch.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      clientBatchId: true,
      deviceClock: true,
      lastStatusCode: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  const wmsDamageReports = await prisma.wmsDamageReport.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      context: true,
      status: true,
      damageCategory: true,
      shipmentId: true,
      outboundOrderId: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  const serialTrace =
    serialTraceQuery?.productId?.trim() && serialTraceQuery?.serialNoRaw?.trim()
      ? await loadInventorySerialTrace(tenantId, viewScope, {
          productId: serialTraceQuery.productId.trim(),
          serialNoRaw: serialTraceQuery.serialNoRaw.trim(),
        })
      : null;

  const cycleCountSessionWhere: Prisma.WmsCycleCountSessionWhereInput =
    viewScope.inventoryProduct != null
      ? { tenantId, lines: { some: { product: viewScope.inventoryProduct } } }
      : { tenantId };

  const cycleCountSessionsRaw = await prisma.wmsCycleCountSession.findMany({
    where: cycleCountSessionWhere,
    orderBy: { updatedAt: "desc" },
    take: 48,
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      lines: {
        orderBy: { id: "asc" },
        include: {
          bin: { select: { id: true, code: true, name: true } },
          product: { select: WMS_PRODUCT_REF_SELECT },
        },
      },
    },
  });

  const lotBatchWhere: Prisma.WmsLotBatchWhereInput =
    viewScope.inventoryProduct != null
      ? { tenantId, product: viewScope.inventoryProduct }
      : { tenantId };

  const lotBatchesRaw = await prisma.wmsLotBatch.findMany({
    where: lotBatchWhere,
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    include: {
      product: { select: WMS_PRODUCT_REF_SELECT },
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

  const dockDetentionPolicyRes = parseDockDetentionPolicy(tenantDockPolicy?.wmsDockDetentionPolicyJson);
  const dockDetentionPolicy = dockDetentionPolicyRes.ok
    ? dockDetentionPolicyRes.value
    : { enabled: false, freeMinutesGateToDock: 120, freeMinutesDockToDepart: 240 };
  const dockDetentionNow = new Date();
  const dockDetentionAlerts = collectDockDetentionAlerts(
    dockAppointmentsRaw.map((a) => ({
      id: a.id,
      warehouseId: a.warehouseId,
      dockCode: a.dockCode,
      status: a.status,
      gateCheckedInAt: a.gateCheckedInAt,
      atDockAt: a.atDockAt,
      departedAt: a.departedAt,
    })),
    dockDetentionPolicy,
    dockDetentionNow,
  );
  const dockDetentionAlertByApptId = new Map(dockDetentionAlerts.map((x) => [x.appointmentId, x]));

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
      crmQuoteLineId: true,
      engineeringBomSyncedRevision: true,
      engineeringBomSyncedAt: true,
      completedAt: true,
      createdAt: true,
      warehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      crmAccount: { select: { id: true, name: true } },
      crmQuoteLine: {
        select: {
          id: true,
          engineeringBomRevision: true,
          engineeringBomMaterialsCents: true,
        },
      },
      bomLines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true,
          lineNo: true,
          plannedQty: true,
          consumedQty: true,
          lineNote: true,
          componentProduct: {
            select: WMS_PRODUCT_REF_SELECT,
          },
        },
      },
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

  const packShipScanPolicy = {
    packScanRequired: process.env.WMS_REQUIRE_PACK_SCAN === "1",
    shipScanRequired: process.env.WMS_REQUIRE_SHIP_SCAN === "1",
  };

  const softByBalanceId = await softReservedQtyByBalanceIds(
    prisma,
    tenantId,
    balances.map((b) => b.id),
  );

  const softReservationWhere: Prisma.WmsInventorySoftReservationWhereInput = {
    tenantId,
    expiresAt: { gt: new Date() },
    ...(viewScope.inventoryProduct
      ? { inventoryBalance: { product: viewScope.inventoryProduct } }
      : {}),
  };
  const softReservationRows = await prisma.wmsInventorySoftReservation.findMany({
    where: softReservationWhere,
    orderBy: { expiresAt: "asc" },
    take: 200,
    include: {
      inventoryBalance: {
        select: {
          id: true,
          bin: { select: { id: true, code: true, name: true } },
          product: { select: WMS_PRODUCT_REF_SELECT },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  const forecastStubQtyByKey = new Map<string, number>();
  for (const s of demandForecastStubsRaw) {
    forecastStubQtyByKey.set(`${s.warehouseId}\t${s.productId}`, Number(s.forecastQty));
  }
  const forecastWeekStartIso = forecastWeekStart.toISOString().slice(0, 10);
  const forecastGapHints = rules
    .filter((r) => r.isActive)
    .map((r) => {
      const forecastQty = forecastStubQtyByKey.get(`${r.warehouseId}\t${r.productId}`) ?? 0;
      const pick = pickFaceEffectiveOnHandForReplenRule(balances, r, softByBalanceId);
      const gap = forecastGapQty(forecastQty, pick);
      const boost = forecastPriorityBoostFromGap(gap);
      return {
        replenishmentRuleId: r.id,
        warehouseId: r.warehouseId,
        warehouse: r.warehouse,
        product: mapWmsProductJson(r.product),
        weekStart: forecastWeekStartIso,
        forecastQty: forecastQty.toFixed(3),
        pickFaceEffectiveQty: pick.toFixed(3),
        forecastGapQty: gap.toFixed(3),
        priorityBoost: boost,
        rulePriority: r.priority,
        effectiveSortPriority: r.priority + boost,
      };
    });

  const atpAgg = new Map<
    string,
    {
      warehouseId: string;
      warehouseLabel: string;
      productId: string;
      product: ReturnType<typeof mapWmsProductJson>;
      onHand: number;
      allocated: number;
      softReserved: number;
    }
  >();
  for (const b of balances) {
    const key = `${b.warehouseId}\t${b.productId}`;
    const soft = softByBalanceId.get(b.id) ?? 0;
    const on = Number(b.onHandQty);
    const alloc = Number(b.allocatedQty);
    const prev = atpAgg.get(key);
    if (!prev) {
      atpAgg.set(key, {
        warehouseId: b.warehouseId,
        warehouseLabel: `${b.warehouse.code ?? ""} ${b.warehouse.name}`.trim(),
        productId: b.productId,
        product: mapWmsProductJson(b.product),
        onHand: on,
        allocated: alloc,
        softReserved: soft,
      });
    } else {
      prev.onHand += on;
      prev.allocated += alloc;
      prev.softReserved += soft;
    }
  }
  const atpByWarehouseProduct = [...atpAgg.values()]
    .map((r) => {
      const atp = Math.max(0, r.onHand - r.allocated - r.softReserved);
      return {
        warehouseId: r.warehouseId,
        warehouseLabel: r.warehouseLabel,
        productId: r.productId,
        product: r.product,
        onHandQty: r.onHand.toFixed(3),
        allocatedQty: r.allocated.toFixed(3),
        softReservedQty: r.softReserved.toFixed(3),
        atpQty: atp.toFixed(3),
      };
    })
    .sort((a, b) =>
      `${a.warehouseLabel}${a.product.name}`.localeCompare(`${b.warehouseLabel}${b.product.name}`),
    );

  const receivingDispositionTemplates = await prisma.wmsReceivingDispositionTemplate.findMany({
    where: { tenantId },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      title: true,
      noteTemplate: true,
      suggestedVarianceDisposition: true,
      updatedAt: true,
    },
  });

  const outboundWebhookSubscriptions = await prisma.wmsOutboundWebhookSubscription.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      eventTypes: true,
      isActive: true,
      signingSecretSuffix: true,
      createdAt: true,
    },
  });

  const partnerApiKeys = await prisma.wmsPartnerApiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      keyPrefix: true,
      scopes: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  const stockTransfersRaw = await prisma.wmsStockTransfer.findMany({
    where: {
      tenantId,
      status: { in: ["DRAFT", "RELEASED", "IN_TRANSIT", "RECEIVED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
    include: {
      fromWarehouse: { select: { id: true, code: true, name: true } },
      toWarehouse: { select: { id: true, code: true, name: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        include: {
          product: { select: WMS_PRODUCT_REF_SELECT },
          fromBin: { select: { id: true, code: true, name: true } },
          toBin: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  return {
    packShipScanPolicy,
    movementCo2eHintMeta: {
      schemaVersion: CO2E_HINT_SCHEMA_VERSION,
      methodology: CO2E_HINT_METHODOLOGY,
    },
    atpByWarehouseProduct,
    softReservations: softReservationRows.map((r) => ({
      id: r.id,
      quantity: r.quantity.toString(),
      expiresAt: r.expiresAt.toISOString(),
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      note: r.note,
      inventoryBalanceId: r.inventoryBalanceId,
      warehouse: r.inventoryBalance.warehouse,
      bin: r.inventoryBalance.bin,
      product: mapWmsProductJson(r.inventoryBalance.product),
    })),
    warehouses: warehouses.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      type: w.type,
      pickAllocationStrategy: w.pickAllocationStrategy,
      pickWaveCartonUnits: w.pickWaveCartonUnits != null ? w.pickWaveCartonUnits.toString() : null,
    })),
    laborStandards: laborStandards.map((r) => ({
      taskType: r.taskType,
      standardMinutes: r.standardMinutes,
      updatedAt: r.updatedAt.toISOString(),
    })),
    dockDetentionPolicy: {
      enabled: dockDetentionPolicy.enabled,
      freeMinutesGateToDock: dockDetentionPolicy.freeMinutesGateToDock,
      freeMinutesDockToDepart: dockDetentionPolicy.freeMinutesDockToDepart,
    },
    dockDetentionAlerts,
    stockTransfers: stockTransfersRaw.map((st) => ({
      id: st.id,
      referenceCode: st.referenceCode,
      status: st.status,
      note: st.note,
      releasedAt: st.releasedAt?.toISOString() ?? null,
      shippedAt: st.shippedAt?.toISOString() ?? null,
      receivedAt: st.receivedAt?.toISOString() ?? null,
      updatedAt: st.updatedAt.toISOString(),
      fromWarehouse: st.fromWarehouse,
      toWarehouse: st.toWarehouse,
      lines: st.lines.map((ln) => ({
        id: ln.id,
        lineNo: ln.lineNo,
        product: mapWmsProductJson(ln.product),
        lotCode: ln.lotCode,
        quantityOrdered: ln.quantityOrdered.toString(),
        quantityShipped: ln.quantityShipped.toString(),
        quantityReceived: ln.quantityReceived.toString(),
        fromBin: ln.fromBin,
        toBin: ln.toBin,
      })),
    })),
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
    aisles: aisles.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      isActive: a.isActive,
      zoneId: a.zoneId,
      zone: a.zone ? { id: a.zone.id, code: a.zone.code, name: a.zone.name } : null,
      lengthMm: a.lengthMm,
      widthMm: a.widthMm,
      originXMm: a.originXMm,
      originYMm: a.originYMm,
      originZMm: a.originZMm,
      warehouse: a.warehouse,
    })),
    bins: bins.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      storageType: b.storageType,
      isPickFace: b.isPickFace,
      isCrossDockStaging: b.isCrossDockStaging,
      maxPallets: b.maxPallets,
      rackCode: b.rackCode,
      aisle: b.aisle,
      warehouseAisleId: b.warehouseAisleId,
      warehouseAisle: b.warehouseAisle
        ? { id: b.warehouseAisle.id, code: b.warehouseAisle.code }
        : null,
      bay: b.bay,
      level: b.level,
      positionIndex: b.positionIndex,
      capacityCubeCubicMm: b.capacityCubeCubicMm ?? null,
      warehouse: b.warehouse,
      zone: b.zone,
    })),
    replenishmentRules: rules.map((r) => ({
      id: r.id,
      warehouse: r.warehouse,
      product: mapWmsProductJson(r.product),
      sourceZone: r.sourceZone,
      targetZone: r.targetZone,
      minPickQty: r.minPickQty.toString(),
      maxPickQty: r.maxPickQty.toString(),
      replenishQty: r.replenishQty.toString(),
      isActive: r.isActive,
      priority: r.priority,
      maxTasksPerRun: r.maxTasksPerRun,
      exceptionQueue: r.exceptionQueue,
    })),
    demandForecastStubs: demandForecastStubsRaw.map((s) => ({
      id: s.id,
      warehouse: s.warehouse,
      product: mapWmsProductJson(s.product),
      weekStart: s.weekStart.toISOString().slice(0, 10),
      forecastQty: s.forecastQty.toString(),
      note: s.note ?? null,
      updatedAt: s.updatedAt.toISOString(),
    })),
    forecastGapHints,
    receivingDispositionTemplates: receivingDispositionTemplates.map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      noteTemplate: t.noteTemplate,
      suggestedVarianceDisposition: t.suggestedVarianceDisposition,
      updatedAt: t.updatedAt.toISOString(),
    })),
    outboundWebhookSubscriptions: outboundWebhookSubscriptions.map((s) => ({
      id: s.id,
      url: s.url,
      eventTypes: [...s.eventTypes],
      isActive: s.isActive,
      signingSecretSuffix: s.signingSecretSuffix,
      createdAt: s.createdAt.toISOString(),
    })),
    partnerApiKeys: partnerApiKeys.map((k) => ({
      id: k.id,
      label: k.label,
      keyPrefix: k.keyPrefix,
      scopes: [...k.scopes],
      isActive: k.isActive,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
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
      estimatedCubeCbm: o.estimatedCubeCbm?.toString() ?? null,
      carrierTrackingNo: o.carrierTrackingNo ?? null,
      carrierLabelAdapterId: o.carrierLabelAdapterId ?? null,
      carrierLabelPurchasedAt: o.carrierLabelPurchasedAt?.toISOString() ?? null,
      manifestParcelIds: manifestParcelIdsFromDbJson(o.manifestParcelIds),
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
        product: mapWmsProductJson(l.product),
        quantity: l.quantity.toString(),
        pickedQty: l.pickedQty.toString(),
        packedQty: l.packedQty.toString(),
        shippedQty: l.shippedQty.toString(),
        commercialUnitPrice: l.commercialUnitPrice?.toString() ?? null,
        commercialListUnitPrice: l.commercialListUnitPrice?.toString() ?? null,
        commercialPriceTierLabel: l.commercialPriceTierLabel ?? null,
        commercialExtendedAmount: l.commercialExtendedAmount?.toString() ?? null,
      })),
      logisticsUnits: (o.logisticsUnits ?? []).map((u) => ({
        id: u.id,
        scanCode: u.scanCode,
        kind: u.kind,
        parentUnitId: u.parentUnitId,
        outboundOrderLineId: u.outboundOrderLineId,
        containedQty: u.containedQty?.toString() ?? null,
      })),
      packScanPlan:
        o.status === "RELEASED" || o.status === "PICKING"
          ? buildOutboundPackScanPlan(
              o.lines.map((l) => ({
                pickedQty: Number(l.pickedQty),
                product: mapWmsProductJson(l.product),
              })),
            )
          : o.status === "PACKED"
            ? buildOutboundPackScanPlan(
                o.lines.map((l) => ({
                  pickedQty: Number(l.packedQty),
                  product: mapWmsProductJson(l.product),
                })),
              )
            : [],
    })),
    balances: balances.map((b) => {
      const lc = normalizeLotCode(b.lotCode);
      const profileRow =
        lc !== FUNGIBLE_LOT_CODE ? lotProfileMap.get(`${b.product.id}\t${lc}`) ?? null : null;
      return {
        id: b.id,
        warehouse: b.warehouse,
        bin: b.bin,
        product: mapWmsProductJson(b.product),
        lotCode: b.lotCode,
        onHandQty: b.onHandQty.toString(),
        allocatedQty: b.allocatedQty.toString(),
        softReservedQty: (softByBalanceId.get(b.id) ?? 0).toFixed(3),
        availableQty: new Prisma.Decimal(b.onHandQty).minus(b.allocatedQty).toString(),
        effectiveAvailableQty: new Prisma.Decimal(b.onHandQty)
          .minus(b.allocatedQty)
          .minus(new Prisma.Decimal(softByBalanceId.get(b.id) ?? 0))
          .toString(),
        onHold: Boolean(b.onHold),
        holdReason: b.holdReason ?? null,
        holdReasonCode: b.holdReasonCode ?? null,
        holdAppliedAt: b.holdAppliedAt?.toISOString() ?? null,
        holdReleaseGrant: b.holdReleaseGrant ?? null,
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
        product: t.product ? mapWmsProductJson(t.product) : null,
        shipment: t.shipment,
        order: t.order,
        wave: t.wave,
        note: t.note,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        lotCode: t.lotCode,
        replenishmentRuleId: t.replenishmentRuleId,
        replenishmentPriority: t.replenishmentPriority,
        replenishmentException: t.replenishmentException,
        startedAt: t.startedAt?.toISOString() ?? null,
        standardMinutes: t.standardMinutes ?? null,
        createdAt: t.createdAt.toISOString(),
        batchGroupKey: t.batchGroupKey ?? null,
      };
    }),
    waves: waves.map((w) => ({
      id: w.id,
      waveNo: w.waveNo,
      status: w.status,
      pickMode: w.pickMode,
      warehouse: w.warehouse,
      taskCount: w.tasks.length,
      openTaskCount: w.tasks.filter((t) => t.status === "OPEN").length,
      totalQty: w.tasks.reduce((s, t) => s + Number(t.quantity), 0).toFixed(3),
      createdAt: w.createdAt.toISOString(),
    })),
    inboundAsnAdvises: inboundAsnAdvises.map((a) => ({
      id: a.id,
      externalAsnId: a.externalAsnId,
      asnReference: a.asnReference,
      expectedReceiveAt: a.expectedReceiveAt?.toISOString() ?? null,
      lineCount: Array.isArray(a.linesJson) ? a.linesJson.length : 0,
      shipmentId: a.shipmentId,
      purchaseOrderId: a.purchaseOrderId,
      warehouseId: a.warehouseId,
      warehouse: a.warehouse,
      purchaseOrder: a.purchaseOrder,
      shipment: a.shipment,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    scanEventBatches: scanEventBatches.map((b) => ({
      id: b.id,
      clientBatchId: b.clientBatchId,
      deviceClock: b.deviceClock,
      lastStatusCode: b.lastStatusCode,
      createdAt: b.createdAt.toISOString(),
      createdBy: b.createdBy,
    })),
    wmsDamageReports: wmsDamageReports.map((r) => ({
      id: r.id,
      context: r.context,
      status: r.status,
      damageCategory: r.damageCategory,
      shipmentId: r.shipmentId,
      outboundOrderId: r.outboundOrderId,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
    })),
    inboundShipments: inboundShipments.map((s) => {
      const m0 = s.milestones[0];
      return {
        id: s.id,
        shipmentNo: s.shipmentNo,
        status: s.status,
        asnReference: s.asnReference,
        expectedReceiveAt: s.expectedReceiveAt?.toISOString() ?? null,
        asnQtyTolerancePct: s.asnQtyTolerancePct != null ? s.asnQtyTolerancePct.toString() : null,
        catchWeightTolerancePct:
          s.catchWeightTolerancePct != null ? s.catchWeightTolerancePct.toString() : null,
        custodySegmentJson: s.custodySegmentJson ?? null,
        wmsCrossDock: s.wmsCrossDock,
        wmsFlowThrough: s.wmsFlowThrough,
        wmsInboundSubtype: s.wmsInboundSubtype,
        wmsRmaReference: s.wmsRmaReference,
        returnSourceOutboundOrderId: s.returnSourceOutboundOrderId,
        returnSourceOutbound: s.returnSourceOutboundOrder
          ? { id: s.returnSourceOutboundOrder.id, outboundNo: s.returnSourceOutboundOrder.outboundNo }
          : null,
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
            productSku:
              li.orderItem.product?.sku?.trim() ||
              li.orderItem.product?.productCode?.trim() ||
              null,
            cargoGrossWeightKg:
              li.cargoGrossWeightKg != null ? li.cargoGrossWeightKg.toString() : null,
            catchWeightKg: li.catchWeightKg != null ? li.catchWeightKg.toString() : null,
            isCatchWeightProduct: Boolean(li.orderItem.product?.isCatchWeight),
            catchWeightLabelHint: li.orderItem.product?.catchWeightLabelHint ?? null,
            productId: li.orderItem.productId,
            quantityShipped: li.quantityShipped.toString(),
            quantityReceived: li.quantityReceived.toString(),
            wmsVarianceDisposition: li.wmsVarianceDisposition,
            wmsVarianceNote: li.wmsVarianceNote,
            wmsReturnDisposition: li.wmsReturnDisposition,
            wmsQaSamplingSkipLot: li.wmsQaSamplingSkipLot,
            wmsQaSamplingPct:
              li.wmsQaSamplingPct != null ? li.wmsQaSamplingPct.toString() : null,
            wmsReceivingDispositionTemplateId: li.wmsReceivingDispositionTemplateId,
            receivingDispositionTemplate: li.wmsReceivingDispositionTemplate,
          })),
        openWmsReceipt: (() => {
          const open = s.wmsReceipts.find((r) => r.status === "OPEN");
          if (!open) return null;
          return {
            id: open.id,
            status: "OPEN" as const,
            dockNote: open.dockNote,
            dockReceivedAt: open.dockReceivedAt?.toISOString() ?? null,
            createdAt: open.createdAt.toISOString(),
            lines: open.lines.map((ln) => ({
              shipmentItemId: ln.shipmentItemId,
              quantityReceived: ln.quantityReceived.toString(),
              wmsVarianceDisposition: ln.wmsVarianceDisposition,
              wmsVarianceNote: ln.wmsVarianceNote,
            })),
          };
        })(),
        closedWmsReceiptHistory: (() => {
          const closed = s.wmsReceipts
            .filter((r) => r.status === "CLOSED")
            .sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0))
            .slice(0, 12)
            .map((r) => ({
              id: r.id,
              closedAt: r.closedAt?.toISOString() ?? null,
              closedBy: r.closedBy ? { id: r.closedBy.id, name: r.closedBy.name } : null,
              createdAt: r.createdAt.toISOString(),
              dockReceivedAt: r.dockReceivedAt?.toISOString() ?? null,
              dockNote: r.dockNote,
              grnReference: r.grnReference ?? null,
              lineCount: r.lines.length,
            }));
          return closed;
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
            product: mapWmsProductJson(line.product),
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
      custodySegmentJson: m.custodySegmentJson ?? null,
      co2eEstimateGrams: m.co2eEstimateGrams != null ? m.co2eEstimateGrams.toString() : null,
      co2eStubJson: m.co2eStubJson ?? null,
      createdAt: m.createdAt.toISOString(),
      warehouse: m.warehouse,
      bin: m.bin,
      product: mapWmsProductJson(m.product),
      createdBy: m.createdBy,
    })),
    recentMovementsMeta: {
      limit: recentMovementTake,
      matchedCount: recentMovementMatchedCount,
      truncated: recentMovementMatchedCount > recentMovementTake,
    },
    dockAppointments: (() => {
      const dockNextWindowStartById = new Map<string, string | null>();
      const byKey = new Map<string, (typeof dockAppointmentsRaw)[number][]>();
      for (const r of dockAppointmentsRaw) {
        if (r.status !== "SCHEDULED") continue;
        const k = `${r.warehouseId}\t${r.dockCode}`;
        const arr = byKey.get(k) ?? [];
        arr.push(r);
        byKey.set(k, arr);
      }
      for (const [, arr] of byKey) {
        arr.sort((x, y) => x.windowStart.getTime() - y.windowStart.getTime());
        for (let i = 0; i < arr.length; i += 1) {
          const next = arr[i + 1];
          dockNextWindowStartById.set(arr[i]!.id, next ? next.windowStart.toISOString() : null);
        }
      }
      return dockAppointmentsRaw.map((a) => ({
      id: a.id,
      warehouseId: a.warehouseId,
      warehouse: a.warehouse,
      dockCode: a.dockCode,
      doorCode: a.doorCode,
      trailerChecklistJson: trailerChecklistFromDb(a.trailerChecklistJson),
      nextDockAppointmentWindowStart: dockNextWindowStartById.get(a.id) ?? null,
      windowStart: a.windowStart.toISOString(),
      windowEnd: a.windowEnd.toISOString(),
      direction: a.direction,
      status: a.status,
      note: a.note,
      carrierName: a.carrierName,
      carrierReference: a.carrierReference,
      trailerId: a.trailerId,
      tmsLoadId: a.tmsLoadId,
      tmsCarrierBookingRef: a.tmsCarrierBookingRef,
      tmsLastWebhookAt: a.tmsLastWebhookAt?.toISOString() ?? null,
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
      detentionAlert: dockDetentionAlertByApptId.get(a.id) ?? null,
    }));
    })(),
    workOrders: workOrdersRaw.map((w) => ({
      id: w.id,
      workOrderNo: w.workOrderNo,
      title: w.title,
      description: w.description,
      status: w.status,
      intakeChannel: w.intakeChannel,
      estimatedMaterialsCents: w.estimatedMaterialsCents,
      estimatedLaborMinutes: w.estimatedLaborMinutes,
      crmQuoteLineId: w.crmQuoteLineId,
      engineeringBomSyncedRevision: w.engineeringBomSyncedRevision,
      engineeringBomSyncedAt: w.engineeringBomSyncedAt?.toISOString() ?? null,
      crmEngineeringBomRevision: w.crmQuoteLine?.engineeringBomRevision ?? null,
      crmEngineeringBomMaterialsCents: w.crmQuoteLine?.engineeringBomMaterialsCents ?? null,
      materialsEstimateVsEngineeringVarianceCents:
        w.estimatedMaterialsCents != null &&
        w.crmQuoteLine?.engineeringBomMaterialsCents != null
          ? w.estimatedMaterialsCents - w.crmQuoteLine.engineeringBomMaterialsCents
          : null,
      completedAt: w.completedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      warehouse: w.warehouse,
      createdBy: w.createdBy,
      crmAccount: w.crmAccount,
      bomLines: w.bomLines.map((bl) => ({
        id: bl.id,
        lineNo: bl.lineNo,
        plannedQty: bl.plannedQty.toString(),
        consumedQty: bl.consumedQty.toString(),
        lineNote: bl.lineNote,
        componentProduct: mapWmsProductJson(bl.componentProduct),
      })),
    })),
    lotBatches: lotBatchesRaw.map((lb) => ({
      id: lb.id,
      productId: lb.productId,
      lotCode: lb.lotCode,
      product: mapWmsProductJson(lb.product),
      expiryDate: lb.expiryDate?.toISOString().slice(0, 10) ?? null,
      countryOfOrigin: lb.countryOfOrigin ?? null,
      notes: lb.notes ?? null,
      updatedAt: lb.updatedAt.toISOString(),
    })),
    cycleCountSessions: cycleCountSessionsRaw.map((s) => ({
      id: s.id,
      referenceCode: s.referenceCode,
      status: s.status,
      scopeNote: s.scopeNote,
      warehouseId: s.warehouseId,
      warehouse: s.warehouse,
      createdBy: s.createdBy,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      closedAt: s.closedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      lines: s.lines.map((ln) => ({
        id: ln.id,
        inventoryBalanceId: ln.inventoryBalanceId,
        binId: ln.binId,
        bin: ln.bin,
        product: mapWmsProductJson(ln.product),
        lotCode: ln.lotCode,
        expectedQty: ln.expectedQty.toString(),
        countedQty: ln.countedQty?.toString() ?? null,
        varianceReasonCode: ln.varianceReasonCode,
        varianceNote: ln.varianceNote,
        status: ln.status,
        inventoryMovementId: ln.inventoryMovementId,
      })),
    })),
    serialTrace,
  };
}
