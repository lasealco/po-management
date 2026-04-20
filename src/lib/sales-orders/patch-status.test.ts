import { describe, expect, it } from "vitest";

import {
  evaluateSalesOrderStatusTransition,
  parseSalesOrderPatchRequestBody,
  parseSalesOrderRouteId,
  parseTargetSalesOrderStatus,
} from "./patch-status";

describe("parseSalesOrderRouteId", () => {
  it("rejects blank id", () => {
    expect(parseSalesOrderRouteId("   ")).toEqual({
      ok: false,
      status: 400,
      error: "Sales order id is required.",
    });
  });

  it("accepts trimmed id", () => {
    expect(parseSalesOrderRouteId("  clxyz123  ")).toEqual({ ok: true, id: "clxyz123" });
  });
});

describe("parseSalesOrderPatchRequestBody", () => {
  it("accepts plain objects", () => {
    const out = parseSalesOrderPatchRequestBody({ status: "OPEN" });
    expect(out).toEqual({ ok: true, record: { status: "OPEN" } });
  });

  it("rejects arrays", () => {
    expect(parseSalesOrderPatchRequestBody([])).toEqual({
      ok: false,
      status: 400,
      error: "Expected JSON object body.",
    });
  });

  it("rejects null", () => {
    expect(parseSalesOrderPatchRequestBody(null)).toEqual({
      ok: false,
      status: 400,
      error: "Expected JSON object body.",
    });
  });

  it("rejects string primitives", () => {
    expect(parseSalesOrderPatchRequestBody("x")).toEqual({
      ok: false,
      status: 400,
      error: "Expected JSON object body.",
    });
  });

  it("rejects number primitives", () => {
    expect(parseSalesOrderPatchRequestBody(1)).toEqual({
      ok: false,
      status: 400,
      error: "Expected JSON object body.",
    });
  });
});

describe("parseTargetSalesOrderStatus", () => {
  it("requires status", () => {
    expect(parseTargetSalesOrderStatus({})).toEqual({
      ok: false,
      error: "Field `status` is required.",
    });
  });

  it("rejects non-string status", () => {
    expect(parseTargetSalesOrderStatus({ status: 1 })).toEqual({
      ok: false,
      error: "Field `status` must be a string (DRAFT, OPEN, or CLOSED).",
    });
  });

  it("normalizes case and whitespace", () => {
    expect(parseTargetSalesOrderStatus({ status: "  open " })).toEqual({ ok: true, status: "OPEN" });
  });

  it("rejects unknown status", () => {
    expect(parseTargetSalesOrderStatus({ status: "PENDING" })).toEqual({
      ok: false,
      error: "status must be DRAFT, OPEN, or CLOSED.",
    });
  });
});

describe("evaluateSalesOrderStatusTransition", () => {
  const ship = (
    id: string,
    status: string,
    shipmentNo: string | null = "S-1",
  ): { id: string; status: string; shipmentNo: string | null } => ({ id, status, shipmentNo });

  it("allows DRAFT to OPEN", () => {
    expect(
      evaluateSalesOrderStatusTransition({
        current: "DRAFT",
        target: "OPEN",
        shipments: [],
      }),
    ).toEqual({ ok: true });
  });

  it("blocks invalid transition", () => {
    expect(
      evaluateSalesOrderStatusTransition({
        current: "DRAFT",
        target: "DRAFT",
        shipments: [],
      }),
    ).toEqual({
      ok: false,
      status: 409,
      code: "INVALID_TRANSITION",
      error: "Cannot change status from DRAFT to DRAFT.",
    });
  });

  it("blocks CLOSE when an active shipment exists", () => {
    const r = evaluateSalesOrderStatusTransition({
      current: "OPEN",
      target: "CLOSED",
      shipments: [ship("s1", "IN_TRANSIT")],
    });
    expect(r).toEqual({
      ok: false,
      status: 409,
      code: "ACTIVE_SHIPMENTS",
      error: "Cannot close sales order while linked shipments are active.",
      activeShipments: [{ id: "s1", shipmentNo: "S-1", status: "IN_TRANSIT" }],
    });
  });

  it("allows CLOSE when shipments are not active", () => {
    expect(
      evaluateSalesOrderStatusTransition({
        current: "OPEN",
        target: "CLOSED",
        shipments: [ship("s1", "CANCELLED")],
      }),
    ).toEqual({ ok: true });
  });
});
