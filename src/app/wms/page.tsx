import Link from "next/link";

import { getViewerGrantSet, viewerHas } from "@/lib/authz";

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
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.wms", "edit"),
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Warehouse operations</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Use the tabs above or the cards below to move between WMS areas. Each area is its own page so
          the app stays organized as we add more from the blueprint.
        </p>
        {!canEdit ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You have view-only WMS access; create and complete actions stay disabled until{" "}
            <span className="font-medium">org.wms → edit</span> is granted.
          </p>
        ) : null}
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {areas.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
            >
              <span className="text-base font-semibold text-zinc-900">{a.title}</span>
              <span className="mt-2 flex-1 text-sm text-zinc-600">{a.description}</span>
              <span className="mt-4 text-sm font-medium text-violet-700">Open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
