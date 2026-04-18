/** Done or waived counts as complete for supplier activation / approval gates. */
function isDoneOrWaived(status: string): boolean {
  return status === "done" || status === "waived";
}

/**
 * Supplier may be set to approved + active only when every onboarding checklist row is done or waived.
 * Used by approval POST and supplier PATCH when transitioning into fully activated state.
 */
export function assertOnboardingCompleteForApprovedActivation(
  tasks: { status: string }[],
): { ok: true } | { ok: false; message: string } {
  if (tasks.length === 0) {
    return {
      ok: false,
      message:
        "Onboarding checklist is not ready yet. Reload the supplier profile, then complete the checklist.",
    };
  }
  const pending = tasks.filter((t) => !isDoneOrWaived(String(t.status)));
  if (pending.length === 0) return { ok: true };
  return {
    ok: false,
    message: `Complete or waive every onboarding checklist item before activating this supplier (${pending.length} still open). Use the Onboarding tab.`,
  };
}
