export type RolloutTemplateAsset = {
  id: string;
  assetType: "PROMPT" | "PLAYBOOK" | "AUTOMATION_POLICY" | "CONNECTOR" | "ADMIN_CONTROL" | "ACCEPTANCE_SCENARIO";
  key: string;
  label: string;
  status: string;
  domain: string | null;
  copyable: boolean;
  requiresSecret: boolean;
};

export type RolloutRoleGrantSignal = {
  roleName: string;
  resource: string;
  action: string;
};

export type RolloutModuleSignal = {
  moduleKey: string;
  enabled: boolean;
  source: string;
};

export type RolloutSeedPackSignal = {
  script: string;
  label: string;
  required: boolean;
  present: boolean;
};

export type RolloutFactoryInputs = {
  sourceTenant: { id: string; name: string; slug: string };
  targetTenant: { name: string; slug: string };
  assets: RolloutTemplateAsset[];
  roleGrants: RolloutRoleGrantSignal[];
  requiredGrants: Array<{ resource: string; action: string; label: string }>;
  modules: RolloutModuleSignal[];
  seedPacks: RolloutSeedPackSignal[];
};

export function buildTemplateInventory(assets: RolloutTemplateAsset[]) {
  const byType = assets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.assetType] = (acc[asset.assetType] ?? 0) + 1;
    return acc;
  }, {});
  const copyPlan = assets.map((asset) => ({
    sourceId: asset.id,
    assetType: asset.assetType,
    key: asset.key,
    label: asset.label,
    status: asset.status,
    copyMode: asset.requiresSecret ? "METADATA_ONLY" : asset.copyable ? "COPY_DRAFT" : "REFERENCE_ONLY",
    guardrail: asset.requiresSecret ? "Secret-bearing configuration must be reconnected manually in the target tenant." : "Copy step is plan-only until review approval.",
  }));
  return {
    assetCount: assets.length,
    copyableCount: assets.filter((asset) => asset.copyable && !asset.requiresSecret).length,
    metadataOnlyCount: assets.filter((asset) => asset.requiresSecret).length,
    byType,
    copyPlan,
  };
}

export function buildRoleGrantPlan(inputs: Pick<RolloutFactoryInputs, "roleGrants" | "requiredGrants">) {
  const grantKeys = new Set(inputs.roleGrants.map((grant) => `${grant.resource}:${grant.action}`));
  const gaps = inputs.requiredGrants
    .filter((grant) => !grantKeys.has(`${grant.resource}:${grant.action}`))
    .map((grant) => ({
      resource: grant.resource,
      action: grant.action,
      label: grant.label,
      severity: grant.resource === "org.settings" ? "HIGH" : "MEDIUM",
      recommendation: "Add to implementation role template before launch.",
    }));
  const roleSummary = inputs.roleGrants.reduce<Record<string, number>>((acc, grant) => {
    acc[grant.roleName] = (acc[grant.roleName] ?? 0) + 1;
    return acc;
  }, {});
  return {
    grantCount: inputs.roleGrants.length,
    gapCount: gaps.length,
    roleSummary,
    gaps,
    guardrail: "Grant changes are proposed only; no target tenant permissions are created automatically.",
  };
}

export function buildModuleFlagPlan(modules: RolloutModuleSignal[]) {
  const gaps = modules
    .filter((module) => !module.enabled)
    .map((module) => ({
      moduleKey: module.moduleKey,
      source: module.source,
      severity: module.moduleKey === "assistant" || module.moduleKey === "settings" ? "HIGH" : "MEDIUM",
      recommendation: "Enable or explicitly defer this module in the customer rollout plan.",
    }));
  return {
    moduleCount: modules.length,
    enabledCount: modules.filter((module) => module.enabled).length,
    gapCount: gaps.length,
    modules,
    gaps,
  };
}

export function buildDemoDataPlan(seedPacks: RolloutSeedPackSignal[]) {
  const gaps = seedPacks
    .filter((pack) => pack.required && !pack.present)
    .map((pack) => ({
      script: pack.script,
      label: pack.label,
      recommendation: "Add or verify this seed/demo pack before pilot handoff.",
    }));
  return {
    seedPackCount: seedPacks.length,
    requiredCount: seedPacks.filter((pack) => pack.required).length,
    gapCount: gaps.length,
    packs: seedPacks,
    gaps,
    guardrail: "Seed commands are listed for operators; packet creation does not execute seeds.",
  };
}

