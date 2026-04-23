import Link from "next/link";
import { Suspense } from "react";

import { ControlTowerMapClient } from "./control-tower-map-client";
import { ControlTowerReportingHubWorkbenchLinks } from "@/components/control-tower-reporting-hub-workbench-links";

export const dynamic = "force-dynamic";

export default function ControlTowerMapPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Shipment map</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            Read-only map of workbench-scoped rows: each pin is placed from booking/leg <strong>origin</strong> and{" "}
            <strong>destination</strong> codes, interpolated by route progress when both resolve (see{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">product-trace-geo</code> LOCODES). Use query params in
            sync with the <Link href="/control-tower/workbench">workbench</Link> (or open it from here with the same
            filters).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ControlTowerReportingHubWorkbenchLinks variant="button" buttonSize="md" includeWorkbench={false} />
        </div>
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-500">Loading map…</p>}>
        <ControlTowerMapClient />
      </Suspense>
    </main>
  );
}
