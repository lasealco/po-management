import { CtExceptionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { controlTowerShipmentAccessWhere, getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TAKE = 8;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function daysUntil(value: Date | null | undefined) {
  if (!value) return null;
  return Math.ceil((value.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function decimalNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toString" in value) return Number(value.toString());
  return Number(value) || 0;
}

function statusTone(days: number | null) {
  if (days == null) return "watch";
  if (days < 0) return "critical";
  if (days <= 3) return "watch";
  return "ready";
}

export async function GET() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }

  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  const canProducts = viewerHas(access.grantSet, "org.products", "view");
  const canSuppliers = viewerHas(access.grantSet, "org.suppliers", "view");
  const canWms = viewerHas(access.grantSet, "org.wms", "view");
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");

  if (!canOrders && !canProducts && !canSuppliers && !canWms && !canCt) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const ctCtx = canCt ? await getControlTowerPortalContext(actorUserId) : null;
  const ctShipmentWhere = canCt && ctCtx ? await controlTowerShipmentAccessWhere(tenant.id, ctCtx, actorUserId) : null;
  const overdueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3);

  const [
    salesDrafts,
    salesAtRisk,
    stockRows,
    purchaseOrders,
    suppliers,
    onboardingTasks,
    shipmentExceptions,
  ] = await Promise.all([
    canOrders
      ? prisma.salesOrder.findMany({
          where: { tenantId: tenant.id, status: "DRAFT" },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
          select: {
            id: true,
            soNumber: true,
            customerName: true,
            externalRef: true,
            requestedDeliveryDate: true,
            updatedAt: true,
            _count: { select: { shipments: true, assistantEmailThreads: true } },
          },
        })
      : Promise.resolve([]),
    canOrders
      ? prisma.salesOrder.findMany({
          where: {
            tenantId: tenant.id,
            OR: [
              { status: "DRAFT" },
              { requestedDeliveryDate: { lte: overdueDate } },
              { shipments: { none: {} } },
            ],
          },
          orderBy: [{ requestedDeliveryDate: "asc" }, { updatedAt: "desc" }],
          take: TAKE,
          select: {
            id: true,
            soNumber: true,
            status: true,
            customerName: true,
            requestedDeliveryDate: true,
            updatedAt: true,
            _count: { select: { shipments: true } },
          },
        })
      : Promise.resolve([]),
    canProducts || canWms
      ? prisma.inventoryBalance.findMany({
          where: { tenantId: tenant.id },
          orderBy: [{ onHold: "desc" }, { updatedAt: "desc" }],
          take: 80,
          select: {
            productId: true,
            onHandQty: true,
            allocatedQty: true,
            onHold: true,
            holdReason: true,
            updatedAt: true,
            product: { select: { id: true, name: true, productCode: true, sku: true } },
            warehouse: { select: { id: true, name: true, code: true } },
          },
        })
      : Promise.resolve([]),
    canOrders
      ? prisma.purchaseOrder.findMany({
          where: {
            tenantId: tenant.id,
            OR: [
              { supplierReference: null },
              { requestedDeliveryDate: { lte: overdueDate } },
              { shipments: { none: {} } },
            ],
          },
          orderBy: [{ requestedDeliveryDate: "asc" }, { updatedAt: "desc" }],
          take: TAKE,
          select: {
            id: true,
            orderNumber: true,
            title: true,
            supplierReference: true,
            requestedDeliveryDate: true,
            updatedAt: true,
            supplier: { select: { id: true, name: true, email: true } },
            status: { select: { label: true, code: true } },
            _count: { select: { items: true, shipments: true, chats: true } },
          },
        })
      : Promise.resolve([]),
    canSuppliers
      ? prisma.supplier.findMany({
          where: { tenantId: tenant.id, isActive: true },
          orderBy: [{ updatedAt: "desc" }],
          take: TAKE,
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
            approvalStatus: true,
            srmOnboardingStage: true,
            paymentTermsLabel: true,
            updatedAt: true,
            _count: {
              select: {
                orders: true,
                contacts: true,
                serviceCapabilities: true,
                onboardingTasks: true,
                srmDocuments: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSuppliers
      ? prisma.supplierOnboardingTask.findMany({
          where: { tenantId: tenant.id, done: false },
          orderBy: [{ dueAt: "asc" }, { sortOrder: "asc" }],
          take: TAKE,
          select: {
            id: true,
            title: true,
            dueAt: true,
            notes: true,
            supplier: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    canCt && ctShipmentWhere
      ? prisma.ctException.findMany({
          where: {
            tenantId: tenant.id,
            status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] },
            shipment: { is: ctShipmentWhere },
          },
          orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
          take: TAKE,
          select: {
            id: true,
            type: true,
            severity: true,
            status: true,
            rootCause: true,
            createdAt: true,
            updatedAt: true,
            owner: { select: { name: true } },
            shipment: {
              select: {
                id: true,
                shipmentNo: true,
                status: true,
                carrier: true,
                trackingNo: true,
                expectedReceiveAt: true,
                order: { select: { orderNumber: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map<
    string,
    {
      productId: string;
      productLabel: string;
      onHand: number;
      allocated: number;
      held: number;
      warehouses: Set<string>;
      updatedAt: string | null;
      holdReason: string | null;
    }
  >();
  for (const row of stockRows) {
    const onHand = decimalNumber(row.onHandQty);
    const allocated = decimalNumber(row.allocatedQty);
    const current = productMap.get(row.productId) ?? {
      productId: row.productId,
      productLabel: row.product.productCode || row.product.sku || row.product.name,
      onHand: 0,
      allocated: 0,
      held: 0,
      warehouses: new Set<string>(),
      updatedAt: null,
      holdReason: null,
    };
    current.onHand += onHand;
    current.allocated += allocated;
    if (row.onHold) {
      current.held += onHand;
      current.holdReason = row.holdReason ?? current.holdReason;
    }
    current.warehouses.add(row.warehouse.code || row.warehouse.name);
    current.updatedAt = iso(row.updatedAt);
    productMap.set(row.productId, current);
  }

  const availability = Array.from(productMap.values())
    .map((row) => {
      const available = Math.max(0, row.onHand - row.allocated - row.held);
      return {
        lmp: "LMP5/LMP6",
        id: row.productId,
        title: row.productLabel,
        subtitle: `${available.toLocaleString()} available · ${row.onHand.toLocaleString()} on hand · ${row.allocated.toLocaleString()} allocated`,
        tone: row.held > 0 || available <= 0 ? "watch" : "ready",
        href: `/products/${row.productId}`,
        evidence: [
          `${row.warehouses.size} warehouse${row.warehouses.size === 1 ? "" : "s"} with stock rows`,
          row.held > 0 ? `${row.held.toLocaleString()} on hold${row.holdReason ? `: ${row.holdReason}` : ""}` : "No held balance in sampled rows",
        ],
        action: {
          id: `lmp5-review-availability-${row.productId}`,
          kind: "navigate",
          label: "Review product availability",
          description: "Open product evidence before promising stock or proposing reallocation.",
          href: `/products/${row.productId}`,
        },
      };
    })
    .sort((a, b) => (a.tone === b.tone ? a.title.localeCompare(b.title) : a.tone === "watch" ? -1 : 1))
    .slice(0, TAKE);

  const payload = {
    generatedAt: new Date().toISOString(),
    actor: access.user,
    capabilities: {
      orders: canOrders,
      products: canProducts,
      suppliers: canSuppliers,
      wms: canWms,
      controlTower: canCt,
    },
    sections: [
      {
        id: "foundation",
        lmpRange: "LMP1",
        title: "Assistant foundation",
        summary: "One cockpit links chat, inbox, command center, object evidence, audit memory, and human-approved action queue.",
        href: "/assistant/command-center",
        items: [
          {
            id: "assistant-shell",
            title: "Unified assistant shell is active",
            subtitle: "Workbench, chat, inbox, mail, and command center share the assistant navigation.",
            tone: "ready",
            href: "/assistant",
            evidence: ["Actions below queue into Assistant action queue instead of silently mutating records."],
            action: {
              id: "lmp1-open-command-center",
              kind: "navigate",
              label: "Open assistant command center",
              description: "Review audit, feedback, queued actions, playbooks, and assistant operating health.",
              href: "/assistant/command-center",
            },
          },
        ],
      },
      {
        id: "sales-order-copilot",
        lmpRange: "LMP2/LMP3",
        title: "Sales-order and customer communication copilot",
        summary: "Draft orders, customer context, and safe reply handoffs from pasted requests or open draft work.",
        href: "/assistant",
        items: salesDrafts.map((row) => ({
          id: row.id,
          title: `Draft SO ${row.soNumber}`,
          subtitle: `${row.customerName}${row.externalRef ? ` · ${row.externalRef}` : ""}`,
          tone: row._count.shipments > 0 ? "ready" : "watch",
          href: `/sales-orders/${row.id}`,
          evidence: [
            `${row._count.shipments} linked shipment${row._count.shipments === 1 ? "" : "s"}`,
            `${row._count.assistantEmailThreads} linked assistant mail thread${row._count.assistantEmailThreads === 1 ? "" : "s"}`,
            row.requestedDeliveryDate ? `Requested delivery ${row.requestedDeliveryDate.toISOString().slice(0, 10)}` : "No requested delivery date",
          ],
          action: {
            id: `lmp2-complete-draft-${row.id}`,
            kind: "navigate",
            label: "Review draft SO",
            description: "Validate customer/product promise, complete missing context, and prepare any customer reply manually.",
            href: `/sales-orders/${row.id}`,
          },
        })),
      },
      {
        id: "order-exceptions",
        lmpRange: "LMP4",
        title: "Order exception triage",
        summary: "Draft, unlinked, and near-due sales orders are grouped with root-cause prompts and safe next actions.",
        href: "/sales-orders",
        items: salesAtRisk.map((row) => {
          const due = daysUntil(row.requestedDeliveryDate);
          return {
            id: row.id,
            title: `${row.soNumber} · ${row.customerName}`,
            subtitle: `${row.status} · ${row._count.shipments} shipment link${row._count.shipments === 1 ? "" : "s"}`,
            tone: row.status === "DRAFT" || row._count.shipments === 0 ? "watch" : statusTone(due),
            href: `/sales-orders/${row.id}`,
            evidence: [
              row.status === "DRAFT" ? "Still draft" : `Status ${row.status}`,
              row._count.shipments === 0 ? "No execution shipment linked" : "Execution shipment linked",
              due == null ? "No delivery date" : due < 0 ? `${Math.abs(due)} days late` : `${due} days until requested delivery`,
            ],
            action: {
              id: `lmp4-triage-so-${row.id}`,
              kind: "navigate",
              label: "Triage order exception",
              description: "Open the SO, confirm root cause, then decide whether to link shipment, update promise, or close the draft.",
              href: `/sales-orders/${row.id}`,
            },
          };
        }),
      },
      {
        id: "availability",
        lmpRange: "LMP5/LMP6",
        title: "Product availability and reallocation review",
        summary: "Stock promise and reallocation candidates use WMS balances and stay human-approved.",
        href: "/wms/stock",
        items: availability,
      },
      {
        id: "po-follow-up",
        lmpRange: "LMP7",
        title: "Purchase-order follow-up copilot",
        summary: "Inbound supply risk and supplier chase work from open PO signals.",
        href: "/orders",
        items: purchaseOrders.map((row) => {
          const due = daysUntil(row.requestedDeliveryDate);
          return {
            id: row.id,
            title: `${row.orderNumber}${row.title ? ` · ${row.title}` : ""}`,
            subtitle: `${row.supplier?.name ?? "No supplier"} · ${row.status.label}`,
            tone: !row.supplierReference || row._count.shipments === 0 ? "watch" : statusTone(due),
            href: `/orders/${row.id}`,
            evidence: [
              row.supplierReference ? `Supplier ref ${row.supplierReference}` : "Missing supplier acknowledgement/reference",
              `${row._count.items} line${row._count.items === 1 ? "" : "s"} · ${row._count.shipments} shipment${row._count.shipments === 1 ? "" : "s"}`,
              due == null ? "No requested delivery date" : due < 0 ? `${Math.abs(due)} days late` : `${due} days until requested delivery`,
            ],
            action: {
              id: `lmp7-follow-up-po-${row.id}`,
              kind: "navigate",
              label: "Prepare supplier follow-up",
              description: "Open the PO, review acknowledgement/shipment status, then draft supplier follow-up from evidence.",
              href: `/orders/${row.id}`,
            },
          };
        }),
      },
      {
        id: "supplier-performance",
        lmpRange: "LMP8",
        title: "Supplier performance assistant",
        summary: "Supplier coaching briefs combine order volume, profile completeness, documents, contacts, and capabilities.",
        href: "/srm",
        items: suppliers.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: `${row.approvalStatus} · onboarding ${row.srmOnboardingStage}`,
          tone: row._count.contacts === 0 || row._count.serviceCapabilities === 0 ? "watch" : "ready",
          href: `/srm/${row.id}`,
          evidence: [
            `${row._count.orders} PO${row._count.orders === 1 ? "" : "s"}`,
            `${row._count.contacts} contact${row._count.contacts === 1 ? "" : "s"} · ${row._count.serviceCapabilities} capability record${row._count.serviceCapabilities === 1 ? "" : "s"}`,
            `${row._count.srmDocuments} compliance document${row._count.srmDocuments === 1 ? "" : "s"}`,
          ],
          action: {
            id: `lmp8-open-supplier-brief-${row.id}`,
            kind: "navigate",
            label: "Review supplier brief",
            description: "Open SRM supplier detail and use the evidence to coach performance or fill profile gaps.",
            href: `/srm/${row.id}`,
          },
        })),
      },
      {
        id: "supplier-onboarding",
        lmpRange: "LMP9",
        title: "Supplier onboarding copilot",
        summary: "Open onboarding tasks are visible with due-date risk and supplier handoff actions.",
        href: "/srm",
        items: onboardingTasks.map((row) => {
          const due = daysUntil(row.dueAt);
          return {
            id: row.id,
            title: row.title,
            subtitle: row.supplier.name,
            tone: statusTone(due),
            href: `/srm/${row.supplier.id}`,
            evidence: [
              due == null ? "No due date" : due < 0 ? `${Math.abs(due)} days overdue` : `${due} days until due`,
              row.notes ? row.notes.slice(0, 140) : "No task notes captured",
              row.supplier.email ? `Supplier email ${row.supplier.email}` : "No supplier email on profile",
            ],
            action: {
              id: `lmp9-chase-onboarding-${row.id}`,
              kind: "navigate",
              label: "Review onboarding gap",
              description: "Open supplier detail, confirm the missing information, and draft a supplier request manually.",
              href: `/srm/${row.supplier.id}`,
            },
          };
        }),
      },
      {
        id: "shipment-triage",
        lmpRange: "LMP10",
        title: "Shipment triage copilot",
        summary: "Open Control Tower exceptions include severity, likely root-cause evidence, owner hints, and guided actions.",
        href: "/control-tower",
        items: shipmentExceptions.map((row) => ({
          id: row.id,
          title: `${row.type} · ${row.shipment.shipmentNo ?? "Shipment"}`,
          subtitle: `${row.severity} · ${row.status} · owner ${row.owner?.name ?? "unassigned"}`,
          tone: row.severity === "CRITICAL" ? "critical" : "watch",
          href: `/control-tower/shipments/${row.shipment.id}?tab=exceptions`,
          evidence: [
            row.rootCause ? `Root cause: ${row.rootCause.slice(0, 160)}` : "Root cause not captured yet",
            row.shipment.carrier ? `Carrier ${row.shipment.carrier}` : "No carrier on shipment",
            row.shipment.expectedReceiveAt
              ? `Expected receive ${row.shipment.expectedReceiveAt.toISOString().slice(0, 10)}`
              : "No expected receive date",
          ],
          action: {
            id: `lmp10-triage-shipment-${row.id}`,
            kind: "navigate",
            label: "Open shipment triage",
            description: "Review exception evidence, assign/confirm root cause, and choose the recovery action before updating anyone.",
            href: `/control-tower/shipments/${row.shipment.id}?tab=exceptions`,
          },
        })),
      },
    ],
  };

  return NextResponse.json(payload);
}
