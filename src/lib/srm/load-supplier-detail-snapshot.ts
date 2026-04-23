import type { SupplierDetailSnapshot } from "@/components/supplier-detail-client";
import type { PrismaClient } from "@prisma/client";
import { ensureSupplierOnboardingTasks } from "@/lib/srm/ensure-supplier-onboarding-tasks";

/**
 * Loads supplier + offices + contacts for SRM / supplier 360 pages.
 * Single query used by `/suppliers/[id]` and `/srm/[id]`.
 */
export async function loadSupplierDetailSnapshot(
  prisma: PrismaClient,
  tenantId: string,
  id: string,
): Promise<SupplierDetailSnapshot | null> {
  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId },
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
      serviceCapabilities: {
        orderBy: [{ serviceType: "asc" }, { id: "asc" }],
        select: {
          id: true,
          mode: true,
          subMode: true,
          serviceType: true,
          geography: true,
          notes: true,
        },
      },
      _count: { select: { productSuppliers: true, orders: true } },
    },
  });

  if (!supplier) return null;

  await ensureSupplierOnboardingTasks(prisma, tenantId, supplier.id);

  return {
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
    bookingConfirmationSlaHours: supplier.bookingConfirmationSlaHours ?? null,
    contacts: supplier.contacts,
    offices: supplier.offices,
    capabilities: supplier.serviceCapabilities.map((c) => ({
      id: c.id,
      mode: c.mode,
      subMode: c.subMode,
      serviceType: c.serviceType,
      geography: c.geography,
      notes: c.notes,
    })),
    productLinkCount: supplier._count.productSuppliers,
    orderCount: supplier._count.orders,
  };
}
