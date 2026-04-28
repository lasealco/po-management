export type FrontlineWorkSignal = {
  id: string;
  sourceType: "WMS_TASK" | "CT_EXCEPTION" | "SUPPLIER_TASK";
  title: string;
  status: string;
  role: "WAREHOUSE" | "DRIVER" | "SUPPLIER" | "OPS";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  objectHref: string;
  ageHours: number;
  hasEvidence: boolean;
  requiresNetwork: boolean;
};

export type FrontlineEvidenceSignal = {
  id: string;
  sourceType: "SHIPMENT_DOCUMENT" | "SHIPMENT_NOTE" | "SUPPLIER_DOCUMENT";
  objectId: string;
  label: string;
  capturedAt: string;
  mobileFriendly: boolean;
};

export type FrontlinePermissionSignal = {
  role: "WAREHOUSE" | "DRIVER" | "SUPPLIER" | "OPS";
  canView: boolean;
  canAct: boolean;
};

export type FrontlineInputs = {
  work: FrontlineWorkSignal[];
  evidence: FrontlineEvidenceSignal[];
  permissions: FrontlinePermissionSignal[];
};

function priorityWeight(priority: FrontlineWorkSignal["priority"]) {
  if (priority === "CRITICAL") return 4;
  if (priority === "HIGH") return 3;
  if (priority === "MEDIUM") return 2;
  return 1;
}

export function buildFrontlineQueue(work: FrontlineWorkSignal[]) {
  return work
    .map((item) => ({
      ...item,
      urgencyScore: priorityWeight(item.priority) * 20 + Math.min(30, Math.round(item.ageHours / 4)),
      mobileLabel: `${item.role}: ${item.title}`,
      nextStep:
        item.sourceType === "WMS_TASK"
          ? "Confirm pick/putaway/replenishment evidence before completing the task."
          : item.sourceType === "CT_EXCEPTION"
            ? "Capture field update and queue exception recovery approval."
            : "Collect supplier confirmation and queue onboarding/compliance update.",
    }))
    .sort((a, b) => b.urgencyScore - a.urgencyScore || a.title.localeCompare(b.title));
}

export function buildQuickActions(queue: ReturnType<typeof buildFrontlineQueue>, permissions: FrontlinePermissionSignal[]) {
  const canActByRole = new Map(permissions.map((permission) => [permission.role, permission.canAct]));
  return queue.map((item) => ({
    sourceId: item.id,
    sourceType: item.sourceType,
    role: item.role,
    label:
      item.sourceType === "WMS_TASK"
        ? "Capture task completion evidence"
        : item.sourceType === "CT_EXCEPTION"
          ? "Draft delivery/exception update"
          : "Request supplier confirmation",
    enabled: canActByRole.get(item.role) === true,
    requiresEvidence: !item.hasEvidence,
    guardrail: "Queues a reviewed frontline action only; it does not complete tasks, resolve exceptions, or change supplier records automatically.",
  }));
}

export function buildEvidenceChecklist(queue: ReturnType<typeof buildFrontlineQueue>, evidence: FrontlineEvidenceSignal[]) {
  const evidenceByObject = new Map<string, FrontlineEvidenceSignal[]>();
  for (const item of evidence) {
    evidenceByObject.set(item.objectId, [...(evidenceByObject.get(item.objectId) ?? []), item]);
  }
  const items = queue.map((work) => {
    const linked = evidenceByObject.get(work.id) ?? [];
    return {
      sourceId: work.id,
      sourceType: work.sourceType,
      title: work.title,
      status: linked.length > 0 || work.hasEvidence ? "READY" : "MISSING",
      requiredEvidence:
        work.sourceType === "WMS_TASK"
          ? "Photo, scan, or note confirming task completion context."
          : work.sourceType === "CT_EXCEPTION"
            ? "Delivery update, POD, carrier note, or shipment document."
            : "Supplier confirmation, attachment, or onboarding note.",
      linkedEvidenceCount: linked.length + (work.hasEvidence ? 1 : 0),
    };
  });
  return {
    missingCount: items.filter((item) => item.status === "MISSING").length,
    items,
  };
}

