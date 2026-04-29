import { prisma } from "@/lib/prisma";
import { WMS_DEMO_WAREHOUSE_CODE } from "@/lib/wms/demo-warehouse-code";

/** Percent on-hand rows flagged hold (0–100, one decimal). */
export function computeHoldRatePercent(balancesOnHold: number, balanceRows: number): number {
  if (balanceRows <= 0) return 0;
  return Math.round((1000 * balancesOnHold) / balanceRows) / 10;
}

export type WmsHomeExecutiveNarratives = {
  /** OTIF-adjacent: past-due outbound vs requested ship date (UTC day). */
  otif: string;
  /** Labor proxy: open pick task pressure. */
  labor: string;
  /** Slotting-adjacent proxy: replenishment backlog (pick-face health). */
  slotting: string;
};

/** Pure helper — used by `/wms` home and tests. */
export function buildExecutiveNarratives(input: {
  outboundPastDueCount: number;
  openPickTasks: number;
  openReplenishmentTasks: number;
}): WmsHomeExecutiveNarratives {
  const { outboundPastDueCount, openPickTasks, openReplenishmentTasks } = input;

  const otif =
    outboundPastDueCount === 0
      ? "No outbound orders are past requested ship date (UTC calendar day)."
      : `OTIF pressure: ${outboundPastDueCount} outbound order${outboundPastDueCount === 1 ? "" : "s"} past requested ship date (not yet shipped).`;

  let laborLabel = "Stable";
  if (openPickTasks > 80) laborLabel = "Heavy";
  else if (openPickTasks > 25) laborLabel = "Elevated";

  const labor = `Pick workload (${laborLabel}): ${openPickTasks} open pick task${openPickTasks === 1 ? "" : "s"} — floor labor proxy, not productivity rate.`;

  const slotting =
    openReplenishmentTasks === 0
      ? "Replenishment queue is clear — no open REPLENISH tasks (pick-face slotting proxy)."
      : `Replenishment backlog: ${openReplenishmentTasks} open REPLENISH task${openReplenishmentTasks === 1 ? "" : "s"} — slotting / pick-face pressure proxy.`;

  return { otif, labor, slotting };
}

export type WmsHomeKpisPayload = {
  /** ISO timestamp used for relative windows (7d movement, UTC day for dock). */
  asOf: string;
  /** When set, operational counts use this warehouse; inbound receiving pipeline stays tenant-wide (see scopeNotes). */
  scopedWarehouseId: string | null;
  scopeNotes: string[];
  hasDemoWarehouse: boolean;
  tiles: { label: string; value: number; hint: string }[];
  confidenceSignals: { label: string; value: number; status: string }[];
  executive: {
    receivingPipelineShipments: number;
    dockAppointmentsScheduledToday: number;
    openValueAddTasks: number;
    holdRatePercent: number;
    /** Outbound orders with requestedShipDate before start of UTC today, still not shipped. */
    outboundPastDueCount: number;
    openPickTasks: number;
    openReplenishmentTasks: number;
  };
  narratives: WmsHomeExecutiveNarratives;
};

export type FetchWmsHomeKpisOptions = {
  /** When provided, must match a warehouse for this tenant or it is ignored (tenant-wide). */
  warehouseId?: string | null;
};

/**
 * Tenant-wide (or warehouse-scoped) operational + executive KPIs for `/wms` home and optional JSON export (`GET /api/wms?homeKpis=1`).
 * See `docs/wms/WMS_EXECUTIVE_KPIS.md` + `WMS_EXECUTIVE_KPIS_BF07.md` for definitions vs blueprint.
 */
