import { AccessDenied } from "@/components/access-denied";
import { OrdersBoard } from "@/components/orders-board";
import { actorIsSupplierPortalRestricted, getViewerGrantSet, viewerHas } from "@/lib/authz";
import {
  defaultBoardQueue,
  ORDERS_BOARD_PREF_KEY,
  parseQueueFromSearchParam,
  readBoardPrefsFromJson,
  type BoardQueueFilter,
  type BoardSortMode,
} from "@/lib/orders-board-prefs";
import { serializeOrderForBoard } from "@/lib/orders-board-serialize";
import { getPurchaseOrderScopeWhere } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ queue?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const queueFromUrl = parseQueueFromSearchParam(sp.queue);

  const access = await getViewerGrantSet();

  if (!access) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold text-zinc-900">Orders</h1>
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
          message="Choose an active demo user: Settings → Demo session (/settings/demo), then reload this page."
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

  const prefRow = await prisma.userPreference.findUnique({
    where: {
      userId_key: { userId: access.user.id, key: ORDERS_BOARD_PREF_KEY },
    },
    select: { value: true },
  });
  const savedBoard = readBoardPrefsFromJson(prefRow?.value);
  const initialQueue: BoardQueueFilter =
    queueFromUrl ?? savedBoard.queueFilter ?? defaultBoardQueue();
  const initialSort: BoardSortMode = savedBoard.sortMode ?? "priority";

  const { tenant } = access;
  const isSupplierPortalUser = await actorIsSupplierPortalRestricted(access.user.id);
  const poScope = await getPurchaseOrderScopeWhere(tenant.id, access.user.id, {
    isSupplierPortalUser,
  });
  const viewerMode: "supplier" | "buyer" = isSupplierPortalUser ? "supplier" : "buyer";
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
      ...(poScope ?? {}),
    },
    include: {
      status: { select: { id: true, code: true, label: true } },
      supplier: {
        select: {
          id: true,
          name: true,
          srmCategory: true,
          approvalStatus: true,
        },
      },
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
      shipments: {
        select: {
          salesOrderId: true,
          asnReference: true,
          expectedReceiveAt: true,
          booking: { select: { status: true } },
          items: {
            select: {
              quantityShipped: true,
              quantityReceived: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const latestSharedByOrder = new Map<
    string,
    {
      createdAt: Date;
      authorRoleNames: string[];
    }
  >();
  if (orders.length > 0) {
    const shared = await prisma.orderChatMessage.findMany({
      where: { orderId: { in: orders.map((o) => o.id) }, isInternal: false },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            userRoles: {
              select: { role: { select: { name: true } } },
            },
          },
        },
      },
    });
    for (const row of shared) {
      if (latestSharedByOrder.has(row.orderId)) continue;
      latestSharedByOrder.set(row.orderId, {
        createdAt: row.createdAt,
        authorRoleNames: row.author.userRoles.map((ur) => ur.role.name),
      });
    }
  }

  const initialData = {
    viewerMode,
    tenant,
    orders: orders.map((order) =>
      serializeOrderForBoard({
        order,
        latestShared: latestSharedByOrder.get(order.id),
        isSupplierPortalUser,
        supplierOnlyActionCodes,
        buyerOnlyActionCodes,
      }),
    ),
  };

  const canTransitionOrders = viewerHas(
    access.grantSet,
    "org.orders",
    "transition",
  );
  const canCreateOrders = viewerHas(access.grantSet, "org.orders", "edit");

  return (
    <div className="min-h-screen bg-zinc-50">
      <OrdersBoard
        initialData={initialData}
        canTransitionOrders={canTransitionOrders}
        canCreateOrders={canCreateOrders}
        defaultQueueFilter={initialQueue}
        defaultSortMode={initialSort}
        defaultFilterSupplierId={savedBoard.filterSupplierId}
        defaultFilterRequesterId={savedBoard.filterRequesterId}
        persistBoardPrefs
      />
    </div>
  );
}
