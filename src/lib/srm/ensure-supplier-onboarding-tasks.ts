import type { PrismaClient } from "@prisma/client";

/** Default checklist aligned with `srm_supplier_lifecycle_and_onboarding_spec.md`. */
export const DEFAULT_SUPPLIER_ONBOARDING_TASKS: Array<{ taskKey: string; label: string }> = [
  { taskKey: "legal_details_verified", label: "Supplier legal details verified" },
  { taskKey: "tax_banking_collected", label: "Tax and banking details collected" },
  { taskKey: "contacts_collected", label: "Required contacts collected" },
  { taskKey: "service_categories_defined", label: "Service categories and geographies defined" },
  { taskKey: "insurance_licenses_uploaded", label: "Insurance and licenses uploaded" },
  { taskKey: "sanctions_screening", label: "Sanctions and watchlist screening completed (where applicable)" },
  { taskKey: "qualification_questionnaire", label: "Qualification questionnaire completed" },
  { taskKey: "commercial_terms_summary", label: "Commercial terms captured at summary level" },
  { taskKey: "approval_chain", label: "Approval chain completed" },
  { taskKey: "activation_decision", label: "Activation decision logged" },
];

/**
 * Idempotently creates default onboarding tasks for a supplier (`skipDuplicates` on `supplierId` + `taskKey`).
 */
export async function ensureSupplierOnboardingTasks(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string,
): Promise<void> {
  await prisma.supplierOnboardingTask.createMany({
    data: DEFAULT_SUPPLIER_ONBOARDING_TASKS.map((t, i) => ({
      tenantId,
      supplierId,
      taskKey: t.taskKey,
      label: t.label,
      sortOrder: i,
    })),
    skipDuplicates: true,
  });
}
