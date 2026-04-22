import { describe, expect, it } from "vitest";

import { ctSlaBreachedSeverityBranches } from "./sla-breach-where";

describe("ctSlaBreachedSeverityBranches", () => {
  it("returns three severity branches with createdAt lt aligned to SLA hours", () => {
    const now = new Date("2025-03-01T12:00:00.000Z");
    const branches = ctSlaBreachedSeverityBranches(now);
    expect(branches).toHaveLength(3);
    expect(branches.map((b) => b.severity)).toEqual(["CRITICAL", "WARN", "INFO"]);

    const critLt = branches[0].createdAt.lt;
    const warnLt = branches[1].createdAt.lt;
    const infoLt = branches[2].createdAt.lt;

    expect(critLt.getTime()).toBe(now.getTime() - 24 * 3_600_000);
    expect(warnLt.getTime()).toBe(now.getTime() - 48 * 3_600_000);
    expect(infoLt.getTime()).toBe(now.getTime() - 72 * 3_600_000);
  });
});
