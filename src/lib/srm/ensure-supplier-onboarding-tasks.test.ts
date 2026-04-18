import { describe, expect, it } from "vitest";

import { DEFAULT_SUPPLIER_ONBOARDING_TASKS } from "./ensure-supplier-onboarding-tasks";

describe("DEFAULT_SUPPLIER_ONBOARDING_TASKS", () => {
  it("defines 10 lifecycle checklist items with unique taskKey", () => {
    expect(DEFAULT_SUPPLIER_ONBOARDING_TASKS).toHaveLength(10);
    const keys = DEFAULT_SUPPLIER_ONBOARDING_TASKS.map((t) => t.taskKey);
    expect(new Set(keys).size).toBe(10);
  });

  it("has non-empty labels", () => {
    for (const row of DEFAULT_SUPPLIER_ONBOARDING_TASKS) {
      expect(row.label.trim().length).toBeGreaterThan(0);
      expect(row.taskKey.trim().length).toBeGreaterThan(0);
    }
  });
});
