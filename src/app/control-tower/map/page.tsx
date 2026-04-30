import Link from "next/link";
import { Suspense } from "react";

import { ControlTowerMapClient } from "./control-tower-map-client";
import { ControlTowerReportingHubWorkbenchLinks } from "@/components/control-tower-reporting-hub-workbench-links";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function ControlTowerMapPage() {
  const access = await getViewerGrantSet();
  const canViewWms = Boolean(access?.user && viewerHas(access.grantSet, "org.wms", "view"));

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Shipment map</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            Read-only map of workbench-scoped <strong className="text-zinc-800">shipments</strong> (● pins from booking
            origin / destination codes via <code className="rounded bg-zinc-100 px-1 text-xs">product-trace-geo</code>
            ). With <strong className="text-zinc-800">org.wms → view</strong>, active warehouses also render as{" "}
            <strong className="text-zinc-800">■ site pins</strong> from city / country / name heuristics (
            <strong className="text-zinc-800">BF-11</strong> — not rack/floor geometry). Use query params in sync with the{" "}
            <Link href="/control-tower/workbench">workbench</Link>.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ControlTowerReportingHubWorkbenchLinks variant="button" buttonSize="md" includeWorkbench={false} />
          {canViewWms ? (
            <Link
              href="/wms"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              WMS workspace
            </Link>
          ) : null}
        </div>
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-500">Loading map…</p>}>
        <ControlTowerMapClient />
      </Suspense>
    </main>
  );
}
