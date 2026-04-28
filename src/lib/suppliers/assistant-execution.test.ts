import { describe, expect, it } from "vitest";

import {
  buildSupplierFollowUpMessage,
  buildSupplierOnboardingGapPlan,
  buildSupplierPerformanceBrief,
  needsSupplierFollowUp,
  parseSupplierAssistantExecutionStatus,
} from "./assistant-execution";

describe("parseSupplierAssistantExecutionStatus", () => {
  it("normalizes supported statuses", () => {
    expect(parseSupplierAssistantExecutionStatus("reviewed")).toBe("REVIEWED");
    expect(parseSupplierAssistantExecutionStatus("FOLLOW_UP_QUEUED")).toBe("FOLLOW_UP_QUEUED");
  });

  it("rejects unsupported statuses", () => {
    expect(parseSupplierAssistantExecutionStatus("approved")).toBeNull();
  });
});

describe("needsSupplierFollowUp", () => {
  it("flags sent or approved supplier orders", () => {
    expect(
      needsSupplierFollowUp({
        id: "po1",
        orderNumber: "PO-1",
        title: null,
        statusCode: "SENT_TO_SUPPLIER",
        statusLabel: "Sent to supplier",
        requestedDeliveryDate: null,
        totalAmount: "100",
        currency: "USD",
        itemCount: 1,
      }),
    ).toBe(true);
  });

  it("does not flag final orders", () => {
    expect(
      needsSupplierFollowUp({
        id: "po1",
        orderNumber: "PO-1",
        title: null,
        statusCode: "RECEIVED",
        statusLabel: "Received",
        requestedDeliveryDate: "2026-01-01T00:00:00.000Z",
        totalAmount: "100",
        currency: "USD",
        itemCount: 1,
      }),
    ).toBe(false);
  });
});

describe("supplier assistant drafts", () => {
  it("builds a performance brief from signals", () => {
    const brief = buildSupplierPerformanceBrief({
      supplierName: "Acme",
      orderCount: 3,
      awaitingConfirmation: 1,
      onTimeShipPct: 75,
      openSignals: [
        {
          id: "po1",
          orderNumber: "PO-1",
          title: null,
          statusCode: "APPROVED",
          statusLabel: "Approved",
          requestedDeliveryDate: null,
          totalAmount: "100",
          currency: "USD",
          itemCount: 1,
        },
      ],
    });
    expect(brief).toContain("Acme has 3 linked parent purchase orders");
    expect(brief).toContain("need acknowledgement or shipment follow-up");
  });

  it("builds an onboarding gap plan and follow-up message", () => {
    expect(
      buildSupplierOnboardingGapPlan([
        { id: "t1", taskKey: "insurance", title: "Upload insurance", done: false, dueAt: null, notes: null },
      ]),
    ).toContain("Upload insurance");
    expect(
      buildSupplierFollowUpMessage({
        supplierName: "Acme",
        order: {
          id: "po1",
          orderNumber: "PO-1",
          title: null,
          statusCode: "APPROVED",
          statusLabel: "Approved",
          requestedDeliveryDate: "2026-05-01T00:00:00.000Z",
          totalAmount: "100",
          currency: "USD",
          itemCount: 1,
        },
      }),
    ).toContain("PO-1");
  });
});
