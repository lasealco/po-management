import { describe, expect, it } from "vitest";

import { computeCtMilestoneSummary } from "./milestone-summary";

describe("computeCtMilestoneSummary", () => {
  const fixedNow = new Date("2026-06-15T12:00:00.000Z");

  it("returns zeros when all milestones are complete", () => {
    const r = computeCtMilestoneSummary(
      [
        {
          code: "A",
          label: "One",
          plannedAt: "2026-06-01T00:00:00.000Z",
          predictedAt: null,
          actualAt: "2026-06-02T00:00:00.000Z",
        },
      ],
      fixedNow,
    );
    expect(r).toEqual({ openCount: 0, lateCount: 0, next: null });
  });

  it("counts late open milestones by planned date before now", () => {
    const r = computeCtMilestoneSummary(
      [
        {
          code: "LATE",
          label: null,
          plannedAt: "2026-06-01T00:00:00.000Z",
          predictedAt: null,
          actualAt: null,
        },
        {
          code: "FUTURE",
          label: null,
          plannedAt: "2026-07-01T00:00:00.000Z",
          predictedAt: null,
          actualAt: null,
        },
      ],
      fixedNow,
    );
    expect(r.openCount).toBe(2);
    expect(r.lateCount).toBe(1);
    expect(r.next?.code).toBe("LATE");
    expect(r.next?.isLate).toBe(true);
  });

  it("uses predictedAt when plannedAt is missing for due ordering", () => {
    const r = computeCtMilestoneSummary(
      [
        {
          code: "SECOND",
          label: null,
          plannedAt: null,
          predictedAt: "2026-07-20T00:00:00.000Z",
          actualAt: null,
        },
        {
          code: "FIRST",
          label: null,
          plannedAt: null,
          predictedAt: "2026-07-10T00:00:00.000Z",
          actualAt: null,
        },
      ],
      fixedNow,
    );
    expect(r.next?.code).toBe("FIRST");
    expect(r.next?.isLate).toBe(false);
  });

  it("treats invalid date strings as no due time for lateness", () => {
    const r = computeCtMilestoneSummary(
      [
        {
          code: "BAD",
          label: null,
          plannedAt: "not-a-date",
          predictedAt: null,
          actualAt: null,
        },
      ],
      fixedNow,
    );
    expect(r.openCount).toBe(1);
    expect(r.lateCount).toBe(0);
  });
});
