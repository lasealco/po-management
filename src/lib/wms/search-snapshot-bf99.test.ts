import { describe, expect, it } from "vitest";

import {
  decodeSearchSnapshotBf99Cursor,
  encodeSearchSnapshotBf99Cursor,
  parseSearchSnapshotBf99Limit,
  SEARCH_SNAPSHOT_BF99_LIMIT_DEFAULT,
  SEARCH_SNAPSHOT_BF99_LIMIT_MAX,
  SEARCH_SNAPSHOT_BF99_LIMIT_MIN,
} from "@/lib/wms/search-snapshot-bf99";

describe("search-snapshot-bf99 cursor", () => {
  it("round-trips segment + afterId", () => {
    const enc = encodeSearchSnapshotBf99Cursor({ v: 1, s: 1, a: "clabcdefghijklmn" });
    const dec = decodeSearchSnapshotBf99Cursor(enc);
    expect(dec.ok).toBe(true);
    if (dec.ok) {
      expect(dec.state.s).toBe(1);
      expect(dec.state.a).toBe("clabcdefghijklmn");
    }
  });

  it("treats empty cursor as start of shipments", () => {
    const dec = decodeSearchSnapshotBf99Cursor("");
    expect(dec.ok).toBe(true);
    if (dec.ok) {
      expect(dec.state).toEqual({ v: 1, s: 0, a: null });
    }
  });

  it("rejects oversized cursor", () => {
    const junk = "x".repeat(900);
    const dec = decodeSearchSnapshotBf99Cursor(junk);
    expect(dec.ok).toBe(false);
  });
});

describe("search-snapshot-bf99 limit", () => {
  it("clamps limit", () => {
    expect(parseSearchSnapshotBf99Limit(null)).toBe(SEARCH_SNAPSHOT_BF99_LIMIT_DEFAULT);
    expect(parseSearchSnapshotBf99Limit("")).toBe(SEARCH_SNAPSHOT_BF99_LIMIT_DEFAULT);
    expect(parseSearchSnapshotBf99Limit("not-a-number")).toBe(SEARCH_SNAPSHOT_BF99_LIMIT_DEFAULT);
    expect(parseSearchSnapshotBf99Limit("1")).toBe(1);
    expect(parseSearchSnapshotBf99Limit("99999")).toBe(SEARCH_SNAPSHOT_BF99_LIMIT_MAX);
    expect(parseSearchSnapshotBf99Limit("0")).toBe(SEARCH_SNAPSHOT_BF99_LIMIT_MIN);
  });
});
