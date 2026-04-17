import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/access-denied";
import { ReportsClient } from "@/components/reports-client";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { listReportDefinitions, toReportListItem } from "@/lib/reports/registry";
import { getReportAccessBlocker } from "@/lib/reports/run-report";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ report?: string; row?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const reportParam = typeof sp.report === "string" ? sp.report.trim() : "";
  const rowRaw = typeof sp.row === "string" ? sp.row.trim() : "";
  const initialDrillRow = /^\d+$/.test(rowRaw) ? Math.min(Number(rowRaw), 500_000) : null;
  const access = await getViewerGrantSet();
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();

  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Reports"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.reports", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Reports"
          message="You do not have permission to run reports (org.reports → view)."
        />
      </div>
    );
  }

  const initialList = [];
  const blockedReports: {
    id: string;
    title: string;
    category: string;
    missing: string;
  }[] = [];

  for (const def of listReportDefinitions()) {
    if (!actorId) break;
    const blocker = await getReportAccessBlocker(actorId, def.id);
    if (blocker === null) {
      initialList.push(toReportListItem(def));
    } else {
      blockedReports.push({
        id: def.id,
        title: def.title,
        category: def.category,
        missing: blocker,
      });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="mb-3 text-sm">
          <Link href="/reporting?focus=po" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            ← All reporting modules
          </Link>
        </p>
        <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">PO reporting workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Reports</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Build operational summaries and CSV exports in a clear 3-step workflow: pick the report, run the output, then
            save/share with your team.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 1</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">Choose report template</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 2</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">Run and inspect results</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 3</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">Export or save definition</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/reporting?focus=po"
              className="inline-flex items-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95"
            >
              Open reporting hub
            </Link>
            <p className="inline-flex items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-600">
              Requires <span className="mx-1 font-medium text-zinc-800">org.reports → view</span> plus report-specific grants.
            </p>
          </div>
        </section>
        {initialList.length === 0 ? (
          <div className="mt-8 space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              None of the registered reports can run with your current role. If something below
              looks wrong, ask an admin to update{" "}
              <span className="font-medium">Settings → Roles</span>.
            </p>
            <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
              <ReportsClient
                initialList={[]}
                blockedReports={blockedReports}
                initialReportId={reportParam || null}
                initialDrillRow={initialDrillRow}
              />
            </Suspense>
          </div>
        ) : (
          <div className="mt-8">
            <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
              <ReportsClient
                initialList={initialList}
                blockedReports={blockedReports}
                initialReportId={reportParam || null}
                initialDrillRow={initialDrillRow}
              />
            </Suspense>
          </div>
        )}
      </main>
    </div>
  );
}
