import { describe, expect, it } from "vitest";

import { parseTwinEdgesQuery } from "@/lib/supply-chain-twin/schemas/twin-edges-query";

describe("parseTwinEdgesQuery", () => {
  it("maps fromEntityId onto fromSnapshotId", () => {
    const r = parseTwinEdgesQuery(new URLSearchParams("fromEntityId=ent-1&take=50"));
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.query.fromSnapshotId).toBe("ent-1");
    expect(r.query.toSnapshotId).toBeUndefined();
    expect(r.query.snapshotId).toBeUndefined();
    expect(r.query.take).toBe(50);
  });

  it("maps toEntityId onto toSnapshotId", () => {
    const r = parseTwinEdgesQuery(new URLSearchParams("toEntityId=ent-2"));
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.query.toSnapshotId).toBe("ent-2");
    expect(r.query.fromSnapshotId).toBeUndefined();
  });

  it("rejects fromEntityId combined with fromSnapshotId", () => {
    const r = parseTwinEdgesQuery(new URLSearchParams("fromEntityId=a&fromSnapshotId=b"));
    expect(r.ok).toBe(false);
  });

  it("rejects fromEntityId combined with toEntityId", () => {
    const r = parseTwinEdgesQuery(new URLSearchParams("fromEntityId=a&toEntityId=b"));
    expect(r.ok).toBe(false);
  });

  it("rejects snapshotId with fromEntityId", () => {
    const r = parseTwinEdgesQuery(new URLSearchParams("snapshotId=x&fromEntityId=y"));
    expect(r.ok).toBe(false);
  });

  it("allows fromEntityId with toSnapshotId", () => {
    const r = parseTwinEdgesQuery(new URLSearchParams("fromEntityId=a&toSnapshotId=b"));
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.query.fromSnapshotId).toBe("a");
    expect(r.query.toSnapshotId).toBe("b");
  });
});
