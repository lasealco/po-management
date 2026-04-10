import { Suspense } from "react";
import { AccessDenied } from "@/components/access-denied";
import { OrderDetail } from "@/components/order-detail";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getViewerGrantSet();

  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Order detail"
          message="Choose a demo user in the header to view this order."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Order detail"
          message="You do not have permission to view orders."
        />
      </div>
    );
  }

  const canTransition = viewerHas(
    access.grantSet,
    "org.orders",
    "transition",
  );
  const canSplit = viewerHas(access.grantSet, "org.orders", "split");
  const canEditHeader = viewerHas(access.grantSet, "org.orders", "edit");
  const canViewProducts = viewerHas(access.grantSet, "org.products", "view");

  return (
    <div className="min-h-screen bg-zinc-50">
      <Suspense
        fallback={
          <div className="px-6 py-16 text-sm text-zinc-600">Loading order…</div>
        }
      >
        <OrderDetail
          orderId={id}
          canTransition={canTransition}
          canSplit={canSplit}
          canEditHeader={canEditHeader}
          canViewProducts={canViewProducts}
          canViewInternalNotes={canEditHeader}
        />
      </Suspense>
    </div>
  );
}
