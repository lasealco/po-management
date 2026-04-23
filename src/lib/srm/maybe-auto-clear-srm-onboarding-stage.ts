import type { PrismaClient } from "@prisma/client";
import type { SrmOnboardingStage } from "@prisma/client";

/**
 * Phase G-v1: when every onboarding task for the supplier is `done` and the
 * pipeline was not already `cleared`, set `Supplier.srmOnboardingStage` to `cleared`
 * (operator can still move stage manually before that if needed).
 */
export async function maybeAutoClearSrmOnboardingStage(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string,
): Promise<{ srmOnboardingStage: SrmOnboardingStage; didAutoAdvance: boolean }> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    select: { srmOnboardingStage: true },
  });
  if (!supplier) {
    return { srmOnboardingStage: "intake", didAutoAdvance: false };
  }
  if (supplier.srmOnboardingStage === "cleared") {
    return { srmOnboardingStage: supplier.srmOnboardingStage, didAutoAdvance: false };
  }

  const tasks = await prisma.supplierOnboardingTask.findMany({
    where: { tenantId, supplierId },
    select: { done: true },
  });
  if (tasks.length === 0) {
    return { srmOnboardingStage: supplier.srmOnboardingStage, didAutoAdvance: false };
  }
  if (!tasks.every((t) => t.done)) {
    return { srmOnboardingStage: supplier.srmOnboardingStage, didAutoAdvance: false };
  }

  const next = await prisma.supplier.update({
    where: { id: supplierId },
    data: { srmOnboardingStage: "cleared" },
    select: { srmOnboardingStage: true },
  });
  return { srmOnboardingStage: next.srmOnboardingStage, didAutoAdvance: true };
}
