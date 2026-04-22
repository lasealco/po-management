import { describe, expect, it } from "vitest";

import { apiClientErrorMessage, readApiErrorTextFromJson, readApiResponseErrorCode } from "./api-client-error";

describe("readApiResponseErrorCode", () => {
  it("returns trimmed codes", () => {
    expect(readApiResponseErrorCode({ code: "FORBIDDEN" })).toBe("FORBIDDEN");
    expect(readApiResponseErrorCode({ code: " NOT_FOUND " })).toBe("NOT_FOUND");
  });

  it("returns null for missing or blank code", () => {
    expect(readApiResponseErrorCode({})).toBeNull();
    expect(readApiResponseErrorCode({ code: "  " })).toBeNull();
    expect(readApiResponseErrorCode(null)).toBeNull();
  });
});

describe("readApiErrorTextFromJson", () => {
  it("prefers error over message", () => {
    expect(readApiErrorTextFromJson({ error: "a", message: "b" })).toBe("a");
  });

  it("uses message when error missing", () => {
    expect(readApiErrorTextFromJson({ message: " hello " })).toBe("hello");
  });
});

describe("apiClientErrorMessage", () => {
  it("appends code when not already in the message", () => {
    expect(apiClientErrorMessage({ error: "Nope", code: "BAD_INPUT" }, "fallback")).toBe("Nope (BAD_INPUT)");
  });

  it("uses fallback when there is no error text", () => {
    expect(apiClientErrorMessage({ code: "X" }, "fallback")).toBe("fallback (X)");
  });

  it("does not duplicate a code that appears in the message", () => {
    expect(apiClientErrorMessage({ error: "Error BAD_INPUT", code: "BAD_INPUT" }, "f")).toBe("Error BAD_INPUT");
  });
});
