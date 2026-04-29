import { describe, expect, it } from "vitest";

import { buildIncidentNerveCenterPacket, type IncidentNerveCenterInputs } from "./incident-nerve-center";

function sampleInputs(): IncidentNerveCenterInputs {
  return {
    ctExceptions: [
      {
        id: "ct-1",
        type: "DELAY",
        severity: "CRITICAL",
        status: "OPEN",
        recoveryState: "TRIAGE",
        ownerUserId: null,
        shipmentId: "sh-1",
        shipmentNo: "SH-001",
        orderId: "po-1",
        recoveryPlan: null,
        customerDraft: null,
      },
      {
        id: "ct-2",
        type: "DELAY",
        severity: "WARN",
        status: "OPEN",
        recoveryState: "ACTIVE",
        ownerUserId: "user-1",
        shipmentId: "sh-1",
        shipmentNo: "SH-001",
        orderId: "po-1",
        recoveryPlan: "Follow up with carrier daily.",
        customerDraft: "Draft only",
      },
    ],
    assistantIncidents: [
      {
        id: "inc-1",
        title: "Cross-module spike",
        status: "OPEN",
        severity: "HIGH",
        severityScore: 70,
        incidentKey: "SPILL-OPS",
        mergedIntoIncidentId: null,
      },
    ],
    observabilityIncidents: [{ id: "obs-1", title: "Eval drift", status: "OPEN", severity: "HIGH", healthScore: 40 }],
    twinRiskSignals: [{ id: "tw-1", code: "RISK-1", severity: "HIGH", title: "Lane risk", acknowledged: false }],
    riskWarRooms: [{ id: "war-1", title: "Port disruption", status: "DRAFT", riskScore: 72 }],
    invoiceIntakes: [{ id: "inv-1", rollupOutcome: "FAIL", redLineCount: 2, amberLineCount: 0 }],
    apiHubReviewItems: [{ id: "hub-1", title: "Mapping conflict", status: "OPEN", severity: "WARN" }],
    actionQueue: [{ id: "aq-1", actionKind: "ct_exception_review", status: "PENDING", priority: "HIGH", objectType: "ct_exception" }],
  };
}

describe("incident nerve center assistant", () => {
  it("builds a Sprint 17 nerve-center packet across CT, rooms, blast, recovery, twin, finance, and dedupe signals", () => {
    const packet = buildIncidentNerveCenterPacket(sampleInputs());

    expect(packet.title).toContain("Sprint 17 Incident Nerve Center");
    expect(packet.nerveScore).toBeLessThan(100);
    expect(packet.controlTowerRiskCount).toBeGreaterThan(0);
    expect(packet.crossModuleIncidentCount).toBeGreaterThan(0);
    expect(packet.blastRadiusSignalCount).toBeGreaterThan(0);
    expect(packet.recoveryGapCount).toBeGreaterThan(0);
    expect(packet.observabilityRiskCount).toBeGreaterThan(0);
    expect(packet.twinRiskCount).toBeGreaterThan(0);
    expect(packet.financeIntegrationRiskCount).toBeGreaterThan(0);
    expect(packet.responsePlan.status).toContain("REVIEW");
  });

  it("keeps merges, owners, communications, Twin acks, and finance actions approval-gated", () => {
    const packet = buildIncidentNerveCenterPacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("without merging");
    expect(packet.controlTower.guardrail).toContain("does not merge");
    expect(packet.crossModule.guardrail).toContain("merges");
    expect(packet.blastRadius.guardrail).toContain("do not page");
    expect(packet.playbookRecovery.guardrail).toContain("do not assign");
    expect(packet.observabilityTwin.guardrail).toContain("do not pause");
    expect(packet.financeIntegration.guardrail).toContain("does not approve");
    expect(packet.dedupeMerge.guardrail).toContain("never merge");
    expect(packet.customerComms.guardrail).toContain("not transmitted");
    expect(packet.rollbackPlan.guardrail).toContain("never auto-reverted");
  });
});
