import Link from "next/link";

import { ControlTowerDashboard } from "@/components/control-tower-dashboard";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getControlTowerOverview } from "@/lib/control-tower/overview";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

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
      </header>

      {overview ? <ControlTowerDashboard overview={overview} /> : null}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/control-tower/workbench"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        >
          <span className="text-base font-semibold text-zinc-900">Tracking workbench</span>
          <p className="mt-2 text-sm text-zinc-600">
            Filterable shipment grid, CSV export, and saved views (R1 + R4).
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-sky-800">Open →</span>
        </Link>
        <Link
          href="/control-tower/search"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        >
          <span className="text-base font-semibold text-zinc-900">Search & assist</span>
          <p className="mt-2 text-sm text-zinc-600">
            Structured search plus lightweight query hints (R5) — no external LLM required.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-sky-800">Open →</span>
        </Link>
      </div>
    </main>
  );
}
