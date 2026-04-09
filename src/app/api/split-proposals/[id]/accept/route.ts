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

  const acceptTransition = await prisma.workflowTransition.findFirst({
    where: {
      workflowId: parent.workflowId,
      actionCode: "buyer_accept_split",
      fromStatusId: parent.statusId,
    },
  });
  const confirmedStatus = await prisma.workflowStatus.findFirst({
    where: { workflowId: parent.workflowId, code: "CONFIRMED" },
  });

  if (!acceptTransition || !confirmedStatus) {
    return NextResponse.json(
      { error: "Workflow misconfigured for buyer accept." },
      { status: 500 },
    );
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.splitProposal.update({
      where: { id: proposal.id },
      data: { status: "ACCEPTED", resolvedAt: now },
    });

    await tx.purchaseOrder.update({
      where: { id: parent.id },
      data: { statusId: acceptTransition.toStatusId },
    });

    await tx.orderTransitionLog.create({
      data: {
        orderId: parent.id,
        fromStatusId: parent.statusId,
        toStatusId: acceptTransition.toStatusId,
        actionCode: "buyer_accept_split",
        actorUserId: buyer.id,
      },
    });

    await tx.purchaseOrder.updateMany({
      where: { splitProposalId: proposal.id },
      data: { statusId: confirmedStatus.id },
    });
  });

  return NextResponse.json({ ok: true });
}
