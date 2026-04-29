import { prisma } from "@/lib/prisma";
import { WMS_DEMO_WAREHOUSE_CODE } from "@/lib/wms/demo-warehouse-code";

/** Percent on-hand rows flagged hold (0–100, one decimal). */
export function computeHoldRatePercent(balancesOnHold: number, balanceRows: number): number {
  if (balanceRows <= 0) return 0;
  return Math.round((1000 * balancesOnHold) / balanceRows) / 10;
}

export type WmsHomeKpisPayload = {
  /** ISO timestamp used for relative windows (7d movement, UTC day for dock). */
  asOf: string;
  hasDemoWarehouse: boolean;
  tiles: { label: string; value: number; hint: string }[];
  confidenceSignals: { label: string; value: number; status: string }[];
  executive: {
    receivingPipelineShipments: number;
    dockAppointmentsScheduledToday: number;
    openValueAddTasks: number;
    holdRatePercent: number;
  };
};

/**
 * Tenant-wide operational + executive KPIs for `/wms` home and optional JSON export (`GET /api/wms?homeKpis=1`).
 * See `docs/wms/WMS_EXECUTIVE_KPIS.md` for definitions vs blueprint.
 */
export async function fetchWmsHomeKpis(tenantId: string): Promise<WmsHomeKpisPayload> {
  const asOf = new Date();
  const weekAgo = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfUtcDay = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const endOfUtcDay = new Date(startOfUtcDay);
  endOfUtcDay.setUTCDate(endOfUtcDay.getUTCDate() + 1);

  const [
    wmsDemoWarehouse,
    openTasks,
    openPutaway,
    openPick,
    openReplenish,
    openCycleCount,
    openValueAddTasks,
    outboundActive,
    wavesActive,
    balanceRows,
    balancesOnHold,
    unbilledEvents,
    movementsWeek,
    receivingPipelineShipments,
    dockAppointmentsScheduledToday,
  ] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { tenantId, code: WMS_DEMO_WAREHOUSE_CODE },
      select: { id: true },
    }),
    prisma.wmsTask.count({ where: { tenantId, status: "OPEN" } }),
    prisma.wmsTask.count({ where: { tenantId, status: "OPEN", taskType: "PUTAWAY" } }),
    prisma.wmsTask.count({ where: { tenantId, status: "OPEN", taskType: "PICK" } }),
    prisma.wmsTask.count({ where: { tenantId, status: "OPEN", taskType: "REPLENISH" } }),
    prisma.wmsTask.count({ where: { tenantId, status: "OPEN", taskType: "CYCLE_COUNT" } }),
    prisma.wmsTask.count({ where: { tenantId, status: "OPEN", taskType: "VALUE_ADD" } }),
    prisma.outboundOrder.count({
      where: {
        tenantId,
        status: { in: ["DRAFT", "RELEASED", "PICKING", "PACKED"] },
      },
    }),
    prisma.wmsWave.count({
      where: { tenantId, status: { in: ["OPEN", "RELEASED"] } },
    }),
    prisma.inventoryBalance.count({ where: { tenantId } }),
    prisma.inventoryBalance.count({ where: { tenantId, onHold: true } }),
    prisma.wmsBillingEvent.count({ where: { tenantId, invoiceRunId: null } }),
    prisma.inventoryMovement.count({
      where: { tenantId, createdAt: { gte: weekAgo } },
    }),
    prisma.shipment.count({
      where: {
        order: { tenantId },
        wmsReceiveStatus: { in: ["EXPECTED", "AT_DOCK", "RECEIVING", "DISCREPANCY"] },
      },
    }),
    prisma.wmsDockAppointment.count({
      where: {
        tenantId,
        status: "SCHEDULED",
        windowStart: { lt: endOfUtcDay },
        windowEnd: { gt: startOfUtcDay },
      },
    }),
  ]);

  const holdRatePercent = computeHoldRatePercent(balancesOnHold, balanceRows);

  const tiles = [
    { label: "Open WMS tasks", value: openTasks, hint: "All task types pending execution" },
    { label: "Open putaway", value: openPutaway, hint: "Inbound stock waiting for final bin" },
    { label: "Open picks", value: openPick, hint: "Order demand not fully picked yet" },
    { label: "Open replenishments", value: openReplenish, hint: "Pick-face refill tasks pending" },
    { label: "Open cycle counts", value: openCycleCount, hint: "Count tasks awaiting entry" },
    { label: "Open VAS tasks", value: openValueAddTasks, hint: "Value-add / work-order tasks pending" },
    { label: "Outbound in flight", value: outboundActive, hint: "Draft through packed outbound flow" },
    { label: "Active waves", value: wavesActive, hint: "Wave batches open or released" },
    { label: "Balance rows", value: balanceRows, hint: "Tracked bin × product rows" },
    { label: "On-hold balances", value: balancesOnHold, hint: "QC or quarantine constrained stock" },
    { label: "Unbilled charges", value: unbilledEvents, hint: "Billing events not yet invoiced" },
    { label: "Movements (7d)", value: movementsWeek, hint: "Recorded stock ledger activity" },
  ];

  const confidenceSignals = [
    {
      label: "Task pressure",
      value: openTasks,
      status: openTasks > 120 ? "High" : openTasks > 40 ? "Moderate" : "Stable",
    },
    {
      label: "Stock quality holds",
      value: balancesOnHold,
      status: balancesOnHold > 0 ? "Needs review" : "Clear",
    },
    {
      label: "Ledger velocity (7d)",
      value: movementsWeek,
      status: movementsWeek > 0 ? "Active" : "No movement",
    },
  ];

  const executive = {
    receivingPipelineShipments,
    dockAppointmentsScheduledToday,
    openValueAddTasks,
    holdRatePercent,
  };

  return {
    asOf: asOf.toISOString(),
    hasDemoWarehouse: Boolean(wmsDemoWarehouse),
    tiles,
    confidenceSignals,
    executive,
  };
}
