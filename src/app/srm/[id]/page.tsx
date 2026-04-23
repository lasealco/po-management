import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { SupplierDetailClient } from "@/components/supplier-detail-client";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet } from "@/lib/authz";
import { loadSupplierDetailSnapshot } from "@/lib/srm/load-supplier-detail-snapshot";
import { redactSupplierDetailSnapshot } from "@/lib/srm/redact-supplier-sensitive";
import { resolveSrmPermissions } from "@/lib/srm/permissions";
import { fetchSupplierOrderAnalytics } from "@/lib/supplier-order-analytics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SRM_TAB_IDS = new Set([
  "overview",
  "contacts",
  "capabilities",
  "onboarding",
  "orders",
  "compliance",
  "activity",
]);

export default async function SrmSupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const raw = sp.tab;
  const tabParam = Array.isArray(raw) ? raw[0] : raw;
  const initialSrmTab =
    typeof tabParam === "string" && SRM_TAB_IDS.has(tabParam)
      ? (tabParam as
          | "overview"
          | "contacts"
          | "capabilities"
          | "onboarding"
          | "orders"
          | "compliance"
          | "activity")
      : undefined;
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

  const permissions = resolveSrmPermissions(access.grantSet);

  if (!permissions.canViewSuppliers) {
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
  const canEdit = permissions.canEditSuppliers;
  const canApprove = permissions.canApproveSuppliers;
  const canViewSupplierSensitiveFields = permissions.canViewSupplierSensitiveFields;
  const canViewOrders = permissions.canViewOrders;
  const initialSnapshot = redactSupplierDetailSnapshot(snapshot, canViewSupplierSensitiveFields);
  const orderHistory = canViewOrders
    ? await fetchSupplierOrderAnalytics(prisma, tenant.id, snapshot.id)
    : null;

  const onboardingAssigneeOptions = await prisma.user.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

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
        <SupplierDetailClient
          key={snapshot.id}
          initial={initialSnapshot}
          canEdit={canEdit}
          canApprove={canApprove}
          canViewSupplierSensitiveFields={canViewSupplierSensitiveFields}
          orderHistory={orderHistory}
          detailNavContext="srm"
          onboardingAssigneeOptions={onboardingAssigneeOptions}
          viewerUserId={access.user.id}
          initialSrmTab={initialSrmTab}
        />
      </main>
    </div>
  );
}
