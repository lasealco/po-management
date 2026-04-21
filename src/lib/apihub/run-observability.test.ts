import { describe, expect, it, vi } from "vitest";

import { buildApiHubRunObservability, computeApiHubRunDerivedTimings } from "./run-observability";

describe("computeApiHubRunDerivedTimings", () => {
  it("computes deterministic timings", () => {
    const row = {
      id: "r1",
      attempt: 1,
      maxAttempts: 3,
      enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
      startedAt: new Date("2026-04-22T10:00:10.000Z"),
      finishedAt: new Date("2026-04-22T10:00:40.000Z"),
    };
    const out = computeApiHubRunDerivedTimings(row, new Date("2026-04-22T10:01:00.000Z"));
    expect(out.queueWaitMs).toBe(10_000);
    expect(out.runMs).toBe(30_000);
    expect(out.totalMs).toBe(40_000);
    expect(out.ageMs).toBe(40_000);
  });

  it("uses now when run is not finished", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T10:00:30.000Z"));
    const out = computeApiHubRunDerivedTimings({
      id: "r2",
      attempt: 1,
      maxAttempts: 3,
      enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
      startedAt: null,
      finishedAt: null,
    });
    expect(out.ageMs).toBe(30_000);
    expect(out.queueWaitMs).toBeNull();
    expect(out.runMs).toBeNull();
    expect(out.totalMs).toBeNull();
    vi.useRealTimers();
  });
});

describe("buildApiHubRunObservability", () => {
  it("includes retry counters and timings", () => {
    const out = buildApiHubRunObservability({
      row: {
        id: "r3",
        attempt: 2,
        maxAttempts: 3,
        enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
        startedAt: null,
        finishedAt: null,
      },
      retryDepth: 1,
      rootRunId: "root-1",
      now: new Date("2026-04-22T10:00:01.000Z"),
    });
    expect(out.retries).toEqual({ retryDepth: 1, rootRunId: "root-1", remainingAttempts: 1 });
    expect(out.timings.ageMs).toBe(1000);
  });
});
