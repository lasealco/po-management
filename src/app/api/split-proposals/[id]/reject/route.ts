import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      { error: "Could not resolve demo actor." },
      { status: 403 },
    );
  }

  const { id: proposalId } = await context.params;

  const proposal = await prisma.splitProposal.findUnique({
    where: { id: proposalId },
    include: { parentOrder: { include: { status: true, workflow: true } } },
  });

  if (!proposal || proposal.status !== "PENDING") {
    return NextResponse.json(
      { error: "Proposal not found or not pending." },
      { status: 404 },
    );
  }

  const parent = proposal.parentOrder;

  const rejectTransition = await prisma.workflowTransition.findFirst({
    where: {
      workflowId: parent.workflowId,
      actionCode: "buyer_reject_proposal",
      fromStatusId: parent.statusId,
    },
  });

  if (!rejectTransition) {
    return NextResponse.json(
      { error: "Workflow misconfigured for buyer reject." },
      { status: 500 },
    );
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.splitProposal.update({
      where: { id: proposal.id },
      data: { status: "REJECTED", resolvedAt: now },
    });

    await tx.purchaseOrder.deleteMany({
      where: { splitProposalId: proposal.id },
    });

    await tx.purchaseOrder.update({
      where: { id: parent.id },
      data: { statusId: rejectTransition.toStatusId },
    });

    await tx.orderTransitionLog.create({
      data: {
        orderId: parent.id,
        fromStatusId: parent.statusId,
        toStatusId: rejectTransition.toStatusId,
        actionCode: "buyer_reject_proposal",
        actorUserId: actorId,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
