import Link from "next/link";

import { ControlTowerDashboard } from "@/components/control-tower-dashboard";
import { ControlTowerDashboardWidgets } from "@/components/control-tower-dashboard-widgets";
import { ControlTowerReportingHubWorkbenchLinks } from "@/components/control-tower-reporting-hub-workbench-links";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getControlTowerOverview } from "@/lib/control-tower/overview";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";
import { controlTowerWorkbenchPath } from "@/lib/control-tower/workbench-url-sync";

export const dynamic = "force-dynamic";

export default async function ControlTowerPage() {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const actorId = await getActorUserId();
  const ctx =
    actorId !== null
      ? await getControlTowerPortalContext(actorId)
      : {
          isRestrictedView: false,
          isSupplierPortal: false,
          customerCrmAccountId: null,
        };
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );

  const overview =
    tenant != null ? await getControlTowerOverview({ tenantId: tenant.id, ctx }) : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Control Tower</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Shipment-level visibility across modes: dashboard, workbench, shipment workspace, alerts, reporting, and
          search. Customer-facing users see a reduced dataset; internal users see operational depth where permitted.
        </p>
        {!canEdit ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            View-only control tower: add <span className="font-medium">org.controltower → edit</span> to post
            milestones, notes, documents, alerts, and exceptions.
          </p>
        ) : null}
        <ControlTowerReportingHubWorkbenchLinks className="mt-4 flex flex-wrap gap-4 text-sm" />
      </header>

      {!tenant ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          No tenant context. Dashboard metrics are hidden; configure a demo tenant or session so APIs can resolve
          data. You can still open the links below once a tenant is available.
        </p>
      ) : null}

      {overview ? <ControlTowerDashboard overview={overview} /> : null}
      <ControlTowerDashboardWidgets canEdit={canEdit} />

      <div
        className={`mt-10 grid gap-4 sm:grid-cols-2 ${
          ctx.isRestrictedView ? "lg:grid-cols-3" : "lg:grid-cols-5"
        }`}
      >
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-sky-300 hover:shadow-md">
          <Link href="/control-tower/workbench" className="block p-5">
            <span className="text-base font-semibold text-zinc-900">Tracking workbench</span>
            <p className="mt-2 text-sm text-zinc-600">
              Filterable shipment grid, CSV export, and saved views (R1 + R4).
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-sky-800">Open →</span>
          </Link>
          <Link
            href={controlTowerWorkbenchPath({ onlyOverdueEta: "1", sortBy: "eta_asc" })}
            className="block border-t border-zinc-100 px-5 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-50"
          >
            Overdue ETAs (earliest first) →
          </Link>
        </div>
        {ctx.isRestrictedView ? (
          <Link
            href="/control-tower/digest"
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
          >
            <span className="text-base font-semibold text-zinc-900">Shipment digest</span>
            <p className="mt-2 text-sm text-zinc-600">
              Read-only list of your most recently updated shipments (same scope as the Digest tab and digest API,
              capped at 250 rows).
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-sky-800">Open →</span>
          </Link>
        ) : null}
        <Link
          href="/control-tower/command-center"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        >
          <span className="text-base font-semibold text-zinc-900">Command center</span>
          <p className="mt-2 text-sm text-zinc-600">
            Kanban by next route action with dispatch-owner triage lanes.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-sky-800">Open →</span>
        </Link>
        <Link
          href="/control-tower/reports"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        >
          <span className="text-base font-semibold text-zinc-900">Reports</span>
          <p className="mt-2 text-sm text-zinc-600">
            Snapshot KPIs plus configurable report builder with save + pin-to-dashboard widgets.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-sky-800">Open →</span>
        </Link>
        <Link
          href="/control-tower/search"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        >
          <span className="text-base font-semibold text-zinc-900">Search & assist</span>
          <p className="mt-2 text-sm text-zinc-600">
            R5: rule-based query parsing to structured filters, same text index as the workbench, and automatic OpenAI
            merge when <code className="rounded bg-zinc-100 px-1">CONTROL_TOWER_ASSIST_LLM=1</code> and an API key are
            set.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-sky-800">Open →</span>
        </Link>
        <Link
          href="/control-tower/ops"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        >
          <span className="text-base font-semibold text-zinc-900">Ops console</span>
          <p className="mt-2 text-sm text-zinc-600">
            Run SLA automations, review run history, and monitor owner capacity and ETA reliability.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-sky-800">Open →</span>
        </Link>
      </div>
    </main>
  );
}
