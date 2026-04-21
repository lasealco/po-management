import { describe, expect, it } from "vitest";

import {
  getTwinEventsExportErrorMessage,
  isTwinApiErrorCode,
  parseTwinApiErrorBody,
  parseTwinApiErrorCode,
  TWIN_API_ERROR_CODES,
} from "./error-codes";

describe("TWIN_API_ERROR_CODES", () => {
  it("has unique values", () => {
    const values = Object.values(TWIN_API_ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes required event and export contract codes", () => {
    expect(TWIN_API_ERROR_CODES).toMatchObject({
      QUERY_VALIDATION_FAILED: "QUERY_VALIDATION_FAILED",
      INVALID_CURSOR: "INVALID_CURSOR",
      BODY_JSON_INVALID: "BODY_JSON_INVALID",
      BODY_VALIDATION_FAILED: "BODY_VALIDATION_FAILED",
      INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
      INVALID_TWIN_INGEST_TYPE: "INVALID_TWIN_INGEST_TYPE",
      FORMAT_INVALID: "FORMAT_INVALID",
      EXPORT_ROW_CAP_EXCEEDED: "EXPORT_ROW_CAP_EXCEEDED",
      PATH_ID_INVALID: "PATH_ID_INVALID",
      INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
      TWIN_INGEST_PAYLOAD_TOO_LARGE: "TWIN_INGEST_PAYLOAD_TOO_LARGE",
      TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE: "TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE",
      TIMEOUT_BUDGET_EXCEEDED: "TIMEOUT_BUDGET_EXCEEDED",
    });
  });

  it("type-guards only registered code strings", () => {
    expect(isTwinApiErrorCode("QUERY_VALIDATION_FAILED")).toBe(true);
    expect(isTwinApiErrorCode("EXPORT_ROW_CAP_EXCEEDED")).toBe(true);
    expect(isTwinApiErrorCode("NOT_A_REAL_TWIN_CODE")).toBe(false);
    expect(isTwinApiErrorCode(123)).toBe(false);
    expect(isTwinApiErrorCode(null)).toBe(false);
  });

  it("parses code safely from unknown response bodies", () => {
    expect(parseTwinApiErrorCode({ code: "QUERY_VALIDATION_FAILED" })).toBe("QUERY_VALIDATION_FAILED");
    expect(parseTwinApiErrorCode({ code: " QUERY_VALIDATION_FAILED " })).toBe("QUERY_VALIDATION_FAILED");
    expect(parseTwinApiErrorCode({ code: "\n\tQUERY_VALIDATION_FAILED\t\n" })).toBe("QUERY_VALIDATION_FAILED");
    expect(parseTwinApiErrorCode({ code: "query_validation_failed" })).toBe("QUERY_VALIDATION_FAILED");
    expect(parseTwinApiErrorCode({ code: "query-validation-failed" })).toBeNull();
    expect(parseTwinApiErrorCode({ code: 1001 })).toBeNull();
    expect(parseTwinApiErrorCode({ code: true })).toBeNull();
    expect(parseTwinApiErrorCode({ code: false })).toBeNull();
    expect(parseTwinApiErrorCode({ code: { value: "QUERY_VALIDATION_FAILED" } })).toBeNull();
    expect(parseTwinApiErrorCode({ code: ["QUERY_VALIDATION_FAILED"] })).toBeNull();
    expect(parseTwinApiErrorCode({ code: undefined })).toBeNull();
    expect(parseTwinApiErrorCode({ code: null })).toBeNull();
    expect(parseTwinApiErrorCode({ code: "NOT_A_REAL_TWIN_CODE" })).toBeNull();
    expect(parseTwinApiErrorCode([])).toBeNull();
    expect(parseTwinApiErrorCode({})).toBeNull();
    expect(parseTwinApiErrorCode(null)).toBeNull();
  });

  it("parses code + error safely from unknown response bodies", () => {
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: "Invalid format" })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "\n\tFORMAT_INVALID\t\n", error: "Invalid format" })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: " Invalid format " })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: " FORMAT_INVALID ", error: "Invalid format" })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "format_invalid", error: "Invalid format" })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: "   " })).toEqual({
      code: "FORMAT_INVALID",
      error: null,
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", message: " Invalid format " })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", message: "\n\tInvalid format\t\n" })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: " format_invalid ", message: " Invalid format " })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", message: "   " })).toEqual({
      code: "FORMAT_INVALID",
      error: null,
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", message: 42 })).toEqual({
      code: "FORMAT_INVALID",
      error: null,
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: 42, message: "Invalid format" })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: "   ", message: "Invalid format" })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: "", message: "Invalid format" })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: " format_invalid ", error: "", message: " Invalid format " })).toEqual({
      code: "FORMAT_INVALID",
      error: "Invalid format",
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: "", message: "   " })).toEqual({
      code: "FORMAT_INVALID",
      error: null,
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: 42, message: 99 })).toEqual({
      code: "FORMAT_INVALID",
      error: null,
    });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: "preferred", message: "secondary" })).toEqual({
      code: "FORMAT_INVALID",
      error: "preferred",
    });
    expect(parseTwinApiErrorBody({ code: "NOT_A_REAL_TWIN_CODE", error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: null, error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: undefined, error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: { value: "FORMAT_INVALID" }, error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: ["FORMAT_INVALID"], error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: 1001, error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: true, error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: false, error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: "", error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody({ code: "   ", error: "x" })).toEqual({
      code: null,
      error: "x",
    });
    expect(parseTwinApiErrorBody([])).toEqual({ code: null, error: null });
    expect(parseTwinApiErrorBody({})).toEqual({ code: null, error: null });
    expect(parseTwinApiErrorBody({ code: "FORMAT_INVALID", error: 42 })).toEqual({
      code: "FORMAT_INVALID",
      error: null,
    });
    expect(parseTwinApiErrorBody(null)).toEqual({ code: null, error: null });
  });

  it("maps export error messages from known code values", () => {
    expect(getTwinEventsExportErrorMessage({ code: "QUERY_VALIDATION_FAILED" })).toMatch(/filters are invalid/i);
    expect(
      getTwinEventsExportErrorMessage({
        code: " query_validation_failed ",
        error: "raw detail",
        message: "fallback detail",
      }),
    ).toMatch(/filters are invalid/i);
    expect(
      getTwinEventsExportErrorMessage({
        code: " query_validation_failed ",
        error: 42,
        message: 99,
      }),
    ).toMatch(/filters are invalid/i);
    expect(getTwinEventsExportErrorMessage({ code: "EXPORT_ROW_CAP_EXCEEDED" })).toMatch(/too large/i);
    expect(
      getTwinEventsExportErrorMessage({
        code: " export_row_cap_exceeded ",
        error: "raw detail",
        message: "fallback detail",
      }),
    ).toMatch(/too large/i);
    expect(
      getTwinEventsExportErrorMessage({
        code: " export_row_cap_exceeded ",
        error: 42,
        message: 99,
      }),
    ).toMatch(/too large/i);
    expect(getTwinEventsExportErrorMessage({ code: "FORMAT_INVALID" })).toMatch(/CSV or JSON/i);
    expect(
      getTwinEventsExportErrorMessage({
        code: " format_invalid ",
        error: "raw detail",
        message: "fallback detail",
      }),
    ).toMatch(/CSV or JSON/i);
    expect(getTwinEventsExportErrorMessage({ code: " format_invalid ", message: "custom backend text" })).toMatch(
      /CSV or JSON/i,
    );
    expect(
      getTwinEventsExportErrorMessage({
        code: " format_invalid ",
        error: "   ",
        message: "custom backend text",
      }),
    ).toMatch(/CSV or JSON/i);
    expect(
      getTwinEventsExportErrorMessage({
        code: " format_invalid ",
        error: 42,
        message: 99,
      }),
    ).toMatch(/CSV or JSON/i);
    expect(getTwinEventsExportErrorMessage({ code: "FORMAT_INVALID", message: "custom backend text" })).toMatch(
      /CSV or JSON/i,
    );
    expect(getTwinEventsExportErrorMessage({ error: "raw message" })).toBe("raw message");
    expect(getTwinEventsExportErrorMessage({ error: "\n\traw message\t\n" })).toBe("raw message");
    expect(getTwinEventsExportErrorMessage({ code: "NOT_A_REAL_TWIN_CODE", message: " fallback message " })).toBe(
      "fallback message",
    );
    expect(
      getTwinEventsExportErrorMessage({ code: "NOT_A_REAL_TWIN_CODE", message: "\n\tfallback message\t\n" }),
    ).toBe("fallback message");
    expect(
      getTwinEventsExportErrorMessage({
        code: "NOT_A_REAL_TWIN_CODE",
        error: "   ",
        message: "\n\tfallback message\t\n",
      }),
    ).toBe("fallback message");
    expect(
      getTwinEventsExportErrorMessage({
        code: "NOT_A_REAL_TWIN_CODE",
        error: 42,
        message: "fallback message",
      }),
    ).toBe("fallback message");
    expect(
      getTwinEventsExportErrorMessage({
        code: " not_a_real_twin_code ",
        error: "",
        message: " fallback message ",
      }),
    ).toBe("fallback message");
    expect(
      getTwinEventsExportErrorMessage({
        code: "NOT_A_REAL_TWIN_CODE",
        error: "preferred detail",
        message: "secondary detail",
      }),
    ).toBe("preferred detail");
    expect(getTwinEventsExportErrorMessage({ code: "NOT_A_REAL_TWIN_CODE", error: "   ", message: "   " })).toBe(
      "Export failed.",
    );
    expect(getTwinEventsExportErrorMessage([])).toBe("Export failed.");
    expect(getTwinEventsExportErrorMessage(null)).toBe("Export failed.");
  });

  it("prefers stable code mapping over raw error text", () => {
    expect(
      getTwinEventsExportErrorMessage({
        code: "QUERY_VALIDATION_FAILED",
        error: "some unhelpful backend detail",
      }),
    ).toMatch(/filters are invalid/i);
  });
});
