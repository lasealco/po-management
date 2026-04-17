import { notFound } from "next/navigation";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { WorkflowHeader } from "@/components/workflow-header";
import {
  SupplierDetailClient,
  type SupplierDetailSnapshot,
} from "@/components/supplier-detail-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
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

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      offices: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          city: true,
          countryCode: true,
          isActive: true,
        },
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          title: true,
          role: true,
          email: true,
          phone: true,
          notes: true,
          isPrimary: true,
        },
      },
      _count: { select: { productSuppliers: true, orders: true } },
    },
  });

  if (!supplier) notFound();

  const snapshot: SupplierDetailSnapshot = {
    id: supplier.id,
    updatedAt: supplier.updatedAt.toISOString(),
    name: supplier.name,
    code: supplier.code,
    email: supplier.email,
    phone: supplier.phone,
    isActive: supplier.isActive,
    srmCategory: supplier.srmCategory === "logistics" ? "logistics" : "product",
    approvalStatus:
      supplier.approvalStatus === "pending_approval"
        ? "pending_approval"
        : supplier.approvalStatus === "rejected"
          ? "rejected"
          : "approved",
    legalName: supplier.legalName,
    taxId: supplier.taxId,
    website: supplier.website,
    registeredAddressLine1: supplier.registeredAddressLine1,
    registeredAddressLine2: supplier.registeredAddressLine2,
    registeredCity: supplier.registeredCity,
    registeredRegion: supplier.registeredRegion,
    registeredPostalCode: supplier.registeredPostalCode,
    registeredCountryCode: supplier.registeredCountryCode,
    paymentTermsDays: supplier.paymentTermsDays,
    paymentTermsLabel: supplier.paymentTermsLabel,
    creditLimit: supplier.creditLimit?.toString() ?? null,
    creditCurrency: supplier.creditCurrency,
    defaultIncoterm: supplier.defaultIncoterm,
    internalNotes: supplier.internalNotes,
    contacts: supplier.contacts,
    offices: supplier.offices,
    productLinkCount: supplier._count.productSuppliers,
    orderCount: supplier._count.orders,
  };

  const canEdit = viewerHas(access.grantSet, "org.suppliers", "edit");
  const canApprove = viewerHas(access.grantSet, "org.suppliers", "approve");
  const canViewOrders = viewerHas(access.grantSet, "org.orders", "view");
  const orderHistory = canViewOrders
    ? await fetchSupplierOrderAnalytics(prisma, tenant.id, supplier.id)
    : null;

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
            title={supplier.name}
            steps={["Step 1: Verify profile and contacts", "Step 2: Edit and approve", "Step 3: Review order performance"]}
          />
        </div>
        <SupplierDetailClient
          key={supplier.id}
          initial={snapshot}
          canEdit={canEdit}
          canApprove={canApprove}
          orderHistory={orderHistory}
        />
      </main>
    </div>
  );
}
