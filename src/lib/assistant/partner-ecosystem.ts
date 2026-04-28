export type PartnerConnectorSignal = {
  id: string;
  name: string;
  sourceKind: string;
  authMode: string;
  authState: string;
  status: string;
  healthSummary: string | null;
  lastSyncAt: string | null;
};

export type PartnerMappingSignal = {
  id: string;
  sourceType: "STAGING_BATCH" | "MAPPING_JOB" | "REVIEW_ITEM";
  title: string;
  status: string;
  rowCount?: number;
  issueCount?: number;
  severity?: string;
  updatedAt: string;
};

export type PartnerSignal = {
  id: string;
  name: string;
  type: "SUPPLIER" | "CUSTOMER";
  portalLinked: boolean;
  status: string;
  countryCode: string | null;
};

export type PartnerEcosystemInputs = {
  connectors: PartnerConnectorSignal[];
  mappings: PartnerMappingSignal[];
  partners: PartnerSignal[];
};

function connectorPenalty(connector: PartnerConnectorSignal) {
  let penalty = 0;
  if (connector.status !== "active") penalty += 15;
  if (connector.authState !== "configured") penalty += 20;
  if (!connector.lastSyncAt) penalty += 10;
  if (!connector.healthSummary) penalty += 5;
  return penalty;
}

export function buildConnectorReadiness(connectors: PartnerConnectorSignal[]) {
  return connectors.map((connector) => {
    const blockers = [
      connector.status !== "active" ? "Connector is not active." : null,
      connector.authState !== "configured" ? "Authentication is not configured." : null,
      !connector.lastSyncAt ? "No successful sync evidence yet." : null,
      !connector.healthSummary ? "No health summary available." : null,
    ].filter((item): item is string => Boolean(item));
    return {
      connectorId: connector.id,
      name: connector.name,
      sourceKind: connector.sourceKind,
      authMode: connector.authMode,
      status: connector.status,
      readinessScore: Math.max(0, 100 - connectorPenalty(connector)),
      blockers,
      launchState: blockers.length === 0 ? "READY" : blockers.length >= 3 ? "BLOCKED" : "NEEDS_REVIEW",
    };
  });
}

export function buildPartnerScope(partners: PartnerSignal[]) {
  const suppliers = partners.filter((partner) => partner.type === "SUPPLIER");
  const customers = partners.filter((partner) => partner.type === "CUSTOMER");
  const portalReady = partners.filter((partner) => partner.portalLinked);
  const gaps = partners
    .filter((partner) => !partner.portalLinked || !partner.countryCode || partner.status !== "active")
    .map((partner) => ({
      partnerId: partner.id,
      partnerType: partner.type,
      name: partner.name,
      gap: !partner.portalLinked ? "No portal-linked user." : !partner.countryCode ? "Missing country/region scope." : "Partner is not active.",
      severity: !partner.portalLinked ? "HIGH" : "MEDIUM",
    }));
  return {
    supplierCount: suppliers.length,
    customerCount: customers.length,
    portalReadyCount: portalReady.length,
    gaps,
  };
}

export function buildMappingReview(mappings: PartnerMappingSignal[]) {
  const items = mappings.map((mapping) => {
    const issueCount = mapping.issueCount ?? 0;
    const severity = mapping.severity ?? (issueCount > 0 || mapping.status === "failed" ? "WARN" : "INFO");
    return {
      sourceId: mapping.id,
      sourceType: mapping.sourceType,
      title: mapping.title,
      status: mapping.status,
      rowCount: mapping.rowCount ?? 0,
      issueCount,
      severity,
      requiredAction:
        severity === "ERROR" || mapping.status === "failed"
          ? "Resolve failed mapping or review item before launch."
          : issueCount > 0
            ? "Review staged row issues before launch."
            : "Keep as launch evidence.",
    };
  });
  return {
    issueCount: items.reduce((sum, item) => sum + item.issueCount + (item.severity === "ERROR" ? 1 : 0), 0),
    openReviewCount: items.filter((item) => item.status !== "CLOSED" && item.status !== "promoted" && item.status !== "succeeded").length,
    items,
  };
}

