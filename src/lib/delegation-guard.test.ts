import { describe, expect, it } from "vitest";

import { isTargetPrimaryOrgAllowed } from "./delegation-guard";

describe("isTargetPrimaryOrgAllowed", () => {
  const rows = [
    { id: "hq", parentId: null as string | null },
    { id: "us", parentId: "hq" },
    { id: "ca", parentId: "us" },
  ];

  it("allows null target only when the actor has no org", () => {
    expect(isTargetPrimaryOrgAllowed(null, null, rows)).toBe(true);
    expect(isTargetPrimaryOrgAllowed("us", null, rows)).toBe(false);
  });

  it("when the actor has no org, any non-null org id passes the tree rule", () => {
    expect(isTargetPrimaryOrgAllowed(null, "ca", rows)).toBe(true);
  });

  it("restricts a placed actor to their subtree (including self)", () => {
    expect(isTargetPrimaryOrgAllowed("us", "us", rows)).toBe(true);
    expect(isTargetPrimaryOrgAllowed("us", "ca", rows)).toBe(true);
    expect(isTargetPrimaryOrgAllowed("us", "hq", rows)).toBe(false);
  });
});
