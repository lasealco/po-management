import type { SupplierQualificationStatus } from "@prisma/client";

import { DEFAULT_SUPPLIER_ONBOARDING_TASKS } from "@/lib/srm/ensure-supplier-onboarding-tasks";

const DEFAULT_KEYS = DEFAULT_SUPPLIER_ONBOARDING_TASKS.map((t) => t.taskKey);

function isDoneOrWaived(status: string | undefined): boolean {
  return status === "done" || status === "waived";
}

/**
 * Heuristic suggestion from checklist only — buyer `Supplier.qualificationStatus` remains authoritative.
 * - All default steps done/waived → qualified
 * - Any non-pending step but not fully complete → in_progress
 * - Otherwise → not_started
 */
export function suggestedQualificationStatusFromChecklist(
  tasks: { taskKey: string; status: string }[],
): SupplierQualificationStatus {
  const byKey = new Map(tasks.map((t) => [t.taskKey, t.status]));
  const allComplete = DEFAULT_KEYS.every((k) => isDoneOrWaived(byKey.get(k)));
  if (allComplete) return "qualified";

  const anyProgress = tasks.some((t) => t.status !== "pending");
  if (!anyProgress) return "not_started";
  return "in_progress";
}
