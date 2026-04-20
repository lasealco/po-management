import { describe, expect, it } from "vitest";

import { apiHubValidationError } from "./api-error";

describe("apiHubValidationError", () => {
  it("returns issues with summary counts", async () => {
    const response = apiHubValidationError(400, "VALIDATION_ERROR", "Bad input", [
      { field: "status", code: "INVALID_ENUM", message: "bad status" },
      { field: "authMode", code: "INVALID_ENUM", message: "bad auth mode" },
      { field: "authConfigRef", code: "REQUIRED", message: "required" },
    ]);
    const body = (await response.json()) as {
      error: {
        details: {
          summary: {
            totalErrors: number;
            byCode: Record<string, number>;
          };
        };
      };
    };

    expect(body.error.details.summary.totalErrors).toBe(3);
    expect(body.error.details.summary.byCode.INVALID_ENUM).toBe(2);
    expect(body.error.details.summary.byCode.REQUIRED).toBe(1);
  });
});