export function buildOfflineRisks(queue: ReturnType<typeof buildFrontlineQueue>) {
  return queue
    .filter((item) => item.requiresNetwork || item.priority === "HIGH" || item.priority === "CRITICAL")
    .map((item) => ({
      sourceId: item.id,
      sourceType: item.sourceType,
      title: item.title,
      severity: item.requiresNetwork ? (item.priority === "CRITICAL" ? "CRITICAL" : "HIGH") : "MEDIUM",
      risk: item.requiresNetwork
        ? "Action depends on live system confirmation; mobile workflow needs poor-network fallback."
        : "High-priority frontline work should be cached and reconciled after connectivity returns.",
      mitigation: "Capture timestamped evidence locally and queue supervisor review before source-system mutation.",
    }));
}

export function buildPermissionScope(permissions: FrontlinePermissionSignal[]) {
  const roles = permissions.map((permission) => ({
    role: permission.role,
    canView: permission.canView,
    canAct: permission.canAct,
    state: permission.canAct ? "ACTION_READY" : permission.canView ? "VIEW_ONLY" : "HIDDEN",
  }));
  return {
    roles,
    blockedRoles: roles.filter((role) => role.state !== "ACTION_READY"),
  };
}

export function scoreFrontlineReadiness(inputs: FrontlineInputs) {
  const queue = buildFrontlineQueue(inputs.work);
  const quickActions = buildQuickActions(queue, inputs.permissions);
  const evidenceChecklist = buildEvidenceChecklist(queue, inputs.evidence);
  const offlineRisks = buildOfflineRisks(queue);
  const enabledActions = quickActions.filter((action) => action.enabled).length;
  const actionCoverage = quickActions.length ? (enabledActions / quickActions.length) * 35 : 20;
  const evidencePenalty = Math.min(30, evidenceChecklist.missingCount * 6);
  const offlinePenalty = Math.min(25, offlineRisks.length * 5);
  const backlogPenalty = Math.min(20, queue.filter((item) => item.ageHours >= 24).length * 5);
  return Math.max(0, Math.min(100, Math.round(60 + actionCoverage - evidencePenalty - offlinePenalty - backlogPenalty)));
}

export function buildFrontlinePacket(inputs: FrontlineInputs) {
  const frontlineQueue = buildFrontlineQueue(inputs.work);
  const quickActions = buildQuickActions(frontlineQueue, inputs.permissions);
  const evidenceChecklist = buildEvidenceChecklist(frontlineQueue, inputs.evidence);
  const offlineRisks = buildOfflineRisks(frontlineQueue);
  const permissionScope = buildPermissionScope(inputs.permissions);
  const readinessScore = scoreFrontlineReadiness(inputs);
  const sourceSummary = {
    workItems: inputs.work.length,
    evidenceItems: inputs.evidence.length,
    roles: inputs.permissions.length,
    actionReadyRoles: permissionScope.roles.filter((role) => role.state === "ACTION_READY").length,
  };
  const leadershipSummary = [
    `Frontline readiness is ${readinessScore}/100 across ${frontlineQueue.length} mobile work item${frontlineQueue.length === 1 ? "" : "s"}.`,
    `${quickActions.length} quick action${quickActions.length === 1 ? "" : "s"}, ${evidenceChecklist.missingCount} evidence gap${evidenceChecklist.missingCount === 1 ? "" : "s"}, and ${offlineRisks.length} offline risk${offlineRisks.length === 1 ? "" : "s"} need review.`,
    "Mobile actions stay approval-gated: no WMS task completion, shipment exception closure, supplier update, or document mutation happens automatically.",
  ].join("\n\n");
  return {
    title: `Frontline packet: score ${readinessScore}/100`,
    status: "DRAFT",
    readinessScore,
    frontlineTaskCount: frontlineQueue.length,
    exceptionCount: inputs.work.filter((item) => item.sourceType === "CT_EXCEPTION").length,
    quickActionCount: quickActions.length,
    evidenceGapCount: evidenceChecklist.missingCount,
    offlineRiskCount: offlineRisks.length,
    sourceSummary,
    frontlineQueue,
    quickActions,
    evidenceChecklist,
    offlineRisks,
    permissionScope,
    leadershipSummary,
  };
}
