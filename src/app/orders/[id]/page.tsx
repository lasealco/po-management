import { Suspense } from "react";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { OrderDetail } from "@/components/order-detail";
import { WorkflowHeader } from "@/components/workflow-header";
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
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
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
      <main className="mx-auto w-full max-w-7xl px-6 pt-8">
        <p className="text-sm">
          <Link href="/orders" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            ← Orders
          </Link>
        </p>
        <div className="mt-3">
          <WorkflowHeader
            eyebrow="Order execution workspace"
            title="Purchase order detail"
            steps={["Step 1: Validate order data", "Step 2: Take transition actions", "Step 3: Confirm shipment flow"]}
          />
        </div>
      </main>
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
