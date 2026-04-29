export type TenantRolloutInputs = {
  tenant: { id: string; name: string; slug: string; legalName: string | null; countryCode: string | null };
  users: Array<{ id: string; email: string; name: string; isActive: boolean; roleNames: string[]; primaryOrgUnit: string | null; createdAt: string }>;
  orgUnits: Array<{ id: string; code: string; name: string; kind: string; parentId: string | null; roleCount: number }>;
  roles: Array<{ id: string; name: string; isSystem: boolean; permissionCount: number; userCount: number }>;
  adminControls: Array<{ id: string; controlKey: string; rolloutMode: string; packetStatus: string; pilotRoleCount: number; pilotSiteCount: number; updatedAt: string }>;
  rolloutFactoryPackets: Array<{ id: string; title: string; status: string; readinessScore: number; roleGrantGapCount: number; moduleGapCount: number; seedGapCount: number; rollbackStepCount: number }>;
  aiQualityReleasePackets: Array<{ id: string; title: string; status: string; qualityScore: number; releaseBlockerCount: number; failedEvalCount: number }>;
  auditEvents: Array<{ id: string; surface: string; answerKind: string; feedback: string | null; actorUserId: string | null; createdAt: string }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null; dueAt: string | null }>;
};

function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function buildTenantProfile(inputs: TenantRolloutInputs) {
  const activeUsers = inputs.users.filter((user) => user.isActive);
  const invitedUsers = inputs.users.filter((user) => user.createdAt);
  const configuredRoles = inputs.roles.filter((role) => role.permissionCount > 0);
  const orgCoverage = inputs.orgUnits.length > 0 ? percent(inputs.orgUnits.filter((unit) => unit.roleCount > 0).length, inputs.orgUnits.length) : 0;
  return {
    tenant: inputs.tenant,
    activeUserCount: activeUsers.length,
    inactiveUserCount: inputs.users.length - activeUsers.length,
    invitedUserCount: invitedUsers.length,
    roleCount: inputs.roles.length,
    configuredRoleCount: configuredRoles.length,
    orgUnitCount: inputs.orgUnits.length,
    orgRoleCoveragePct: orgCoverage,
    adminControlCount: inputs.adminControls.length,
    rolloutMode: inputs.adminControls[0]?.rolloutMode ?? "UNSET",
    guardrail: "Tenant profile is observational only; it does not create tenants, invite users, activate accounts, assign org units, or change roles.",
  };
}

export function buildStakeholderMap(inputs: TenantRolloutInputs) {
  const requiredRoles = ["Admin", "Operations", "Warehouse", "Finance", "Commercial", "Integration"];
  const roleNames = new Set(inputs.roles.map((role) => role.name.toLowerCase()));
  const usersByRole = new Map<string, number>();
  for (const user of inputs.users.filter((item) => item.isActive)) {
    for (const role of user.roleNames) usersByRole.set(role.toLowerCase(), (usersByRole.get(role.toLowerCase()) ?? 0) + 1);
  }
  const gaps = requiredRoles
    .filter((role) => !Array.from(roleNames).some((name) => name.includes(role.toLowerCase())) || (usersByRole.get(role.toLowerCase()) ?? 0) === 0)
    .map((role) => ({
      role,
      severity: role === "Admin" || role === "Operations" ? "HIGH" : "MEDIUM",
      recommendation: "Assign named stakeholder and pilot backup before rollout approval.",
    }));
  const stakeholders = inputs.roles
    .filter((role) => role.userCount > 0)
    .map((role) => ({ role: role.name, users: role.userCount, permissionCount: role.permissionCount, readiness: role.permissionCount > 0 ? "READY" : "NO_PERMISSIONS" }));
  return {
    stakeholderCount: stakeholders.reduce((sum, row) => sum + row.users, 0),
    stakeholderGapCount: gaps.length,
    stakeholders,
    gaps,
    guardrail: "Stakeholder mapping does not assign users, roles, permissions, backups, or ownership automatically.",
  };
}

