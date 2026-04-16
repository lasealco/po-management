import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { ReportingCockpitBoard } from "@/components/reporting-cockpit-board";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { buildReportingCockpitSnapshot } from "@/lib/reporting/cockpit-data";

export const dynamic = "force-dynamic";

function cardClass(focus: string | undefined, id: string) {
  const active = focus === id;
  return `rounded-xl border bg-white p-5 shadow-sm ${active ? "border-sky-400 ring-2 ring-sky-100" : "border-zinc-200"}`;
}

export default async function ReportingHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>;
}) {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const actorId = await getActorUserId();
  const sp = searchParams ? await searchParams : {};
  const focusRaw = typeof sp.focus === "string" ? sp.focus.toLowerCase() : "";
  const focus =
    focusRaw === "po" || focusRaw === "control-tower" || focusRaw === "crm" || focusRaw === "wms" ? focusRaw : undefined;

  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Demo tenant not found.</p>
      </div>
    );
  }

  if (!access?.user || !actorId) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Reporting" message="Choose an active user in the header to open reporting." />
      </div>
    );
  }

  const canPo = viewerHas(access.grantSet, "org.reports", "view");
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canCrm = viewerHas(access.grantSet, "org.crm", "view");
  const canWms = viewerHas(access.grantSet, "org.wms", "view");

  if (!canPo && !canCt && !canCrm && !canWms) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Reporting"
          message="You need at least one of: PO reports, Control Tower, CRM, or WMS view access."
        />
      </div>
    );
  }

  const snapshot = await buildReportingCockpitSnapshot({
    tenantId: tenant.id,
    actorUserId: actorId,
  });

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-zinc-50 px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Reporting</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
          Extraordinary cross-module analytics cockpit plus module-specific workspaces. This first release focuses on
          exceptions and cash-cycle visibility, with AI narrative on top.
        </p>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-zinc-500">
          <span className="font-medium text-zinc-700">Tips:</span> use{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">R</kbd> to
          refresh the cockpit (when you are not typing in a field),{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">
            Shift+R
          </kbd>{" "}
          for a silent refresh, and optional <span className="font-medium text-zinc-700">Auto-refresh</span> on the
          board. Open the Help assistant anytime for the full Reporting hub playbook. On Control Tower dashboards, open a
          pinned widget and click a bar, line point, or pie slice to jump to that row in the data table.
        </p>
      </header>

      <ReportingCockpitBoard snapshot={snapshot} />

      <div className="mb-6 flex flex-wrap gap-2">
        {canPo ? (
          <Link href="/reports" className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
            PO reports
          </Link>
        ) : null}
        {canCt ? (
          <Link
            href="/control-tower/reports"
            className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm text-sky-900 hover:bg-sky-100"
          >
            Control Tower reports
          </Link>
        ) : null}
        {canCrm ? (
          <Link
            href="/crm/reporting"
            className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-900 hover:bg-violet-100"
          >
            CRM reporting
          </Link>
        ) : null}
        {canWms ? (
          <Link
            href="/wms/reporting"
            className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-900 hover:bg-violet-100"
          >
            WMS reporting
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canPo ? (
          <section id="po" className={`scroll-mt-24 ${cardClass(focus, "po")}`}>
            <h2 className="text-lg font-semibold text-zinc-900">PO Management</h2>
            <p className="mt-1 text-sm text-zinc-600">Order and procurement reports (registry-based definitions, CSV export).</p>
            <Link
              href="/reports"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Open PO reports
            </Link>
          </section>
        ) : null}

        {canCt ? (
          <section id="control-tower" className={`scroll-mt-24 ${cardClass(focus, "control-tower")}`}>
            <h2 className="text-lg font-semibold text-zinc-900">Control Tower</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Shipment KPIs, lanes, spend, on-time — save reports and pin charts to your personal dashboard.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/control-tower/reports"
                className="inline-block rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
              >
                Report builder
              </Link>
              <Link
                href="/control-tower/dashboard"
                className="inline-block rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                My dashboard
              </Link>
            </div>
          </section>
        ) : null}

        {canCrm ? (
          <section id="crm" className={`scroll-mt-24 ${cardClass(focus, "crm")}`}>
            <h2 className="text-lg font-semibold text-zinc-900">CRM</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Pipeline, account, and activity analytics — connected with the same cross-module storytelling layer.
            </p>
            <Link
              href="/crm/reporting"
              className="mt-4 inline-block rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
            >
              CRM reporting
            </Link>
          </section>
        ) : null}

        {canWms ? (
          <section id="wms" className={`scroll-mt-24 ${cardClass(focus, "wms")}`}>
            <h2 className="text-lg font-semibold text-zinc-900">WMS</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Throughput, inventory, and billing analytics integrated into this shared reporting architecture.
            </p>
            <Link
              href="/wms/reporting"
              className="mt-4 inline-block rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
            >
              WMS reporting
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
