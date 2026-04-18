import { describe, expect, it } from "vitest";

import { parseInvoiceIntakePatchBody } from "@/lib/invoice-audit/invoice-intake-patch-parse";

describe("parseInvoiceIntakePatchBody", () => {
  it("rejects non-objects", () => {
    expect(parseInvoiceIntakePatchBody(null)).toMatchObject({ ok: false, status: 400 });
    expect(parseInvoiceIntakePatchBody([])).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects empty patch", () => {
    const r = parseInvoiceIntakePatchBody({});
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.status).toBe(400);
    expect(r.error).toContain("reviewDecision");
  });

  it("rejects bad reviewDecision before any other field matters", () => {
    const r = parseInvoiceIntakePatchBody({
      reviewDecision: "MAYBE",
      approvedForAccounting: true,
    });
    expect(r).toMatchObject({ ok: false, status: 400, error: expect.stringContaining("APPROVED") });
  });

  it("rejects approvedForAccounting when present but not boolean", () => {
    const r = parseInvoiceIntakePatchBody({
      reviewDecision: "APPROVED",
      approvedForAccounting: "true",
    });
    expect(r).toMatchObject({ ok: false, status: 400, error: expect.stringContaining("boolean") });
  });

  it("rejects rawSourceNotes wrong type even when review is valid", () => {
    const r = parseInvoiceIntakePatchBody({
      reviewDecision: "APPROVED",
      rawSourceNotes: 123,
    });
    expect(r).toMatchObject({ ok: false, status: 400, error: expect.stringContaining("rawSourceNotes") });
  });

  it("accepts review-only", () => {
    const r = parseInvoiceIntakePatchBody({ reviewDecision: "approved", reviewNote: " ok " });
    expect(r).toEqual({
      ok: true,
      value: {
        hasReview: true,
        reviewDecision: "APPROVED",
        reviewNote: " ok ",
        hasAccounting: false,
        approvedForAccounting: null,
        accountingApprovalNote: null,
        hasRawSourceNotes: false,
        rawSourceNotes: null,
      },
    });
  });

  it("accepts accounting-only", () => {
    const r = parseInvoiceIntakePatchBody({ approvedForAccounting: false });
    expect(r).toEqual({
      ok: true,
      value: {
        hasReview: false,
        reviewDecision: null,
        reviewNote: null,
        hasAccounting: true,
        approvedForAccounting: false,
        accountingApprovalNote: null,
        hasRawSourceNotes: false,
        rawSourceNotes: null,
      },
    });
  });

  it("accepts rawSourceNotes null", () => {
    const r = parseInvoiceIntakePatchBody({ rawSourceNotes: null });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value).toMatchObject({
      hasRawSourceNotes: true,
      rawSourceNotes: null,
      hasReview: false,
      hasAccounting: false,
    });
  });

  it("accepts combined review + accounting + notes", () => {
    const r = parseInvoiceIntakePatchBody({
      reviewDecision: "OVERRIDDEN",
      reviewNote: "x",
      approvedForAccounting: true,
      accountingApprovalNote: "GL",
      rawSourceNotes: "ops",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value).toMatchObject({
      hasReview: true,
      reviewDecision: "OVERRIDDEN",
      reviewNote: "x",
      hasAccounting: true,
      approvedForAccounting: true,
      accountingApprovalNote: "GL",
      hasRawSourceNotes: true,
      rawSourceNotes: "ops",
    });
  });
});
