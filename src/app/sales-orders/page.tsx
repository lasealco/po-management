import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SalesOrdersPage() {
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

  const rows = await prisma.salesOrder.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { shipments: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Sales Orders</h1>
          <p className="mt-1 text-sm text-zinc-600">Sales Order process v1 for export-linked logistics.</p>
        </div>
        {viewerHas(access.grantSet, "org.orders", "edit") ? (
          <Link href="/sales-orders/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            New Sales Order
          </Link>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-700">
            <tr>
              <th className="px-3 py-2">SO</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">External ref</th>
              <th className="px-3 py-2">Req. delivery</th>
              <th className="px-3 py-2">Shipments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No sales orders yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <Link href={`/sales-orders/${r.id}`} className="font-medium text-sky-800 hover:underline">
                      {r.soNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.customerName}</td>
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
