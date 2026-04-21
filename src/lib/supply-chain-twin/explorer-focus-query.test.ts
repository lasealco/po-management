import { describe, expect, it } from "vitest";

import {
  parseExplorerSnapshotFocusQuery,
  parseExplorerSnapshotQueryParam,
} from "@/lib/supply-chain-twin/explorer-focus-query";

describe("parseExplorerSnapshotFocusQuery", () => {
  it("returns absent when undefined", () => {
    expect(parseExplorerSnapshotFocusQuery(undefined)).toEqual({ kind: "absent" });
  });

  it("returns ok for a valid id", () => {
    expect(parseExplorerSnapshotFocusQuery("clabc123")).toEqual({ kind: "ok", snapshotId: "clabc123" });
  });

  it("trims string values", () => {
    expect(parseExplorerSnapshotFocusQuery("  x  ")).toEqual({ kind: "ok", snapshotId: "x" });
  });

  it("uses first array entry", () => {
    expect(parseExplorerSnapshotFocusQuery(["a", "b"])).toEqual({ kind: "ok", snapshotId: "a" });
  });

  it("rejects empty after trim", () => {
    const r = parseExplorerSnapshotFocusQuery("   ");
    expect(r.kind).toBe("invalid");
    if (r.kind === "invalid") {
      expect(r.message.length).toBeGreaterThan(0);
    }
  });

  it("rejects overlong values", () => {
    const r = parseExplorerSnapshotFocusQuery("x".repeat(200));
    expect(r.kind).toBe("invalid");
  });
});

describe("parseExplorerSnapshotQueryParam", () => {
  it("returns null for invalid", () => {
    expect(parseExplorerSnapshotQueryParam("")).toBeNull();
  });

  it("returns id when ok", () => {
    expect(parseExplorerSnapshotQueryParam("snap-1")).toBe("snap-1");
  });
});