export async function fetchWmsHomeKpis(
  tenantId: string,
  opts?: FetchWmsHomeKpisOptions,
): Promise<WmsHomeKpisPayload> {
  const scopedWarehouseId =
    opts?.warehouseId != null && opts.warehouseId !== ""
      ? (
          await prisma.warehouse.findFirst({
            where: { id: opts.warehouseId, tenantId },
            select: { id: true },
          })
        )?.id ?? null
      : null;

  const wh = scopedWarehouseId;
  const scopeNotes: string[] = [];
  if (opts?.warehouseId && !scopedWarehouseId) {
    scopeNotes.push("Unknown warehouse id — counts fell back to tenant-wide.");
  }
  if (wh) {
    scopeNotes.push(
      "Receiving pipeline is tenant-wide: inbound shipments are not warehouse-keyed in this KPI set.",
    );
  }

  const asOf = new Date();
  const weekAgo = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfUtcDay = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const endOfUtcDay = new Date(startOfUtcDay);
  endOfUtcDay.setUTCDate(endOfUtcDay.getUTCDate() + 1);

  const taskWhere = { tenantId, ...(wh ? { warehouseId: wh } : {}) };
  const outboundWhere = { tenantId, ...(wh ? { warehouseId: wh } : {}) };
  const balanceWhere = { tenantId, ...(wh ? { warehouseId: wh } : {}) };
  const movementWhere = { tenantId, ...(wh ? { warehouseId: wh } : {}) };
  const billingWhere = { tenantId, ...(wh ? { warehouseId: wh } : {}) };
  const waveWhere = { tenantId, ...(wh ? { warehouseId: wh } : {}) };
  const dockWhere = {
    tenantId,
    ...(wh ? { warehouseId: wh } : {}),
    status: "SCHEDULED" as const,
    windowStart: { lt: endOfUtcDay },
    windowEnd: { gt: startOfUtcDay },
  };

  const outboundActiveStatuses = ["DRAFT", "RELEASED", "PICKING", "PACKED"] as const;

  const [
    wmsDemoWarehouse,
    openTasks,
    openPutaway,
    openPick,
    openReplenish,
    openCycleCount,
    openValueAddTasks,
    outboundActive,
    outboundPastDueCount,
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
    prisma.wmsTask.count({ where: { ...taskWhere, status: "OPEN" } }),
    prisma.wmsTask.count({ where: { ...taskWhere, status: "OPEN", taskType: "PUTAWAY" } }),
    prisma.wmsTask.count({ where: { ...taskWhere, status: "OPEN", taskType: "PICK" } }),
    prisma.wmsTask.count({ where: { ...taskWhere, status: "OPEN", taskType: "REPLENISH" } }),
    prisma.wmsTask.count({ where: { ...taskWhere, status: "OPEN", taskType: "CYCLE_COUNT" } }),
    prisma.wmsTask.count({ where: { ...taskWhere, status: "OPEN", taskType: "VALUE_ADD" } }),
    prisma.outboundOrder.count({
      where: {
        ...outboundWhere,
        status: { in: [...outboundActiveStatuses] },
      },
    }),
    prisma.outboundOrder.count({
      where: {
        ...outboundWhere,
        status: { in: [...outboundActiveStatuses] },
        requestedShipDate: { not: null, lt: startOfUtcDay },
      },
    }),
    prisma.wmsWave.count({
      where: { ...waveWhere, status: { in: ["OPEN", "RELEASED"] } },
    }),
    prisma.inventoryBalance.count({ where: balanceWhere }),
    prisma.inventoryBalance.count({ where: { ...balanceWhere, onHold: true } }),
    prisma.wmsBillingEvent.count({ where: { ...billingWhere, invoiceRunId: null } }),
    prisma.inventoryMovement.count({
      where: { ...movementWhere, createdAt: { gte: weekAgo } },
    }),
    prisma.shipment.count({
      where: {
        order: { tenantId },
        wmsReceiveStatus: { in: ["EXPECTED", "AT_DOCK", "RECEIVING", "DISCREPANCY"] },
      },
    }),
    prisma.wmsDockAppointment.count({
      where: dockWhere,
    }),
  ]);

  const holdRatePercent = computeHoldRatePercent(balancesOnHold, balanceRows);

  const scopeHint = wh ? "Scoped to selected warehouse" : "Tenant-wide";

  const tiles = [
    { label: "Open WMS tasks", value: openTasks, hint: `${scopeHint}; all task types pending execution` },
    { label: "Open putaway", value: openPutaway, hint: `${scopeHint}; inbound stock waiting for final bin` },
    { label: "Open picks", value: openPick, hint: `${scopeHint}; order demand not fully picked yet` },
    { label: "Open replenishments", value: openReplenish, hint: `${scopeHint}; pick-face refill tasks pending` },
    { label: "Open cycle counts", value: openCycleCount, hint: `${scopeHint}; count tasks awaiting entry` },
    { label: "Open VAS tasks", value: openValueAddTasks, hint: `${scopeHint}; value-add / work-order tasks pending` },
    {
      label: "Outbound in flight",
      value: outboundActive,
      hint: `${scopeHint}; draft through packed outbound flow`,
    },
    { label: "Active waves", value: wavesActive, hint: `${scopeHint}; wave batches open or released` },
    { label: "Balance rows", value: balanceRows, hint: `${scopeHint}; tracked bin × product rows` },
    { label: "On-hold balances", value: balancesOnHold, hint: `${scopeHint}; QC or quarantine constrained stock` },
    { label: "Unbilled charges", value: unbilledEvents, hint: `${scopeHint}; billing events not yet invoiced` },
    { label: "Movements (7d)", value: movementsWeek, hint: `${scopeHint}; recorded stock ledger activity` },
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
    outboundPastDueCount,
    openPickTasks: openPick,
    openReplenishmentTasks: openReplenish,
  };

  const narratives = buildExecutiveNarratives({
    outboundPastDueCount,
    openPickTasks: openPick,
    openReplenishmentTasks: openReplenish,
  });

  return {
    asOf: asOf.toISOString(),
    scopedWarehouseId: wh,
    scopeNotes,
    hasDemoWarehouse: Boolean(wmsDemoWarehouse),
    tiles,
    confidenceSignals,
    executive,
    narratives,
  };
}
