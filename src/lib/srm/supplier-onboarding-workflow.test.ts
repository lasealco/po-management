import { describe, expect, it } from "vitest";

import {
  assertOnboardingStatusChangeAllowed,
  computeOnboardingProgress,
} from "./supplier-onboarding-workflow";

describe("computeOnboardingProgress", () => {
  it("counts done and waived and finds first pending", () => {
    const tasks = [
      { taskKey: "a", status: "done", label: "A" },
      { taskKey: "b", status: "waived", label: "B" },
      { taskKey: "c", status: "pending", label: "C" },
    ];
    const p = computeOnboardingProgress(tasks);
    expect(p.total).toBe(3);
    expect(p.doneOrWaived).toBe(2);
    expect(p.firstPending).toEqual({ taskKey: "c", label: "C" });
  });
});

describe("assertOnboardingStatusChangeAllowed", () => {
  it("blocks activation_decision done without approval_chain complete", () => {
    const tasks = [
      { taskKey: "approval_chain", status: "pending" },
      { taskKey: "activation_decision", status: "pending" },
    ];
    const r = assertOnboardingStatusChangeAllowed("activation_decision", "done", tasks);
    expect(r.ok).toBe(false);
  });

  it("allows activation_decision done when approval_chain is done", () => {
    const tasks = [
      { taskKey: "approval_chain", status: "done" },
      { taskKey: "activation_decision", status: "pending" },
    ];
    expect(assertOnboardingStatusChangeAllowed("activation_decision", "done", tasks).ok).toBe(true);
  });

  it("allows activation_decision done when approval_chain is waived", () => {
    const tasks = [{ taskKey: "approval_chain", status: "waived" }];
    expect(assertOnboardingStatusChangeAllowed("activation_decision", "done", tasks).ok).toBe(true);
  });
});
