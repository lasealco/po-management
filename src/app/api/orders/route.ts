import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { visibleOnBoard } from "@/lib/workflow-actions";

export async function GET() {
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

  const actorId = await getActorUserId();
  const isSupplierPortalUser =
    actorId !== null && (await userHasRoleNamed(actorId, "Supplier portal"));
  const supplierOnlyActionCodes = new Set([
    "confirm",
    "decline",
    "propose_split",
    "mark_fulfilled",
  ]);
  const buyerOnlyActionCodes = new Set([
    "send_to_supplier",
    "buyer_accept_split",
    "buyer_reject_proposal",
    "buyer_cancel",
  ]);

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      tenantId: tenant.id,
      splitParentId: null,
      ...(isSupplierPortalUser ? { workflow: { supplierPortalOn: true } } : {}),
    },
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
      .filter(
        (transition) =>
          transition.fromStatusId === order.statusId &&
          visibleOnBoard(transition.actionCode),
      )
      .filter((transition) => {
        if (supplierOnlyActionCodes.has(transition.actionCode)) {
          return isSupplierPortalUser;
        }
        if (buyerOnlyActionCodes.has(transition.actionCode)) {
          return !isSupplierPortalUser;
        }
        return true;
      })
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
      buyerReference: order.buyerReference,
      requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() ?? null,
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
