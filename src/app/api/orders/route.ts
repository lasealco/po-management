import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_TENANT_SLUG = "demo-company";

export async function GET() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const orders = await prisma.purchaseOrder.findMany({
    where: { tenantId: tenant.id },
    include: {
      status: {
        select: { id: true, code: true, label: true },
      },
      supplier: {
        select: { id: true, name: true },
      },
      requester: {
        select: { id: true, name: true, email: true },
      },
      workflow: {
        select: {
          id: true,
          name: true,
          transitions: {
            select: {
              fromStatusId: true,
              toStatusId: true,
              actionCode: true,
              label: true,
              requiresComment: true,
              toStatus: {
                select: { id: true, code: true, label: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = orders.map((order) => {
    const allowedActions = order.workflow.transitions
      .filter((transition) => transition.fromStatusId === order.statusId)
      .map((transition) => ({
        actionCode: transition.actionCode,
        label: transition.label,
        requiresComment: transition.requiresComment,
        toStatus: transition.toStatus,
      }));

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      totalAmount: order.totalAmount.toString(),
      currency: order.currency,
      status: order.status,
      supplier: order.supplier,
      requester: order.requester,
      workflow: {
        id: order.workflow.id,
        name: order.workflow.name,
      },
      allowedActions,
      createdAt: order.createdAt,
    };
  });

  return NextResponse.json({ tenant, orders: data });
}
