import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "Could not resolve demo actor.", code: "FORBIDDEN", status: 403 });
  }

  const { id: proposalId } = await context.params;

  const proposal = await prisma.splitProposal.findUnique({
    where: { id: proposalId },
    include: { parentOrder: { include: { status: true, workflow: true } } },
  });

  if (!proposal || proposal.status !== "PENDING") {
    return toApiErrorResponse({ error: "Proposal not found or not pending.", code: "NOT_FOUND", status: 404 });
  }

  const parent = proposal.parentOrder;

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
    return toApiErrorResponse({ error: "Workflow misconfigured for buyer accept.", code: "UNHANDLED", status: 500 });
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
        actorUserId: actorId,
      },
    });

    await tx.purchaseOrder.updateMany({
      where: { splitProposalId: proposal.id },
      data: { statusId: confirmedStatus.id },
    });
  });

  return NextResponse.json({ ok: true });
}
