import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { ReportingCockpitBoard } from "@/components/reporting-cockpit-board";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { buildReportingCockpitSnapshot } from "@/lib/reporting/cockpit-data";

export const dynamic = "force-dynamic";

function cardClass(focus: string | undefined, id: string) {
  const active = focus === id;
  return `rounded-2xl border bg-white p-6 shadow-sm transition ${
    active ? "border-[var(--arscmp-primary)] ring-2 ring-teal-100" : "border-zinc-200 hover:border-zinc-300"
  }`;
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
        <AccessDenied title="Reporting" message="Choose an active demo user: open Settings → Demo session (/settings/demo)." />
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
      <header className="mb-8 rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Reporting command center</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Reporting</h1>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-600">
          Cross-module analytics cockpit plus module-specific workspaces. Start with the shared board for risk and cash
          signals, then move into the module report builders for execution.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 1</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Scan cockpit signals</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 2</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Choose module workspace</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 3</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Run, save, and share</p>
          </div>
        </div>
        <p className="mt-4 max-w-4xl text-xs leading-relaxed text-zinc-500">
          Tip: use <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">R</kbd>{" "}
          to refresh,{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">Shift+R</kbd> for
          silent refresh, and enable auto-refresh when presenting live metrics.
        </p>
      </header>

      <ReportingCockpitBoard snapshot={snapshot} />

      <div className="mb-8 mt-6 flex flex-wrap gap-3">
        {canPo ? (
          <Link
            href="/reports"
            className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            PO reports
          </Link>
        ) : null}
        {canCt ? (
          <Link
            href="/control-tower/reports"
            className="inline-flex items-center rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
          >
            Control Tower reports
          </Link>
        ) : null}
        {canCrm ? (
          <Link
            href="/crm/reporting"
            className="inline-flex items-center rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-900 hover:bg-violet-100"
          >
            CRM reporting
          </Link>
        ) : null}
        {canWms ? (
          <Link
            href="/wms/reporting"
            className="inline-flex items-center rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-900 hover:bg-violet-100"
          >
            WMS reporting
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canPo ? (
          <section id="po" className={`scroll-mt-24 ${cardClass(focus, "po")}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 2A</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">PO Management</h2>
            <p className="mt-1 text-sm text-zinc-600">Order and procurement reports with drilldowns and CSV export.</p>
            <Link
              href="/reports"
              className="mt-5 inline-flex items-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Open PO reports
            </Link>
          </section>
        ) : null}

        {canCt ? (
          <section id="control-tower" className={`scroll-mt-24 ${cardClass(focus, "control-tower")}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 2B</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">Control Tower</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Shipment KPIs, lanes, spend, on-time — save reports and pin charts to your personal dashboard.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/control-tower/reports"
                className="inline-flex items-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95"
              >
                Report builder
              </Link>
              <Link
                href="/control-tower/dashboard"
                className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                My dashboard
              </Link>
            </div>
          </section>
        ) : null}

        {canCrm ? (
          <section id="crm" className={`scroll-mt-24 ${cardClass(focus, "crm")}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 2C</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">CRM</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Pipeline, account, and activity analytics — connected with the same cross-module storytelling layer.
            </p>
            <Link
              href="/crm/reporting"
              className="mt-5 inline-flex items-center rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
            >
              CRM reporting
            </Link>
          </section>
        ) : null}

        {canWms ? (
          <section id="wms" className={`scroll-mt-24 ${cardClass(focus, "wms")}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 2D</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">WMS</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Throughput, inventory, and billing analytics integrated into this shared reporting architecture.
            </p>
            <Link
              href="/wms/reporting"
              className="mt-5 inline-flex items-center rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
            >
              WMS reporting
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
