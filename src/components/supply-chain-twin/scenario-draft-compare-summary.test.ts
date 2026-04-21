import { describe, expect, it } from "vitest";

import {
  computeDraftTopLevelKeyDiffV1,
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
  });

  it("returns narrative when roots are not both objects", () => {
    const d = computeDraftTopLevelKeyDiffV1([], {});
    expect(d.kind).toBe("non_object");
    if (d.kind !== "non_object") {
      return;
    }
    expect(d.narrative.length).toBeGreaterThan(0);
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
