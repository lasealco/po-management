import { notFound } from "next/navigation";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { WorkflowHeader } from "@/components/workflow-header";
import { SupplierDetailClient } from "@/components/supplier-detail-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { loadSupplierDetailSnapshot } from "@/lib/srm/load-supplier-detail-snapshot";
import { redactSupplierDetailSnapshot } from "@/lib/srm/redact-supplier-sensitive";
import { resolveSrmPermissions } from "@/lib/srm/permissions";
import { fetchSupplierOrderAnalytics } from "@/lib/supplier-order-analytics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
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
          title="Supplier"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.suppliers", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Supplier"
          message="You do not have permission to view suppliers."
        />
      </div>
    );
  }

  const { tenant } = access;

  const snapshot = await loadSupplierDetailSnapshot(prisma, tenant.id, id);
  if (!snapshot) notFound();

  const permissions = resolveSrmPermissions(access.grantSet);
  const canEdit = permissions.canEditSuppliers;
  const canApprove = permissions.canApproveSuppliers;
  const canViewSupplierSensitiveFields = permissions.canViewSupplierSensitiveFields;
  const canViewOrders = permissions.canViewOrders;
  const orderHistory = canViewOrders
    ? await fetchSupplierOrderAnalytics(prisma, tenant.id, snapshot.id)
    : null;

  const initialSnapshot = redactSupplierDetailSnapshot(snapshot, canViewSupplierSensitiveFields);

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm">
          <Link href="/suppliers" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            ← Suppliers
          </Link>
        </p>
        <div className="mt-3 mb-5">
          <WorkflowHeader
            eyebrow="Supplier governance workspace"
            title={snapshot.name}
            steps={["Step 1: Verify profile and contacts", "Step 2: Edit and approve", "Step 3: Review order performance"]}
          />
        </div>
        <SupplierDetailClient
          key={snapshot.id}
          initial={initialSnapshot}
          canEdit={canEdit}
          canApprove={canApprove}
          canViewSupplierSensitiveFields={canViewSupplierSensitiveFields}
          canViewOrders={canViewOrders}
          orderHistory={orderHistory}
          detailNavContext="suppliers"
        />
      </main>
    </div>
  );
}
