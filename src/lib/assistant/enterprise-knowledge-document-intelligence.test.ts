import { describe, expect, it } from "vitest";

import {
  buildEnterpriseKnowledgePacket,
  type EnterpriseKnowledgeInputs,
} from "./enterprise-knowledge-document-intelligence";

function sampleInputs(): EnterpriseKnowledgeInputs {
  const lows = Array.from({ length: 6 }, (_, i) => ({
    id: `e${i}`,
    label: `Doc ${i}`,
    confidence: "LOW",
    archivedAt: null as Date | null,
    sourceType: "LINK",
  }));
  const archived = Array.from({ length: 12 }, (_, i) => ({
    id: `a${i}`,
    label: `Old ${i}`,
    confidence: "HIGH",
    archivedAt: new Date(),
    sourceType: "LINK",
  }));
  return {
    evidenceRows: [...lows, ...archived],
    promptItems: Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      title: `Draft ${i}`,
      status: "DRAFT",
      usageCount: 0,
    })),
    reviewExamples: Array.from({ length: 5 }, (_, i) => ({
      id: `x${i}`,
      status: "QUEUED",
      label: "BAD",
    })),
    releaseGates: [
      { id: "g1", gateKey: "eval_suite", status: "BLOCKED", score: 40, threshold: 75 },
      { id: "g2", gateKey: "grounding", status: "BLOCKED", score: 55, threshold: 75 },
    ],
  };
}

describe("enterprise knowledge document intelligence", () => {
  it("builds Sprint 25 packet from evidence, prompts, review pipeline, and release gates", () => {
    const packet = buildEnterpriseKnowledgePacket(sampleInputs());

    expect(packet.title).toContain("Sprint 25 Enterprise Knowledge");
    expect(packet.knowledgeScore).toBeLessThan(100);
    expect(packet.evidenceCitationRiskCount).toBeGreaterThan(0);
    expect(packet.promptGovernanceRiskCount).toBeGreaterThan(0);
    expect(packet.reviewPipelineGapCount).toBeGreaterThan(0);
    expect(packet.releaseGateRiskCount).toBeGreaterThan(0);
    expect(packet.responsePlan.status).toContain("REVIEW");
  });

  it("keeps publications, prompt promotion, and extraction trust workflow-owned", () => {
    const packet = buildEnterpriseKnowledgePacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("approve publications");
    expect(packet.citationEvidenceJson.guardrail).toContain("do not publish");
    expect(packet.promptGovernanceJson.guardrail).toContain("do not promote");
    expect(packet.reviewPipelineJson.guardrail).toContain("do not export");
    expect(packet.releaseGateJson.guardrail).toContain("do not bypass");
    expect(packet.rollbackPlan.guardrail).toContain("never auto-reverted");
  });
});
