import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { WmsHomeOverview } from "@/components/wms-home-overview";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { REPORTING_HUB_FOCUS_WMS_HREF } from "@/lib/reporting-hub-paths";

export const dynamic = "force-dynamic";

export default async function WmsReportingPage() {
  const access = await getViewerGrantSet();
  const tenant = await getDemoTenant();

  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="WMS reporting" message="Choose an active demo user: open Settings → Demo session (/settings/demo)." />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.wms", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="WMS reporting" message="You do not have WMS view access." />
      </div>
    );
  }
  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Tenant not found.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/wms" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          WMS
        </Link>
        <span className="mx-1">/</span>
        <span className="text-zinc-700">Reporting</span>
      </nav>
      <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">WMS analytics workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">WMS reporting</h1>
        <p className="mt-3 max-w-3xl text-sm text-zinc-600">
          This shell follows the same workflow language as Control Tower: review operating signals, run focused analysis,
          then share actions across inventory and fulfillment teams.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 1</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Scan stock and throughput</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 2</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Run operational views</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 3</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Share and follow through</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={REPORTING_HUB_FOCUS_WMS_HREF}
            className="inline-flex items-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95"
          >
            Open reporting hub
          </Link>
          <Link
            href="/wms/operations"
            className="inline-flex items-center rounded-xl border border-[var(--arscmp-primary)]/30 bg-[var(--arscmp-primary-50)] px-5 py-2.5 text-sm font-medium text-[var(--arscmp-primary)] hover:bg-[var(--arscmp-primary)]/10"
          >
            Operations workspace
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <WmsHomeOverview tenantId={tenant.id} />
      </section>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link
          href="/wms/stock"
          className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-zinc-700 hover:bg-zinc-50"
        >
          Stock & ledger
        </Link>
        <Link
          href="/control-tower/reports"
          className="inline-flex items-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sky-900 hover:bg-sky-100"
        >
          Control Tower report builder
        </Link>
        <Link
          href="/control-tower/workbench"
          className="inline-flex items-center rounded-xl border border-sky-200 bg-white px-4 py-2 text-sky-900 hover:bg-sky-50"
        >
          Control Tower workbench
        </Link>
        <Link
          href="/control-tower/digest"
          className="inline-flex items-center rounded-xl border border-sky-200 bg-white px-4 py-2 text-sky-900 hover:bg-sky-50"
        >
          Shipment digest
        </Link>
      </div>
    </main>
  );
}
