import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildRolloutFactoryPacket,
  type RolloutFactoryInputs,
  type RolloutModuleSignal,
  type RolloutSeedPackSignal,
  type RolloutTemplateAsset,
} from "@/lib/assistant/rollout-factory";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { GLOBAL_PERMISSION_CATALOG } from "@/lib/permission-catalog";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const REQUIRED_SEED_PACKS: RolloutSeedPackSignal[] = [
  { script: "db:seed", label: "Main tenant and PO demo", required: true, present: true },
  { script: "db:seed:wms-demo", label: "WMS demo operations", required: true, present: true },
  { script: "db:seed:invoice-audit-demo", label: "Invoice audit demo", required: false, present: true },
  { script: "db:seed:tariff-fra-chi-demo", label: "Tariff demo lane", required: false, present: true },
  { script: "db:seed:supply-chain-twin-demo", label: "Supply Chain Twin demo", required: false, present: true },
];

const REQUIRED_MODULES = ["assistant", "settings", "orders", "suppliers", "wms", "controltower", "apihub"];
const REQUIRED_GRANT_KEYS = new Set([
  "org.settings:view",
  "org.settings:edit",
  "org.orders:view",
  "org.suppliers:view",
  "org.wms:view",
  "org.controltower:view",
  "org.apihub:view",
]);

async function requireRolloutFactoryAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  if (!viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view")) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings access for rollout factory.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function targetTenantFromSlug(slug: string) {
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "new-customer-pilot";
  return {
    slug: clean,
    name: clean
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  };
}

async function loadRolloutFactoryInputs(tenantId: string, targetSlug = "new-customer-pilot"): Promise<RolloutFactoryInputs> {
  const [tenant, prompts, playbooks, automations, connectors, adminControl, rolePermissions] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } }),
    prisma.assistantPromptLibraryItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, title: true, status: true, domain: true, objectType: true },
    }),
    prisma.assistantPlaybookTemplate.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, playbookId: true, title: true, objectType: true, isActive: true },
    }),
    prisma.assistantAutomationPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, policyKey: true, label: true, actionKind: true, status: true },
    }),
    prisma.apiHubConnector.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, name: true, sourceKind: true, authMode: true, authState: true, status: true },
    }),
    prisma.assistantAdminControl.findUnique({
      where: { tenantId_controlKey: { tenantId, controlKey: "assistant_admin_console" } },
      select: { id: true, rolloutMode: true, flagsJson: true, packetStatus: true },
    }),
    prisma.rolePermission.findMany({
      where: { role: { tenantId }, effect: "allow", workflowStatusId: null },
      select: { resource: true, action: true, role: { select: { name: true } } },
    }),
  ]);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const assets: RolloutTemplateAsset[] = [];
  assets.push(
    ...prompts.map((prompt): RolloutTemplateAsset => ({
      id: prompt.id,
      assetType: "PROMPT",
      key: prompt.id,
      label: prompt.title,
      status: prompt.status,
      domain: prompt.domain ?? prompt.objectType,
      copyable: prompt.status === "APPROVED",
      requiresSecret: false,
    })),
    ...playbooks.map((playbook): RolloutTemplateAsset => ({
      id: playbook.id,
      assetType: "PLAYBOOK",
      key: playbook.playbookId,
      label: playbook.title,
      status: playbook.isActive ? "ACTIVE" : "INACTIVE",
      domain: playbook.objectType,
      copyable: playbook.isActive,
      requiresSecret: false,
    })),
    ...automations.map((policy): RolloutTemplateAsset => ({
      id: policy.id,
      assetType: "AUTOMATION_POLICY",
      key: policy.policyKey,
      label: policy.label,
      status: policy.status,
      domain: policy.actionKind,
      copyable: policy.status !== "PAUSED",
      requiresSecret: false,
    })),
    ...connectors.map((connector): RolloutTemplateAsset => ({
      id: connector.id,
      assetType: "CONNECTOR",
      key: connector.id,
      label: connector.name,
      status: connector.status,
      domain: connector.sourceKind,
      copyable: connector.authState === "configured" || connector.status === "active",
      requiresSecret: connector.authMode !== "none",
    })),
    ...REQUIRED_SEED_PACKS.map((pack): RolloutTemplateAsset => ({
      id: pack.script,
      assetType: "ACCEPTANCE_SCENARIO",
      key: pack.script,
      label: pack.label,
      status: pack.present ? "AVAILABLE" : "MISSING",
      domain: "demo",
      copyable: pack.present,
      requiresSecret: false,
    })),
  );
  if (adminControl) {
    assets.push({
      id: adminControl.id,
      assetType: "ADMIN_CONTROL",
      key: "assistant_admin_console",
      label: `Admin control ${adminControl.rolloutMode}`,
      status: adminControl.packetStatus,
      domain: "assistant",
      copyable: true,
      requiresSecret: false,
    });
  }

  const grantKeys = new Set(rolePermissions.map((grant) => `${grant.resource}:${grant.action}`));
  const modules: RolloutModuleSignal[] = REQUIRED_MODULES.map((moduleKey) => {
    const requiredGrant = moduleKey === "assistant" ? "org.settings:view" : moduleKey === "settings" ? "org.settings:view" : `org.${moduleKey}:view`;
    return {
      moduleKey,
      enabled: moduleKey === "assistant" ? true : grantKeys.has(requiredGrant),
      source: moduleKey === "assistant" ? "assistant workspace" : requiredGrant,
    };
  });

  return {
    sourceTenant: tenant,
    targetTenant: targetTenantFromSlug(targetSlug),
    assets,
    roleGrants: rolePermissions.map((grant) => ({ roleName: grant.role.name, resource: grant.resource, action: grant.action })),
    requiredGrants: GLOBAL_PERMISSION_CATALOG.filter((permission) => REQUIRED_GRANT_KEYS.has(`${permission.resource}:${permission.action}`)).map((permission) => ({
      resource: permission.resource,
      action: permission.action,
      label: permission.label,
    })),
    modules,
    seedPacks: REQUIRED_SEED_PACKS,
  };
}

