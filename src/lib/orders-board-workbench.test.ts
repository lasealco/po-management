import { describe, expect, it } from "vitest";

import {
  buildImpactTags,
  buildLogisticsRollup,
  buildSupplierSignals,
  computeLogisticsBlocked,
  computeWorkbenchNextStep,
} from "./orders-board-workbench";

describe("buildLogisticsRollup", () => {
  it("marks SO linked and booking pending", () => {
    const r = buildLogisticsRollup([
      {
        salesOrderId: "so1",
        asnReference: null,
        expectedReceiveAt: null,
        items: [{ quantityShipped: { toString: () => "0" }, quantityReceived: { toString: () => "0" } }],
        booking: { status: "SENT" },
      },
    ]);
    expect(r.linkedToSalesOrder).toBe(true);
    expect(r.bookingPending).toBe(true);
    expect(r.logisticsStatus).toBe("NONE");
  });

  it("detects missing ASN when quantity shipped", () => {
    const r = buildLogisticsRollup([
      {
        salesOrderId: null,
        asnReference: "",
        expectedReceiveAt: null,
        items: [{ quantityShipped: { toString: () => "10" }, quantityReceived: { toString: () => "0" } }],
        booking: { status: "CONFIRMED" },
      },
    ]);
    expect(r.missingAsnOnActiveShipment).toBe(true);
    expect(r.logisticsStatus).toBe("SHIPPED");
  });
});

describe("buildSupplierSignals", () => {
  it("flags logistics partner and pending approval", () => {
    expect(
      buildSupplierSignals({
        srmCategory: "logistics",
        approvalStatus: "pending_approval",
      }),
    ).toEqual(["Logistics partner", "Supplier approval pending"]);
  });

  it("returns empty when no supplier", () => {
    expect(buildSupplierSignals(null)).toEqual([]);
  });
});

describe("buildImpactTags", () => {
  it("includes SO link and high USD value", () => {
    const tags = buildImpactTags({
      totalAmount: "150000",
      currency: "USD",
      linkedToSalesOrder: true,
      requestedDeliveryOverdue: false,
      bookingPending: false,
    });
    expect(tags).toContain("SO linked");
    expect(tags).toContain("High value");
  });
});

describe("computeLogisticsBlocked", () => {
  it("is true when booking pending", () => {
    expect(
      computeLogisticsBlocked({
        statusCode: "CONFIRMED",
        logisticsStatus: "SHIPPED",
        bookingPending: true,
        missingAsnOnActiveShipment: false,
      }),
    ).toBe(true);
  });
});

describe("computeWorkbenchNextStep", () => {
  it("prioritizes split pending for buyer", () => {
    const s = computeWorkbenchNextStep({
      statusCode: "SPLIT_PENDING_BUYER",
      viewerMode: "buyer",
      allowedActionLabels: [],
      conversationSla: { awaitingReplyFrom: null, daysSinceLastShared: null, lastSharedAt: null },
      logisticsStatus: "NONE",
      bookingPending: false,
    });
    expect(s.nextOwner).toBe("buyer");
    expect(s.nextActionLabel).toContain("split");
  });

  it("shows supplier ownership for SENT", () => {
    const s = computeWorkbenchNextStep({
      statusCode: "SENT",
      viewerMode: "buyer",
      allowedActionLabels: [],
      conversationSla: { awaitingReplyFrom: null, daysSinceLastShared: null, lastSharedAt: null },
      logisticsStatus: "NONE",
      bookingPending: false,
    });
    expect(s.nextOwner).toBe("supplier");
    expect(s.nextActionDetail).toContain("No shared");
  });
});
