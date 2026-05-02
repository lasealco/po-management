import { prisma } from "@/lib/prisma";
import { WMS_DEMO_WAREHOUSE_CODE } from "@/lib/wms/demo-warehouse-code";
import {
  buildLaborTimingSummary,
  type LaborTimingSummary,
} from "@/lib/wms/labor-standards";
import { collectDockDetentionAlerts, parseDockDetentionPolicy } from "@/lib/wms/dock-detention";

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

/** Doc-aligned strings surfaced on `/wms` + `GET /api/wms?homeKpis=1` (BF-20). */
export const WMS_HOME_RATE_METHODOLOGY_BF20 = [
  "OTIF past-due share (%): past-due scheduled orders ÷ active outbound with requestedShipDate set (UTC calendar-day boundary). Omitted when the scheduled cohort is empty.",
  "Pick intensity: open PICK tasks ÷ max(1, active outbound orders). Backlog proxy, not picks/hour productivity.",
  "Replenishment share (%): open REPLENISH ÷ (open PICK + open REPLENISH). Slotting / pick-face pressure proxy (0% when both queues are empty).",
] as const;

/** BF-20 + BF-53 — methodology bullets on `GET /api/wms?homeKpis=1`. */
export const WMS_HOME_KPI_METHODOLOGY = [
  ...WMS_HOME_RATE_METHODOLOGY_BF20,
  "Labor timing (BF-53): among DONE tasks completed in the last 7 days with both startedAt and completedAt set, reports average actual elapsed minutes and average engineered standard minutes (when task.standardMinutes was snapshotted at creation). Efficiency vs standard = (avg standard ÷ avg actual) × 100 — above 100% means faster than standard; requires ≥1 task with a standard snapshot for the standard average.",
  "Dock detention (BF-54): when tenant policy is enabled, counts open SCHEDULED appointments where elapsed minutes from gate check-in to now (not yet at dock) exceed freeMinutesGateToDock, or from at-dock to now (not yet departed) exceed freeMinutesDockToDepart. Computed on read against Tenant.wmsDockDetentionPolicyJson — not carrier billing.",
] as const;

export type WmsHomeExecutiveRates = {
  /** % of scheduled active outbound (requestedShipDate set) that is past due UTC; null when cohort is empty. */
  otifPastDueSharePercent: number | null;
  /** Active outbound with requestedShipDate — denominator for OTIF proxy rate. */
  outboundScheduledCohortCount: number;
  /** Open PICK tasks per in-flight outbound order (≥1 denominator). */
  pickTasksPerActiveOutbound: number;
  /** Open REPLENISH as % of open PICK + REPLENISH (one decimal, 0–100). */
  replenishmentShareOfPickFaceWorkloadPercent: number;
};

/** Pure helper — BF-20 rate proxies from BF-07 counts. */
export function buildExecutiveRates(input: {
  outboundPastDueCount: number;
  outboundScheduledCohortCount: number;
  openPickTasks: number;
  openReplenishmentTasks: number;
  outboundActive: number;
}): WmsHomeExecutiveRates {
  const {
    outboundPastDueCount,
    outboundScheduledCohortCount,
    openPickTasks,
    openReplenishmentTasks,
    outboundActive,
  } = input;

  const otifPastDueSharePercent =
    outboundScheduledCohortCount <= 0
      ? null
      : Math.round((1000 * outboundPastDueCount) / outboundScheduledCohortCount) / 10;

  const pickTasksPerActiveOutbound =
    Math.round((100 * openPickTasks) / Math.max(1, outboundActive)) / 100;

  const pickPlusReplen = openPickTasks + openReplenishmentTasks;
  const replenishmentShareOfPickFaceWorkloadPercent =
    pickPlusReplen <= 0
      ? 0
      : Math.round((1000 * openReplenishmentTasks) / pickPlusReplen) / 10;

  return {
    otifPastDueSharePercent,
    outboundScheduledCohortCount,
    pickTasksPerActiveOutbound,
    replenishmentShareOfPickFaceWorkloadPercent,
  };
}

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
  /** BF-20 — derived proxy rates (methodology: `rateMethodology`). */
  rates: WmsHomeExecutiveRates;
  /** BF-20 + BF-53 methodology bullets (OTIF/pick/replen proxies + labor timing). */
  rateMethodology: readonly string[];
  /** BF-53 — closed tasks in last 7d with start + complete timestamps (engineered labor proxy). */
  laborTiming: LaborTimingSummary;
  /** BF-54 — live yard detention breaches (see `rateMethodology` / BF-54 bullet). */
  dockDetentionOpenAlerts: number;
};

