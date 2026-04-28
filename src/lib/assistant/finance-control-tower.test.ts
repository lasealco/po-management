import { describe, expect, it } from "vitest";

import {
  buildAccrualRisk,
  buildFinanceControlPacket,
  scoreFinanceRisk,
  summarizeInvoiceVariance,
  summarizeMarginLeakage,
  type FinanceControlInputs,
} from "@/lib/assistant/finance-control-tower";

const input: FinanceControlInputs = {
  invoices: [
    {
      id: "intake-1",
      vendorLabel: "Carrier A",
      externalInvoiceNo: "INV-1",
      currency: "USD",
      rollupOutcome: "FAIL",
      financeHandoffStatus: "READY_FOR_FINANCE",
      approvedForAccounting: false,
      totalEstimatedCost: 1200,
      totalVariance: 350,
      redLineCount: 2,
      amberLineCount: 1,
    },
    {
      id: "intake-2",
      vendorLabel: "Carrier B",
      externalInvoiceNo: "INV-2",
      currency: "USD",
      rollupOutcome: "WARN",
      financeHandoffStatus: "DRAFT",
      approvedForAccounting: true,
      totalEstimatedCost: 800,
      totalVariance: -50,
      redLineCount: 0,
      amberLineCount: 2,
    },
  ],
  shipmentCosts: [
    {
      id: "ship-1",
      shipmentNo: "SHP-1",
      currency: "USD",
      internalRevenue: 1000,
      internalCost: 1300,
      internalNet: -300,
      internalMarginPct: -0.3,
      costLineTotal: 1300,
    },
  ],
  procurementPlans: [{ id: "proc-1", recommendedCarrier: "Carrier A", allocationScore: 60, status: "DRAFT" }],
  customerBriefs: [{ id: "brief-1", serviceScore: 45, status: "DRAFT" }],
};

describe("finance control tower helpers", () => {
  it("summarizes invoice variance and dispute candidates", () => {
    const summary = summarizeInvoiceVariance(input.invoices);
    expect(summary.totalVariance).toBe(300);
    expect(summary.disputeAmount).toBe(350);
    expect(summary.unapprovedAccountingCount).toBe(1);
    expect(summary.redLineCount).toBe(2);
  });

  it("summarizes negative margin leakage", () => {
    const leakage = summarizeMarginLeakage(input.shipmentCosts);
    expect(leakage.estimatedLeakage).toBe(300);
    expect(leakage.negativeMarginCount).toBe(1);
    expect(leakage.flaggedShipments[0]?.shipmentNo).toBe("SHP-1");
  });

  it("builds accrual risk from unapproved invoices and pending work", () => {
    const accrual = buildAccrualRisk(input);
    expect(accrual.accrualAmount).toBe(1550);
    expect(accrual.riskFlags).toContain("1 invoice(s) not cleared for accounting.");
    expect(accrual.riskFlags).toContain("1 procurement allocation(s) still pending.");
  });

  it("scores finance risk from combined pressure", () => {
    const variance = summarizeInvoiceVariance(input.invoices);
    const leakage = summarizeMarginLeakage(input.shipmentCosts);
    const accrual = buildAccrualRisk(input);
    expect(scoreFinanceRisk({ variance, leakage, accrual })).toBeGreaterThan(10);
  });

  it("builds a finance packet without implying accounting mutation", () => {
    const packet = buildFinanceControlPacket(input);
    expect(packet.disputeQueue.candidates).toHaveLength(1);
    expect(packet.boardSummary).toContain("No accounting export");
    expect(packet.evidence.invoiceIds).toEqual(["intake-1", "intake-2"]);
  });
});
