import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { SalesOrderStatusActions } from "@/components/sales-order-status-actions";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { parseSalesOrdersListQueryFromNext, salesOrdersListQueryString } from "@/lib/sales-orders";

export const dynamic = "force-dynamic";

export default async function SalesOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
  const rawList = searchParams ? await searchParams : {};
  const listBackQs = salesOrdersListQueryString(parseSalesOrdersListQueryFromNext(rawList));
  const listHref = listBackQs ? `/sales-orders?${listBackQs}` : "/sales-orders";

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
  const activeShipmentCount = row.shipments.filter((s) =>
    ["SHIPPED", "VALIDATED", "BOOKED", "IN_TRANSIT"].includes(s.status),
  ).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <p className="text-sm">
        <Link href={listHref} className="font-medium text-[var(--arscmp-primary)] hover:underline">
          ← Sales orders
        </Link>
      </p>
      <div className="mt-3">
        <WorkflowHeader
          eyebrow="Sales order workspace"
          title={row.soNumber}
          description={`Status: ${row.status}`}
          steps={["Step 1: Review customer commitment", "Step 2: Transition SO status", "Step 3: Track linked shipments"]}
        />
      </div>
      <section className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Current status</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{row.status}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Linked shipments</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{row.shipments.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Active shipments</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{activeShipmentCount}</p>
        </div>
      </section>
      <SalesOrderStatusActions
        salesOrderId={row.id}
        status={row.status}
        canTransition={viewerHas(access.grantSet, "org.orders", "transition")}
      />
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
      <p className="mt-1 text-xs text-zinc-500">Review shipment state and jump into the shipment workspace when needed.</p>
      <ul className="mt-2 space-y-2">
        {row.shipments.length === 0 ? (
          <li className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500">No shipments linked.</li>
        ) : (
          row.shipments.map((s) => (
            <li key={s.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{s.shipmentNo || s.id}</p>
                  <p className="text-xs text-zinc-500">
                    {s.status} · {s.transportMode || "—"} · {s.carrier || "—"} · {s.trackingNo || "—"}
                  </p>
                </div>
                <Link
                  href={`/control-tower/shipments/${s.id}`}
                  className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  title="Open in Control Tower"
                >
                  Open shipment
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
