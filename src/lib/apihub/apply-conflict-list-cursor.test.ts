import { describe, expect, it } from "vitest";

import { decodeApplyConflictListCursor, encodeApplyConflictListCursor } from "./apply-conflict-list-cursor";

describe("apply-conflict-list-cursor", () => {
  it("round-trips", () => {
    const d = new Date("2026-04-22T12:00:00.000Z");
    const id = "clabcdefghijklmn";
    const enc = encodeApplyConflictListCursor(d, id);
    const dec = decodeApplyConflictListCursor(enc);
    expect(dec).toEqual({ ok: true, cursor: { createdAt: d, id } });
  });

  it("rejects ingestion-run cursors (v1)", () => {
    const enc = Buffer.from(JSON.stringify({ v: 1, c: "2026-01-01T00:00:00.000Z", i: "clabcdefghijklmn" }), "utf8").toString(
      "base64url",
    );
    expect(decodeApplyConflictListCursor(enc).ok).toBe(false);
  });
});
