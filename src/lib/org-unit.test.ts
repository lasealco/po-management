import { describe, expect, it } from "vitest";

import { orgUnitReparentIsValid, normalizeOrgUnitCode } from "./org-unit";

describe("normalizeOrgUnitCode", () => {
  it("accepts valid codes", () => {
    expect(normalizeOrgUnitCode(" apac-1 ")).toEqual({ ok: true, code: "APAC-1" });
  });
  it("rejects short codes", () => {
    expect(normalizeOrgUnitCode("A").ok).toBe(false);
  });
});

describe("orgUnitReparentIsValid", () => {
  const flat = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "b" },
  ];
  it("allows null parent", () => {
    expect(orgUnitReparentIsValid(flat, "a", null)).toBe(true);
  });
  it("reparent under self", () => {
    expect(orgUnitReparentIsValid(flat, "a", "a")).toBe(false);
  });
  it("reparent under descendant", () => {
    expect(orgUnitReparentIsValid(flat, "a", "c")).toBe(false);
  });
  it("allows reparent to sibling", () => {
    expect(
      orgUnitReparentIsValid(
        [
          { id: "a", parentId: null },
          { id: "b1", parentId: "a" },
          { id: "b2", parentId: "a" },
        ],
        "b1",
        "b2",
      ),
    ).toBe(true);
  });
});
