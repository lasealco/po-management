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

  it("accepts optional expiresAt ISO string", () => {
    const r = parseSupplierDocumentCreateBody({
      title: "License",
      expiresAt: "2027-06-01T00:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.expiresAt?.toISOString().slice(0, 4)).toBe("2027");
  });

  it("rejects invalid expiresAt", () => {
    const r = parseSupplierDocumentCreateBody({
      title: "x",
      expiresAt: "not-a-date",
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

  it("allows clearing expiresAt", () => {
    const r = parseSupplierDocumentPatchBody({ expiresAt: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.expiresAt).toBeNull();
  });

  it("accepts archived boolean", () => {
    const r = parseSupplierDocumentPatchBody({ archived: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.archivedAt).toBeInstanceOf(Date);
    const cleared = parseSupplierDocumentPatchBody({ archived: false });
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.data.archivedAt).toBeNull();
  });

  it("accepts combined metadata patch for row edit workflow", () => {
    const r = parseSupplierDocumentPatchBody({
      title: "Updated COI",
      notes: "Renewed",
      documentDate: "2026-03-01T00:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.title).toBe("Updated COI");
      expect(r.data.notes).toBe("Renewed");
      expect(r.data.documentDate?.toISOString().slice(0, 10)).toBe("2026-03-01");
    }
  });
});
