import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { decodeIngestionRunListCursor, encodeIngestionRunListCursor } from "./ingestion-run-list-cursor";

describe("ingestion run list cursor", () => {
  it("round-trips createdAt and id", () => {
    const createdAt = new Date("2026-04-22T10:15:30.123Z");
    const id = "clabcdefgh1234567890jkl";
    const encoded = encodeIngestionRunListCursor(createdAt, id);
    const decoded = decodeIngestionRunListCursor(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.cursor.id).toBe(id);
      expect(decoded.cursor.createdAt.toISOString()).toBe(createdAt.toISOString());
    }
  });

  it("rejects garbage", () => {
    expect(decodeIngestionRunListCursor("not-base64!!!").ok).toBe(false);
    expect(decodeIngestionRunListCursor("{}").ok).toBe(false);
  });

  it("rejects ids outside allowed charset", () => {
    const encoded = Buffer.from(
      JSON.stringify({ v: 1, c: "2026-01-01T00:00:00.000Z", i: "bad id!" }),
      "utf8",
    ).toString("base64url");
    expect(decodeIngestionRunListCursor(encoded).ok).toBe(false);
  });
});
