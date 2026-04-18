import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/access-denied";
import { SupplierDetailClient } from "@/components/supplier-detail-client";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { loadSupplierDetailSnapshot } from "@/lib/srm/load-supplier-detail-snapshot";
import { fetchSupplierOrderAnalytics } from "@/lib/supplier-order-analytics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SrmSupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getViewerGrantSet();
  if (!access) notFound();

  if (!access.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="SRM"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.suppliers", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="SRM"
          message="You do not have permission to view supplier data (org.suppliers → view)."
        />
      </div>
    );
  }

  const { tenant } = access;
  const snapshot = await loadSupplierDetailSnapshot(prisma, tenant.id, id);
  if (!snapshot) notFound();

  const kind = snapshot.srmCategory === "logistics" ? "logistics" : "product";
  const canEdit = viewerHas(access.grantSet, "org.suppliers", "edit");
  const canApprove = viewerHas(access.grantSet, "org.suppliers", "approve");
  const canViewOrders = viewerHas(access.grantSet, "org.orders", "view");
  const orderHistory = canViewOrders
    ? await fetchSupplierOrderAnalytics(prisma, tenant.id, snapshot.id)
    : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm">
          <Link
            href={`/srm?kind=${kind}`}
            className="font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            ← SRM · {kind === "logistics" ? "Logistics partners" : "Product suppliers"}
          </Link>
        </p>
        <div className="mt-3 mb-5">
          <WorkflowHeader
            eyebrow="SRM · Supplier 360"
            title={snapshot.name}
            steps={["Step 1: Profile & contacts", "Step 2: Approve & activate", "Step 3: Commercial & sites"]}
          />
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading supplier workspace…</p>}>
          <SupplierDetailClient
            key={snapshot.id}
            initial={snapshot}
            canEdit={canEdit}
            canApprove={canApprove}
            orderHistory={orderHistory}
            detailNavContext="srm"
          />
        </Suspense>
      </main>
    </div>
  );
}
