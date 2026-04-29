export type AgentGovernanceToolScope = {
  actionKind: string;
  label: string;
  status: string;
  readinessScore: number;
  threshold: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
};

export type AgentGovernanceInputs = {
  prompts: Array<{ id: string; title: string; status: string; domain: string | null; roleScope: string | null; usageCount: number }>;
  policies: Array<{ id: string; actionKind: string; label: string; status: string; readinessScore: number; threshold: number; rollbackPlan: string | null }>;
  audits: Array<{ id: string; surface: string; answerKind: string; evidencePresent: boolean; qualityPresent: boolean; feedback: string | null }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string }>;
  observabilityIncidents: Array<{ id: string; status: string; severity: string; healthScore: number }>;
};

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function buildAgentRegistry(inputs: AgentGovernanceInputs) {
  const surfaces = Array.from(new Set(inputs.audits.map((audit) => audit.surface))).sort();
  const agents = surfaces.length
    ? surfaces.map((surface) => {
        const audits = inputs.audits.filter((audit) => audit.surface === surface);
        const evidenceCoveragePct = pct(audits.filter((audit) => audit.evidencePresent || audit.qualityPresent).length, audits.length);
        const negativeFeedbackCount = audits.filter((audit) => audit.feedback === "not_helpful").length;
        const relatedPolicies = inputs.policies.filter((policy) => policy.actionKind.includes(surface.replace(/^assistant_/, "")) || surface.includes(policy.actionKind.split("_")[0] ?? ""));
        const status = evidenceCoveragePct >= 70 && negativeFeedbackCount === 0 ? "CERTIFIABLE" : "REVIEW_REQUIRED";
        return {
          agentKey: surface,
          label: surface.replaceAll("_", " "),
          status,
          evidenceCoveragePct,
          negativeFeedbackCount,
          toolScopeCount: relatedPolicies.length,
          certificationOwner: status === "CERTIFIABLE" ? "AI quality" : "Control owner",
        };
      })
    : [
        {
          agentKey: "assistant_control_plane",
          label: "assistant control plane",
          status: "REVIEW_REQUIRED",
          evidenceCoveragePct: 0,
          negativeFeedbackCount: 0,
          toolScopeCount: inputs.policies.length,
          certificationOwner: "AI quality",
        },
      ];
  return {
    agents,
    highRiskAgents: agents.filter((agent) => agent.status !== "CERTIFIABLE" || agent.evidenceCoveragePct < 70),
  };
}

export function buildToolScopeReview(inputs: AgentGovernanceInputs) {
  const scopes: AgentGovernanceToolScope[] = inputs.policies.map((policy) => {
    const pending = inputs.actionQueue.filter((item) => item.actionKind === policy.actionKind && item.status === "PENDING").length;
    const risk = policy.status === "ENABLED" && policy.readinessScore < policy.threshold ? "HIGH" : pending >= 5 ? "MEDIUM" : "LOW";
    return {
      actionKind: policy.actionKind,
      label: policy.label,
      status: policy.status,
      readinessScore: policy.readinessScore,
      threshold: policy.threshold,
      risk,
    };
  });
  return {
    scopes,
    highRiskScopes: scopes.filter((scope) => scope.risk === "HIGH"),
    reviewRequired: scopes.filter((scope) => scope.risk !== "LOW" || scope.status === "ENABLED"),
  };
}

export function buildPromptSupplyChain(inputs: AgentGovernanceInputs) {
  const approved = inputs.prompts.filter((prompt) => prompt.status === "APPROVED");
  const draft = inputs.prompts.filter((prompt) => prompt.status !== "APPROVED");
  return {
    promptCount: inputs.prompts.length,
    approvedCount: approved.length,
    draftCount: draft.length,
    domains: Array.from(new Set(inputs.prompts.map((prompt) => prompt.domain ?? "general"))).sort(),
    reviewQueue: draft.slice(0, 10).map((prompt) => ({ id: prompt.id, title: prompt.title, status: prompt.status, domain: prompt.domain })),
    guardrail: "Prompt updates require approval and do not rewrite prompt library records from this sprint packet.",
  };
}

export function buildMemoryGovernance(inputs: AgentGovernanceInputs) {
  const weakEvidence = inputs.audits.filter((audit) => !audit.evidencePresent && !audit.qualityPresent);
  return {
    policyCount: 4,
    policies: [
      "Memories must cite source audit events or approved evidence.",
      "Personal data memories require privacy review before reuse.",
      "Corrections create new review examples instead of rewriting source audit logs.",
      "Expired memories are queued for review before archive/delete actions.",
    ],
    weakEvidenceCount: weakEvidence.length,
    correctionCandidates: weakEvidence.slice(0, 10).map((audit) => ({ auditEventId: audit.id, surface: audit.surface, answerKind: audit.answerKind })),
  };
}

