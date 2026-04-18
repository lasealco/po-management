import { describe, expect, it } from "vitest";

import {
  parseSupplierDocumentCreateBody,
  parseSupplierDocumentPatchBody,
} from "./supplier-document-parse";

describe("parseSupplierDocumentCreateBody", () => {
  it("requires title", () => {
    expect(parseSupplierDocumentCreateBody({ title: "" }).ok).toBe(false);
  });

  it("accepts https referenceUrl", () => {
    const r = parseSupplierDocumentCreateBody({
      title: "COI 2026",
      category: "insurance",
      referenceUrl: "https://example.com/doc.pdf",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.referenceUrl).toContain("https://");
  });

  it("rejects non-http referenceUrl", () => {
    const r = parseSupplierDocumentCreateBody({
      title: "x",
      referenceUrl: "ftp://bad",
    });
    expect(r.ok).toBe(false);
  });
});

describe("parseSupplierDocumentPatchBody", () => {
  it("rejects empty patch", () => {
    expect(parseSupplierDocumentPatchBody({}).ok).toBe(false);
  });

  it("allows clearing referenceUrl", () => {
    const r = parseSupplierDocumentPatchBody({ referenceUrl: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.referenceUrl).toBeNull();
  });
});
