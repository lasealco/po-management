export type AssistantAdminThresholds = {
  evidenceCoveragePct: number;
  releaseGateScore: number;
  automationReadiness: number;
  maxOpenHighPriorityActions: number;
};

export type AssistantAdminSignals = {
  evidenceCoveragePct: number;
  latestReleaseGateScore: number;
  latestReleaseGateStatus: string | null;
  enabledAutomationCount: number;
  pausedAutomationCount: number;
  openHighPriorityActionCount: number;
  approvedPromptCount: number;
  activePlaybookCount: number;
};

export const DEFAULT_ASSISTANT_ADMIN_THRESHOLDS: AssistantAdminThresholds = {
  evidenceCoveragePct: 70,
  releaseGateScore: 75,
  automationReadiness: 80,
  maxOpenHighPriorityActions: 10,
};

export function normalizeAssistantAdminThresholds(input: unknown): AssistantAdminThresholds {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const numberOrDefault = (key: keyof AssistantAdminThresholds) => {
    const value = raw[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_ASSISTANT_ADMIN_THRESHOLDS[key];
    return Math.max(0, Math.min(key === "maxOpenHighPriorityActions" ? 999 : 100, Math.round(value)));
  };
  return {
    evidenceCoveragePct: numberOrDefault("evidenceCoveragePct"),
    releaseGateScore: numberOrDefault("releaseGateScore"),
    automationReadiness: numberOrDefault("automationReadiness"),
    maxOpenHighPriorityActions: numberOrDefault("maxOpenHighPriorityActions"),
  };
}

export function evaluateAssistantAdminReadiness(signals: AssistantAdminSignals, thresholds: AssistantAdminThresholds) {
  const checks = [
    {
      key: "evidence_coverage",
      label: "Evidence coverage",
      passed: signals.evidenceCoveragePct >= thresholds.evidenceCoveragePct,
      detail: `${signals.evidenceCoveragePct}% coverage, threshold ${thresholds.evidenceCoveragePct}%.`,
    },
    {
      key: "release_gate",
      label: "Release gate",
      passed: signals.latestReleaseGateStatus === "PASSED" && signals.latestReleaseGateScore >= thresholds.releaseGateScore,
      detail: `${signals.latestReleaseGateStatus ?? "NO_GATE"} at ${signals.latestReleaseGateScore}/100, threshold ${thresholds.releaseGateScore}.`,
    },
    {
      key: "automation_control",
      label: "Automation control",
      passed: signals.pausedAutomationCount === 0,
      detail: `${signals.enabledAutomationCount} enabled, ${signals.pausedAutomationCount} paused.`,
    },
    {
      key: "open_priority_work",
      label: "Open priority work",
      passed: signals.openHighPriorityActionCount <= thresholds.maxOpenHighPriorityActions,
      detail: `${signals.openHighPriorityActionCount} high-priority open items, max ${thresholds.maxOpenHighPriorityActions}.`,
    },
    {
      key: "operating_assets",
      label: "Prompt and playbook assets",
      passed: signals.approvedPromptCount > 0 && signals.activePlaybookCount > 0,
      detail: `${signals.approvedPromptCount} approved prompts and ${signals.activePlaybookCount} active playbooks.`,
    },
  ];
  const score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
  return {
    score,
    status: checks.every((check) => check.passed) ? "READY" : "BLOCKED",
    checks,
  };
}

export function buildAssistantCompliancePacket(input: {
  generatedAt: string;
  tenant: { id: string; name: string; slug: string };
  rolloutMode: string;
  pilotRoles: string[];
  pilotSites: string[];
  thresholds: AssistantAdminThresholds;
  signals: AssistantAdminSignals;
  readiness: ReturnType<typeof evaluateAssistantAdminReadiness>;
  permissionMatrix: Array<{ resource: string; action: string; label: string; grantedRoleCount: number }>;
}) {
  return {
    packetType: "AMP11_ASSISTANT_CONTROL_PACKET",
    generatedAt: input.generatedAt,
    tenant: input.tenant,
    rollout: {
      mode: input.rolloutMode,
      pilotRoles: input.pilotRoles,
      pilotSites: input.pilotSites,
    },
    thresholds: input.thresholds,
    readiness: input.readiness,
    signals: input.signals,
    permissionMatrix: input.permissionMatrix,
    controls: [
      "Writes require org.settings edit.",
      "Automation enablement remains guarded by release gates and AMP8 readiness.",
      "Compliance packet is exported as a snapshot; it does not mutate operational data.",
    ],
  };
}

export function buildPermissionMatrix(
  catalog: ReadonlyArray<{ resource: string; action: string; label: string; description: string }>,
  grants: Array<{ resource: string; action: string; roleId: string }>,
) {
  return catalog.map((permission) => {
    const roleIds = new Set(
      grants
        .filter((grant) => grant.resource === permission.resource && grant.action === permission.action)
        .map((grant) => grant.roleId),
    );
    return {
      resource: permission.resource,
      action: permission.action,
      label: permission.label,
      description: permission.description,
      grantedRoleCount: roleIds.size,
    };
  });
}
