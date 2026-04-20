import { describe, expect, it } from "vitest";

import { canTransitionRunStatus, isValidRunStatus } from "./run-lifecycle";

describe("run lifecycle", () => {
  it("accepts only supported statuses", () => {
    expect(isValidRunStatus("queued")).toBe(true);
    expect(isValidRunStatus("running")).toBe(true);
    expect(isValidRunStatus("succeeded")).toBe(true);
    expect(isValidRunStatus("failed")).toBe(true);
    expect(isValidRunStatus("cancelled")).toBe(false);
  });

  it("enforces status transitions", () => {
    expect(canTransitionRunStatus("queued", "running")).toBe(true);
    expect(canTransitionRunStatus("queued", "failed")).toBe(true);
    expect(canTransitionRunStatus("running", "succeeded")).toBe(true);
    expect(canTransitionRunStatus("running", "failed")).toBe(true);
    expect(canTransitionRunStatus("queued", "succeeded")).toBe(false);
    expect(canTransitionRunStatus("failed", "queued")).toBe(false);
  });
});