export function buildAgentObservability(inputs: AgentGovernanceInputs) {
  const evidenceCoveragePct = pct(inputs.audits.filter((audit) => audit.evidencePresent || audit.qualityPresent).length, inputs.audits.length);
  const negativeFeedbackCount = inputs.audits.filter((audit) => audit.feedback === "not_helpful").length;
  const openIncidentCount = inputs.observabilityIncidents.filter((incident) => incident.status !== "RESOLVED").length;
  const highIncidentCount = inputs.observabilityIncidents.filter((incident) => incident.severity === "HIGH" && incident.status !== "RESOLVED").length;
  return {
    evidenceCoveragePct,
    negativeFeedbackCount,
    openIncidentCount,
    highIncidentCount,
    actionBacklogCount: inputs.actionQueue.filter((item) => item.status === "PENDING").length,
    signalCount: inputs.audits.length + inputs.policies.length + inputs.actionQueue.length + inputs.observabilityIncidents.length,
  };
}

export function buildCertificationPlan(input: {
  registry: ReturnType<typeof buildAgentRegistry>;
  toolScopes: ReturnType<typeof buildToolScopeReview>;
  observability: ReturnType<typeof buildAgentObservability>;
}) {
  const blockers = [
    ...input.registry.highRiskAgents.map((agent) => `${agent.label}: evidence coverage ${agent.evidenceCoveragePct}%`),
    ...input.toolScopes.highRiskScopes.map((scope) => `${scope.actionKind}: enabled below threshold`),
    input.observability.highIncidentCount > 0 ? `${input.observability.highIncidentCount} high-severity observability incident(s)` : null,
  ].filter((item): item is string => Boolean(item));
  return {
    status: blockers.length === 0 ? "CERTIFICATION_READY" : "REVIEW_REQUIRED",
    owners: ["AI platform", "Security", "AI quality", "Control owner"],
    blockers,
    steps: [
      "Review agent registry evidence and owner assignments.",
      "Recertify high-risk tool scopes before enabling or expanding permissions.",
      "Approve prompt and memory governance controls.",
      "Queue downstream certification before changing agent scopes, tools, prompts, memories, or automation policies.",
    ],
  };
}

export function buildAgentGovernancePacket(inputs: AgentGovernanceInputs) {
  const agentRegistry = buildAgentRegistry(inputs);
  const toolScopes = buildToolScopeReview(inputs);
  const promptSupplyChain = buildPromptSupplyChain(inputs);
  const memoryGovernance = buildMemoryGovernance(inputs);
  const observability = buildAgentObservability(inputs);
  const certificationPlan = buildCertificationPlan({ registry: agentRegistry, toolScopes, observability });
  const governanceScore = Math.max(
    0,
    Math.min(
      100,
      88 -
        agentRegistry.highRiskAgents.length * 8 -
        toolScopes.highRiskScopes.length * 10 -
        observability.highIncidentCount * 12 -
        Math.max(0, 70 - observability.evidenceCoveragePct),
    ),
  );
  const rollbackPlan = {
    steps: [
      "Keep agent scopes, tool permissions, prompt records, memory policy, and automation policies unchanged until separate approval.",
      "If certification is rejected, preserve the packet and action queue notes for audit.",
      "Create a fresh packet when telemetry, prompt approval, or tool permission evidence changes materially.",
      "Use assistant audit events to explain why certification was queued, approved, rejected, or superseded.",
    ],
  };
  const leadershipSummary = [
    `Sprint 1 Agent Governance score is ${governanceScore}/100 across ${agentRegistry.agents.length} agent surface${agentRegistry.agents.length === 1 ? "" : "s"}, ${toolScopes.scopes.length} tool scope${toolScopes.scopes.length === 1 ? "" : "s"}, and ${observability.signalCount} telemetry signal${observability.signalCount === 1 ? "" : "s"}.`,
    `${agentRegistry.highRiskAgents.length} agent certification blocker${agentRegistry.highRiskAgents.length === 1 ? "" : "s"}, ${toolScopes.highRiskScopes.length} high-risk tool scope${toolScopes.highRiskScopes.length === 1 ? "" : "s"}, ${promptSupplyChain.draftCount} prompt review item${promptSupplyChain.draftCount === 1 ? "" : "s"}, and ${memoryGovernance.weakEvidenceCount} memory/evidence correction candidate${memoryGovernance.weakEvidenceCount === 1 ? "" : "s"} are in scope.`,
    "Packet creation does not mutate agent scopes, tool permissions, prompt library records, memory policy, automation policies, or source telemetry.",
  ].join("\n\n");
  return {
    title: `Sprint 1 Agent Governance packet: score ${governanceScore}/100`,
    status: "DRAFT",
    governanceScore,
    agentRegistry,
    toolScopes,
    promptSupplyChain,
    memoryGovernance,
    observability,
    certificationPlan,
    rollbackPlan,
    leadershipSummary,
  };
}
