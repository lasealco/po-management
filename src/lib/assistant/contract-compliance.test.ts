import { describe, expect, it } from "vitest";

import {
  buildComplianceGaps,
  buildContractCompliancePacket,
  buildDocumentRisks,
  buildRenewalRisks,
  extractContractObligations,
  scoreContractCompliance,
  type ContractComplianceInputs,
} from "./contract-compliance";

const inputs: ContractComplianceInputs = {
  nowIso: "2026-04-28T00:00:00.000Z",
  documents: [
    {
      id: "doc-1",
      supplierId: "supplier-1",
      supplierLabel: "ACME Supplier",
      documentType: "certificate_of_insurance",
      title: "Insurance certificate",
      status: "active",
      expiresAt: "2026-05-05T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
  tariffContracts: [
    {
      id: "tariff-1",
      title: "Ocean contract",
      providerLabel: "Carrier A",
      contractNumber: "OC-1",
      status: "ACTIVE",
      transportMode: "OCEAN",
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: "2026-05-20T00:00:00.000Z",
      tradeScope: "FRA to CHI",
      rateLineCount: 1,
      chargeLineCount: 0,
      freeTimeRuleCount: 0,
    },
  ],
  rfqCommitments: [
    {
      id: "rfq-1",
      title: "May carrier RFQ",
      status: "AWARDED",
      transportMode: "OCEAN",
      quotesDueAt: "2026-04-15T00:00:00.000Z",
      responseCount: 2,
      submittedResponseCount: 1,
      validityTo: "2026-05-10T00:00:00.000Z",
      recommendedCarrier: "Carrier A",
    },
  ],
};

describe("AMP23 contract compliance helpers", () => {
  it("extracts obligations from documents, tariff contracts, and RFQs", () => {
    const obligations = extractContractObligations(inputs);

    expect(obligations.length).toBeGreaterThanOrEqual(4);
    expect(obligations.map((item) => item.sourceType)).toContain("SUPPLIER_DOCUMENT");
    expect(obligations.map((item) => item.sourceType)).toContain("TARIFF_CONTRACT");
    expect(obligations.map((item) => item.sourceType)).toContain("RFQ_COMMITMENT");
  });

  it("flags expiring supplier documents", () => {
    const risks = buildDocumentRisks(inputs.documents, inputs.nowIso);

    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({ severity: "HIGH", requiredAction: expect.stringContaining("renewal") });
  });

  it("flags renewal risks for tariff and RFQ validity windows", () => {
    const risks = buildRenewalRisks(inputs);

    expect(risks.length).toBeGreaterThanOrEqual(2);
    expect(risks.map((risk) => risk.sourceType)).toContain("TARIFF_CONTRACT");
    expect(risks.map((risk) => risk.sourceType)).toContain("RFQ_COMMITMENT");
  });

  it("detects tariff evidence gaps", () => {
    const gaps = buildComplianceGaps(inputs);

    expect(gaps.map((gap) => gap.gap)).toContain("No charge lines are attached.");
    expect(gaps.map((gap) => gap.gap)).toContain("No free-time rule evidence is attached.");
  });

  it("builds an approval-safe compliance packet", () => {
    const packet = buildContractCompliancePacket(inputs);

    expect(packet.complianceScore).toBeLessThan(scoreContractCompliance({ obligationCount: 4, documentRiskCount: 0, renewalRiskCount: 0, gapCount: 0 }));
    expect(packet.documentRisks).toHaveLength(1);
    expect(packet.complianceGaps.length).toBeGreaterThan(0);
    expect(packet.sourceSummary.guardrail).toContain("not changed automatically");
    expect(packet.leadershipSummary).toContain("does not modify supplier documents");
  });
});
