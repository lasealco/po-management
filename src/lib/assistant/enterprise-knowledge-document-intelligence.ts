export type EnterpriseKnowledgeInputs = {
  evidenceRows: Array<{
    id: string;
    label: string;
    confidence: string;
    archivedAt: Date | null;
    sourceType: string;
  }>;
  promptItems: Array<{ id: string; title: string; status: string; usageCount: number }>;
  reviewExamples: Array<{ id: string; status: string; label: string }>;
  releaseGates: Array<{ id: string; gateKey: string; status: string; score: number; threshold: number }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function buildCitationEvidenceSignals(inputs: EnterpriseKnowledgeInputs) {
  const active = inputs.evidenceRows.filter((row) => !row.archivedAt);
  const archived = inputs.evidenceRows.filter((row) => !!row.archivedAt);
  const lowConfidence = active.filter((row) => row.confidence === "LOW");
  const evidenceCitationRiskCount = lowConfidence.length + Math.min(archived.length, 14);
  return {
    evidenceCitationRiskCount,
    lowConfidenceSamples: lowConfidence.slice(0, 12).map((row) => ({
      evidenceId: row.id,
      label: row.label,
      confidence: row.confidence,
      sourceType: row.sourceType,
    })),
    archivedEvidenceRows: archived.length,
    guardrail:
      "Citation overlays summarize AMP7 grounding ledger posture — they do not publish policies, overwrite KB snippets, or treat excerpts as operational truth automatically.",
  };
}

export function buildPromptGovernanceSignals(inputs: EnterpriseKnowledgeInputs) {
  const drafts = inputs.promptItems.filter((item) => item.status === "DRAFT" || item.status === "REVIEW_QUEUED");
  const promptGovernanceRiskCount = drafts.length;
  return {
    promptGovernanceRiskCount,
    pendingPrompts: drafts.slice(0, 14).map((item) => ({
      promptId: item.id,
      title: item.title,
      status: item.status,
      usageCount: item.usageCount,
    })),
    guardrail:
      "Prompt governance overlays cite AMP7 library items — they do not promote drafts to production prompts, alter starter bundles, or change automation prompts silently.",
  };
}

export function buildReviewPipelineSignals(inputs: EnterpriseKnowledgeInputs) {
  const queued = inputs.reviewExamples.filter((row) => row.status === "QUEUED");
  const reviewPipelineGapCount = queued.length;
  return {
    reviewPipelineGapCount,
    backlogExamples: queued.slice(0, 14).map((row) => ({
      exampleId: row.id,
      label: row.label,
      status: row.status,
    })),
    guardrail:
      "Training-review overlays summarize AMP7 export/readiness gaps — they do not export examples to downstream trainers or overwrite reviewer corrections automatically.",
  };
}

export function buildReleaseGateSignals(inputs: EnterpriseKnowledgeInputs) {
  const blocked = inputs.releaseGates.filter((gate) => gate.status === "BLOCKED" || gate.score < gate.threshold);
  const releaseGateRiskCount = blocked.length;
  return {
    releaseGateRiskCount,
    blockedGates: blocked.slice(0, 10).map((gate) => ({
      gateId: gate.id,
      gateKey: gate.gateKey,
      status: gate.status,
      score: gate.score,
      threshold: gate.threshold,
    })),
    guardrail:
      "Release gate overlays cite AMP7 gate snapshots — they do not bypass gates, flip CI/CD flags, or ship assistant builds automatically.",
  };
}

export function buildEnterpriseKnowledgePacket(inputs: EnterpriseKnowledgeInputs) {
  const citationEvidenceJson = buildCitationEvidenceSignals(inputs);
  const promptGovernanceJson = buildPromptGovernanceSignals(inputs);
  const reviewPipelineJson = buildReviewPipelineSignals(inputs);
  const releaseGateJson = buildReleaseGateSignals(inputs);

  const evidenceCitationRiskCount = citationEvidenceJson.evidenceCitationRiskCount;
  const promptGovernanceRiskCount = promptGovernanceJson.promptGovernanceRiskCount;
  const reviewPipelineGapCount = reviewPipelineJson.reviewPipelineGapCount;
  const releaseGateRiskCount = releaseGateJson.releaseGateRiskCount;

  const knowledgeScore = clamp(
    Math.round(
      100 -
        Math.min(22, evidenceCitationRiskCount * 2) -
        Math.min(20, promptGovernanceRiskCount * 2) -
        Math.min(18, reviewPipelineGapCount * 2) -
        Math.min(24, releaseGateRiskCount * 5),
    ),
  );

  const sourceSummary = {
    evidenceRecordsSampled: inputs.evidenceRows.length,
    promptLibrarySampled: inputs.promptItems.length,
    reviewExamplesSampled: inputs.reviewExamples.length,
    releaseGatesSampled: inputs.releaseGates.length,
    guardrail:
      "Sprint 25 packets unify AMP7 citation evidence, prompt starters, training-review examples, and release gate posture — knowledge stewards approve publications, prompt promotions, exports, and extraction reliance outside this sprint.",
  };

  const responsePlan = {
    status:
      knowledgeScore < 62 ? "KNOWLEDGE_GOVERNANCE_REVIEW_REQUIRED" : knowledgeScore < 80 ? "KNOWLEDGE_DESK_REVIEW" : "MONITOR",
    owners: ["Knowledge steward", "AI quality owner", "Compliance reviewer", "Documentation owner"],
    steps: [
      "Separate citation freshness from prompt readiness — avoid mixing draft prompts with production starters.",
      "Confirm training exports reference reviewer-approved examples before referencing downstream automation.",
      "Route blocked release gates through governed CI processes — assistant packets remain descriptive.",
      "Escalate archived evidence retirement through steward workflows rather than silent deletes.",
    ],
    guardrail: "Knowledge recommendations remain advisory until stewards execute approved publication workflows.",
  };

  const rollbackPlan = {
    steps: [
      "Rejecting a packet does not delete evidence rows, prompt drafts, review examples, or release gate snapshots.",
      "Open a fresh packet after steward-approved publications or automation switches.",
      "Manual approvals remain mandatory before trusting extracted fields in operational workflows.",
    ],
    guardrail: "Rollback preserves advisory narratives — production KB and prompt stores are never auto-reverted here.",
  };

  const leadershipSummary = [
    `Sprint 25 Enterprise Knowledge & Document Intelligence score is ${knowledgeScore}/100 with ${evidenceCitationRiskCount} citation-risk cue(s), ${promptGovernanceRiskCount} prompt-governance cue(s), ${reviewPipelineGapCount} training pipeline gap(s), and ${releaseGateRiskCount} release gate risk cue(s).`,
    citationEvidenceJson.guardrail,
    sourceSummary.guardrail,
  ].join("\n\n");

  return {
    title: `Sprint 25 Enterprise Knowledge & Document Intelligence: score ${knowledgeScore}/100`,
    status: "DRAFT" as const,
    knowledgeScore,
    evidenceCitationRiskCount,
    promptGovernanceRiskCount,
    reviewPipelineGapCount,
    releaseGateRiskCount,
    sourceSummary,
    citationEvidenceJson,
    promptGovernanceJson,
    reviewPipelineJson,
    releaseGateJson,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
