import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_BUYER_EMAIL = "buyer@demo-company.com";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const buyer = await prisma.user.findFirst({
    where: { tenantId: parent.tenantId, email: DEMO_BUYER_EMAIL },
    select: { id: true },
  });
  if (!buyer) {
    return NextResponse.json(
      { error: "Buyer demo user missing. Run db:seed." },
      { status: 500 },
    );
  }

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
        actorUserId: buyer.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
