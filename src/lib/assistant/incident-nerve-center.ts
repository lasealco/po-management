export type IncidentNerveCenterInputs = {
  ctExceptions: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    recoveryState: string;
    ownerUserId: string | null;
    shipmentId: string;
    shipmentNo: string | null;
    orderId: string;
    recoveryPlan: string | null;
    customerDraft: string | null;
  }>;
  assistantIncidents: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    severityScore: number;
    incidentKey: string;
    mergedIntoIncidentId: string | null;
  }>;
  observabilityIncidents: Array<{ id: string; title: string; status: string; severity: string; healthScore: number }>;
  twinRiskSignals: Array<{ id: string; code: string; severity: string; title: string; acknowledged: boolean }>;
  riskWarRooms: Array<{ id: string; title: string; status: string; riskScore: number }>;
  invoiceIntakes: Array<{ id: string; rollupOutcome: string; redLineCount: number; amberLineCount: number }>;
  apiHubReviewItems: Array<{ id: string; title: string; status: string; severity: string }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function buildControlTowerSignals(inputs: IncidentNerveCenterInputs) {
  const open = inputs.ctExceptions.filter((exception) => exception.status === "OPEN");
  const criticalSlice = open.filter((exception) => exception.severity === "CRITICAL");
  const controlTowerRiskCount = open.length + criticalSlice.length;
  return {
    controlTowerRiskCount,
    openExceptionCount: open.length,
    openExceptions: open.slice(0, 18).map((exception) => ({
      exceptionId: exception.id,
      type: exception.type,
      severity: exception.severity,
      shipmentId: exception.shipmentId,
      shipmentNo: exception.shipmentNo,
      recoveryState: exception.recoveryState,
      ownerAssigned: Boolean(exception.ownerUserId),
    })),
    guardrail:
      "Control Tower telemetry does not merge duplicates, assign owners, change recovery states, resolve exceptions, send carrier/customer drafts, or mutate shipment records automatically.",
  };
}

export function buildCrossModuleRooms(inputs: IncidentNerveCenterInputs) {
  const openRooms = inputs.assistantIncidents.filter((incident) => incident.status === "OPEN");
  const pendingMerge = inputs.assistantIncidents.filter((incident) => incident.mergedIntoIncidentId);
  const crossModuleIncidentCount = openRooms.length + Math.min(pendingMerge.length, 6);
  return {
    crossModuleIncidentCount,
    openIncidentRooms: openRooms.slice(0, 15).map((incident) => ({
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      severityScore: incident.severityScore,
      incidentKey: incident.incidentKey,
    })),
    mergeHints: pendingMerge.slice(0, 10).map((incident) => ({ incidentId: incident.id, mergedIntoIncidentId: incident.mergedIntoIncidentId })),
    guardrail:
      "Cross-module incident rooms remain advisory; merges, splits, owners, and closures stay human-approved inside Control Tower or incident workflows.",
  };
}

export function buildBlastRadius(inputs: IncidentNerveCenterInputs) {
  const open = inputs.ctExceptions.filter((exception) => exception.status === "OPEN");
  const byShipment = new Map<string, number>();
  for (const exception of open) {
    byShipment.set(exception.shipmentId, (byShipment.get(exception.shipmentId) ?? 0) + 1);
  }
  const multiHitShipments = [...byShipment.entries()].filter(([, count]) => count > 1);
  const blastRadiusSignalCount = multiHitShipments.length + Math.min(open.filter((ex) => !ex.ownerUserId).length, 12);
  return {
    blastRadiusSignalCount,
    multiExceptionShipments: multiHitShipments.slice(0, 12).map(([shipmentId, exceptionCount]) => ({ shipmentId, openExceptionCount: exceptionCount })),
    coverageNote:
      open.length > 0
        ? `${new Set(open.map((exception) => exception.orderId)).size} purchase order(s) touch active shipment exceptions in this packet window.`
        : "No overlapping shipment exceptions detected in captured signals.",
    guardrail:
      "Blast radius overlays estimate operational coupling; they do not page teams, trigger customer notices, or freeze inventory automatically.",
  };
}

export function buildIncidentEscalation(inputs: IncidentNerveCenterInputs) {
  const pending = inputs.actionQueue.filter(
    (item) =>
      item.status === "PENDING" &&
      /exception|incident|recovery|control_tower|shipment|nerve|blast|ct_|invoice_audit|integration/i.test(`${item.actionKind} ${item.objectType ?? ""}`),
  );
  return {
    pendingEscalations: pending.slice(0, 14).map((item) => ({
      actionQueueItemId: item.id,
      actionKind: item.actionKind,
      priority: item.priority,
    })),
    guardrail: "Escalation queues surface work items only — assignments complete through explicit owner acceptance.",
  };
}

