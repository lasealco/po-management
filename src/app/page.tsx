import { AccessDenied } from "@/components/access-denied";
import { OrdersBoard } from "@/components/orders-board";
import { getViewerGrantSet, userHasRoleNamed, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { visibleOnBoard } from "@/lib/workflow-actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const access = await getViewerGrantSet();

  if (!access) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold text-zinc-900">
          PO Workflow Playground
        </h1>
        <p className="mt-4 text-zinc-600">
          Demo data not found. Run <code>npm run db:seed</code> locally, then
          deploy.
        </p>
      </main>
    );
  }

  if (!access.user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AccessDenied
          title="Orders"
          message="Choose an active demo user in the header bar to view the board."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AccessDenied
          title="Orders"
          message="You do not have permission to view purchase orders (org.orders → view)."
        />
      </div>
    );
  }

  const { tenant } = access;
  const isSupplierPortalUser = await userHasRoleNamed(
    access.user.id,
    "Supplier portal",
  );
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
      status: { select: { id: true, code: true, label: true } },
      supplier: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true, email: true } },
      workflow: {
        select: {
          id: true,
          name: true,
          transitions: {
            select: {
              fromStatusId: true,
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

  const initialData = {
    tenant,
    orders: orders.map((order) => ({
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
      allowedActions: order.workflow.transitions
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
        })),
      createdAt: order.createdAt.toISOString(),
    })),
  };

  const canTransitionOrders = viewerHas(
    access.grantSet,
    "org.orders",
    "transition",
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <OrdersBoard
        initialData={initialData}
        canTransitionOrders={canTransitionOrders}
        defaultQueueFilter={isSupplierPortalUser ? "all" : "awaiting_supplier"}
      />
    </div>
  );
}
