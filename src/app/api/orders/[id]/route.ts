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
        select: { id: true, orderNumber: true },
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
      buyerReference: order.buyerReference,
      supplierReference: order.supplierReference,
      paymentTermsDays: order.paymentTermsDays,
      paymentTermsLabel: order.paymentTermsLabel,
      incoterm: order.incoterm,
      requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() ?? null,
      shipToName: order.shipToName,
      shipToLine1: order.shipToLine1,
      shipToLine2: order.shipToLine2,
      shipToCity: order.shipToCity,
      shipToRegion: order.shipToRegion,
      shipToPostalCode: order.shipToPostalCode,
      shipToCountryCode: order.shipToCountryCode,
      internalNotes: canSeeInternalFields ? order.internalNotes : null,
      notesToSupplier: order.notesToSupplier,
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