export function buildPlaybookRecovery(inputs: IncidentNerveCenterInputs) {
  const gaps = inputs.ctExceptions.filter(
    (exception) =>
      exception.status === "OPEN" &&
      (!exception.ownerUserId || exception.recoveryState === "TRIAGE" || !exception.recoveryPlan || exception.recoveryPlan.trim().length < 8),
  );
  const recoveryGapCount = gaps.length;
  const escalation = buildIncidentEscalation(inputs);
  return {
    recoveryGapCount,
    recoveryGaps: gaps.slice(0, 14).map((exception) => ({
      exceptionId: exception.id,
      shipmentNo: exception.shipmentNo,
      recoveryState: exception.recoveryState,
      missing: [
        !exception.ownerUserId ? "owner" : null,
        exception.recoveryState === "TRIAGE" ? "recovery promotion" : null,
        !exception.recoveryPlan || exception.recoveryPlan.trim().length < 8 ? "recovery plan detail" : null,
      ].filter((item): item is string => Boolean(item)),
    })),
    escalation,
    guardrail:
      "Playbook recommendations do not assign owners, append playbook steps, or close exceptions — those actions stay in approved Control Tower workflows.",
  };
}

export function buildObservabilityTwin(inputs: IncidentNerveCenterInputs) {
  const obsOpen = inputs.observabilityIncidents.filter((incident) => incident.status === "OPEN");
  const twinOpen = inputs.twinRiskSignals.filter((signal) => !signal.acknowledged);
  const warRoomsHot = inputs.riskWarRooms.filter((room) => room.status !== "APPROVED" && room.riskScore >= 55);
  const observabilityRiskCount = obsOpen.length + warRoomsHot.length;
  const twinRiskCount = twinOpen.length;
  return {
    observabilityRiskCount,
    twinRiskCount,
    observabilityOpen: obsOpen.slice(0, 10).map((incident) => ({
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      healthScore: incident.healthScore,
    })),
    twinSignals: twinOpen.slice(0, 12).map((signal) => ({ signalId: signal.id, code: signal.code, severity: signal.severity, title: signal.title })),
    riskWarRooms: warRoomsHot.slice(0, 8).map((room) => ({ roomId: room.id, title: room.title, riskScore: room.riskScore })),
    guardrail:
      "Observability and Twin overlays do not pause automation, acknowledge Twin signals, approve war-room packets, or launch mitigations automatically.",
  };
}

export function buildFinanceIntegration(inputs: IncidentNerveCenterInputs) {
  const riskyInvoices = inputs.invoiceIntakes.filter((invoice) => invoice.rollupOutcome === "FAIL" || invoice.redLineCount > 0);
  const openHub = inputs.apiHubReviewItems.filter((item) => item.status === "OPEN" && (item.severity === "WARN" || item.severity === "HIGH" || item.severity === "CRITICAL"));
  const financeIntegrationRiskCount = riskyInvoices.length + openHub.length;
  return {
    financeIntegrationRiskCount,
    riskyInvoices: riskyInvoices.slice(0, 12).map((invoice) => ({
      intakeId: invoice.id,
      rollupOutcome: invoice.rollupOutcome,
      redLineCount: invoice.redLineCount,
      amberLineCount: invoice.amberLineCount,
    })),
    integrationReviews: openHub.slice(0, 12).map((item) => ({ reviewId: item.id, title: item.title, severity: item.severity })),
    guardrail:
      "Finance and integration evidence stays internal; it does not approve invoices, replay ingestion, edit mappings, or apply staging rows automatically.",
  };
}