export function buildPartnerOnboardingPlan(
  connectorReadiness: ReturnType<typeof buildConnectorReadiness>,
  partnerScope: ReturnType<typeof buildPartnerScope>,
  mappingReview: ReturnType<typeof buildMappingReview>,
) {
  const steps = [];
  if (connectorReadiness.some((connector) => connector.launchState !== "READY")) {
    steps.push({ step: "Connector readiness", owner: "Integration owner", action: "Configure auth, activate connectors, and capture sync/health evidence." });
  }
  if (partnerScope.gaps.length > 0) {
    steps.push({ step: "Partner portal scope", owner: "Partner operations", action: "Link supplier/customer users and complete country or account scope before launch." });
  }
  if (mappingReview.openReviewCount > 0 || mappingReview.issueCount > 0) {
    steps.push({ step: "Mapping and staging review", owner: "API Hub operator", action: "Review staging rows, failed mapping jobs, and assistant review items." });
  }
  steps.push({ step: "Launch approval", owner: "Ecosystem lead", action: "Approve partner-specific playbooks before enabling external partner work." });
  return { steps };
}

export function scorePartnerEcosystem(inputs: PartnerEcosystemInputs) {
  const connectorReadiness = buildConnectorReadiness(inputs.connectors);
  const partnerScope = buildPartnerScope(inputs.partners);
  const mappingReview = buildMappingReview(inputs.mappings);
  const avgConnectorScore = connectorReadiness.length
    ? connectorReadiness.reduce((sum, item) => sum + item.readinessScore, 0) / connectorReadiness.length
    : 55;
  const portalCoverage = inputs.partners.length ? (partnerScope.portalReadyCount / inputs.partners.length) * 100 : 50;
  const mappingPenalty = Math.min(35, mappingReview.issueCount * 5 + mappingReview.openReviewCount * 3);
  return Math.max(0, Math.min(100, Math.round(avgConnectorScore * 0.45 + portalCoverage * 0.35 + 20 - mappingPenalty)));
}

export function buildPartnerEcosystemPacket(inputs: PartnerEcosystemInputs) {
  const connectorReadiness = buildConnectorReadiness(inputs.connectors);
  const partnerScope = buildPartnerScope(inputs.partners);
  const mappingReview = buildMappingReview(inputs.mappings);
  const onboardingPlan = buildPartnerOnboardingPlan(connectorReadiness, partnerScope, mappingReview);
  const readinessScore = scorePartnerEcosystem(inputs);
  const launchChecklist = {
    checks: [
      { label: "Connector auth configured", passed: connectorReadiness.every((connector) => !connector.blockers.includes("Authentication is not configured.")) },
      { label: "Connector health captured", passed: connectorReadiness.every((connector) => connector.blockers.length === 0) },
      { label: "Partner portal scopes linked", passed: partnerScope.gaps.every((gap) => gap.gap !== "No portal-linked user.") },
      { label: "Mapping/staging review clean", passed: mappingReview.issueCount === 0 && mappingReview.openReviewCount === 0 },
      { label: "Human launch approval required", passed: false },
    ],
    guardrail: "Do not activate partner workflows, apply staging rows, or expose portal access without human launch approval.",
  };
  const sourceSummary = {
    connectors: inputs.connectors.length,
    partners: inputs.partners.length,
    mappings: inputs.mappings.length,
    portalReadyPartners: partnerScope.portalReadyCount,
  };
  const leadershipSummary = [
    `Partner ecosystem readiness is ${readinessScore}/100 across ${inputs.connectors.length} connector${inputs.connectors.length === 1 ? "" : "s"} and ${inputs.partners.length} partner${inputs.partners.length === 1 ? "" : "s"}.`,
    `${partnerScope.gaps.length} partner scope gap${partnerScope.gaps.length === 1 ? "" : "s"}, ${mappingReview.issueCount} mapping issue${mappingReview.issueCount === 1 ? "" : "s"}, and ${mappingReview.openReviewCount} open review item${mappingReview.openReviewCount === 1 ? "" : "s"} need review before launch.`,
    "Connector activation, staging apply, portal exposure, and partner playbook launch remain human-approved.",
  ].join("\n\n");
  return {
    title: `Partner ecosystem packet: score ${readinessScore}/100`,
    status: "DRAFT",
    readinessScore,
    connectorCount: inputs.connectors.length,
    partnerCount: inputs.partners.length,
    mappingIssueCount: mappingReview.issueCount,
    openReviewCount: mappingReview.openReviewCount,
    sourceSummary,
    connectorReadiness,
    partnerScope,
    mappingReview,
    onboardingPlan,
    launchChecklist,
    leadershipSummary,
  };
}