export function buildReadinessChecks(
  templateInventory: ReturnType<typeof buildTemplateInventory>,
  roleGrantPlan: ReturnType<typeof buildRoleGrantPlan>,
  moduleFlagPlan: ReturnType<typeof buildModuleFlagPlan>,
  demoDataPlan: ReturnType<typeof buildDemoDataPlan>,
) {
  const checks = [
    {
      key: "template_assets",
      label: "Template assets",
      passed: templateInventory.copyableCount > 0,
      detail: `${templateInventory.copyableCount} copyable assets, ${templateInventory.metadataOnlyCount} metadata-only assets.`,
    },
    {
      key: "role_grants",
      label: "Role grants",
      passed: roleGrantPlan.gapCount === 0,
      detail: `${roleGrantPlan.gapCount} required grant gap${roleGrantPlan.gapCount === 1 ? "" : "s"}.`,
    },
    {
      key: "module_flags",
      label: "Module flags",
      passed: moduleFlagPlan.gapCount === 0,
      detail: `${moduleFlagPlan.enabledCount}/${moduleFlagPlan.moduleCount} modules enabled.`,
    },
    {
      key: "demo_data",
      label: "Demo data packs",
      passed: demoDataPlan.gapCount === 0,
      detail: `${demoDataPlan.requiredCount - demoDataPlan.gapCount}/${demoDataPlan.requiredCount} required packs present.`,
    },
    {
      key: "secret_safety",
      label: "Secret safety",
      passed: true,
      detail: "Connector secrets are metadata-only and must be re-entered manually.",
    },
  ];
  const score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
  return {
    score,
    status: checks.every((check) => check.passed) ? "READY" : "BLOCKED",
    checks,
  };
}

export function buildRollbackPlan(input: { targetTenantSlug: string; assetCount: number }) {
  const steps = [
    `Keep target tenant ${input.targetTenantSlug} in pilot mode until onboarding review is approved.`,
    "Disable assistant module flags before inviting pilot users if validation fails.",
    "Archive copied prompt/playbook drafts instead of deleting source templates.",
    "Pause copied automation policies in SHADOW mode before any controlled enablement.",
    "Revoke newly granted role permissions through Settings if launch is rolled back.",
  ];
  return {
    stepCount: steps.length,
    steps,
    blastRadius: `${input.assetCount} planned template assets; source tenant remains unchanged.`,
  };
}

export function buildOnboardingPacket(
  inputs: RolloutFactoryInputs,
  readiness: ReturnType<typeof buildReadinessChecks>,
  rollbackPlan: ReturnType<typeof buildRollbackPlan>,
) {
  return {
    packetType: "AMP30_ROLLOUT_FACTORY_PACKET",
    sourceTenant: inputs.sourceTenant,
    targetTenant: inputs.targetTenant,
    readiness,
    launchChecklist: [
      "Confirm customer tenant slug and owner users.",
      "Review role grants and module flags with customer success.",
      "Run required demo seed commands in the intended environment.",
      "Reconnect connector credentials outside the assistant packet.",
      "Queue launch review before copying templates or enabling users.",
    ],
    rollbackPlan,
  };
}

export function buildRolloutFactoryPacket(inputs: RolloutFactoryInputs) {
  const templateInventory = buildTemplateInventory(inputs.assets);
  const roleGrantPlan = buildRoleGrantPlan(inputs);
  const moduleFlagPlan = buildModuleFlagPlan(inputs.modules);
  const demoDataPlan = buildDemoDataPlan(inputs.seedPacks);
  const readinessChecks = buildReadinessChecks(templateInventory, roleGrantPlan, moduleFlagPlan, demoDataPlan);
  const rollbackPlan = buildRollbackPlan({ targetTenantSlug: inputs.targetTenant.slug, assetCount: inputs.assets.length });
  const onboardingPacket = buildOnboardingPacket(inputs, readinessChecks, rollbackPlan);
  const leadershipSummary = [
    `Rollout factory score is ${readinessChecks.score}/100 for ${inputs.targetTenant.name} from template tenant ${inputs.sourceTenant.name}.`,
    `${templateInventory.assetCount} template asset${templateInventory.assetCount === 1 ? "" : "s"}, ${roleGrantPlan.gapCount} role grant gap${roleGrantPlan.gapCount === 1 ? "" : "s"}, ${moduleFlagPlan.gapCount} module gap${moduleFlagPlan.gapCount === 1 ? "" : "s"}, and ${demoDataPlan.gapCount} seed gap${demoDataPlan.gapCount === 1 ? "" : "s"} are ready for review.`,
    "Packet creation does not create tenants, copy templates, run seeds, grant permissions, enable modules, or move connector secrets.",
  ].join("\n\n");
  return {
    title: `Rollout factory packet: ${inputs.targetTenant.name}`,
    status: "DRAFT",
    readinessScore: readinessChecks.score,
    templateAssetCount: templateInventory.assetCount,
    roleGrantGapCount: roleGrantPlan.gapCount,
    moduleGapCount: moduleFlagPlan.gapCount,
    seedGapCount: demoDataPlan.gapCount,
    rollbackStepCount: rollbackPlan.stepCount,
    sourceTenant: inputs.sourceTenant,
    templateInventory,
    roleGrantPlan,
    moduleFlagPlan,
    demoDataPlan,
    readinessChecks,
    rollbackPlan,
    onboardingPacket,
    leadershipSummary,
  };
}
