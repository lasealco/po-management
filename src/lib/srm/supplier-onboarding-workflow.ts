import type { SupplierOnboardingTaskStatus } from "@prisma/client";

export type OnboardingTaskKeyStatus = {
  taskKey: string;
  status: SupplierOnboardingTaskStatus | string;
  label?: string;
};

function isDoneOrWaived(status: string): boolean {
  return status === "done" || status === "waived";
}

/** Progress counts for UI (checklist order is caller’s array order). */
export function computeOnboardingProgress(tasksOrdered: OnboardingTaskKeyStatus[]): {
  total: number;
  doneOrWaived: number;
  firstPending: { taskKey: string; label: string | null } | null;
} {
  const total = tasksOrdered.length;
  let doneOrWaived = 0;
  let firstPending: { taskKey: string; label: string | null } | null = null;
  for (const t of tasksOrdered) {
    if (isDoneOrWaived(String(t.status))) {
      doneOrWaived += 1;
    } else if (!firstPending) {
      firstPending = { taskKey: t.taskKey, label: t.label ?? null };
    }
  }
  return { total, doneOrWaived, firstPending };
}

/**
 * Lightweight workflow rule: activation cannot be marked done until approval chain is done or waived.
 */
export function assertOnboardingStatusChangeAllowed(
  taskKey: string,
  nextStatus: SupplierOnboardingTaskStatus | string,
  allTasks: OnboardingTaskKeyStatus[],
): { ok: true } | { ok: false; message: string } {
  if (nextStatus !== "done") return { ok: true };
  if (taskKey !== "activation_decision") return { ok: true };
  const approval = allTasks.find((x) => x.taskKey === "approval_chain");
  if (!approval || !isDoneOrWaived(String(approval.status))) {
    return {
      ok: false,
      message:
        "Complete or waive the approval chain task before logging the activation decision as done.",
    };
  }
  return { ok: true };
}
