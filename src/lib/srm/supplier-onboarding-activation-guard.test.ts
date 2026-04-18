import { describe, expect, it } from "vitest";

import { assertOnboardingCompleteForApprovedActivation } from "./supplier-onboarding-activation-guard";

describe("assertOnboardingCompleteForApprovedActivation", () => {
  it("allows when all tasks are done or waived", () => {
    const r = assertOnboardingCompleteForApprovedActivation([
      { status: "done", taskKey: "a" },
      { status: "waived", taskKey: "b" },
      { status: "done", taskKey: "c" },
    ]);
    expect(r.ok).toBe(true);
  });

  it("rejects when any task is pending", () => {
    const r = assertOnboardingCompleteForApprovedActivation([
      { status: "done", taskKey: "a", label: "A", sortOrder: 0 },
      { status: "pending", taskKey: "b", label: "B", sortOrder: 1 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.pendingCount).toBe(1);
      expect(r.pendingTasks).toEqual([{ taskKey: "b", label: "B" }]);
    }
  });

  it("rejects empty checklist", () => {
    const r = assertOnboardingCompleteForApprovedActivation([]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.pendingTasks).toEqual([]);
    }
  });
});
