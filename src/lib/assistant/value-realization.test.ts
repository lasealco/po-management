import { describe, expect, it } from "vitest";

import {
  buildAdoptionFunnel,
  buildExportReport,
  buildRoiAssumptions,
  buildSavings,
  buildServiceImpact,
  buildValueAttribution,
  buildValueRealizationPacket,
  type ValueRealizationInputs,
} from "./value-realization";

const inputs: ValueRealizationInputs = {
  audits: [
    { id: "audit-1", surface: "assistant_chat", actorUserId: "user-1", answerKind: "answer", objectType: "shipment", feedback: "helpful", createdAt: "2026-04-28T00:00:00.000Z" },
    { id: "audit-2", surface: "assistant_chat", actorUserId: "user-2", answerKind: "answer", objectType: "invoice", feedback: "helpful", createdAt: "2026-04-28T00:01:00.000Z" },
    { id: "audit-3", surface: "assistant_finance", actorUserId: "user-1", answerKind: "finance_packet", objectType: "invoice", feedback: "not_helpful", createdAt: "2026-04-28T00:02:00.000Z" },
  ],
  actions: [
    { id: "action-1", actionKind: "invoice_review", status: "DONE", priority: "HIGH", objectType: "invoice", createdAt: "2026-04-28T00:00:00.000Z" },
    { id: "action-2", actionKind: "shipment_recovery", status: "DONE", priority: "HIGH", objectType: "shipment", createdAt: "2026-04-28T00:00:00.000Z" },
    { id: "action-3", actionKind: "supplier_followup", status: "PENDING", priority: "MEDIUM", objectType: "supplier", createdAt: "2026-04-28T00:00:00.000Z" },
  ],
  finances: [
    { id: "finance-1", sourceType: "FINANCE_PACKET", status: "REVIEW_QUEUED", varianceAmount: 1200, recoveredAmount: 800, createdAt: "2026-04-28T00:00:00.000Z" },
    { id: "intake-1", sourceType: "INVOICE_INTAKE", status: "DISPUTE_QUEUED", varianceAmount: 500, recoveredAmount: 500, createdAt: "2026-04-28T00:00:00.000Z" },
  ],
  services: [
    { id: "brief-1", sourceType: "CUSTOMER_BRIEF", status: "REVIEW_QUEUED", serviceScore: 82, severity: "LOW", resolved: true, createdAt: "2026-04-28T00:00:00.000Z" },
    { id: "exception-1", sourceType: "CT_EXCEPTION", status: "RESOLVED", serviceScore: 85, severity: "HIGH", resolved: true, createdAt: "2026-04-28T00:00:00.000Z" },
  ],
  automations: [
    { id: "auto-1", actionKind: "invoice_review", status: "ENABLED", readinessScore: 85, matched: true },
    { id: "auto-2", actionKind: "shipment_recovery", status: "SHADOW", readinessScore: 70, matched: null },
  ],
  assumptions: {
    hourlyCost: 100,
    minutesSavedPerCompletedAction: 30,
    automationMinutesSaved: 60,
    customerSaveValue: 300,
    monthlyProgramCost: 1000,
  },
};

describe("assistant value realization helpers", () => {
  it("builds adoption funnel from assistant telemetry", () => {
    const adoption = buildAdoptionFunnel(inputs);

    expect(adoption.interactionCount).toBe(3);
    expect(adoption.activeUserCount).toBe(2);
    expect(adoption.surfaceCount).toBe(2);
    expect(adoption.helpfulRatePct).toBe(67);
  });

  it("estimates avoided cost, automation savings, and recovered value", () => {
    const savings = buildSavings(inputs);

    expect(savings.completedActions).toBe(2);
    expect(savings.avoidedCost).toBe(100);
    expect(savings.automationSavings).toBe(100);
    expect(savings.recoveredValue).toBe(1300);
    expect(savings.totalEstimatedValue).toBe(1500);
  });

  it("attributes value to finance, service, and completed domains", () => {
    const serviceImpact = buildServiceImpact(inputs);
    const attribution = buildValueAttribution(inputs, buildSavings(inputs), serviceImpact);

    expect(serviceImpact.resolvedExceptions).toBe(1);
    expect(serviceImpact.estimatedCustomerSaveValue).toBe(600);
    expect(attribution.entries.map((entry) => entry.domain)).toEqual(expect.arrayContaining(["finance", "service", "invoice", "shipment"]));
  });

  it("builds ROI assumptions and role-safe exports", () => {
    const savings = buildSavings(inputs);
    const roi = buildRoiAssumptions(inputs, savings);
    const report = buildExportReport({
      adoptionFunnel: buildAdoptionFunnel(inputs),
      savings,
      serviceImpact: buildServiceImpact(inputs),
      valueAttribution: buildValueAttribution(inputs),
      roiAssumptions: roi,
    });

    expect(roi.roiPct).toBe(50);
    expect(roi.guardrail).toContain("reviewed");
    expect(report.redactionMode).toBe("ROLE_SAFE_SUMMARY");
    expect(report.guardrails[0]).toContain("No user emails");
  });

  it("builds a review-gated value realization packet", () => {
    const packet = buildValueRealizationPacket(inputs);

    expect(packet.valueScore).toBeGreaterThan(0);
    expect(packet.totalEstimatedValue).toBe(1500);
    expect(packet.roiPct).toBe(50);
    expect(packet.exportReport.redactionMode).toBe("ROLE_SAFE_SUMMARY");
    expect(packet.leadershipSummary).toContain("does not mutate source records");
  });
});
