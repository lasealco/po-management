import { describe, expect, it } from "vitest";

import { DEFAULT_SUPPLIER_ONBOARDING_TASKS } from "./ensure-supplier-onboarding-tasks";
import { suggestedQualificationStatusFromChecklist } from "./supplier-qualification-suggest";

describe("suggestedQualificationStatusFromChecklist", () => {
  it("returns not_started when every task is pending", () => {
    const tasks = DEFAULT_SUPPLIER_ONBOARDING_TASKS.map((t) => ({
      taskKey: t.taskKey,
      status: "pending",
    }));
    expect(suggestedQualificationStatusFromChecklist(tasks)).toBe("not_started");
  });

  it("returns in_progress when some steps complete", () => {
    const tasks = DEFAULT_SUPPLIER_ONBOARDING_TASKS.map((t, i) => ({
      taskKey: t.taskKey,
      status: i < 2 ? "done" : "pending",
    }));
    expect(suggestedQualificationStatusFromChecklist(tasks)).toBe("in_progress");
  });

  it("returns qualified when all default keys are done or waived", () => {
    const tasks = DEFAULT_SUPPLIER_ONBOARDING_TASKS.map((t, i) => ({
      taskKey: t.taskKey,
      status: i === 5 ? "waived" : "done",
    }));
    expect(suggestedQualificationStatusFromChecklist(tasks)).toBe("qualified");
  });
});
