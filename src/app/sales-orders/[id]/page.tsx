import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { AssistantContextCard } from "@/components/assistant/assistant-context-card";
import { AssistantObjectTimeline } from "@/components/assistant/assistant-object-timeline";
import { SalesOrderAssistantIntakeReview } from "@/components/sales-order-assistant-intake-review";
import { SalesOrderCompanyLegalSnapshot } from "@/components/sales-order-company-legal-snapshot";
import { SalesOrderServedOrgField } from "@/components/sales-order-served-org-field";
import { SalesOrderStatusActions } from "@/components/sales-order-status-actions";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { loadSerializedCompanyLegalForServedOrg } from "@/lib/sales-order-company-legal";
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

  const [row, orgUnitOptions, assistantAuditEvents] = await Promise.all([
    prisma.salesOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        servedOrgUnit: { select: { id: true, name: true, code: true, kind: true } },
        lines: {
          orderBy: { lineNo: "asc" },
          select: {
            id: true,
            lineNo: true,
            description: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            currency: true,
            source: true,
            product: { select: { id: true, name: true, productCode: true, sku: true } },
          },
        },
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
        assistantEmailThreads: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            subject: true,
            fromAddress: true,
            status: true,
            createdAt: true,
            draftReply: true,
            lastSendConfirmAt: true,
          },
        },
      },
    }),
    prisma.orgUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, kind: true },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId: tenant.id, objectType: "sales_order", objectId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        surface: true,
        answerKind: true,
        message: true,
        prompt: true,
        createdAt: true,
      },
    }),
  ]);
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
  const canEditOrders = viewerHas(access.grantSet, "org.orders", "edit");
  const canEditServedOrg = viewerHas(access.grantSet, "org.orders", "edit");
  const canViewLegalSettings = viewerHas(access.grantSet, "org.settings", "view");
  const assistantReviewStatus = ["PENDING", "APPROVED", "NEEDS_CHANGES", "REJECTED"].includes(row.assistantReviewStatus)
    ? (row.assistantReviewStatus as "PENDING" | "APPROVED" | "NEEDS_CHANGES" | "REJECTED")
    : "PENDING";
  const companyLegalForServed = await loadSerializedCompanyLegalForServedOrg(
    tenant.id,
    row.servedOrgUnitId,
  );

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
      <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">AMP1 Intake</p>
            <h2 className="mt-1 text-base font-semibold text-zinc-950">Structured order draft</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Assistant-created drafts now keep line items, source request, parser snapshot, and a customer reply draft on
              the sales order record.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
            {row.lines.length} line{row.lines.length === 1 ? "" : "s"}
          </span>
        </div>
        <SalesOrderAssistantIntakeReview
          salesOrderId={row.id}
          canEdit={canEditOrders}
          initialStatus={assistantReviewStatus}
          initialNote={row.assistantReviewNote}
          initialDraftReply={row.assistantDraftReply}
          sourceText={row.assistantSourceText}
          lines={row.lines.map((line) => ({
            id: line.id,
            productId: line.product?.id ?? null,
            productLabel: line.product ? line.product.productCode || line.product.sku || line.product.name : null,
            description: line.description,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toString(),
            lineTotal: line.lineTotal.toString(),
            currency: line.currency,
            source: line.source,
          }))}
        />
      </section>
      <AssistantContextCard
        title="Ask about this sales order"
        description="Use the assistant to summarize the customer commitment, draft a reply, or ask what still needs action."
        prompt={`Summarize sales order ${row.id} (${row.soNumber}) for ${row.customerName}. What is the next best action?`}
      />
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
        <p className="sm:col-span-2">
          <span className="text-zinc-500">Order for: </span>
          <div className="mt-1 text-zinc-900">
            <SalesOrderServedOrgField
              key={row.servedOrgUnit?.id ?? "served-none"}
              salesOrderId={row.id}
              orgUnitOptions={orgUnitOptions}
              canEdit={canEditServedOrg}
              initial={row.servedOrgUnit}
            />
          </div>
        </p>
        <div className="sm:col-span-2">
          <span className="text-sm text-zinc-500">Legal (order-for) snapshot: </span>
          <SalesOrderCompanyLegalSnapshot
            servedOrg={row.servedOrgUnit}
            companyLegal={companyLegalForServed}
            canViewSettings={canViewLegalSettings}
          />
        </div>
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
      <AssistantObjectTimeline
        events={[
          ...assistantAuditEvents.map((event) => ({
            id: `audit:${event.id}`,
            label: `Assistant ${event.answerKind}`,
            description: event.message || `${event.surface} · ${event.prompt.slice(0, 120)}`,
            href: "/assistant/command-center",
            at: event.createdAt,
          })),
          ...row.assistantEmailThreads.flatMap((thread) => {
          const base = [
            {
              id: `${thread.id}:created`,
              label: "Email converted to draft SO",
              description: `${thread.fromAddress} · ${thread.subject} · ${thread.status}`,
              href: `/assistant/mail?thread=${thread.id}`,
              at: thread.createdAt,
            },
          ];
          if (!thread.draftReply && !thread.lastSendConfirmAt) return base;
          return [
            ...base,
            ...(thread.draftReply
              ? [
                  {
                    id: `${thread.id}:draft`,
                    label: "Assistant reply drafted",
                    description: "A customer reply draft is saved on the linked mail thread.",
                    href: `/assistant/mail?thread=${thread.id}`,
                    at: thread.createdAt,
                  },
                ]
              : []),
            ...(thread.lastSendConfirmAt
              ? [
                  {
                    id: `${thread.id}:confirm`,
                    label: "Send confirmation logged",
                    description: "A user confirmed the mailto handoff for this thread.",
                    href: `/assistant/mail?thread=${thread.id}`,
                    at: thread.lastSendConfirmAt,
                  },
                ]
              : []),
          ];
          }),
        ]}
      />
    </main>
  );
}
