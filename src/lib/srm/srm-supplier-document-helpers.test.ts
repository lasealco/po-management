import { describe, expect, it } from "vitest";

import { groupSrmDocumentsByRevisionGroup } from "@/lib/srm/srm-supplier-document-helpers";

describe("groupSrmDocumentsByRevisionGroup", () => {
  it("groups and sorts by revision descending", () => {
    const map = groupSrmDocumentsByRevisionGroup([
      { id: "a", revisionGroupId: "g1", revisionNumber: 1 },
      { id: "c", revisionGroupId: "g2", revisionNumber: 1 },
      { id: "b", revisionGroupId: "g1", revisionNumber: 2 },
    ]);
    expect(map.size).toBe(2);
    expect(map.get("g1")?.map((x) => x.id)).toEqual(["b", "a"]);
    expect(map.get("g2")?.map((x) => x.id)).toEqual(["c"]);
  });
});
