import Link from "next/link";

import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { WmsHomeOverview } from "@/components/wms-home-overview";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

const areas: { href: string; title: string; description: string }[] = [
  {
    href: "/wms/setup",
    title: "Setup",
    description: "Zones, bins, and replenishment rules for each warehouse.",
  },
  {
    href: "/wms/operations",
    title: "Operations",
    description: "Putaway and pick tasks, outbound orders, waves, and the open task queue.",
  },
  {
    href: "/wms/stock",
    title: "Stock & ledger",
    description: "On-hand balances by bin and recent inventory movements.",
  },
  {
    href: "/wms/billing",
    title: "Billing",
    description: "Rates, billing events from movements, draft invoices, and CSV export (Phase B).",
  },
];

export default async function WmsPage() {
  const access = await getViewerGrantSet();
  const tenant = await getDemoTenant();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.wms", "edit"),
  );
  const canViewControlTowerMap = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "view"),
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">WMS workspace</p>
        <PageTitleWithHint title="Warehouse operations" titleClassName="text-2xl font-semibold text-zinc-900" />
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Use this page as your daily command center: confirm floor workload, scan stock confidence signals,
          and jump straight into Setup, Operations, Stock, or Billing for action-level detail.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Step 1</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Check floor health</p>
            <p className="text-xs text-zinc-600">Review open tasks, waves, and outbound pressure.</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Step 2</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Validate stock confidence</p>
            <p className="text-xs text-zinc-600">Watch holds, movement velocity, and balance coverage.</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Step 3</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Execute next action</p>
            <p className="text-xs text-zinc-600">Use cards below to move into the right WMS workflow.</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Confidence note: counts below are live from this tenant and intended for operational triage, not month-end finance close.
        </p>
        {!canEdit ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You have view-only WMS access; create and complete actions stay disabled until{" "}
            <span className="font-medium">org.wms → edit</span> is granted.
          </p>
        ) : null}
        {canViewControlTowerMap ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Control Tower</p>
            <p className="mt-1 text-sm text-zinc-700">
              Open a read-only lane map of workbench-scoped shipments (pins from booking origin/destination; use
              the same query parameters as the workbench when you add them to the URL).
            </p>
            <Link
              href="/control-tower/map"
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Open shipment map
            </Link>
          </div>
        ) : null}
      </header>

      {tenant ? <WmsHomeOverview tenantId={tenant.id} /> : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {areas.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
            >
              <span className="text-base font-semibold text-zinc-900">{a.title}</span>
              <span className="mt-2 flex-1 text-sm text-zinc-600">{a.description}</span>
              <span className="mt-4 text-sm font-semibold text-[var(--arscmp-primary)]">Open area →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
