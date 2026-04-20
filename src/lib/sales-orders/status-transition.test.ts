import { describe, expect, it } from "vitest";

import { canTransitionSalesOrderStatus, parseSalesOrderPatchPayload } from "./status-transition";

describe("parseSalesOrderPatchPayload", () => {
  it("accepts valid status with case and spaces", () => {
    expect(parseSalesOrderPatchPayload({ status: "  open " })).toEqual({ ok: true, status: "OPEN" });
  });

  it("rejects non-object payloads", () => {
    expect(parseSalesOrderPatchPayload(null)).toEqual({
      ok: false,
      error: "Request body must be a JSON object.",
    });
    expect(parseSalesOrderPatchPayload(["OPEN"])).toEqual({
      ok: false,
      error: "Request body must be a JSON object.",
    });
  });

  it("rejects missing status", () => {
    expect(parseSalesOrderPatchPayload({})).toEqual({ ok: false, error: "status is required." });
  });

  it("rejects unsupported status", () => {
    expect(parseSalesOrderPatchPayload({ status: "cancelled" })).toEqual({
      ok: false,
      error: "status must be DRAFT | OPEN | CLOSED",
    });
  });
});

describe("canTransitionSalesOrderStatus", () => {
  it("rejects no-op transitions", () => {
    expect(canTransitionSalesOrderStatus("OPEN", "OPEN")).toEqual({
      ok: false,
      error: "Sales order is already OPEN.",
    });
  });

  it("allows valid transitions", () => {
    expect(canTransitionSalesOrderStatus("DRAFT", "OPEN")).toEqual({ ok: true });
    expect(canTransitionSalesOrderStatus("OPEN", "CLOSED")).toEqual({ ok: true });
    expect(canTransitionSalesOrderStatus("CLOSED", "OPEN")).toEqual({ ok: true });
  });
});
