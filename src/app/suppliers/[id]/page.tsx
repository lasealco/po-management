import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import {
  SupplierDetailClient,
  type SupplierDetailSnapshot,
} from "@/components/supplier-detail-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
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
          message="Choose a demo user in the header."
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <SupplierDetailClient
          key={supplier.id}
          initial={snapshot}
          canEdit={canEdit}
        />
      </main>
    </div>
  );
}
