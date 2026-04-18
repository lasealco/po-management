import { describe, expect, it } from "vitest";

import { supplierDocumentRowEditorKey } from "./supplier-document-row-key";

describe("supplierDocumentRowEditorKey", () => {
  it("changes when any tracked field changes", () => {
    const a = supplierDocumentRowEditorKey("id1", "A", null, null, null);
    const b = supplierDocumentRowEditorKey("id1", "B", null, null, null);
    expect(a).not.toBe(b);
  });

  it("is stable for identical inputs", () => {
    expect(supplierDocumentRowEditorKey("x", "t", "https://a", "2026-01-01T00:00:00.000Z", "n")).toBe(
      supplierDocumentRowEditorKey("x", "t", "https://a", "2026-01-01T00:00:00.000Z", "n"),
    );
  });
});