export function buildRolloutWaves(inputs: TenantRolloutInputs, stakeholderMap = buildStakeholderMap(inputs)) {
  const pilotUsers = inputs.users.filter((user) => user.isActive).slice(0, 12);
  const orgWaves = inputs.orgUnits.slice(0, 8).map((unit, index) => ({
    wave: index < 2 ? "PILOT" : index < 5 ? "EXPANSION" : "SCALE",
    orgUnitId: unit.id,
    code: unit.code,
    name: unit.name,
    kind: unit.kind,
    readiness: unit.roleCount > 0 ? "READY" : "ROLE_SCOPE_NEEDED",
  }));
  const blockers = [
    ...stakeholderMap.gaps.map((gap) => ({ type: "STAKEHOLDER_GAP", key: gap.role, severity: gap.severity, detail: gap.recommendation })),
    ...inputs.rolloutFactoryPackets
      .filter((packet) => packet.status !== "APPROVED" || packet.readinessScore < 75 || packet.roleGrantGapCount + packet.moduleGapCount + packet.seedGapCount > 0)
      .slice(0, 8)
      .map((packet) => ({ type: "ROLLOUT_FACTORY", key: packet.id, severity: packet.readinessScore < 60 ? "HIGH" : "MEDIUM", detail: `${packet.title}: ${packet.readinessScore}/100.` })),
  ];
  return {
    waveCount: Math.max(1, new Set(orgWaves.map((wave) => wave.wave)).size),
    pilotUserCount: pilotUsers.length,
    pilotUsers: pilotUsers.map((user) => ({ userId: user.id, name: user.name, email: user.email, roles: user.roleNames, orgUnit: user.primaryOrgUnit })),
    orgWaves,
    blockers,
    guardrail: "Rollout waves are proposed only; no users are invited, moved between waves, granted access, or activated automatically.",
  };
}

export function buildEnablementPlan(inputs: TenantRolloutInputs, stakeholderMap = buildStakeholderMap(inputs)) {
  const modules = ["Assistant basics", "Review queue", "Evidence and audit", "Role-safe workflows", "Rollback and support", "Data and integration readiness"];
  const activeUsers = inputs.users.filter((user) => user.isActive).length;
  const trainingGapCount = Math.max(0, stakeholderMap.stakeholderGapCount) + (activeUsers < 3 ? 1 : 0) + (inputs.adminControls.length === 0 ? 1 : 0);
  return {
    trainingModuleCount: modules.length,
    trainingGapCount,
    modules: modules.map((module, index) => ({
      module,
      audience: index < 2 ? "All pilot users" : index < 4 ? "Functional owners" : "Admins and support owners",
      format: index % 2 === 0 ? "Live enablement" : "Guided checklist",
      status: trainingGapCount > 0 && index < 2 ? "NEEDS_SCHEDULING" : "READY_TO_PLAN",
    })),
    assignments: inputs.roles.slice(0, 10).map((role) => ({ role: role.name, learnerCount: role.userCount, recommendedTrack: role.isSystem ? "Admin controls" : "Functional workflow" })),
    guardrail: "Enablement plan does not send training invitations, enroll users, certify learners, or change access automatically.",
  };
}

export function buildCommunicationPlan(inputs: TenantRolloutInputs, rolloutWaves = buildRolloutWaves(inputs)) {
  const channels = [
    { channel: "Executive sponsor update", audience: "Leadership", status: rolloutWaves.blockers.length > 0 ? "DRAFT_BLOCKED" : "READY_TO_DRAFT" },
    { channel: "Pilot kickoff", audience: "Pilot users", status: rolloutWaves.pilotUserCount > 0 ? "READY_TO_DRAFT" : "NEEDS_USER_LIST" },
    { channel: "Support escalation brief", audience: "Support owners", status: "READY_TO_DRAFT" },
    { channel: "Change impact note", audience: "Operations and frontline teams", status: inputs.orgUnits.length > 0 ? "READY_TO_DRAFT" : "NEEDS_ORG_SCOPE" },
  ];
  const communicationGapCount = channels.filter((channel) => channel.status !== "READY_TO_DRAFT").length;
  return {
    channelCount: channels.length,
    communicationGapCount,
    channels,
    messageDrafts: channels.map((channel) => ({
      channel: channel.channel,
      subject: `${inputs.tenant.name}: ${channel.channel}`,
      status: channel.status,
      guardrail: "Draft only; no message is sent automatically.",
    })),
    guardrail: "Communication plan creates review drafts only; it does not email, notify, publish announcements, or contact users automatically.",
  };
}

