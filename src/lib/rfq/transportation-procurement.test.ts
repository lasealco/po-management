import { describe, expect, it } from "vitest";

import {
  buildCarrierScorecards,
  buildTenderDraft,
  buildTransportationAllocationPlan,
  buildTransportationProcurementSummary,
  normalizeAmount,
} from "@/lib/rfq/transportation-procurement";

describe("transportation procurement assistant helpers", () => {
  it("normalizes decimal-like quote amounts", () => {
    expect(normalizeAmount({ toString: () => "1234.50" })).toBe(1234.5);
    expect(normalizeAmount("bad")).toBeNull();
  });

  it("recommends the best carrier using cost, service, invoice, and evidence", () => {
    const scorecards = buildCarrierScorecards([
      {
        responseId: "cheap-risky",
        supplierId: "sup-a",
        carrierName: "Cheap Risky",
        currency: "USD",
        totalAmount: 900,
        quoteStatus: "SUBMITTED",
        snapshotCount: 0,
        shipmentCount: 10,
        lateShipmentCount: 5,
        invoiceIntakeCount: 2,
        invoiceRedLineCount: 3,
        invoiceAmberLineCount: 1,
      },
      {
        responseId: "balanced",
        supplierId: "sup-b",
        carrierName: "Balanced Carrier",
        currency: "USD",
        totalAmount: 1000,
        quoteStatus: "SUBMITTED",
        snapshotCount: 2,
        shipmentCount: 10,
        lateShipmentCount: 0,
        invoiceIntakeCount: 2,
        invoiceRedLineCount: 0,
        invoiceAmberLineCount: 1,
      },
    ]);

    expect(scorecards[0]?.carrierName).toBe("Balanced Carrier");
    expect(scorecards[0]?.recommendation).toBe("RECOMMENDED");
    expect(scorecards[1]?.riskFlags).toContain("No frozen booking/pricing snapshot yet");
  });

  it("builds an approval-first allocation plan and tender draft", () => {
    const [scorecard] = buildCarrierScorecards([
      {
        responseId: "resp-1",
        supplierId: "sup-1",
        carrierName: "Atlas Forwarding",
        currency: "USD",
        totalAmount: 1200,
        quoteStatus: "SUBMITTED",
        snapshotCount: 1,
        shipmentCount: 5,
        lateShipmentCount: 0,
        invoiceIntakeCount: 1,
        invoiceRedLineCount: 0,
        invoiceAmberLineCount: 0,
      },
    ]);
    const plan = buildTransportationAllocationPlan(scorecard ? [scorecard] : []);
    const draft = buildTenderDraft({
      rfqTitle: "FRA to CHI April",
      originLabel: "FRA",
      destinationLabel: "CHI",
      equipmentSummary: "40HC",
      allocationPlan: plan,
    });

    expect(plan.status).toBe("READY_FOR_APPROVAL");
    expect(plan.nextActions.join(" ")).toContain("before sending anything externally");
    expect(draft.body).toContain("No tender has been sent automatically");
    expect(buildTransportationProcurementSummary(plan)).toContain("Human approval is required");
  });
});
