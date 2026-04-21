import { describe, expect, it } from "vitest";

import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";

import { diffApiHubMappingRules } from "./mapping-rules-diff";

describe("diffApiHubMappingRules", () => {
  it("classifies added, removed, changed, and unchanged by targetField", () => {
    const baseline: ApiHubMappingRule[] = [
      { sourcePath: "a", targetField: "x", transform: "trim" },
      { sourcePath: "b", targetField: "y", required: true },
      { sourcePath: "c", targetField: "z" },
    ];
    const compare: ApiHubMappingRule[] = [
      { sourcePath: "a2", targetField: "x", transform: "trim" },
      { sourcePath: "b", targetField: "y", required: true },
      { sourcePath: "n", targetField: "new1" },
    ];
    const d = diffApiHubMappingRules(baseline, compare);
    expect(d.summary).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
    expect(d.added.map((r) => r.targetField)).toEqual(["new1"]);
    expect(d.removed.map((r) => r.targetField)).toEqual(["z"]);
    expect(d.changed.map((c) => c.targetField)).toEqual(["x"]);
    expect(d.unchanged.map((r) => r.targetField)).toEqual(["y"]);
  });

  it("treats transform omission vs identity as different when compare is explicit", () => {
    const baseline: ApiHubMappingRule[] = [{ sourcePath: "s", targetField: "t" }];
    const compare: ApiHubMappingRule[] = [{ sourcePath: "s", targetField: "t", transform: "upper" }];
    const d = diffApiHubMappingRules(baseline, compare);
    expect(d.summary.changed).toBe(1);
    expect(d.summary.unchanged).toBe(0);
  });
});
