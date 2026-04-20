import { describe, expect, it } from "vitest";

import {
  parseAccountWorkspaceTab,
  validateAccountSummaryInput,
  validateContactCreateInput,
  validateQuoteDraftInput,
} from "./account-workspace";

describe("parseAccountWorkspaceTab", () => {
  it("defaults to overview for unknown values", () => {
    expect(parseAccountWorkspaceTab("unknown")).toBe("overview");
    expect(parseAccountWorkspaceTab(null)).toBe("overview");
  });

  it("returns known tab ids", () => {
    expect(parseAccountWorkspaceTab("contacts")).toBe("contacts");
    expect(parseAccountWorkspaceTab("finance")).toBe("finance");
  });
});

describe("validateAccountSummaryInput", () => {
  it("rejects empty or too-short names", () => {
    expect(validateAccountSummaryInput({ name: " ", industry: "" })).toEqual({
      ok: false,
      error: "Account name is required.",
    });
    expect(validateAccountSummaryInput({ name: "A", industry: "" })).toEqual({
      ok: false,
      error: "Account name must be at least 2 characters.",
    });
  });

  it("rejects oversized industry and accepts valid input", () => {
    expect(
      validateAccountSummaryInput({
        name: "Acme Logistics",
        industry: "A".repeat(81),
      }),
    ).toEqual({
      ok: false,
      error: "Industry must be 80 characters or fewer.",
    });
    expect(validateAccountSummaryInput({ name: "Acme Logistics", industry: "3PL" })).toEqual({
      ok: true,
    });
  });
});

describe("validateContactCreateInput", () => {
  it("requires complete names and validates email", () => {
    expect(validateContactCreateInput({ firstName: "", lastName: "Kim", email: "" })).toEqual({
      ok: false,
      error: "First and last name are required.",
    });
    expect(validateContactCreateInput({ firstName: "A", lastName: "K", email: "" })).toEqual({
      ok: false,
      error: "First and last name must be at least 2 characters.",
    });
    expect(
      validateContactCreateInput({
        firstName: "Alex",
        lastName: "Kim",
        email: "bad-email",
      }),
    ).toEqual({
      ok: false,
      error: "Email must be a valid address.",
    });
  });

  it("accepts blank or valid emails", () => {
    expect(validateContactCreateInput({ firstName: "Alex", lastName: "Kim", email: "" })).toEqual({
      ok: true,
    });
    expect(
      validateContactCreateInput({
        firstName: "Alex",
        lastName: "Kim",
        email: "alex.kim@acme.com",
      }),
    ).toEqual({
      ok: true,
    });
  });
});

describe("validateQuoteDraftInput", () => {
  it("enforces title required and boundaries", () => {
    expect(validateQuoteDraftInput({ title: " " })).toEqual({
      ok: false,
      error: "Quote title is required.",
    });
    expect(validateQuoteDraftInput({ title: "short" })).toEqual({
      ok: false,
      error: "Quote title must be at least 6 characters.",
    });
    expect(validateQuoteDraftInput({ title: "x".repeat(141) })).toEqual({
      ok: false,
      error: "Quote title must be 140 characters or fewer.",
    });
  });

  it("accepts a normal quote title", () => {
    expect(validateQuoteDraftInput({ title: "Chicago lane proposal Q3" })).toEqual({
      ok: true,
    });
  });
});
