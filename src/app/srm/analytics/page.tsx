import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import {
  SrmAnalyticsDateForm,
  SrmBookingSlaPanel,
  SrmOrderKpiPanel,
} from "@/components/srm-analytics-panels";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { loadSrmBookingSlaStats, loadSrmOrderVolumeKpis } from "@/lib/srm/srm-analytics-aggregates";
import { resolveSrmPermissions } from "@/lib/srm/permissions";

export const dynamic = "force-dynamic";

function parseYmdToUtcStart(s: string | undefined, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(fallback);
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? new Date(fallback) : d;
}

function parseYmdToUtcEnd(s: string | undefined, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const e = new Date(fallback);
    e.setUTCHours(23, 59, 59, 999);
    return e;
  }
  const d = new Date(`${s}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? new Date(fallback) : d;
}

export default async function SrmAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string; from?: string; to?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const access = await getViewerGrantSet();
  if (!access) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }
  if (!access.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="SRM analytics"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  const permissions = resolveSrmPermissions(access.grantSet);
  if (!permissions.canViewSuppliers) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="SRM analytics"
          message="You do not have permission to view supplier data (org.suppliers → view)."
        />
      </div>
    );
  }

  const toDefault = new Date();
  const fromDefault = new Date(toDefault);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 90);

  const fromStart = parseYmdToUtcStart(sp.from, fromDefault);
  const toEnd = parseYmdToUtcEnd(sp.to, toDefault);
  if (fromStart.getTime() > toEnd.getTime()) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-800">Invalid range: <strong>from</strong> is after <strong>to</strong>.</p>
        <Link href="/srm/analytics" className="mt-2 inline-block text-sm text-[var(--arscmp-primary)] hover:underline">
          Reset
        </Link>
      </div>
    );
  }

  const kind = sp.kind === "logistics" ? "logistics" as const : "product" as const;
  const { tenant } = access;

  const orderKpi = permissions.canViewOrders
    ? await loadSrmOrderVolumeKpis(prisma, tenant.id, { from: fromStart, to: toEnd, srmKind: kind })
    : null;

  const bookingSla =
    kind === "logistics" ? await loadSrmBookingSlaStats(prisma, tenant.id, { from: fromStart, to: toEnd }) : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm">
          <Link
            href={`/srm?kind=${kind === "logistics" ? "logistics" : "product"}`}
            className="font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            ← SRM · {kind === "logistics" ? "Logistics partners" : "Product suppliers"}
          </Link>
        </p>

        <div className="mt-3 mb-5">
          <WorkflowHeader
            eyebrow="SRM · Analytics"
            title="Volume, concentration, and booking SLA"
            description="MVP: parent POs in a UTC date window; spend by PO currency (no conversion). Top-3 shares are a simple concentration signal — not a full risk model."
            steps={["Step 1: Pick range & supplier kind", "Step 2: Review order mix", "Step 3: Check logistics booking SLA (if applicable)"]}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
          <span>View:</span>
          <Link
            href={`/srm/analytics?kind=product&from=${fromStart.toISOString().slice(0, 10)}&to=${toEnd.toISOString().slice(0, 10)}`}
            className={kind === "product" ? "font-semibold text-zinc-900" : "text-[var(--arscmp-primary)] hover:underline"}
          >
            Product
          </Link>
          <span className="text-zinc-300">|</span>
          <Link
            href={`/srm/analytics?kind=logistics&from=${fromStart.toISOString().slice(0, 10)}&to=${toEnd.toISOString().slice(0, 10)}`}
            className={kind === "logistics" ? "font-semibold text-zinc-900" : "text-[var(--arscmp-primary)] hover:underline"}
          >
            Logistics
          </Link>
        </div>

        <SrmAnalyticsDateForm kind={kind} from={fromStart.toISOString()} to={toEnd.toISOString()} />

        <div className="mt-6">
          <SrmOrderKpiPanel kpi={orderKpi} canViewOrders={permissions.canViewOrders} />
        </div>

        {kind === "logistics" ? <SrmBookingSlaPanel summary={bookingSla} /> : null}
      </main>
    </div>
  );
}
