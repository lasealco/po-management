import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await getViewerGrantSet();
  if (!access?.user || !viewerHas(access.grantSet, "org.orders", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Sales order" message="You do not have permission to view sales orders." />
      </div>
    );
  }
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Sales order" message="Tenant not found." />
      </div>
    );
  }
  const { id } = await params;
  const row = await prisma.salesOrder.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      shipments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          shipmentNo: true,
          status: true,
          transportMode: true,
          carrier: true,
          trackingNo: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Sales order" message="Sales order not found." />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">{row.soNumber}</h1>
      <p className="mt-1 text-sm text-zinc-600">Status: {row.status}</p>
      <div className="mt-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="text-zinc-500">Customer: </span>
          {row.customerName}
        </p>
        <p>
          <span className="text-zinc-500">External ref: </span>
          {row.externalRef || "—"}
        </p>
        <p>
          <span className="text-zinc-500">Requested ship: </span>
          {row.requestedShipDate ? new Date(row.requestedShipDate).toLocaleDateString() : "—"}
        </p>
        <p>
          <span className="text-zinc-500">Requested delivery: </span>
          {row.requestedDeliveryDate ? new Date(row.requestedDeliveryDate).toLocaleDateString() : "—"}
        </p>
        <p className="sm:col-span-2">
          <span className="text-zinc-500">Notes: </span>
          {row.notes || "—"}
        </p>
      </div>

      <h2 className="mt-6 text-base font-semibold text-zinc-900">Linked shipments</h2>
      <ul className="mt-2 space-y-2">
        {row.shipments.length === 0 ? (
          <li className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500">No shipments linked.</li>
        ) : (
          row.shipments.map((s) => (
            <li key={s.id} className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm">
              <Link href={`/control-tower/shipments/${s.id}`} className="font-medium text-sky-800 hover:underline">
                {s.shipmentNo || s.id}
              </Link>
              <span className="ml-2 text-zinc-500">
                {s.status} · {s.transportMode || "—"} · {s.carrier || "—"} · {s.trackingNo || "—"}
              </span>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
