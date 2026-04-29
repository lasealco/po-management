import { describe, expect, it } from "vitest";

import { buildTransportCarrierProcurementPacket, type TransportCarrierProcurementInputs } from "./transport-carrier-procurement";

function sampleInputs(): TransportCarrierProcurementInputs {
  return {
    quoteRequests: [
      {
        id: "rfq-1",
        title: "Asia export RFQ",
        status: "OPEN",
        quotesDueAt: new Date(Date.now() - 86_400_000).toISOString(),
        transportMode: "OCEAN",
        originLabel: "Shanghai",
        destinationLabel: "Los Angeles",
        responseCount: 0,
        submittedQuoteCount: 0,
      },
    ],
    tariffContractHeaders: [
      {
        id: "hdr-1",
        title: "Ocean contract",
        status: "ACTIVE",
        transportMode: "OCEAN",
        pendingVersionCount: 2,
        rejectedVersionCount: 0,
        versionCount: 3,
      },
    ],
    bookingPricingSnapshots: [
      {
        id: "snap-1",
        sourceType: "CONTRACT_VERSION",
        sourceSummary: null,
        currency: "USD",
        totalEstimatedCost: 0,
        frozenAt: new Date().toISOString(),
        basisSide: null,
        incoterm: null,
        shipmentBookingId: "bk-1",
      },
    ],
    shipments: [
      {
        id: "ship-1",
        shipmentNo: "SH-100",
        status: "BOOKING_DRAFT",
        carrierLabel: "Demo Carrier",
        transportMode: "OCEAN",
        updatedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        bookingStatus: "SENT",
        bookingSlaDueAt: new Date(Date.now() - 86_400_000).toISOString(),
        originCode: "CNSHA",
        destinationCode: "USLAX",
        openExceptionCount: 1,
      },
    ],
    transportationProcurementPlans: [
      { id: "plan-1", title: "Carrier allocation", status: "DRAFT", allocationScore: 55, recommendedCarrier: "Demo Carrier", quoteRequestId: "rfq-1" },
    ],
    invoiceIntakes: [
      {
        id: "inv-1",
        externalInvoiceNo: "INV-FRT-1",
        vendorLabel: "Freight Forwarder",
        status: "AUDITED",
        currency: "USD",
        rollupOutcome: "FAIL",
        redLineCount: 2,
        amberLineCount: 0,
        approvedForAccounting: false,
      },
    ],
    ctExceptionsOpen: [{ id: "ex-1", severity: "WARN", shipmentId: "ship-1", recoveryState: "TRIAGE" }],
    actionQueue: [{ id: "aq-1", actionKind: "transport_carrier_procurement_review", status: "PENDING", priority: "HIGH", objectType: "assistant_transport_carrier_procurement_packet" }],
  };
}

describe("transport carrier procurement assistant", () => {
  it("builds a Sprint 16 procurement packet across RFQ, tariff, lane, tender, invoice, and execution signals", () => {
    const packet = buildTransportCarrierProcurementPacket(sampleInputs());

    expect(packet.title).toContain("Sprint 16 Transportation & Carrier Procurement");
    expect(packet.procurementScore).toBeLessThan(100);
    expect(packet.rfqRiskCount).toBeGreaterThan(0);
    expect(packet.tariffBookingRiskCount).toBeGreaterThan(0);
    expect(packet.laneRiskCount).toBeGreaterThan(0);
    expect(packet.tenderRiskCount).toBeGreaterThan(0);
    expect(packet.invoiceVarianceCount).toBeGreaterThan(0);
    expect(packet.executionRiskCount).toBeGreaterThan(0);
    expect(packet.responsePlan.status).toContain("REVIEW");
  });

  it("keeps carriers, tariffs, bookings, tenders, invoices, and shipments approval-gated", () => {
    const packet = buildTransportCarrierProcurementPacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("without mutating");
    expect(packet.rfqTariff.guardrail).toContain("does not award");
    expect(packet.bookingPricing.guardrail).toContain("does not publish");
    expect(packet.laneExecution.guardrail).toContain("do not confirm");
    expect(packet.tenderAllocation.guardrail).toContain("stay internal");
    expect(packet.invoiceFeedback.guardrail).toContain("does not approve");
    expect(packet.executionRisk.guardrail).toContain("do not advance");
    expect(packet.carrierPerformance.guardrail).toContain("do not retender");
    expect(packet.rollbackPlan.guardrail).toContain("never auto-reverted");
  });
});
