import { describe, expect, it } from "vitest";

import {
  computeDueAtFromSla,
  isStaleWork,
  normalizePlaybookSteps,
  parseAssistantActionStatus,
  parseAssistantWorkPriority,
} from "./work-engine";

describe("assistant work engine helpers", () => {
  it("normalizes priorities and action statuses", () => {
    expect(parseAssistantWorkPriority("urgent")).toBe("URGENT");
    expect(parseAssistantWorkPriority("bad")).toBe("MEDIUM");
    expect(parseAssistantActionStatus("done")).toBe("DONE");
    expect(parseAssistantActionStatus("open")).toBeNull();
  });

  it("validates playbook step templates", () => {
    expect(
      normalizePlaybookSteps([
        { title: "Review evidence", status: "needs_review" },
        { title: "" },
      ]),
    ).toEqual([{ id: "step-1", title: "Review evidence", description: undefined, status: "needs_review", note: undefined }]);
  });

  it("computes SLA due dates and stale work", () => {
    const start = new Date("2026-04-28T00:00:00.000Z");
    expect(computeDueAtFromSla(start, 6)?.toISOString()).toBe("2026-04-28T06:00:00.000Z");
    expect(isStaleWork(new Date("2026-04-28T07:00:00.000Z"), "2026-04-28T06:00:00.000Z", "PENDING")).toBe(true);
    expect(isStaleWork(new Date("2026-04-28T07:00:00.000Z"), "2026-04-28T06:00:00.000Z", "DONE")).toBe(false);
  });
});
