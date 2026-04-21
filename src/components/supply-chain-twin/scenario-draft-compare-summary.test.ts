import { describe, expect, it } from "vitest";

import {
  computeDraftTopLevelKeyDiffV1,
  DRAFT_COMPARE_NESTED_PATH_MAX_NODES,
  describeDraftRootKeyDiff,
  draftsDeepEqualSerialized,
} from "./scenario-draft-compare-summary";

describe("describeDraftRootKeyDiff", () => {
  it("reports same keys for two objects", () => {
    expect(describeDraftRootKeyDiff({ a: 1, b: 2 }, { b: 3, a: 0 })).toContain("Same top-level object keys");
  });

  it("reports keys only on one side", () => {
    const msg = describeDraftRootKeyDiff({ a: 1 }, { b: 2 });
    expect(msg).toContain("Different top-level object keys");
    expect(msg).toContain("Only in left: a");
    expect(msg).toContain("Only in right: b");
  });

  it("handles non-object roots", () => {
    expect(describeDraftRootKeyDiff([], [])).toContain("arrays at root");
    expect(describeDraftRootKeyDiff(1, true)).toContain("Different JSON shapes at root");
  });
});

describe("computeDraftTopLevelKeyDiffV1", () => {
  it("buckets top-level keys for two objects", () => {
    const d = computeDraftTopLevelKeyDiffV1({ a: 1, b: 2, c: 3 }, { b: 2, c: 0, d: 4 });
    expect(d.kind).toBe("objects");
    if (d.kind !== "objects") {
      return;
    }
    expect(d.onlyInLeft).toEqual(["a"]);
    expect(d.onlyInRight).toEqual(["d"]);
    expect(d.sameKeys.sort()).toEqual(["b"]);
    expect(d.changedKeys.sort()).toEqual(["c"]);
    expect(d.nestedPathDiffs).toEqual([]);
    expect(d.nestedPathDiffsOverflow).toBe(0);
  });

  it("returns narrative when roots are not both objects", () => {
    const d = computeDraftTopLevelKeyDiffV1([], {});
    expect(d.kind).toBe("non_object");
    if (d.kind !== "non_object") {
      return;
    }
    expect(d.narrative.length).toBeGreaterThan(0);
  });

  it("lists depth-2 paths when a changed key is an object on both sides", () => {
    const d = computeDraftTopLevelKeyDiffV1(
      { meta: { x: 1, y: 2, keep: 0 } },
      { meta: { x: 1, y: 9, keep: 0 } },
    );
    expect(d.kind).toBe("objects");
    if (d.kind !== "objects") {
      return;
    }
    expect(d.changedKeys).toEqual(["meta"]);
    expect(d.nestedPathDiffs).toEqual([{ path: "meta.y", kind: "diff" }]);
    expect(d.nestedPathDiffsOverflow).toBe(0);
  });

  it("lists only_left and only_right nested keys under a changed parent object", () => {
    const d = computeDraftTopLevelKeyDiffV1({ cfg: { a: 1, onlyL: true } }, { cfg: { a: 2, onlyR: true } });
    expect(d.kind).toBe("objects");
    if (d.kind !== "objects") {
      return;
    }
    expect(d.changedKeys).toEqual(["cfg"]);
    expect(d.nestedPathDiffs).toEqual([
      { path: "cfg.a", kind: "diff" },
      { path: "cfg.onlyL", kind: "only_left" },
      { path: "cfg.onlyR", kind: "only_right" },
    ]);
    expect(d.nestedPathDiffsOverflow).toBe(0);
  });

  it("caps nested path rows and reports overflow", () => {
    const many = 5 + DRAFT_COMPARE_NESTED_PATH_MAX_NODES;
    const leftP: Record<string, number> = {};
    for (let i = 0; i < many; i += 1) {
      leftP[`k${i}`] = i;
    }
    const d = computeDraftTopLevelKeyDiffV1({ p: leftP }, { p: {} });
    expect(d.kind).toBe("objects");
    if (d.kind !== "objects") {
      return;
    }
    expect(d.changedKeys).toEqual(["p"]);
    expect(d.nestedPathDiffs.length).toBe(DRAFT_COMPARE_NESTED_PATH_MAX_NODES);
    expect(d.nestedPathDiffsOverflow).toBe(many - DRAFT_COMPARE_NESTED_PATH_MAX_NODES);
  });
});

describe("draftsDeepEqualSerialized", () => {
  it("returns true for equal objects", () => {
    expect(draftsDeepEqualSerialized({ x: 1 }, { x: 1 })).toBe(true);
  });

  it("returns false for different objects", () => {
    expect(draftsDeepEqualSerialized({ x: 1 }, { x: 2 })).toBe(false);
  });

  it("returns null when payload is oversized", () => {
    const big = "x".repeat(60_000);
    expect(draftsDeepEqualSerialized({ a: big }, { a: big }, 100)).toBe(null);
  });
});
