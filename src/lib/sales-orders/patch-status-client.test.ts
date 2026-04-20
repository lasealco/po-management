import { describe, expect, it } from "vitest";

import { buildSalesOrderPatchStatusErrorMessage } from "./patch-status-client";

describe("buildSalesOrderPatchStatusErrorMessage", () => {
  it("falls back to default message", () => {
    expect(buildSalesOrderPatchStatusErrorMessage(undefined)).toBe("Could not change status.");
  });

  it("returns API error for non-active-shipment failures", () => {
    expect(
      buildSalesOrderPatchStatusErrorMessage({
        code: "INVALID_TRANSITION",
        error: "Cannot change status from DRAFT to DRAFT.",
      }),
    ).toBe("Cannot change status from DRAFT to DRAFT.");
  });

  it("appends active shipment details when payload code matches", () => {
    expect(
      buildSalesOrderPatchStatusErrorMessage({
        code: "ACTIVE_SHIPMENTS",
        error: "Cannot close sales order while linked shipments are active.",
        activeShipments: [
          { shipmentNo: "S-42", status: "IN_TRANSIT" },
          { shipmentNo: null, status: "BOOKED" },
        ],
      }),
    ).toBe("Cannot close sales order while linked shipments are active. Active: S-42 (IN_TRANSIT), shipment (BOOKED)");
  });
});
