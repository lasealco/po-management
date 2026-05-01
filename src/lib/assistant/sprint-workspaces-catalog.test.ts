import { describe, expect, it } from "vitest";

import { pathnameMatchesProgramTrackWorkspace, SPRINT_WORKSPACE_ENTRIES } from "./sprint-workspaces-catalog";

describe("sprint-workspaces-catalog", () => {
  it("includes contiguous sprint rows including bridge 22–24", () => {
    expect(SPRINT_WORKSPACE_ENTRIES.map((e) => e.sprintLabel)).toEqual([
      "Sprint 1",
      "Sprint 2",
      "Sprint 3",
      "Sprint 4",
      "Sprint 5",
      "Sprint 6",
      "Sprint 7",
      "Sprint 8",
      "Sprint 9",
      "Sprint 10",
      "Sprint 11",
      "Sprint 12",
      "Sprint 13",
      "Sprint 14",
      "Sprint 15",
      "Sprint 16",
      "Sprint 17",
      "Sprint 18",
      "Sprint 19",
      "Sprint 20",
      "Sprint 21",
      "Sprint 22",
      "Sprint 23",
      "Sprint 24",
      "Sprint 25",
    ]);
  });

  it("matches program track paths for active nav state", () => {
    expect(pathnameMatchesProgramTrackWorkspace("/assistant/agent-governance")).toBe(true);
    expect(pathnameMatchesProgramTrackWorkspace("/assistant/planning-bridge")).toBe(true);
    expect(pathnameMatchesProgramTrackWorkspace("/assistant/sprint-workspaces")).toBe(false);
    expect(pathnameMatchesProgramTrackWorkspace("/assistant")).toBe(false);
  });
});