export type FetchWmsHomeKpisOptions = {
  /** When provided, must match a warehouse for this tenant or it is ignored (tenant-wide). */
  warehouseId?: string | null;
};

/**
 * Tenant-wide (or warehouse-scoped) operational + executive KPIs for `/wms` home and optional JSON export (`GET /api/wms?homeKpis=1`).
 * See `docs/wms/WMS_EXECUTIVE_KPIS.md`, `WMS_EXECUTIVE_KPIS_BF07.md`, and BF-20 rate notes in the latter for definitions vs blueprint.
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
    outboundScheduledCohortCount,
    wavesActive,
    balanceRows,
    balancesOnHold,
    unbilledEvents,
    movementsWeek,
    receivingPipelineShipments,
    dockAppointmentsScheduledToday,
    laborTasksDone7d,
    tenantDockDetentionJson,
    dockAppointmentsForDetention,
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
    prisma.outboundOrder.count({
      where: {
        ...outboundWhere,
        status: { in: [...outboundActiveStatuses] },
        requestedShipDate: { not: null },
      },
    }),
    prisma.wmsWave.count({
      where: { ...waveWhere, status: { in: ["OPEN", "RELEASED"] } },
    }),
    prisma.inventoryBalance.count({ where: balanceWhere }),
    prisma.inventoryBalance.count({ where: { ...balanceWhere, onHold: true } }),
    prisma.wmsBillingEvent.count({
      where: { ...billingWhere, invoiceRunId: null, billingDisputed: false },
    }),
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
    prisma.wmsTask.findMany({
      where: {
        ...taskWhere,
        status: "DONE",
        completedAt: { gte: weekAgo },
        startedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
        standardMinutes: true,
      },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { wmsDockDetentionPolicyJson: true },
    }),
    prisma.wmsDockAppointment.findMany({
      where: {
        tenantId,
        ...(wh ? { warehouseId: wh } : {}),
        status: "SCHEDULED",
      },
      take: 200,
      select: {
        id: true,
        warehouseId: true,
        dockCode: true,
        status: true,
        gateCheckedInAt: true,
        atDockAt: true,
        departedAt: true,
      },
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
    { label: "Unbilled charges", value: unbilledEvents, hint: `${scopeHint}; billable events not invoiced (disputed held)` },
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

  const rates = buildExecutiveRates({
    outboundPastDueCount,
    outboundScheduledCohortCount,
    openPickTasks: openPick,
    openReplenishmentTasks: openReplenish,
    outboundActive,
  });

  const laborTiming = buildLaborTimingSummary(
    laborTasksDone7d.flatMap((t) => {
      if (!t.startedAt || !t.completedAt) return [];
      return [
        {
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          standardMinutes: t.standardMinutes ?? null,
        },
      ];
    }),
  );

  const detentionPolicyRes = parseDockDetentionPolicy(tenantDockDetentionJson?.wmsDockDetentionPolicyJson);
  const detentionPolicyForKpis = detentionPolicyRes.ok
    ? detentionPolicyRes.value
    : { enabled: false, freeMinutesGateToDock: 120, freeMinutesDockToDepart: 240 };
  const dockDetentionOpenAlerts = collectDockDetentionAlerts(
    dockAppointmentsForDetention,
    detentionPolicyForKpis,
    asOf,
  ).length;

  return {
    asOf: asOf.toISOString(),
    scopedWarehouseId: wh,
    scopeNotes,
    hasDemoWarehouse: Boolean(wmsDemoWarehouse),
    tiles,
    confidenceSignals,
    executive,
    narratives,
    rates,
    rateMethodology: [...WMS_HOME_KPI_METHODOLOGY],
    laborTiming,
    dockDetentionOpenAlerts,
  };
}
