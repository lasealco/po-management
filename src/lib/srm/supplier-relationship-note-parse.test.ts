import { describe, expect, it } from "vitest";

import {
  parseRelationshipNoteCreateBody,
  parseRelationshipNotePatchBody,
} from "./supplier-relationship-note-parse";

describe("parseRelationshipNoteCreateBody", () => {
  it("rejects empty body", () => {
    expect(parseRelationshipNoteCreateBody({ body: "  " }).ok).toBe(false);
  });

  it("accepts trimmed body", () => {
    const r = parseRelationshipNoteCreateBody({ body: "  Quarterly review call.  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.body).toBe("Quarterly review call.");
  });
});

describe("parseRelationshipNotePatchBody", () => {
  it("accepts body", () => {
    const r = parseRelationshipNotePatchBody({ body: "updated" });
    expect(r.ok).toBe(true);
  });
});
