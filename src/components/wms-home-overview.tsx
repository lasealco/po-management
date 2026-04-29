import Link from "next/link";

import { fetchWmsHomeKpis } from "@/lib/wms/wms-home-kpis";
import { WMS_DEMO_WAREHOUSE_CODE } from "@/lib/wms/demo-warehouse-code";

export async function WmsHomeOverview({ tenantId }: { tenantId: string }) {
  const data = await fetchWmsHomeKpis(tenantId);

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-zinc-900">At a glance</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Live operational counts for this tenant. Use these as triage signals, then open Operations/Stock/Billing for execution detail.
        Executive KPI definitions:{" "}
        <Link href="/docs" className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline">
          docs
        </Link>{" "}
        → <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">docs/wms/WMS_EXECUTIVE_KPIS.md</code> in-repo.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {data.confidenceSignals.map((signal) => (
          <div key={signal.label} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{signal.label}</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">
              {signal.status} · <span className="tabular-nums">{signal.value}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Executive highlights</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Leadership-oriented snapshots beyond raw task tiles — receiving backlog, dock schedule density, VAS workload, and hold exposure (see{" "}
          <span className="font-medium text-zinc-800">WMS_EXECUTIVE_KPIS.md</span>).
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Receiving pipeline</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {data.executive.receivingPipelineShipments}
            </p>
            <p className="mt-1 text-xs text-zinc-600">Inbound shipments in active WMS receive states (not closed).</p>
            <Link href="/wms/operations" className="mt-2 inline-block text-xs font-semibold text-[var(--arscmp-primary)]">
              Operations →
            </Link>
          </li>
          <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Dock windows (today, UTC)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {data.executive.dockAppointmentsScheduledToday}
            </p>
            <p className="mt-1 text-xs text-zinc-600">Scheduled appointments overlapping the UTC calendar day.</p>
            <Link href="/wms/operations" className="mt-2 inline-block text-xs font-semibold text-[var(--arscmp-primary)]">
              Dock schedule →
            </Link>
          </li>
          <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Open VAS workload</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{data.executive.openValueAddTasks}</p>
            <p className="mt-1 text-xs text-zinc-600">VALUE_ADD tasks still OPEN.</p>
            <Link href="/wms/operations" className="mt-2 inline-block text-xs font-semibold text-[var(--arscmp-primary)]">
              Work orders →
            </Link>
          </li>
          <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Hold rate (% of rows)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{data.executive.holdRatePercent}%</p>
            <p className="mt-1 text-xs text-zinc-600">Share of inventory balance rows flagged on-hold.</p>
            <Link href="/wms/stock" className="mt-2 inline-block text-xs font-semibold text-[var(--arscmp-primary)]">
              Stock →
            </Link>
          </li>
        </ul>
      </div>

      {!data.hasDemoWarehouse ? (
        <p
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          No WMS demo warehouse ({WMS_DEMO_WAREHOUSE_CODE}) in this database. Purchase orders and CRM data come from the base seed; tasks, bins, and
          inventory for WMS are loaded by a separate script. Run{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">
            USE_DOTENV_LOCAL=1 npm run db:seed:wms-demo
          </code>{" "}
          against the same <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">DATABASE_URL</code> as your app
          (e.g. Vercel env must match the Neon DB you seed). Requires{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">npm run db:seed</code> first.
        </p>
      ) : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {data.tiles.map((t) => (
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
