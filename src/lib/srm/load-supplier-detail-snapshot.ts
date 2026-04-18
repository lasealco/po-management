import type { SupplierDetailSnapshot } from "@/components/supplier-detail-client";
import { ensureSupplierOnboardingTasks } from "@/lib/srm/ensure-supplier-onboarding-tasks";
import { computeOnboardingProgress } from "@/lib/srm/supplier-onboarding-workflow";
import { suggestedQualificationStatusFromChecklist } from "@/lib/srm/supplier-qualification-suggest";
import type { PrismaClient } from "@prisma/client";

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
  const onboardingTasks = await prisma.supplierOnboardingTask.findMany({
    where: { supplierId: supplier.id, tenantId },
    orderBy: [{ sortOrder: "asc" }, { taskKey: "asc" }],
    select: {
      id: true,
      taskKey: true,
      label: true,
      sortOrder: true,
      status: true,
      notes: true,
      completedAt: true,
    },
  });

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
    onboardingTasks: onboardingTasks.map((t) => ({
      id: t.id,
      taskKey: t.taskKey,
      label: t.label,
      sortOrder: t.sortOrder,
      status: t.status as "pending" | "done" | "waived",
      notes: t.notes,
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
    onboardingWorkflow: (() => {
      const wf = computeOnboardingProgress(
        onboardingTasks.map((t) => ({
          taskKey: t.taskKey,
          status: t.status,
          label: t.label,
        })),
      );
      return {
        completedCount: wf.doneOrWaived,
        totalCount: wf.total,
        nextTaskLabel: wf.firstPending?.label ?? null,
        nextTaskKey: wf.firstPending?.taskKey ?? null,
      };
    })(),
    qualification: {
      status: supplier.qualificationStatus,
      summary: supplier.qualificationSummary,
      lastReviewedAt: supplier.qualificationLastReviewedAt?.toISOString() ?? null,
      suggestedStatus: suggestedQualificationStatusFromChecklist(
        onboardingTasks.map((t) => ({ taskKey: t.taskKey, status: t.status })),
      ),
    },
    productLinkCount: supplier._count.productSuppliers,
    orderCount: supplier._count.orders,
  };
}
