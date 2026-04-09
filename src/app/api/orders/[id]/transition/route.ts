import { NextRequest, NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

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
    return NextResponse.json(
      { error: "actionCode is required" },
      { status: 400 },
    );
  }

  if (body.actionCode === "propose_split") {
    return NextResponse.json(
      {
        error:
          "Use POST /api/orders/:id/split-proposal with line allocations instead.",
      },
      { status: 400 },
    );
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
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const selectedTransition = order.workflow.transitions.find(
    (transition) =>
      transition.fromStatusId === order.statusId &&
      transition.actionCode === body.actionCode,
  );

  if (!selectedTransition) {
    return NextResponse.json(
      {
        error: `Action '${body.actionCode}' is not allowed from status '${order.status.code}'.`,
      },
      { status: 400 },
    );
  }

  if (
    selectedTransition.requiresComment &&
    (!body.comment || !body.comment.trim())
  ) {
    return NextResponse.json(
      { error: "A comment is required for this transition." },
      { status: 400 },
    );
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      { error: "Could not resolve demo actor for this tenant." },
      { status: 403 },
    );
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
