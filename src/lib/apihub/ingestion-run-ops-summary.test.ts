import { describe, expect, it } from "vitest";

import {
  emptyIngestionRunOpsByStatus,
  ingestionRunOpsFromGroupBy,
  sumIngestionRunOpsByStatus,
} from "./ingestion-run-ops-summary";

describe("ingestionRunOpsFromGroupBy", () => {
  it("maps groupBy rows and ignores unknown statuses", () => {
    const out = ingestionRunOpsFromGroupBy([
      { status: "queued", _count: { _all: 2 } },
      { status: "running", _count: { _all: 1 } },
      { status: "bogus", _count: { _all: 99 } },
    ]);
    expect(out).toEqual({
      queued: 2,
      running: 1,
      succeeded: 0,
      failed: 0,
    });
  });

  it("sums counts", () => {
    expect(sumIngestionRunOpsByStatus(emptyIngestionRunOpsByStatus())).toBe(0);
    expect(
      sumIngestionRunOpsByStatus({
        queued: 1,
        running: 2,
        succeeded: 3,
        failed: 4,
      }),
    ).toBe(10);
  });
});
