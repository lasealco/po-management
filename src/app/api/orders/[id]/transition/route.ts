import { NextRequest, NextResponse } from "next/server";
import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


type TransitionBody = {
  actionCode?: string;
  comment?: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "transition");
  if (gate) return gate;

  const { id: orderId } = await context.params;
  const body = (await request.json()) as TransitionBody;

  if (!body.actionCode) {
    return toApiErrorResponse({ error: "actionCode is required", code: "BAD_INPUT", status: 400 });
  }

  if (body.actionCode === "propose_split") {
    return toApiErrorResponse({ error: "Use POST /api/orders/:id/split-proposal with line allocations instead.", code: "BAD_INPUT", status: 400 });
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: {
      workflow: {
        include: {
          transitions: true,
        },
      },
      status: true,
    },
  });

  if (!order) {
    return toApiErrorResponse({ error: "Order not found", code: "NOT_FOUND", status: 404 });
  }

  const selectedTransition = order.workflow.transitions.find(
    (transition) =>
      transition.fromStatusId === order.statusId &&
      transition.actionCode === body.actionCode,
  );

  if (!selectedTransition) {
    return toApiErrorResponse({ error: `Action '${body.actionCode}' is not allowed from status '${order.status.code}'.`, code: "BAD_INPUT", status: 400 });
  }

  if (
    selectedTransition.requiresComment &&
    (!body.comment || !body.comment.trim())
  ) {
    return toApiErrorResponse({ error: "A comment is required for this transition.", code: "BAD_INPUT", status: 400 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "Could not resolve demo actor for this tenant.", code: "FORBIDDEN", status: 403 });
  }

  const isSupplierPortalUser = await actorIsSupplierPortalRestricted(actorId);
  if (isSupplierPortalUser && !order.workflow.supplierPortalOn) {
    return toApiErrorResponse({ error: "Supplier users can only act on supplier-portal orders.", code: "FORBIDDEN", status: 403 });
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

  if (
    supplierOnlyActions.has(selectedTransition.actionCode) &&
    !isSupplierPortalUser
  ) {
    return toApiErrorResponse({ error: `Action '${selectedTransition.actionCode}' is supplier-only.`, code: "FORBIDDEN", status: 403 });
  }
  if (buyerOnlyActions.has(selectedTransition.actionCode) && isSupplierPortalUser) {
    return toApiErrorResponse({ error: `Action '${selectedTransition.actionCode}' is buyer-only.`, code: "FORBIDDEN", status: 403 });
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const nextOrder = await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { statusId: selectedTransition.toStatusId },
      include: {
        status: {
          select: { id: true, code: true, label: true },
        },
      },
    });

    await tx.orderTransitionLog.create({
      data: {
        orderId: order.id,
        fromStatusId: order.statusId,
        toStatusId: selectedTransition.toStatusId,
        actionCode: selectedTransition.actionCode,
        actorUserId: actorId,
        comment: body.comment?.trim(),
      },
    });

    return nextOrder;
  });

  return NextResponse.json({
    ok: true,
    order: {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
    },
  });
}
