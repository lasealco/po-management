import { describe, expect, it } from "vitest";

import { buildProductLifecyclePacket, type ProductLifecycleInputs } from "./product-lifecycle-passport";

function sampleInputs(): ProductLifecycleInputs {
  return {
    nowIso: "2026-04-29T00:00:00.000Z",
    products: [
      {
        id: "prod-1",
        sku: "DG-100",
        productCode: "DG-100",
        name: "Dangerous goods component",
        categoryName: "Chemicals",
        divisionName: "Industrial",
        hsCode: "3824.99",
        ean: "4000000000011",
        isActive: true,
        isDangerousGoods: true,
        hasDangerousGoodsEvidence: true,
        msdsUrl: "https://example.test/msds.pdf",
        isTemperatureControlled: false,
        hasTemperatureEvidence: false,
        supplierCount: 2,
        documentKinds: ["MSDS", "OTHER"],
        inventoryBalanceCount: 2,
        openWmsTaskCount: 1,
        salesOrderLineCount: 4,
        purchaseOrderLineCount: 3,
        outboundOrderLineCount: 2,
      },
      {
        id: "prod-2",
        sku: null,
        productCode: null,
        name: "Cold chain launch SKU",
        categoryName: null,
        divisionName: "Healthcare",
        hsCode: null,
        ean: null,
        isActive: true,
        isDangerousGoods: false,
        hasDangerousGoodsEvidence: false,
        msdsUrl: null,
        isTemperatureControlled: true,
        hasTemperatureEvidence: false,
        supplierCount: 0,
        documentKinds: [],
        inventoryBalanceCount: 0,
        openWmsTaskCount: 0,
        salesOrderLineCount: 0,
        purchaseOrderLineCount: 0,
        outboundOrderLineCount: 0,
      },
    ],
    supplierDocuments: [
      { id: "doc-1", supplierId: "sup-1", supplierName: "Acme Supply", documentType: "quality_agreement", status: "active", title: "Quality agreement", expiresAt: "2026-05-15T00:00:00.000Z" },
      { id: "doc-2", supplierId: "sup-2", supplierName: "Beta Supply", documentType: "certificate_of_insurance", status: "active", title: "COI", expiresAt: null },
    ],
    supplierTasks: [{ id: "task-1", supplierId: "sup-2", supplierName: "Beta Supply", title: "Complete product compliance packet", done: false, dueAt: "2026-04-01T00:00:00.000Z" }],
    sustainabilityPackets: [{ id: "sus-1", title: "ESG packet", status: "DRAFT", sustainabilityScore: 68, missingDataCount: 2, recommendationCount: 1 }],
    contractCompliancePackets: [{ id: "contract-1", title: "Contract packet", status: "DRAFT", complianceScore: 72, expiringDocumentCount: 1, complianceGapCount: 1, renewalRiskCount: 0 }],
    riskSignals: [{ id: "risk-1", title: "Supplier certificate review", eventType: "certificate", severity: "HIGH", confidence: 90, reviewState: "ACTION_REQUIRED", affectedObjectType: "SUPPLIER", affectedObjectId: "sup-2" }],
    actionQueue: [{ id: "queue-1", actionKind: "product_passport_review", status: "PENDING", priority: "HIGH", objectType: "assistant_product_lifecycle_packet" }],
  };
}

describe("product lifecycle passport assistant", () => {
  it("builds a durable product lifecycle packet with passport and compliance evidence", () => {
    const packet = buildProductLifecyclePacket(sampleInputs());

    expect(packet.title).toContain("Sprint 13 Product Lifecycle");
    expect(packet.productCount).toBe(2);
    expect(packet.passportGapCount).toBeGreaterThan(0);
    expect(packet.documentRiskCount).toBe(2);
    expect(packet.supplierComplianceGapCount).toBeGreaterThanOrEqual(4);
    expect(packet.sustainabilityGapCount).toBeGreaterThan(0);
    expect(packet.lifecycleRisk.externalRiskCount).toBe(1);
    expect(packet.releaseChecklist.releaseReady).toBe(false);
    expect(packet.lifecycleScore).toBeLessThan(100);
  });

  it("keeps product, supplier, ESG, passport, and recall work approval-gated", () => {
    const packet = buildProductLifecyclePacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("never mutated silently");
    expect(packet.catalogReadiness.guardrail).toContain("not changed automatically");
    expect(packet.passportEvidence.guardrail).toContain("not created or published automatically");
    expect(packet.supplierCompliance.guardrail).toContain("not changed automatically");
    expect(packet.sustainabilityPassport.guardrail).toContain("require reviewed factors and approval");
    expect(packet.lifecycleRisk.guardrail).toContain("does not close risk events");
    expect(packet.releaseChecklist.guardrail).toContain("does not activate products");
    expect(packet.rollbackPlan.steps.join(" ")).toContain("Leave product master data");
  });
});
