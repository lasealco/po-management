import { describe, expect, it } from "vitest";

import { compositeIncotermRoleHints, suggestedCompositeRolesFromIncoterm } from "./composite-incoterm-suggestions";

describe("compositeIncotermRoleHints", () => {
  it("returns null for blank", () => {
    expect(compositeIncotermRoleHints("")).toBeNull();
    expect(compositeIncotermRoleHints("   ")).toBeNull();
  });

  it("returns guidance for FOB", () => {
    const h = compositeIncotermRoleHints("fob");
    expect(h).toContain("FORWARDER_HANDLING");
    expect(h).toContain("PRE_CARRIAGE");
  });

  it("returns null for unknown terms", () => {
    expect(compositeIncotermRoleHints("ZZZ")).toBeNull();
  });
});

describe("suggestedCompositeRolesFromIncoterm", () => {
  it("returns FOB handling stack", () => {
    expect(suggestedCompositeRolesFromIncoterm("FOB")).toEqual(["FORWARDER_HANDLING", "PRE_CARRIAGE"]);
  });

  it("returns empty for unknown", () => {
    expect(suggestedCompositeRolesFromIncoterm("ZZZ")).toEqual([]);
  });
});
