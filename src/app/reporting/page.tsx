import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

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

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-zinc-50 px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Reporting</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
          One place to reach analytics across PO, logistics (Control Tower), CRM, and WMS. Each module can grow its own
          saved reports and metrics; Control Tower dashboards today pin <strong>logistics</strong> saved reports only. A
          single cross-module dashboard surface can mix widgets per domain as engines are added.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {canPo ? (
          <section id="po" className={`scroll-mt-24 ${cardClass(focus, "po")}`}>
            <h2 className="text-lg font-semibold text-zinc-900">PO Management</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Order and procurement reports (registry-based definitions, CSV export).
            </p>
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
              Shipment KPIs, lanes, spend, on-time — save reports and pin charts to your personal Control Tower
              dashboard.
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
              <Link
                href="/control-tower"
                className="inline-block rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Overview
              </Link>
            </div>
          </section>
        ) : null}

        {canCrm ? (
          <section id="crm" className={`scroll-mt-24 ${cardClass(focus, "crm")}`}>
            <h2 className="text-lg font-semibold text-zinc-900">CRM</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Pipeline and account analytics will plug into the same reporting layer. Use the CRM reporting entry for
              module-specific shortcuts.
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
              Inventory, throughput, and billing views will connect here. Warehouse-specific entry point below.
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

      <p className="mt-8 text-xs text-zinc-500">
        Tip: CRM and WMS subnav include <strong>Reporting</strong> for quick access. Deep links:{" "}
        <code className="rounded bg-zinc-200/70 px-1">/reporting?focus=crm</code>.
      </p>
    </main>
  );
}
