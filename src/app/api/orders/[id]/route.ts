import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  getActorUserId,
  requireApiGrant,
  userHasGlobalGrant,
  userHasRoleNamed,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { optionalStringField } from "@/lib/supplier-patch";
import { prisma } from "@/lib/prisma";

function parseRequestedDeliveryDate(
  v: unknown,
): Date | null | undefined | "invalid" {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return "invalid";
  const t = v.trim();
  if (!t) return null;
  const d = new Date(`${t}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}

function preferText(
  childValue: string | null | undefined,
  parentValue: string | null | undefined,
) {
  if (typeof childValue === "string" && childValue.trim()) return childValue;
  if (typeof parentValue === "string" && parentValue.trim()) return parentValue;
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const { id } = await context.params;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      status: true,
      supplier: {
        select: {
          id: true,
          name: true,
          paymentTermsDays: true,
          paymentTermsLabel: true,
          defaultIncoterm: true,
        },
      },
      splitParent: {
        select: {
          id: true,
          orderNumber: true,
          buyerReference: true,
          supplierReference: true,
          paymentTermsDays: true,
          paymentTermsLabel: true,
          incoterm: true,
          requestedDeliveryDate: true,
          shipToName: true,
          shipToLine1: true,
          shipToLine2: true,
          shipToCity: true,
          shipToRegion: true,
          shipToPostalCode: true,
          shipToCountryCode: true,
          internalNotes: true,
          notesToSupplier: true,
        },
      },
      requester: true,
      workflow: {
        include: {
          transitions: {
            include: {
              toStatus: true,
            },
          },
        },
      },
      items: {
        orderBy: { lineNo: "asc" },
        include: {
          product: {
            select: { sku: true, productCode: true, name: true },
          },
        },
      },
      splitChildren: {
        orderBy: { splitIndex: "asc" },
        include: { status: true },
      },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true, email: true } },
          items: {
            include: { orderItem: { select: { id: true, lineNo: true, description: true } } },
            orderBy: { orderItem: { lineNo: "asc" } },
          },
        },
      },
      splitProposalsAsParent: {
        where: { status: "PENDING" },
        include: {
          lines: {
            include: { sourceLine: true },
            orderBy: [{ childIndex: "asc" }, { id: "asc" }],
          },
        },
        take: 1,
      },
      transitions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          actor: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const statusIds = new Set<string>();
  for (const log of order.transitions) {
    if (log.fromStatusId) statusIds.add(log.fromStatusId);
    statusIds.add(log.toStatusId);
  }
  const statusRows =
    statusIds.size > 0
      ? await prisma.workflowStatus.findMany({
          where: { id: { in: [...statusIds] } },
          select: { id: true, code: true, label: true },
        })
      : [];
  const statusById = new Map(statusRows.map((s) => [s.id, s]));

  const actorId = await getActorUserId();
  const isSupplierPortalUser =
    actorId !== null && (await userHasRoleNamed(actorId, "Supplier portal"));
  if (isSupplierPortalUser && !order.workflow.supplierPortalOn) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const supplierOnlyActions = new Set([
    "confirm",
    "decline",
    "propose_split",
    "mark_fulfilled",
  ]);
  const buyerOnlyActions = new Set([
    "send_to_supplier",
    "buyer_accept_split",
    "buyer_reject_proposal",
    "buyer_cancel",
  ]);
  const allowedActions = order.workflow.transitions
    .filter((t) => t.fromStatusId === order.statusId)
    .filter((t) => {
      if (supplierOnlyActions.has(t.actionCode)) return isSupplierPortalUser;
      if (buyerOnlyActions.has(t.actionCode)) return !isSupplierPortalUser;
      return true;
    })
    .map((t) => ({
      actionCode: t.actionCode,
      label: t.label,
      requiresComment: t.requiresComment,
      toStatus: t.toStatus,
    }));

  const pendingProposal = order.splitProposalsAsParent[0] ?? null;

  const canSeeInternalMessages =
    actorId !== null &&
    (await userHasGlobalGrant(actorId, "org.orders", "edit"));
  const canSeeInternalFields = canSeeInternalMessages;
  const canReceiveShipments = canSeeInternalMessages && !isSupplierPortalUser;
  const canCreateShipments =
    isSupplierPortalUser &&
    order.workflow.supplierPortalOn &&
    (order.status.code === "SENT" || order.status.code === "CONFIRMED");
  const effective = {
    buyerReference: preferText(
      order.buyerReference,
      order.splitParent?.buyerReference,
    ),
    supplierReference: preferText(
      order.supplierReference,
      order.splitParent?.supplierReference,
    ),
    paymentTermsDays:
      order.paymentTermsDays ?? order.splitParent?.paymentTermsDays ?? null,
    paymentTermsLabel: preferText(
      order.paymentTermsLabel,
      order.splitParent?.paymentTermsLabel,
    ),
    incoterm: preferText(order.incoterm, order.splitParent?.incoterm),
    requestedDeliveryDate:
      order.requestedDeliveryDate ?? order.splitParent?.requestedDeliveryDate ?? null,
    shipToName: preferText(order.shipToName, order.splitParent?.shipToName),
    shipToLine1: preferText(order.shipToLine1, order.splitParent?.shipToLine1),
    shipToLine2: preferText(order.shipToLine2, order.splitParent?.shipToLine2),
    shipToCity: preferText(order.shipToCity, order.splitParent?.shipToCity),
    shipToRegion: preferText(order.shipToRegion, order.splitParent?.shipToRegion),
    shipToPostalCode: preferText(
      order.shipToPostalCode,
      order.splitParent?.shipToPostalCode,
    ),
    shipToCountryCode: preferText(
      order.shipToCountryCode,
      order.splitParent?.shipToCountryCode,
    ),
    internalNotes: preferText(order.internalNotes, order.splitParent?.internalNotes),
    notesToSupplier: preferText(
      order.notesToSupplier,
      order.splitParent?.notesToSupplier,
    ),
  };

  let childPlannedShipDates: string[] = [];
  if (order.splitIndex != null) {
    const splitLines = await prisma.splitProposalLine.findMany({
      where: {
        childIndex: order.splitIndex,
        proposal: {
          parentOrderId: order.splitParentId ?? order.id,
          ...(order.splitProposalId ? { id: order.splitProposalId } : {}),
        },
      },
      orderBy: { plannedShipDate: "asc" },
      select: { plannedShipDate: true, proposalId: true },
      take: 200,
    });
    const firstProposal = splitLines[0]?.proposalId;
    const sameProposal = firstProposal
      ? splitLines.filter((line) => line.proposalId === firstProposal)
      : splitLines;
    const unique = new Set(
      sameProposal.map((line) => line.plannedShipDate.toISOString().slice(0, 10)),
    );
    childPlannedShipDates = [...unique];
  }

  const messages = await prisma.orderChatMessage.findMany({
    where: {
      orderId: id,
      ...(canSeeInternalMessages ? {} : { isInternal: false }),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      author: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      currency: order.currency,
      subtotal: order.subtotal.toString(),
      taxAmount: order.taxAmount.toString(),
      totalAmount: order.totalAmount.toString(),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      buyerReference: effective.buyerReference,
      supplierReference: effective.supplierReference,
      paymentTermsDays: effective.paymentTermsDays,
      paymentTermsLabel: effective.paymentTermsLabel,
      incoterm: effective.incoterm,
      requestedDeliveryDate: effective.requestedDeliveryDate?.toISOString() ?? null,
      shipToName: effective.shipToName,
      shipToLine1: effective.shipToLine1,
      shipToLine2: effective.shipToLine2,
      shipToCity: effective.shipToCity,
      shipToRegion: effective.shipToRegion,
      shipToPostalCode: effective.shipToPostalCode,
      shipToCountryCode: effective.shipToCountryCode,
      internalNotes: canSeeInternalFields ? effective.internalNotes : null,
      notesToSupplier: effective.notesToSupplier,
      status: order.status,
      workflow: {
        id: order.workflow.id,
        name: order.workflow.name,
        allowSplitOrders: order.workflow.allowSplitOrders,
        supplierPortalOn: order.workflow.supplierPortalOn,
      },
      supplier: order.supplier,
      requester: order.requester,
      splitParentId: order.splitParentId,
      splitParent: order.splitParent
        ? {
            id: order.splitParent.id,
            orderNumber: order.splitParent.orderNumber,
          }
        : null,
      splitIndex: order.splitIndex,
      plannedShipDates: childPlannedShipDates,
    },
    items: order.items.map((item) => ({
      id: item.id,
      lineNo: item.lineNo,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
      productId: item.productId,
      product: item.product
        ? {
            sku: item.product.sku,
            productCode: item.product.productCode,
            name: item.product.name,
          }
        : null,
    })),
    splitChildren: order.splitChildren.map((child) => ({
      id: child.id,
      orderNumber: child.orderNumber,
      splitIndex: child.splitIndex,
      status: child.status,
      totalAmount: child.totalAmount.toString(),
    })),
    shipments: order.shipments.map((shipment) => ({
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      status: shipment.status,
      shippedAt: shipment.shippedAt.toISOString(),
      receivedAt: shipment.receivedAt?.toISOString() ?? null,
      carrier: shipment.carrier,
      trackingNo: shipment.trackingNo,
      notes: shipment.notes,
      createdBy: shipment.createdBy,
      items: shipment.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        lineNo: item.orderItem.lineNo,
        description: item.orderItem.description,
        quantityShipped: item.quantityShipped.toString(),
        quantityReceived: item.quantityReceived.toString(),
        plannedShipDate: item.plannedShipDate?.toISOString() ?? null,
      })),
    })),
    pendingProposal: pendingProposal
      ? {
          id: pendingProposal.id,
          status: pendingProposal.status,
          comment: pendingProposal.comment,
          lines: pendingProposal.lines.map((line) => ({
            id: line.id,
            childIndex: line.childIndex,
            quantity: line.quantity.toString(),
            plannedShipDate: line.plannedShipDate.toISOString(),
            sourceLineId: line.sourceLineId,
            sourceDescription: line.sourceLine.description,
          })),
        }
      : null,
    allowedActions,
    activity: order.transitions.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      actionCode: log.actionCode,
      comment: log.comment,
      actor: log.actor,
      fromStatus: log.fromStatusId
        ? (statusById.get(log.fromStatusId) ?? null)
        : null,
      toStatus: statusById.get(log.toStatusId) ?? {
        id: log.toStatusId,
        code: "?",
        label: "Unknown",
      },
    })),
    messages: messages.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      body: m.body,
      isInternal: m.isInternal,
      author: m.author,
    })),
    messageCapabilities: {
      canPost: actorId !== null,
      canPostInternal: canSeeInternalMessages,
    },
    splitCapabilities: {
      canPropose: isSupplierPortalUser,
    },
    shipmentCapabilities: {
      canCreate: canCreateShipments,
      canReceive: canReceiveShipments,
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const o = body as Record<string, unknown>;
  const data: Prisma.PurchaseOrderUpdateInput = {};

  const stringKeys = [
    "buyerReference",
    "supplierReference",
    "paymentTermsLabel",
    "incoterm",
    "shipToName",
    "shipToLine1",
    "shipToLine2",
    "shipToCity",
    "shipToRegion",
    "shipToPostalCode",
  ] as const;
  for (const key of stringKeys) {
    const v = optionalStringField(o, key);
    if (v !== undefined) data[key] = v;
  }

  if ("internalNotes" in o) {
    const v = optionalStringField(o, "internalNotes");
    if (v !== undefined) data.internalNotes = v;
  }
  if ("notesToSupplier" in o) {
    const v = optionalStringField(o, "notesToSupplier");
    if (v !== undefined) data.notesToSupplier = v;
  }

  if ("shipToCountryCode" in o) {
    const v = o.shipToCountryCode;
    if (v === null) {
      data.shipToCountryCode = null;
    } else if (typeof v === "string") {
      const t = v.trim().toUpperCase();
      data.shipToCountryCode = t.length === 2 ? t : null;
    } else {
      return NextResponse.json(
        { error: "Invalid shipToCountryCode." },
        { status: 400 },
      );
    }
  }

  if ("paymentTermsDays" in o) {
    const v = o.paymentTermsDays;
    if (v === null) {
      data.paymentTermsDays = null;
    } else if (
      typeof v === "number" &&
      Number.isInteger(v) &&
      v >= 0 &&
      v <= 3650
    ) {
      data.paymentTermsDays = v;
    } else {
      return NextResponse.json(
        { error: "Invalid paymentTermsDays." },
        { status: 400 },
      );
    }
  }

  if ("requestedDeliveryDate" in o) {
    const parsed = parseRequestedDeliveryDate(o.requestedDeliveryDate);
    if (parsed === "invalid") {
      return NextResponse.json(
        { error: "Invalid requestedDeliveryDate (use YYYY-MM-DD)." },
        { status: 400 },
      );
    }
    if (parsed !== undefined) {
      data.requestedDeliveryDate = parsed;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 },
    );
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data,
  });

  return GET(request, context);
}