async function buildSnapshot(tenantId: string, targetSlug?: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantRolloutFactoryPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        readinessScore: true,
        templateAssetCount: true,
        roleGrantGapCount: true,
        moduleGapCount: true,
        seedGapCount: true,
        rollbackStepCount: true,
        sourceTenantJson: true,
        templateInventoryJson: true,
        roleGrantPlanJson: true,
        moduleFlagPlanJson: true,
        demoDataPlanJson: true,
        readinessCheckJson: true,
        rollbackPlanJson: true,
        onboardingPacketJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadRolloutFactoryInputs(tenantId, targetSlug),
  ]);
  const preview = buildRolloutFactoryPacket(inputs);
  return {
    signals: {
      assets: inputs.assets.length,
      roleGrants: inputs.roleGrants.length,
      modules: inputs.modules.length,
      previewReadinessScore: preview.readinessScore,
      previewGaps: preview.roleGrantGapCount + preview.moduleGapCount + preview.seedGapCount,
    },
    targetTenant: inputs.targetTenant,
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET(request: Request) {
  const gate = await requireRolloutFactoryAccess(false);
  if (!gate.ok) return gate.response;
  const targetSlug = new URL(request.url).searchParams.get("targetSlug") ?? undefined;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, targetSlug));
}

export async function POST(request: Request) {
  const gate = await requireRolloutFactoryAccess(true);
  if (!gate.ok) return gate.response;
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const action = typeof body.action === "string" ? body.action : "";
  const targetSlug = typeof body.targetSlug === "string" ? body.targetSlug : undefined;

  if (action === "queue_rollout_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantRolloutFactoryPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Rollout factory packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_rollout_factory",
        prompt: "Queue assistant rollout factory review",
        answerKind: "assistant_rollout_review",
        message: "Assistant rollout packet queued for human review. Tenants, templates, seeds, role grants, module flags, automation policies, connectors, and secrets were not created or changed automatically.",
        evidence: { packetId: packet.id, readinessScore: packet.readinessScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_rollout_factory_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_rollout_factory_packet",
        objectId: packet.id,
        objectHref: "/assistant/rollout-factory",
        priority: packet.readinessScore < 80 || packet.roleGrantGapCount > 0 || packet.moduleGapCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `amp30-rollout-${packet.id}`.slice(0, 128),
        actionKind: "assistant_rollout_factory_review",
        label: `Review rollout packet: ${packet.title}`,
        description: "Approve tenant launch, template copy, grant/module setup, demo seeds, and rollback plan before implementation.",
        payload: { packetId: packet.id, readinessScore: packet.readinessScore, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantRolloutFactoryPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, targetSlug) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported rollout factory action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadRolloutFactoryInputs(gate.access.tenant.id, targetSlug);
  const built = buildRolloutFactoryPacket(inputs);
  const packet = await prisma.assistantRolloutFactoryPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      readinessScore: built.readinessScore,
      templateAssetCount: built.templateAssetCount,
      roleGrantGapCount: built.roleGrantGapCount,
      moduleGapCount: built.moduleGapCount,
      seedGapCount: built.seedGapCount,
      rollbackStepCount: built.rollbackStepCount,
      sourceTenantJson: built.sourceTenant as Prisma.InputJsonValue,
      templateInventoryJson: built.templateInventory as Prisma.InputJsonValue,
      roleGrantPlanJson: built.roleGrantPlan as Prisma.InputJsonValue,
      moduleFlagPlanJson: built.moduleFlagPlan as Prisma.InputJsonValue,
      demoDataPlanJson: built.demoDataPlan as Prisma.InputJsonValue,
      readinessCheckJson: built.readinessChecks as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      onboardingPacketJson: built.onboardingPacket as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, readinessScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_rollout_factory",
      prompt: "Create assistant rollout factory packet",
      answerKind: "assistant_rollout_factory_packet",
      message: built.leadershipSummary,
      evidence: { targetTenant: inputs.targetTenant, readiness: built.readinessChecks, copyPlan: built.templateInventory.copyPlan } as Prisma.InputJsonObject,
      objectType: "assistant_rollout_factory_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, targetSlug) }, { status: 201 });
}
