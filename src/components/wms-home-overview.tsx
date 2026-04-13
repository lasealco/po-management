import { prisma } from "@/lib/prisma";

export async function WmsHomeOverview({ tenantId }: { tenantId: string }) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
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
    { label: "Open WMS tasks", value: openTasks, hint: "All types (see breakdown below)" },
    { label: "Open putaway", value: openPutaway, hint: "Inbound to bin" },
    { label: "Open picks", value: openPick, hint: "Wave or ad-hoc" },
    { label: "Open replenishments", value: openReplenish, hint: "From REPLENISH rules" },
    { label: "Open cycle counts", value: openCycleCount, hint: "Awaiting count entry" },
    { label: "Outbound in flight", value: outboundActive, hint: "Draft through packed" },
    { label: "Active waves", value: wavesActive, hint: "Open or released" },
    { label: "Balance rows", value: balanceRows, hint: "Bin × product" },
    { label: "On-hold balances", value: balancesOnHold, hint: "QC / quarantine flags" },
    { label: "Unbilled charges", value: unbilledEvents, hint: "Billing events not invoiced" },
    { label: "Movements (7d)", value: movementsWeek, hint: "All movement types" },
  ];

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-zinc-900">At a glance</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Live counts for this tenant — Operations and Stock tabs hold the detail.
      </p>
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
