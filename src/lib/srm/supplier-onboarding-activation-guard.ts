/** Done or waived counts as complete for supplier activation / approval gates. */
function isDoneOrWaived(status: string): boolean {
  return status === "done" || status === "waived";
}

export type OnboardingActivationTaskInput = {
  status: string;
  taskKey?: string;
  label?: string | null;
  sortOrder?: number;
};

export type OnboardingPendingTask = { taskKey: string; label: string };

/**
 * Supplier may be set to approved + active only when every onboarding checklist row is done or waived.
 * Used by approval POST and supplier PATCH when transitioning into fully activated state.
 */
export function assertOnboardingCompleteForApprovedActivation(
  tasks: OnboardingActivationTaskInput[],
):
  | { ok: true }
  | {
      ok: false;
      message: string;
      pendingCount: number;
      pendingTasks: OnboardingPendingTask[];
    } {
  if (tasks.length === 0) {
    return {
      ok: false,
      message:
        "Onboarding checklist is not ready yet. Reload the supplier profile, then complete the checklist.",
      pendingCount: 0,
      pendingTasks: [],
    };
  }
  const pending = tasks.filter((t) => !isDoneOrWaived(String(t.status)));
  if (pending.length === 0) return { ok: true };

  const pendingTasks: OnboardingPendingTask[] = [...pending]
    .sort((a, b) => {
      const ao = a.sortOrder ?? 9999;
      const bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return String(a.taskKey ?? "").localeCompare(String(b.taskKey ?? ""));
    })
    .map((t) => ({
      taskKey: t.taskKey ?? "unknown",
      label: (t.label && t.label.trim()) || t.taskKey || "Onboarding item",
    }));

  return {
    ok: false,
    message: `Complete or waive every onboarding checklist item before activating this supplier (${pending.length} still open). Use the Onboarding tab.`,
    pendingCount: pending.length,
    pendingTasks,
  };
}
