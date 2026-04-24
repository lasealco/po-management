import { describe, expect, it } from "vitest";

import { orgUnitSubtreeIds } from "./org-scope";

describe("orgUnitSubtreeIds", () => {
  const rows = [
    { id: "g", parentId: null },
    { id: "a", parentId: "g" },
    { id: "b", parentId: "g" },
    { id: "us", parentId: "a" },
  ];

  it("returns root and descendants", () => {
    const s = new Set(orgUnitSubtreeIds(rows, "g"));
    expect(s.has("g")).toBe(true);
    expect(s.has("a")).toBe(true);
    expect(s.has("us")).toBe(true);
    expect(s.has("b")).toBe(true);
  });

  it("returns single node when no children", () => {
    expect(orgUnitSubtreeIds(rows, "us")).toEqual(["us"]);
  });
});