export function buildAdoptionTelemetry(inputs: TenantRolloutInputs) {
  const activeActors = new Set(inputs.auditEvents.map((event) => event.actorUserId).filter((id): id is string => Boolean(id)));
  const activeUsers = inputs.users.filter((user) => user.isActive).length;
  const feedbackCount = inputs.auditEvents.filter((event) => event.feedback != null).length;
  const negativeFeedbackCount = inputs.auditEvents.filter((event) => event.feedback === "not_helpful").length;
  const highPriorityOpen = inputs.actionQueue.filter((item) => item.status === "PENDING" && item.priority === "HIGH").length;
  const adoptionPct = percent(activeActors.size, activeUsers);
  const adoptionRisks = [
    ...(activeUsers > 0 && adoptionPct < 40 ? [{ type: "LOW_ACTIVE_USAGE", severity: "HIGH", detail: `${adoptionPct}% of active users have recent assistant audit activity.` }] : []),
    ...(feedbackCount < Math.min(5, inputs.auditEvents.length) ? [{ type: "LOW_FEEDBACK", severity: "MEDIUM", detail: `${feedbackCount} feedback signal(s) captured.` }] : []),
    ...(negativeFeedbackCount > 0 ? [{ type: "NEGATIVE_FEEDBACK", severity: "MEDIUM", detail: `${negativeFeedbackCount} negative feedback signal(s).` }] : []),
    ...(highPriorityOpen > 5 ? [{ type: "ACTION_BACKLOG", severity: "HIGH", detail: `${highPriorityOpen} high-priority rollout-adjacent pending action(s).` }] : []),
  ];
  return {
    auditEventCount: inputs.auditEvents.length,
    activeActorCount: activeActors.size,
    adoptionPct,
    feedbackCount,
    negativeFeedbackCount,
    pendingActionCount: inputs.actionQueue.filter((item) => item.status === "PENDING").length,
    adoptionRiskCount: adoptionRisks.length,
    adoptionRisks,
    guardrail: "Adoption telemetry does not alter user status, change access, close actions, or manipulate activity metrics automatically.",
  };
}

export function buildSupportModel(inputs: TenantRolloutInputs, adoptionTelemetry = buildAdoptionTelemetry(inputs)) {
  const owners = inputs.users.filter((user) => user.isActive && user.roleNames.some((role) => /admin|ops|operation|support/i.test(role))).slice(0, 8);
  const riskCount = (owners.length === 0 ? 1 : 0) + (adoptionTelemetry.pendingActionCount > 20 ? 1 : 0) + (inputs.aiQualityReleasePackets.some((packet) => packet.status !== "APPROVED" || packet.releaseBlockerCount > 0) ? 1 : 0);
  return {
    supportOwnerCount: owners.length,
    supportRiskCount: riskCount,
    owners: owners.map((user) => ({ userId: user.id, name: user.name, email: user.email, roles: user.roleNames })),
    escalationPaths: [
      { tier: "Tier 1", owner: owners[0]?.name ?? "Assign customer success owner", scope: "How-to and training questions" },
      { tier: "Tier 2", owner: owners[1]?.name ?? "Assign implementation lead", scope: "Workflow setup, roles, and adoption blockers" },
      { tier: "Tier 3", owner: "Assistant platform owner", scope: "Quality, release, automation, and rollback governance" },
    ],
    guardrail: "Support model does not assign owners, create tickets, change queues, notify users, or close issues automatically.",
  };
}

export function buildCutoverChecklist(
  inputs: TenantRolloutInputs,
  rolloutWaves = buildRolloutWaves(inputs),
  enablementPlan = buildEnablementPlan(inputs),
  communicationPlan = buildCommunicationPlan(inputs),
  supportModel = buildSupportModel(inputs),
) {
  const latestQuality = inputs.aiQualityReleasePackets[0];
  const checks = [
    { key: "stakeholders", label: "Named stakeholders", passed: rolloutWaves.blockers.filter((blocker) => blocker.type === "STAKEHOLDER_GAP").length === 0 },
    { key: "rollout_factory", label: "Rollout factory approved", passed: inputs.rolloutFactoryPackets.some((packet) => packet.status === "APPROVED" && packet.readinessScore >= 75) },
    { key: "enablement", label: "Training plan ready", passed: enablementPlan.trainingGapCount === 0 },
    { key: "communications", label: "Communications ready", passed: communicationPlan.communicationGapCount === 0 },
    { key: "support", label: "Support owners assigned", passed: supportModel.supportRiskCount === 0 },
    { key: "quality_release", label: "AI quality release clean", passed: latestQuality ? latestQuality.status === "APPROVED" && latestQuality.releaseBlockerCount === 0 : false },
  ];
  const blockers = checks.filter((check) => !check.passed).map((check) => ({ key: check.key, label: check.label, severity: check.key === "quality_release" || check.key === "rollout_factory" ? "HIGH" : "MEDIUM" }));
  return {
    checkCount: checks.length,
    passedCount: checks.filter((check) => check.passed).length,
    cutoverBlockerCount: blockers.length,
    checks,
    blockers,
    guardrail: "Cutover checklist blocks or queues review only; it does not launch tenants, invite users, enable modules, change flags, or promote releases automatically.",
  };
}

