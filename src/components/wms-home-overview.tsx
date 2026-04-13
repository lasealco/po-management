import { prisma } from "@/lib/prisma";

export async function WmsHomeOverview({ tenantId }: { tenantId: string }) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    openTasks,
    outboundActive,
    wavesActive,
    balanceRows,
    unbilledEvents,
    movementsWeek,
  ] = await Promise.all([
    prisma.wmsTask.count({ where: { tenantId, status: "OPEN" } }),
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
    prisma.wmsBillingEvent.count({ where: { tenantId, invoiceRunId: null } }),
    prisma.inventoryMovement.count({
      where: { tenantId, createdAt: { gte: weekAgo } },
    }),
  ]);

  const tiles = [
    { label: "Open WMS tasks", value: openTasks, hint: "Putaway, pick, replenish, cycle count" },
    { label: "Outbound in flight", value: outboundActive, hint: "Draft through packed" },
    { label: "Active waves", value: wavesActive, hint: "Open or released" },
    { label: "Balance rows", value: balanceRows, hint: "Bin × product positions" },
    { label: "Unbilled ledger charges", value: unbilledEvents, hint: "Billing events not on a run" },
    { label: "Movements (7 days)", value: movementsWeek, hint: "All movement types" },
  ];

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-zinc-900">At a glance</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Live counts for this tenant — use the tabs above for detail.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
