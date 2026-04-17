import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsWorkflowPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  const workflows = await prisma.workflow.findMany({
    where: { tenantId: tenant.id },
    include: {
      statuses: {
        orderBy: { sortOrder: "asc" },
      },
      transitions: true,
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Order workflow</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Purchase orders follow these workflows. Editing rules here is not
        available yet; this view matches what buyers see in the board.
      </p>

      <div className="mt-8 space-y-10">
        {workflows.map((wf) => {
          const labelById = new Map(
            wf.statuses.map((s) => [s.id, s.label] as const),
          );
          const ordered = [...wf.statuses].sort(
            (a, b) => a.sortOrder - b.sortOrder,
          );
          return (
            <section
              key={wf.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-lg font-semibold text-zinc-900">{wf.name}</h3>
                <span className="font-mono text-xs text-zinc-500">{wf.code}</span>
                {wf.isDefault ? (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    Default
                  </span>
                ) : null}
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-600">
                <div>
                  <dt className="inline text-zinc-500">Supplier portal</dt>{" "}
                  <dd className="inline font-medium text-zinc-800">
                    {wf.supplierPortalOn ? "On" : "Off"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-zinc-500">Split orders</dt>{" "}
                  <dd className="inline font-medium text-zinc-800">
                    {wf.allowSplitOrders ? "Allowed" : "Off"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Statuses
                </h4>
                <ol className="mt-2 flex flex-wrap gap-2">
                  {ordered.map((s) => (
                    <li
                      key={s.id}
                      className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-800"
                    >
                      <span className="font-medium">{s.label}</span>
                      <span className="text-zinc-500"> · {s.code}</span>
                      {s.isStart ? (
                        <span className="ml-1 text-emerald-700">start</span>
                      ) : null}
                      {s.isEnd ? (
                        <span className="ml-1 text-zinc-500">end</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Transitions
                </h4>
                <ul className="mt-2 space-y-1.5 text-sm text-zinc-800">
                  {wf.transitions.length === 0 ? (
                    <li className="text-zinc-500">None defined.</li>
                  ) : (
                    wf.transitions.map((t) => (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0"
                      >
                        <span>{labelById.get(t.fromStatusId) ?? "?"}</span>
                        <span className="text-zinc-400">→</span>
                        <span className="font-medium">{t.label}</span>
                        <span className="font-mono text-xs text-zinc-500">
                          ({t.actionCode})
                        </span>
                        <span className="text-zinc-400">→</span>
                        <span>{labelById.get(t.toStatusId) ?? "?"}</span>
                        {t.requiresComment ? (
                          <span className="text-xs text-amber-800">
                            requires comment
                          </span>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
