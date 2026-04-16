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
          message="Choose an active user in the header to run reports."
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
        <p className="mb-2 text-sm">
          <Link href="/reporting?focus=po" className="font-medium text-sky-800 hover:underline">
            ← All reporting modules
          </Link>
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900">Reports</h1>
        <p className="mt-2 text-zinc-600">
          Operational summaries and CSV exports. Each report checks{" "}
          <span className="font-medium text-zinc-800">org.reports → view</span> plus any extra
          grants noted below.
        </p>
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
