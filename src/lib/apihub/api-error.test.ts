import { describe, expect, it } from "vitest";

import { apiHubValidationError, readApiHubErrorMessageFromJsonBody } from "./api-error";
import { APIHUB_REQUEST_ID_HEADER } from "./request-id";

describe("apiHubValidationError", () => {
  it("returns issues with summary counts", async () => {
    const response = apiHubValidationError(400, "VALIDATION_ERROR", "Bad input", [
      { field: "status", code: "INVALID_ENUM", message: "bad status" },
      { field: "authMode", code: "INVALID_ENUM", message: "bad auth mode" },
      { field: "authConfigRef", code: "REQUIRED", message: "required" },
    ], "req-test-001");
    const body = (await response.json()) as {
      error: {
        details: {
          summary: {
            totalErrors: number;
            byCode: Record<string, number>;
            bySeverity: Record<"error" | "warn" | "info", number>;
          };
        };
      };
    };

    expect(body.error.details.summary.totalErrors).toBe(3);
    expect(body.error.details.summary.byCode.INVALID_ENUM).toBe(2);
    expect(body.error.details.summary.byCode.REQUIRED).toBe(1);
    expect(body.error.details.summary.bySeverity).toEqual({ error: 3, warn: 0, info: 0 });
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("req-test-001");
  });

  it("counts bySeverity when issues mix severities and omit severity", async () => {
    const response = apiHubValidationError(400, "VALIDATION_ERROR", "Mixed", [
      { field: "a", code: "W", message: "w", severity: "warn" },
      { field: "b", code: "I", message: "i", severity: "info" },
      { field: "c", code: "E", message: "e" },
    ], "req-mix-1");
    const body = (await response.json()) as {
      error: {
        details: {
          issues: { field: string; severity?: string }[];
          summary: { totalErrors: number; bySeverity: Record<string, number> };
        };
      };
    };
    expect(body.error.details.summary.totalErrors).toBe(3);
    expect(body.error.details.summary.bySeverity).toEqual({ error: 1, warn: 1, info: 1 });
    expect(body.error.details.issues[0].severity).toBe("warn");
    expect(body.error.details.issues[1].severity).toBe("info");
    expect(body.error.details.issues[2].severity).toBeUndefined();
  });
});

describe("readApiHubErrorMessageFromJsonBody", () => {
  it("reads structured error message", () => {
    expect(
      readApiHubErrorMessageFromJsonBody(
        { ok: false, error: { code: "X", message: "hello" } },
        "fallback",
      ),
    ).toBe("hello");
  });

  it("reads legacy string error", () => {
    expect(readApiHubErrorMessageFromJsonBody({ error: "legacy" }, "fallback")).toBe("legacy");
  });

  it("uses fallback when missing", () => {
    expect(readApiHubErrorMessageFromJsonBody({}, "fallback")).toBe("fallback");
  });
});