export function buildDedupeMerge(inputs: IncidentNerveCenterInputs) {
  const byType = new Map<string, number>();
  for (const exception of inputs.ctExceptions.filter((row) => row.status === "OPEN")) {
    const key = `${exception.type}|${exception.severity}`;
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  const duplicateTypes = [...byType.entries()].filter(([, count]) => count > 1).length;
  const incidentKeyDupes = (() => {
    const keys = new Map<string, number>();
    for (const incident of inputs.assistantIncidents.filter((row) => row.status === "OPEN")) {
      keys.set(incident.incidentKey, (keys.get(incident.incidentKey) ?? 0) + 1);
    }
    return [...keys.values()].filter((count) => count > 1).length;
  })();
  const dedupeCandidateCount = duplicateTypes + incidentKeyDupes;
  return {
    dedupeCandidateCount,
    duplicateExceptionTypes: [...byType.entries()]
      .filter(([, count]) => count > 1)
      .slice(0, 10)
      .map(([key, count]) => ({ key, openCount: count })),
    duplicateIncidentKeys: incidentKeyDupes,
    guardrail:
      "Dedupe hints never merge incidents automatically — analysts confirm merges with audit notes and ownership rules.",
  };
}

export function buildCustomerComms(inputs: IncidentNerveCenterInputs) {
  return {
    safeCommsChecklist: [
      "Remove internal-only supplier economics before sharing externally.",
      "Reference milestone evidence (booking, departure, POD) when explaining delays.",
      "Confirm severity and customer impact statements with Control Tower owners.",
      "Keep carrier drafts separate from customer drafts — never send both audiences the same text.",
    ],
    guardrail:
      "Customer and carrier drafts referenced here are not transmitted; sending stays human-approved through supported channels.",
  };
}

export function buildIncidentNerveCenterPacket(inputs: IncidentNerveCenterInputs) {
  const sourceSummary = {
    ctExceptions: inputs.ctExceptions.length,
    assistantIncidents: inputs.assistantIncidents.length,
    observabilityIncidents: inputs.observabilityIncidents.length,
    twinRiskSignals: inputs.twinRiskSignals.length,
    riskWarRooms: inputs.riskWarRooms.length,
    invoiceIntakes: inputs.invoiceIntakes.length,
    apiHubReviewItems: inputs.apiHubReviewItems.length,
    actionQueueItems: inputs.actionQueue.length,
    guardrail:
      "Sprint 17 nerve-center packets unify signals across Control Tower, assistant incident rooms, observability, Twin, finance, integrations, and queues without merging incidents, assigning owners, messaging customers, or closing recovery work silently.",
  };

  const controlTower = buildControlTowerSignals(inputs);
  const crossModule = buildCrossModuleRooms(inputs);
  const blastRadius = buildBlastRadius(inputs);
  const observabilityTwin = buildObservabilityTwin(inputs);
  const playbookRecovery = buildPlaybookRecovery(inputs);
  const financeIntegration = buildFinanceIntegration(inputs);
  const dedupeMerge = buildDedupeMerge(inputs);
  const customerComms = buildCustomerComms(inputs);

  const nerveScore = clamp(
    Math.round(
      100 -
        Math.min(22, controlTower.controlTowerRiskCount * 2) -
        Math.min(18, crossModule.crossModuleIncidentCount * 3) -
        Math.min(14, blastRadius.blastRadiusSignalCount * 3) -
        Math.min(18, playbookRecovery.recoveryGapCount * 2) -
        Math.min(14, observabilityTwin.observabilityRiskCount * 3) -
        Math.min(14, observabilityTwin.twinRiskCount * 2) -
        Math.min(16, financeIntegration.financeIntegrationRiskCount * 2) -
        Math.min(10, dedupeMerge.dedupeCandidateCount * 4),
    ),
  );

  const responsePlan = {
    status: nerveScore < 68 ? "INCIDENT_COMMAND_REVIEW_REQUIRED" : nerveScore < 82 ? "OPS_COMMAND_DESK_REVIEW" : "MONITOR",
    owners: ["Control Tower", "Carrier desk", "Assistant reliability", "Finance ops", "Integration engineering", "Customer communications"],
    steps: [
      "Confirm blast radius and duplicate hints against authoritative shipment, order, and incident records.",
      "Validate recovery ownership, playbook readiness, and Twin/observability signals before external communications.",
      "Triage finance/integration spikes separately from logistics exceptions to avoid accidental settlements.",
      "Keep merges, owner assignments, customer/carrier sends, and closures inside approved workflows.",
    ],
    guardrail: "Incident response plans are advisory until operators execute approved Control Tower actions.",
  };

  const rollbackPlan = {
    steps: [
      "Preserve incident merges, owner assignments, communications, Twin acknowledgements, invoices, and ingestion actions until explicitly approved.",
      "Rejecting a nerve-center packet must not delete historical exceptions, incidents, audits, or communications drafts.",
      "Open a fresh packet when exception volumes or blast clusters shift materially.",
    ],
    guardrail: "Rollback narratives document intent only — source recovery records are never auto-reverted by this sprint.",
  };

  const leadershipSummary = [
    `Sprint 17 Incident Nerve Center score is ${nerveScore}/100 with ${controlTower.controlTowerRiskCount} Control Tower risk signal(s), ${crossModule.crossModuleIncidentCount} cross-module incident signal(s), ${blastRadius.blastRadiusSignalCount} blast-radius cue(s), ${playbookRecovery.recoveryGapCount} recovery gap(s), ${observabilityTwin.observabilityRiskCount} observability/war-room signal(s), ${observabilityTwin.twinRiskCount} unacknowledged Twin signal(s), ${financeIntegration.financeIntegrationRiskCount} finance/integration risk cue(s), and ${dedupeMerge.dedupeCandidateCount} dedupe hint(s).`,
    blastRadius.coverageNote,
    `${playbookRecovery.escalation.pendingEscalations.length} queued escalation item(s) reference exceptions or integrations — verify owners before broadcast.`,
    sourceSummary.guardrail,
  ].join("\n\n");

  return {
    title: `Sprint 17 Incident Nerve Center packet: score ${nerveScore}/100`,
    status: "DRAFT" as const,
    nerveScore,
    controlTowerRiskCount: controlTower.controlTowerRiskCount,
    crossModuleIncidentCount: crossModule.crossModuleIncidentCount,
    blastRadiusSignalCount: blastRadius.blastRadiusSignalCount,
    recoveryGapCount: playbookRecovery.recoveryGapCount,
    observabilityRiskCount: observabilityTwin.observabilityRiskCount,
    twinRiskCount: observabilityTwin.twinRiskCount,
    financeIntegrationRiskCount: financeIntegration.financeIntegrationRiskCount,
    sourceSummary,
    controlTower,
    crossModule,
    blastRadius,
    playbookRecovery,
    observabilityTwin,
    financeIntegration,
    dedupeMerge,
    customerComms,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
