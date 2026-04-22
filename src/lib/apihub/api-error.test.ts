import { describe, expect, it } from "vitest";

import {
  apiHubError,
  apiHubStagingBatchCreateFailedMessage,
  apiHubValidationError,
  readApiHubErrorMessageFromJsonBody,
} from "./api-error";
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

describe("apiHubError (P4 leakage guard — stable envelope)", () => {
  it("exposes only code + message on the error object (no stack / cause fields)", async () => {
    const response = apiHubError(400, "TEST_CODE", "Operator-safe message.", "req-leak-1");
    const body = (await response.json()) as { ok: false; error: Record<string, unknown> };
    expect(body.ok).toBe(false);
    expect(body.error).toEqual({
      code: "TEST_CODE",
      message: "Operator-safe message.",
    });
    expect(Object.keys(body.error).sort()).toEqual(["code", "message"]);
  });

  it("top-level JSON has only ok + error keys", async () => {
    const response = apiHubError(503, "UNAVAILABLE", "Try again.", "req-shape-1");
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["error", "ok"]);
  });
});

describe("apiHubValidationError (P4 — stable envelope)", () => {
  it("error object exposes only code, message, details; details only issues + summary", async () => {
    const response = apiHubValidationError(
      422,
      "VALIDATION_ERROR",
      "Fix input.",
      [{ field: "x", code: "BAD", message: "nope" }],
      "req-val-1",
    );
    const body = (await response.json()) as {
      ok: false;
      error: Record<string, unknown> & {
        details: { issues: unknown[]; summary: Record<string, unknown> };
      };
    };
    expect(body.ok).toBe(false);
    expect(Object.keys(body).sort()).toEqual(["error", "ok"]);
    expect(Object.keys(body.error).sort()).toEqual(["code", "details", "message"]);
    expect(Object.keys(body.error.details).sort()).toEqual(["issues", "summary"]);
    expect(Array.isArray(body.error.details.issues)).toBe(true);
    expect(body.error.details.issues).toHaveLength(1);
  });
});

describe("apiHubStagingBatchCreateFailedMessage", () => {
  const fb = "Could not create staging batch.";

  it("passes through known domain messages from staging-batches-repo", () => {
    expect(
      apiHubStagingBatchCreateFailedMessage(
        new Error("Analysis job not found, wrong tenant, or not succeeded."),
        fb,
      ),
    ).toBe("Analysis job not found, wrong tenant, or not succeeded.");
    expect(apiHubStagingBatchCreateFailedMessage(new Error("Job input has no records array."), fb)).toBe(
      "Job input has no records array.",
    );
    expect(apiHubStagingBatchCreateFailedMessage(new Error("Job output has no rules array."), fb)).toBe(
      "Job output has no rules array.",
    );
    expect(apiHubStagingBatchCreateFailedMessage(new Error("At most 500 rows per staging batch."), fb)).toBe(
      "At most 500 rows per staging batch.",
    );
  });

  it("hides unexpected engine errors", () => {
    expect(
      apiHubStagingBatchCreateFailedMessage(
        new Error(
          "\nInvalid `prisma.apiHubStagingBatch.create()` invocation:\nForeign key constraint failed",
        ),
        fb,
      ),
    ).toBe(fb);
    expect(apiHubStagingBatchCreateFailedMessage("not an error", fb)).toBe(fb);
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
