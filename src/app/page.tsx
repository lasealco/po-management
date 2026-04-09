import { OrdersBoard } from "@/components/orders-board";
import { ProductCreateForm } from "@/components/product-create-form";
import { prisma } from "@/lib/prisma";
import { visibleOnBoard } from "@/lib/workflow-actions";

const DEFAULT_TENANT_SLUG = "demo-company";
export const dynamic = "force-dynamic";

export default async function Home() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold text-zinc-900">
          PO Workflow Playground
        </h1>
        <p className="mt-4 text-zinc-600">
          Demo data not found. Run <code>npm run db:seed</code> locally, then deploy.
        </p>
      </main>
    );
  }

  const orders = await prisma.purchaseOrder.findMany({
    where: { tenantId: tenant.id, splitParentId: null },
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
        .map((transition) => ({
          actionCode: transition.actionCode,
          label: transition.label,
          requiresComment: transition.requiresComment,
          toStatus: transition.toStatus,
        })),
      createdAt: order.createdAt.toISOString(),
    })),
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <ProductCreateForm />
      <OrdersBoard initialData={initialData} />
    </div>
  );
}
