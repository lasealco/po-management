import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      status: true,
      supplier: true,
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
      items: { orderBy: { lineNo: "asc" } },
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
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const allowedActions = order.workflow.transitions
    .filter((t) => t.fromStatusId === order.statusId)
    .map((t) => ({
      actionCode: t.actionCode,
      label: t.label,
      requiresComment: t.requiresComment,
      toStatus: t.toStatus,
    }));

  const pendingProposal = order.splitProposalsAsParent[0] ?? null;

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      currency: order.currency,
      subtotal: order.subtotal.toString(),
      taxAmount: order.taxAmount.toString(),
      totalAmount: order.totalAmount.toString(),
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
      splitIndex: order.splitIndex,
    },
    items: order.items.map((item) => ({
      id: item.id,
      lineNo: item.lineNo,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
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
  });
}
