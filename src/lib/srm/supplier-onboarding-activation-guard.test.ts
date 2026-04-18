import { describe, expect, it } from "vitest";

import { assertOnboardingCompleteForApprovedActivation } from "./supplier-onboarding-activation-guard";

describe("assertOnboardingCompleteForApprovedActivation", () => {
  it("allows when all tasks are done or waived", () => {
    const r = assertOnboardingCompleteForApprovedActivation([
      { status: "done" },
      { status: "waived" },
      { status: "done" },
    ]);
    expect(r.ok).toBe(true);
  });

  it("rejects when any task is pending", () => {
    const r = assertOnboardingCompleteForApprovedActivation([
      { status: "done" },
      { status: "pending" },
    ]);
    expect(r.ok).toBe(false);
  });

  it("rejects empty checklist", () => {
    const r = assertOnboardingCompleteForApprovedActivation([]);
    expect(r.ok).toBe(false);
  });
});
