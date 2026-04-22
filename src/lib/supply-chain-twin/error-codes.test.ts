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
    expect(isTwinApiErrorCode("INVALID_CURSOR")).toBe(true);
    expect(isTwinApiErrorCode("BODY_JSON_INVALID")).toBe(true);
    expect(isTwinApiErrorCode("BODY_VALIDATION_FAILED")).toBe(true);
    expect(isTwinApiErrorCode("PATH_ID_INVALID")).toBe(true);
    expect(isTwinApiErrorCode("INVALID_STATUS_TRANSITION")).toBe(true);
    expect(isTwinApiErrorCode("TWIN_INGEST_PAYLOAD_TOO_LARGE")).toBe(true);
    expect(isTwinApiErrorCode("TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE")).toBe(true);
    expect(isTwinApiErrorCode("TIMEOUT_BUDGET_EXCEEDED")).toBe(true);
    expect(isTwinApiErrorCode("INVALID_IDEMPOTENCY_KEY")).toBe(true);
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
    expect(parseTwinApiErrorCode({ code: " invalid_cursor " })).toBe("INVALID_CURSOR");
    expect(parseTwinApiErrorCode({ code: " body_json_invalid " })).toBe("BODY_JSON_INVALID");
    expect(parseTwinApiErrorCode({ code: " body_validation_failed " })).toBe("BODY_VALIDATION_FAILED");
    expect(parseTwinApiErrorCode({ code: " path_id_invalid " })).toBe("PATH_ID_INVALID");
    expect(parseTwinApiErrorCode({ code: " invalid_status_transition " })).toBe("INVALID_STATUS_TRANSITION");
    expect(parseTwinApiErrorCode({ code: " twin_ingest_payload_too_large " })).toBe("TWIN_INGEST_PAYLOAD_TOO_LARGE");
    expect(parseTwinApiErrorCode({ code: " twin_scenario_draft_json_too_large " })).toBe(
      "TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE",
    );
    expect(parseTwinApiErrorCode({ code: " timeout_budget_exceeded " })).toBe("TIMEOUT_BUDGET_EXCEEDED");
    expect(parseTwinApiErrorCode({ code: " invalid_idempotency_key " })).toBe("INVALID_IDEMPOTENCY_KEY");
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
    expect(
      parseTwinApiErrorBody({
        code: " export_row_cap_exceeded ",
        error: 42,
        message: "Too many rows",
      }),
    ).toEqual({
      code: "EXPORT_ROW_CAP_EXCEEDED",
      error: "Too many rows",
    });
    expect(
      parseTwinApiErrorBody({
        code: " query_validation_failed ",
        error: 42,
        message: "Bad filters",
      }),
    ).toEqual({
      code: "QUERY_VALIDATION_FAILED",
      error: "Bad filters",
    });
    expect(
      parseTwinApiErrorBody({
        code: " invalid_cursor ",
        error: 42,
        message: "Bad cursor",
      }),
    ).toEqual({
      code: "INVALID_CURSOR",
      error: "Bad cursor",
    });
    expect(
      parseTwinApiErrorBody({
        code: " body_json_invalid ",
        error: 42,
        message: "Unexpected token",
      }),
    ).toEqual({
      code: "BODY_JSON_INVALID",
      error: "Unexpected token",
    });
    expect(
      parseTwinApiErrorBody({
        code: " body_validation_failed ",
        error: 42,
        message: "title is required",
      }),
    ).toEqual({
      code: "BODY_VALIDATION_FAILED",
      error: "title is required",
    });
    expect(
      parseTwinApiErrorBody({
        code: " path_id_invalid ",
        error: 42,
        message: "id is empty",
      }),
    ).toEqual({
      code: "PATH_ID_INVALID",
      error: "id is empty",
    });
    expect(
      parseTwinApiErrorBody({
        code: " invalid_status_transition ",
        error: 42,
        message: "draft is archived",
      }),
    ).toEqual({
      code: "INVALID_STATUS_TRANSITION",
      error: "draft is archived",
    });
    expect(
      parseTwinApiErrorBody({
        code: " twin_ingest_payload_too_large ",
        error: 42,
        message: "payload exceeds cap",
      }),
    ).toEqual({
      code: "TWIN_INGEST_PAYLOAD_TOO_LARGE",
      error: "payload exceeds cap",
    });
    expect(
      parseTwinApiErrorBody({
        code: " twin_scenario_draft_json_too_large ",
        error: 42,
        message: "draft JSON exceeds byte cap",
      }),
    ).toEqual({
      code: "TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE",
      error: "draft JSON exceeds byte cap",
    });
    expect(
      parseTwinApiErrorBody({
        code: " timeout_budget_exceeded ",
        error: 42,
        message: "deadline exceeded",
      }),
    ).toEqual({
      code: "TIMEOUT_BUDGET_EXCEEDED",
      error: "deadline exceeded",
    });
    expect(
      parseTwinApiErrorBody({
        code: " invalid_idempotency_key ",
        error: 42,
        message: "Idempotency-Key exceeds max length",
      }),
    ).toEqual({
      code: "INVALID_IDEMPOTENCY_KEY",
      error: "Idempotency-Key exceeds max length",
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
    expect(getTwinEventsExportErrorMessage({ code: " invalid_cursor ", error: "Use next page token" })).toBe(
      "Use next page token",
    );
    expect(getTwinEventsExportErrorMessage({ code: " body_json_invalid ", error: "Unexpected token" })).toBe(
      "Unexpected token",
    );
    expect(getTwinEventsExportErrorMessage({ code: " body_validation_failed ", error: "title is required" })).toBe(
      "title is required",
    );
    expect(getTwinEventsExportErrorMessage({ code: " path_id_invalid ", error: "id is empty" })).toBe("id is empty");
    expect(getTwinEventsExportErrorMessage({ code: " invalid_status_transition ", error: "draft is archived" })).toBe(
      "draft is archived",
    );
    expect(
      getTwinEventsExportErrorMessage({ code: " twin_ingest_payload_too_large ", error: "payload exceeds cap" }),
    ).toBe("payload exceeds cap");
    expect(
      getTwinEventsExportErrorMessage({
        code: " twin_scenario_draft_json_too_large ",
        error: "draft JSON exceeds byte cap",
      }),
    ).toBe("draft JSON exceeds byte cap");
    expect(
      getTwinEventsExportErrorMessage({ code: " timeout_budget_exceeded ", error: "deadline exceeded" }),
    ).toBe("deadline exceeded");
    expect(
      getTwinEventsExportErrorMessage({
        code: " invalid_idempotency_key ",
        error: "Idempotency-Key exceeds max length",
      }),
    ).toBe("Idempotency-Key exceeds max length");
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
