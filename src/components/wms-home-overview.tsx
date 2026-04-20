import { prisma } from "@/lib/prisma";
import { WMS_DEMO_WAREHOUSE_CODE } from "@/lib/wms/demo-warehouse-code";

export async function WmsHomeOverview({ tenantId }: { tenantId: string }) {
  const asOf = new Date();
  const weekAgo = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [
    wmsDemoWarehouse,
    openTasks,
    openPutaway,
    openPick,
    openReplenish,
    openCycleCount,
    outboundActive,
    wavesActive,
    balanceRows,
    balancesOnHold,
    unbilledEvents,
    movementsWeek,
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
  ]);

  const tiles = [
    { label: "Open WMS tasks", value: openTasks, hint: "All task types pending execution" },
    { label: "Open putaway", value: openPutaway, hint: "Inbound stock waiting for final bin" },
    { label: "Open picks", value: openPick, hint: "Order demand not fully picked yet" },
    { label: "Open replenishments", value: openReplenish, hint: "Pick-face refill tasks pending" },
    { label: "Open cycle counts", value: openCycleCount, hint: "Count tasks awaiting entry" },
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
      status:
        openTasks > 120 ? "High" : openTasks > 40 ? "Moderate" : "Stable",
    },
    {
      label: "Stock quality holds",
      value: balancesOnHold,
      status:
        balancesOnHold > 0 ? "Needs review" : "Clear",
    },
    {
      label: "Ledger velocity (7d)",
      value: movementsWeek,
      status:
        movementsWeek > 0 ? "Active" : "No movement",
    },
  ];

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-zinc-900">At a glance</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Live operational counts for this tenant. Use these as triage signals, then open Operations/Stock/Billing for execution detail.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {confidenceSignals.map((signal) => (
          <div key={signal.label} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{signal.label}</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">
              {signal.status} · <span className="tabular-nums">{signal.value}</span>
            </p>
          </div>
        ))}
      </div>
      {!wmsDemoWarehouse ? (
        <p
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          No WMS demo warehouse ({WMS_DEMO_WAREHOUSE_CODE}) in this database. Purchase orders and CRM data
          come from the base seed; tasks, bins, and inventory for WMS are loaded by a separate script. Run{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">
            USE_DOTENV_LOCAL=1 npm run db:seed:wms-demo
          </code>{" "}
          against the same <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">DATABASE_URL</code>{" "}
          as your app (e.g. Vercel env must match the Neon DB you seed). Requires{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">npm run db:seed</code> first.
        </p>
      ) : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <li
            key={t.label}
            className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{t.value}</p>
            <p className="mt-1 text-xs text-zinc-600">{t.hint}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
