import { AccessDenied } from "@/components/access-denied";
import { ReportsClient } from "@/components/reports-client";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { listReportDefinitions, toReportListItem } from "@/lib/reports/registry";
import { canUserRunReport } from "@/lib/reports/run-report";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
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
  for (const def of listReportDefinitions()) {
    if (actorId && (await canUserRunReport(actorId, def.id)).ok) {
      initialList.push(toReportListItem(def));
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-zinc-900">Reports</h1>
        <p className="mt-2 text-zinc-600">
          Operational summaries and exports. New report types can be added to the report
          registry as the product grows.
        </p>
        {initialList.length === 0 ? (
          <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            No reports are available for your current permissions.
          </p>
        ) : (
          <div className="mt-8">
            <ReportsClient initialList={initialList} />
          </div>
        )}
      </main>
    </div>
  );
}
