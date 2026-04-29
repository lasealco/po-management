import { describe, expect, it } from "vitest";

import { buildAgentGovernancePacket, type AgentGovernanceInputs } from "./agent-governance";

const inputs: AgentGovernanceInputs = {
  prompts: [
    { id: "prompt-1", title: "Approved control prompt", status: "APPROVED", domain: "governance", roleScope: "admin", usageCount: 12 },
    { id: "prompt-2", title: "Draft memory prompt", status: "DRAFT", domain: "memory", roleScope: "admin", usageCount: 0 },
  ],
  policies: [
    { id: "policy-1", actionKind: "assistant_agent_tool", label: "Agent tool execution", status: "ENABLED", readinessScore: 62, threshold: 80, rollbackPlan: "Pause agent tool execution." },
    { id: "policy-2", actionKind: "assistant_prompt_update", label: "Prompt update", status: "SHADOW", readinessScore: 90, threshold: 80, rollbackPlan: "Revert prompt update." },
  ],
  audits: [
    { id: "audit-1", surface: "assistant_agent_governance", answerKind: "agent_packet", evidencePresent: true, qualityPresent: true, feedback: null },
    { id: "audit-2", surface: "assistant_agent_governance", answerKind: "agent_packet", evidencePresent: false, qualityPresent: false, feedback: "not_helpful" },
    { id: "audit-3", surface: "assistant_observability", answerKind: "incident", evidencePresent: false, qualityPresent: false, feedback: null },
  ],
  actionQueue: [
    { id: "action-1", actionKind: "assistant_agent_tool", status: "PENDING", priority: "HIGH" },
    { id: "action-2", actionKind: "assistant_agent_tool", status: "PENDING", priority: "MEDIUM" },
  ],
  observabilityIncidents: [{ id: "incident-1", status: "OPEN", severity: "HIGH", healthScore: 44 }],
};

describe("agent governance sprint helpers", () => {
  it("builds durable governance packets with registry, tool, prompt, memory, and observability sections", () => {
    const packet = buildAgentGovernancePacket(inputs);

    expect(packet.governanceScore).toBeLessThan(80);
    expect(packet.agentRegistry.agents.length).toBeGreaterThan(0);
    expect(packet.toolScopes.highRiskScopes[0]).toMatchObject({ actionKind: "assistant_agent_tool", risk: "HIGH" });
    expect(packet.promptSupplyChain.draftCount).toBe(1);
    expect(packet.memoryGovernance.weakEvidenceCount).toBe(2);
    expect(packet.observability.highIncidentCount).toBe(1);
  });

  it("requires human certification review before changing source controls", () => {
    const packet = buildAgentGovernancePacket(inputs);

    expect(packet.certificationPlan.status).toBe("REVIEW_REQUIRED");
    expect(packet.certificationPlan.steps.join(" ")).toContain("Queue downstream certification");
    expect(packet.rollbackPlan.steps[0]).toContain("Keep agent scopes, tool permissions, prompt records");
    expect(packet.leadershipSummary).toContain("does not mutate agent scopes");
  });
});
