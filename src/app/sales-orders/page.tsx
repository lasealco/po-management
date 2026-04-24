import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/access-denied";
import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { SalesOrdersListFilters } from "@/components/sales-orders-list-filters";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { mapOrgUnitIdsToCompanyLegalNames } from "@/lib/sales-order-company-legal";
import {
  parseSalesOrdersListQueryFromNext,
  salesOrdersListPrismaWhere,
  salesOrdersListQueryString,
} from "@/lib/sales-orders";

export const dynamic = "force-dynamic";

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getViewerGrantSet();
  if (!access?.user || !viewerHas(access.grantSet, "org.orders", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Sales orders" message="You do not have permission to view sales orders." />
      </div>
    );
  }
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Sales orders" message="Tenant not found." />
      </div>
    );
  }

  const rawSearch = await searchParams;
  const listQuery = parseSalesOrdersListQueryFromNext(rawSearch);
  const where = salesOrdersListPrismaWhere(tenant.id, listQuery);
  const listQs = salesOrdersListQueryString(listQuery);

  const rows = await prisma.salesOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      _count: { select: { shipments: true } },
      servedOrgUnit: { select: { id: true, name: true, code: true, kind: true } },
    },
  });

  const servedOrgIds = rows
    .map((r) => r.servedOrgUnit?.id)
    .filter((x): x is string => Boolean(x));
  const sellingLegalNameByOrg = await mapOrgUnitIdsToCompanyLegalNames(tenant.id, servedOrgIds);

  const hasFilters = Boolean(listQuery.status.trim() || listQuery.q.trim());
  const emptyCopy = hasFilters
    ? "No sales orders match these filters. Try clearing search or choosing a different status."
    : "No sales orders yet.";

  return (
    <main className="mx-auto w-full max-w-6xl bg-zinc-50 px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <PageTitleWithHint title="Sales Orders" titleClassName="text-2xl font-semibold text-zinc-900" />
          <p className="mt-1 text-sm text-zinc-600">Sales Order process v1 for export-linked logistics.</p>
        </div>
        {viewerHas(access.grantSet, "org.orders", "edit") ? (
          <Link
            href="/sales-orders/new"
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            New Sales Order
          </Link>
        ) : null}
      </div>

      <Suspense
        fallback={
          <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Loading filters…</p>
          </section>
        }
      >
        <SalesOrdersListFilters />
      </Suspense>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-700">
            <tr>
              <th className="px-3 py-2">SO</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">For org</th>
              <th className="px-3 py-2">Selling (legal)</th>
              <th className="px-3 py-2">External ref</th>
              <th className="px-3 py-2">Req. delivery</th>
              <th className="px-3 py-2">Shipments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-zinc-900">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                  {emptyCopy}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/sales-orders/${r.id}${listQs ? `?${listQs}` : ""}`}
                      className="font-medium text-sky-800 hover:underline"
                    >
                      {r.soNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.customerName}</td>
                  <td className="px-3 py-2">
                    {r.servedOrgUnit
                      ? [r.servedOrgUnit.name, r.servedOrgUnit.code].filter(Boolean).join(" · ") || "—"
                      : "—"}
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-xs text-zinc-700" title={r.servedOrgUnit ? sellingLegalNameByOrg.get(r.servedOrgUnit.id) ?? undefined : undefined}>
                    {r.servedOrgUnit && sellingLegalNameByOrg.get(r.servedOrgUnit.id)
                      ? sellingLegalNameByOrg.get(r.servedOrgUnit.id)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{r.externalRef || "—"}</td>
                  <td className="px-3 py-2">
                    {r.requestedDeliveryDate ? new Date(r.requestedDeliveryDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2">{r._count.shipments}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
