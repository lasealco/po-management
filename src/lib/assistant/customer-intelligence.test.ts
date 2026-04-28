import { describe, expect, it } from "vitest";

import {
  buildCustomerActivityLog,
  buildCustomerBrief,
  buildPromiseStatus,
  computeCustomerServiceScore,
  redactCustomerEvidence,
  type CustomerIntelligenceInputs,
} from "@/lib/assistant/customer-intelligence";

const baseInput: CustomerIntelligenceInputs = {
  accountName: "Acme Retail",
  industry: "Retail",
  segment: "Enterprise",
  strategicFlag: true,
  activities: [{ subject: "Weekly service call", status: "OPEN", dueDate: "2026-04-30T00:00:00.000Z" }],
  orders: [{ id: "so-1", soNumber: "SO-1", status: "OPEN", requestedDeliveryDate: "2026-05-01T00:00:00.000Z", assistantReviewStatus: "APPROVED" }],
  shipments: [
    {
      id: "ship-1",
      shipmentNo: "SHP-1",
      status: "IN_TRANSIT",
      expectedReceiveAt: "2000-01-01T00:00:00.000Z",
      receivedAt: null,
      openExceptionCount: 1,
      openAlertCount: 1,
    },
  ],
  invoices: [{ id: "inv-1", externalInvoiceNo: "INV-1", rollupOutcome: "FAIL", redLineCount: 2, amberLineCount: 1 }],
  incidents: [{ id: "inc-1", title: "Late delivery", severity: "HIGH", status: "OPEN", customerImpact: "Acme Retail delivery at risk." }],
};

describe("customer intelligence helpers", () => {
  it("scores service lower when shipment, incident, and invoice pressure exists", () => {
    expect(computeCustomerServiceScore(baseInput)).toBeLessThan(80);
  });

  it("builds promise status from shipment and order evidence", () => {
    const promise = buildPromiseStatus(baseInput);
    expect(promise.status).toBe("AT_RISK");
    expect(promise.openOrderCount).toBe(1);
    expect(promise.lateShipmentCount).toBe(1);
  });

  it("redacts sensitive finance and partner language for customer-safe replies", () => {
    const redacted = redactCustomerEvidence({
      text: "Carrier invoice variance and margin details should not be sent.",
      canViewSensitive: false,
    });
    expect(redacted.text).not.toContain("Carrier");
    expect(redacted.text).not.toContain("invoice");
    expect(redacted.text).not.toContain("margin");
    expect(redacted.redactions).toEqual(["commercial detail", "finance detail", "partner detail"]);
  });

  it("keeps authorized evidence visible when allowed", () => {
    const redacted = redactCustomerEvidence({
      text: "Carrier invoice variance and margin details.",
      canViewSensitive: true,
    });
    expect(redacted.text).toContain("Carrier invoice");
    expect(redacted.redactions).toEqual([]);
  });

  it("builds an editable customer-ready brief and activity log", () => {
    const brief = buildCustomerBrief({ ...baseInput, canViewSensitive: false });
    expect(brief.replyDraft).toContain("Here is the latest service update for Acme Retail");
    expect(brief.redaction.applied).toBe(true);
    expect(brief.operationsSummary.promise.status).toBe("AT_RISK");

    const log = buildCustomerActivityLog({ accountName: "Acme Retail", reply: brief.replyDraft, approvedBy: "user-1" });
    expect(log.subject).toContain("Acme Retail");
    expect(log.status).toBe("COMPLETED");
  });
});