export function buildRollbackPlan(inputs: TenantRolloutInputs, rolloutWaves = buildRolloutWaves(inputs)) {
  const steps = [
    `Keep tenant ${inputs.tenant.slug} in pilot or review-only mode until rollout approval is recorded.`,
    "Pause new invitations and role expansion if cutover checklist has blockers.",
    "Route assistant rollout requests through the action queue for owner review.",
    "Keep copied templates and enablement drafts in draft/review status until launch approval.",
    "Use support owner escalation before changing module flags, roles, or runtime settings.",
    ...rolloutWaves.blockers.slice(0, 5).map((blocker) => `Resolve ${blocker.type} blocker ${blocker.key} before expanding rollout.`),
  ];
  return {
    rollbackStepCount: steps.length,
    steps,
    blastRadius: `${inputs.users.filter((user) => user.isActive).length} active users and ${inputs.orgUnits.length} org units are in rollout scope; source data remains unchanged.`,
    guardrail: "Rollback plan is review evidence only; it does not revoke access, disable modules, remove users, delete data, send notices, or change tenant settings automatically.",
  };
}

export function buildTenantRolloutPacket(inputs: TenantRolloutInputs) {
  const tenantProfile = buildTenantProfile(inputs);
  const stakeholderMap = buildStakeholderMap(inputs);
  const rolloutWaves = buildRolloutWaves(inputs, stakeholderMap);
  const enablementPlan = buildEnablementPlan(inputs, stakeholderMap);
  const communicationPlan = buildCommunicationPlan(inputs, rolloutWaves);
  const adoptionTelemetry = buildAdoptionTelemetry(inputs);
  const supportModel = buildSupportModel(inputs, adoptionTelemetry);
  const cutoverChecklist = buildCutoverChecklist(inputs, rolloutWaves, enablementPlan, communicationPlan, supportModel);
  const rollbackPlan = buildRollbackPlan(inputs, rolloutWaves);
  const sourceSummary = {
    users: inputs.users.length,
    activeUsers: tenantProfile.activeUserCount,
    orgUnits: inputs.orgUnits.length,
    roles: inputs.roles.length,
    adminControls: inputs.adminControls.length,
    rolloutFactoryPackets: inputs.rolloutFactoryPackets.length,
    aiQualityReleasePackets: inputs.aiQualityReleasePackets.length,
    auditEvents: inputs.auditEvents.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const rolloutScore = clamp(
    96 -
      Math.min(24, stakeholderMap.stakeholderGapCount * 5) -
      Math.min(20, enablementPlan.trainingGapCount * 5) -
      Math.min(16, communicationPlan.communicationGapCount * 4) -
      Math.min(22, supportModel.supportRiskCount * 7) -
      Math.min(18, adoptionTelemetry.adoptionRiskCount * 5) -
      Math.min(30, cutoverChecklist.cutoverBlockerCount * 5),
  );
  const responsePlan = {
    status: rolloutScore < 70 || cutoverChecklist.cutoverBlockerCount > 0 ? "CHANGE_BOARD_REVIEW_REQUIRED" : rolloutScore < 88 ? "CUSTOMER_SUCCESS_REVIEW" : "READY_FOR_PILOT_REVIEW",
    owners: ["Customer success", "Implementation lead", "Tenant admin", "Support owner", "Assistant platform owner", "Executive sponsor"],
    steps: [
      "Review stakeholder gaps, rollout waves, enablement plan, communications, support model, adoption telemetry, and cutover blockers.",
      "Queue launch readiness review before inviting users, changing roles, enabling modules, or switching tenant rollout mode.",
      "Approve separate downstream work for any access, communication, training, runtime, seed, or tenant setting change.",
    ],
    guardrail: "Response plan is review-only and does not create tenants, invite users, grant roles, enable modules, send communications, run seeds, or change tenant settings automatically.",
  };
  const leadershipSummary = [
    `Sprint 11 Tenant Rollout score is ${rolloutScore}/100 for ${inputs.tenant.name} with ${tenantProfile.activeUserCount} active user(s), ${inputs.roles.length} role(s), and ${inputs.orgUnits.length} org unit(s).`,
    `${stakeholderMap.stakeholderGapCount} stakeholder gap(s), ${enablementPlan.trainingGapCount} training gap(s), ${communicationPlan.communicationGapCount} communication gap(s), ${supportModel.supportRiskCount} support risk(s), ${adoptionTelemetry.adoptionRiskCount} adoption risk(s), and ${cutoverChecklist.cutoverBlockerCount} cutover blocker(s) need review.`,
    "Packet creation does not create tenants, invite users, grant roles, enable modules, send communications, run seeds, certify training, change rollout mode, or mutate tenant settings.",
  ].join("\n\n");
  return {
    title: `Sprint 11 Tenant Rollout packet: ${inputs.tenant.name}`,
    status: "DRAFT",
    rolloutScore,
    sourceSummary,
    tenantProfile,
    stakeholderMap,
    rolloutWaves,
    enablementPlan,
    communicationPlan,
    adoptionTelemetry,
    supportModel,
    cutoverChecklist,
    rollbackPlan,
    responsePlan,
    leadershipSummary,
  };
}
