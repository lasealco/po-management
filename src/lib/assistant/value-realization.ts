export type ValueAuditSignal = {
  id: string;
  surface: string;
  actorUserId: string | null;
  answerKind: string;
  objectType: string | null;
  feedback: string | null;
  createdAt: string;
};

export type ValueActionSignal = {
  id: string;
  actionKind: string;
  status: string;
  priority: string;
  objectType: string | null;
  createdAt: string;
};

export type ValueFinanceSignal = {
  id: string;
  sourceType: "FINANCE_PACKET" | "INVOICE_INTAKE";
  status: string;
  varianceAmount: number;
  recoveredAmount: number;
  createdAt: string;
};

export type ValueServiceSignal = {
  id: string;
  sourceType: "CUSTOMER_BRIEF" | "CT_EXCEPTION";
  status: string;
  serviceScore: number;
  severity: string;
  resolved: boolean;
  createdAt: string;
};

export type ValueAutomationSignal = {
  id: string;
  actionKind: string;
  status: string;
  readinessScore: number;
  matched: boolean | null;
};

export type ValueRealizationInputs = {
  audits: ValueAuditSignal[];
  actions: ValueActionSignal[];
  finances: ValueFinanceSignal[];
  services: ValueServiceSignal[];
  automations: ValueAutomationSignal[];
  assumptions: {
    hourlyCost: number;
    minutesSavedPerCompletedAction: number;
    automationMinutesSaved: number;
    customerSaveValue: number;
    monthlyProgramCost: number;
  };
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function buildAdoptionFunnel(inputs: ValueRealizationInputs) {
  const activeUsers = new Set(inputs.audits.map((audit) => audit.actorUserId).filter(Boolean)).size;
  const surfaces = inputs.audits.reduce<Record<string, number>>((acc, audit) => {
    acc[audit.surface] = (acc[audit.surface] ?? 0) + 1;
    return acc;
  }, {});
  const positiveFeedback = inputs.audits.filter((audit) => audit.feedback === "helpful").length;
  const negativeFeedback = inputs.audits.filter((audit) => audit.feedback === "not_helpful").length;
  return {
    interactionCount: inputs.audits.length,
    activeUserCount: activeUsers,
    surfaceCount: Object.keys(surfaces).length,
    completedActionCount: inputs.actions.filter((action) => action.status === "DONE").length,
    positiveFeedback,
    negativeFeedback,
    helpfulRatePct: percent(positiveFeedback, positiveFeedback + negativeFeedback),
    surfaces,
  };
}

export function buildSavings(inputs: ValueRealizationInputs) {
  const completedActions = inputs.actions.filter((action) => action.status === "DONE").length;
  const enabledAutomations = inputs.automations.filter((automation) => automation.status === "ENABLED").length;
  const actionHoursSaved = (completedActions * inputs.assumptions.minutesSavedPerCompletedAction) / 60;
  const automationHoursSaved = (enabledAutomations * inputs.assumptions.automationMinutesSaved) / 60;
  const automationSavings = roundCurrency(automationHoursSaved * inputs.assumptions.hourlyCost);
  const avoidedCost = roundCurrency(actionHoursSaved * inputs.assumptions.hourlyCost);
  const recoveredValue = roundCurrency(inputs.finances.reduce((sum, finance) => sum + Math.max(0, finance.recoveredAmount), 0));
  return {
    completedActions,
    enabledAutomations,
    actionHoursSaved,
    automationHoursSaved,
    avoidedCost,
    automationSavings,
    recoveredValue,
    totalEstimatedValue: roundCurrency(avoidedCost + automationSavings + recoveredValue),
  };
}

export function buildServiceImpact(inputs: ValueRealizationInputs) {
  const resolvedExceptions = inputs.services.filter((service) => service.sourceType === "CT_EXCEPTION" && service.resolved).length;
  const customerBriefs = inputs.services.filter((service) => service.sourceType === "CUSTOMER_BRIEF").length;
  const averageServiceScore = Math.round(
    inputs.services.reduce((sum, service) => sum + service.serviceScore, 0) / Math.max(1, inputs.services.length),
  );
  const highSeverityOpen = inputs.services.filter((service) => service.severity === "HIGH" && !service.resolved).length;
  return {
    customerBriefs,
    resolvedExceptions,
    highSeverityOpen,
    averageServiceScore,
    estimatedCustomerSaveValue: roundCurrency((resolvedExceptions + customerBriefs) * inputs.assumptions.customerSaveValue),
  };
}

export function buildValueAttribution(inputs: ValueRealizationInputs, savings = buildSavings(inputs), serviceImpact = buildServiceImpact(inputs)) {
  const byDomain = inputs.actions.reduce<Record<string, { completed: number; estimatedValue: number }>>((acc, action) => {
    const domain = action.objectType ?? action.actionKind;
    if (!acc[domain]) acc[domain] = { completed: 0, estimatedValue: 0 };
    if (action.status === "DONE") {
      acc[domain].completed += 1;
      acc[domain].estimatedValue += roundCurrency((inputs.assumptions.minutesSavedPerCompletedAction / 60) * inputs.assumptions.hourlyCost);
    }
    return acc;
  }, {});
  if (savings.recoveredValue > 0) {
    byDomain.finance = {
      completed: inputs.finances.length,
      estimatedValue: roundCurrency((byDomain.finance?.estimatedValue ?? 0) + savings.recoveredValue),
    };
  }
  if (serviceImpact.estimatedCustomerSaveValue > 0) {
    byDomain.service = {
      completed: inputs.services.length,
      estimatedValue: roundCurrency((byDomain.service?.estimatedValue ?? 0) + serviceImpact.estimatedCustomerSaveValue),
    };
  }
  const entries = Object.entries(byDomain)
    .map(([domain, value]) => ({ domain, completed: value.completed, estimatedValue: roundCurrency(value.estimatedValue) }))
    .sort((a, b) => b.estimatedValue - a.estimatedValue);
  return {
    entries,
    assumptions: "Attribution uses completed assistant work, finance recovery, and service-impact assumptions; values are directional until approved.",
  };
}

export function buildCohorts(inputs: ValueRealizationInputs) {
  const bySurface = inputs.audits.reduce<Record<string, { interactions: number; users: Set<string> }>>((acc, audit) => {
    if (!acc[audit.surface]) acc[audit.surface] = { interactions: 0, users: new Set<string>() };
    acc[audit.surface].interactions += 1;
    if (audit.actorUserId) acc[audit.surface].users.add(audit.actorUserId);
    return acc;
  }, {});
  return {
    cohorts: Object.entries(bySurface)
      .map(([surface, value]) => ({ surface, interactions: value.interactions, activeUsers: value.users.size }))
      .sort((a, b) => b.interactions - a.interactions),
  };
}

export function buildRoiAssumptions(inputs: ValueRealizationInputs, savings = buildSavings(inputs)) {
  const roiPct = Math.round(((savings.totalEstimatedValue - inputs.assumptions.monthlyProgramCost) / Math.max(1, inputs.assumptions.monthlyProgramCost)) * 100);
  return {
    ...inputs.assumptions,
    totalEstimatedValue: savings.totalEstimatedValue,
    roiPct,
    paybackStatus: roiPct >= 0 ? "POSITIVE" : "NEGATIVE",
    guardrail: "ROI is assumption-backed and must be reviewed before external claims.",
  };
}

export function scoreValueRealization(inputs: ValueRealizationInputs) {
  const adoption = buildAdoptionFunnel(inputs);
  const savings = buildSavings(inputs);
  const serviceImpact = buildServiceImpact(inputs);
  const adoptionScore = Math.min(40, adoption.surfaceCount * 8 + Math.min(16, adoption.activeUserCount * 4) + (adoption.helpfulRatePct >= 60 ? 8 : 0));
  const valueScore = Math.min(40, Math.round(savings.totalEstimatedValue / 1000) * 4);
  const serviceScore = Math.min(20, serviceImpact.resolvedExceptions * 4 + serviceImpact.customerBriefs * 2 + (serviceImpact.highSeverityOpen === 0 ? 6 : 0));
  return Math.max(0, Math.min(100, adoptionScore + valueScore + serviceScore));
}

export function buildExportReport(input: {
  adoptionFunnel: ReturnType<typeof buildAdoptionFunnel>;
  savings: ReturnType<typeof buildSavings>;
  serviceImpact: ReturnType<typeof buildServiceImpact>;
  valueAttribution: ReturnType<typeof buildValueAttribution>;
  roiAssumptions: ReturnType<typeof buildRoiAssumptions>;
}) {
  return {
    audience: ["BOARD", "CUSTOMER_SUCCESS"],
    redactionMode: "ROLE_SAFE_SUMMARY",
    executiveMetrics: {
      interactions: input.adoptionFunnel.interactionCount,
      activeUsers: input.adoptionFunnel.activeUserCount,
      totalEstimatedValue: input.savings.totalEstimatedValue,
      roiPct: input.roiAssumptions.roiPct,
      averageServiceScore: input.serviceImpact.averageServiceScore,
    },
    topAttribution: input.valueAttribution.entries.slice(0, 5),
    guardrails: [
      "No user emails, customer names, invoice IDs, or source excerpts are included in this export.",
      "ROI and savings are assumption-backed and require approval before external sharing.",
    ],
  };
}

export function buildValueRealizationPacket(inputs: ValueRealizationInputs) {
  const adoptionFunnel = buildAdoptionFunnel(inputs);
  const savings = buildSavings(inputs);
  const serviceImpact = buildServiceImpact(inputs);
  const valueAttribution = buildValueAttribution(inputs, savings, serviceImpact);
  const cohorts = buildCohorts(inputs);
  const roiAssumptions = buildRoiAssumptions(inputs, savings);
  const exportReport = buildExportReport({ adoptionFunnel, savings, serviceImpact, valueAttribution, roiAssumptions });
  const valueScore = scoreValueRealization(inputs);
  const adoptionScore = Math.min(100, adoptionFunnel.surfaceCount * 15 + adoptionFunnel.activeUserCount * 10 + Math.round(adoptionFunnel.helpfulRatePct / 2));
  const leadershipSummary = [
    `Value realization score is ${valueScore}/100 with ${adoptionFunnel.interactionCount} assistant interaction${adoptionFunnel.interactionCount === 1 ? "" : "s"} across ${adoptionFunnel.surfaceCount} surface${adoptionFunnel.surfaceCount === 1 ? "" : "s"}.`,
    `Estimated value is ${savings.totalEstimatedValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}: ${savings.avoidedCost.toLocaleString("en-US", { style: "currency", currency: "USD" })} avoided work cost, ${savings.automationSavings.toLocaleString("en-US", { style: "currency", currency: "USD" })} automation savings, and ${savings.recoveredValue.toLocaleString("en-US", { style: "currency", currency: "USD" })} recovered finance value.`,
    "Board/customer exports are role-safe summaries; packet creation does not mutate source records or publish ROI claims.",
  ].join("\n\n");
  return {
    title: `Value realization packet: ${valueScore}/100`,
    status: "DRAFT",
    valueScore,
    adoptionScore: Math.min(100, adoptionScore),
    totalEstimatedValue: savings.totalEstimatedValue,
    automationSavings: savings.automationSavings,
    recoveredValue: savings.recoveredValue,
    avoidedCost: savings.avoidedCost,
    roiPct: roiAssumptions.roiPct,
    adoptionFunnel,
    valueAttribution,
    savings,
    serviceImpact,
    cohorts,
    roiAssumptions,
    exportReport,
    leadershipSummary,
  };
}
