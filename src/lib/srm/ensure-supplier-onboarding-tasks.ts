import type { PrismaClient } from "@prisma/client";

export const SUPPLIER_ONBOARDING_DEFAULTS = [
  { taskKey: "supplier_profile", title: "Verify company profile and tax ID", sortOrder: 10 },
  { taskKey: "bank_payment", title: "Collect bank / payment details", sortOrder: 20 },
  { taskKey: "insurance_docs", title: "Insurance or liability documentation", sortOrder: 30 },
  { taskKey: "code_of_conduct", title: "Code of conduct / compliance acknowledgment", sortOrder: 40 },
] as const;

/** Idempotent: inserts default checklist rows once per supplier. */
export async function ensureSupplierOnboardingTasks(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string,
): Promise<void> {
  await prisma.supplierOnboardingTask.createMany({
    data: SUPPLIER_ONBOARDING_DEFAULTS.map((d) => ({
      tenantId,
      supplierId,
      taskKey: d.taskKey,
      title: d.title,
      sortOrder: d.sortOrder,
    })),
    skipDuplicates: true,
  });
}
