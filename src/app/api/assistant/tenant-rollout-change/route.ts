import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildTenantRolloutPacket, type TenantRolloutInputs } from "@/lib/assistant/tenant-rollout-change";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireTenantRolloutAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen = viewerHas(access.grantSet, "org.settings", mode) || viewerHas(access.grantSet, "org.reports", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires settings or reports access for Tenant Rollout & Change Enablement.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function arrayLength(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.length : 0;
}

async function loadTenantRolloutInputs(tenantId: string): Promise<TenantRolloutInputs> {
  const [tenant, users, orgUnits, roles, adminControls, rolloutFactoryPackets, aiQualityReleasePackets, auditEvents, actionQueue] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, legalName: true, addressCountryCode: true },
    }),
    prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        primaryOrgUnit: { select: { name: true } },
        userRoles: { select: { role: { select: { name: true } } } },
      },
    }),
    prisma.orgUnit.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 250,
      select: { id: true, code: true, name: true, kind: true, parentId: true, roleAssignments: { select: { role: true } } },
    }),
    prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      take: 120,
      select: { id: true, name: true, isSystem: true, permissions: { select: { id: true } }, users: { select: { id: true } } },
    }),
    prisma.assistantAdminControl.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, controlKey: true, rolloutMode: true, packetStatus: true, pilotRolesJson: true, pilotSitesJson: true, updatedAt: true },
    }),
    prisma.assistantRolloutFactoryPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, readinessScore: true, roleGrantGapCount: true, moduleGapCount: true, seedGapCount: true, rollbackStepCount: true },
    }),
    prisma.assistantAiQualityReleasePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, title: true, status: true, qualityScore: true, releaseBlockerCount: true, failedEvalCount: true },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, surface: true, answerKind: true, feedback: true, actorUserId: true, createdAt: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true, dueAt: true },
    }),
  ]);
  if (!tenant) throw new Error("Tenant not found.");
  return {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, legalName: tenant.legalName, countryCode: tenant.addressCountryCode },
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roleNames: user.userRoles.map((role) => role.role.name),
      primaryOrgUnit: user.primaryOrgUnit?.name ?? null,
      createdAt: user.createdAt.toISOString(),
    })),
    orgUnits: orgUnits.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name, kind: unit.kind, parentId: unit.parentId, roleCount: unit.roleAssignments.length })),
    roles: roles.map((role) => ({ id: role.id, name: role.name, isSystem: role.isSystem, permissionCount: role.permissions.length, userCount: role.users.length })),
    adminControls: adminControls.map((control) => ({
      id: control.id,
      controlKey: control.controlKey,
      rolloutMode: control.rolloutMode,
      packetStatus: control.packetStatus,
      pilotRoleCount: arrayLength(control.pilotRolesJson),
      pilotSiteCount: arrayLength(control.pilotSitesJson),
      updatedAt: control.updatedAt.toISOString(),
    })),
    rolloutFactoryPackets,
    aiQualityReleasePackets,
    auditEvents: auditEvents.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    actionQueue: actionQueue.map((item) => ({ ...item, dueAt: item.dueAt?.toISOString() ?? null })),
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantTenantRolloutPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        rolloutScore: true,
        activeUserCount: true,
        stakeholderGapCount: true,
        trainingGapCount: true,
        communicationGapCount: true,
        supportRiskCount: true,
        adoptionRiskCount: true,
        cutoverBlockerCount: true,
        sourceSummaryJson: true,
        tenantProfileJson: true,
        stakeholderMapJson: true,
        rolloutWaveJson: true,
        enablementPlanJson: true,
        communicationPlanJson: true,
        adoptionTelemetryJson: true,
        supportModelJson: true,
        cutoverChecklistJson: true,
        rollbackPlanJson: true,
        responsePlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadTenantRolloutInputs(tenantId),
  ]);
  const preview = buildTenantRolloutPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewRolloutScore: preview.rolloutScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireTenantRolloutAccess(false);
  if (!gate.ok) return gate.response;
  try {
    return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
  } catch (error) {
    return toApiErrorResponse({ error: error instanceof Error ? error.message : "Unable to build Tenant Rollout snapshot.", code: "TENANT_ROLLOUT_SNAPSHOT_FAILED", status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireTenantRolloutAccess(true);
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

  if (action === "queue_change_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantTenantRolloutPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Tenant rollout packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantTenantRolloutPacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_tenant_rollout_change",
          prompt: "Approve Sprint 11 Tenant Rollout packet",
          answerKind: "tenant_rollout_packet_approved",
          message: "Tenant Rollout & Change Enablement packet approved after human review. Users, roles, tenant settings, module flags, training, communications, seeds, and launch state were not changed automatically.",
          evidence: { packetId: packet.id, rolloutScore: packet.rolloutScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_tenant_rollout_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_tenant_rollout_change",
        prompt: "Queue Sprint 11 tenant rollout change review",
        answerKind: "tenant_rollout_change_review",
        message: "Tenant rollout change review queued. The assistant does not invite users, grant roles, enable modules, send communications, run seeds, change rollout mode, or mutate tenant settings.",
        evidence: { packetId: packet.id, rolloutScore: packet.rolloutScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_tenant_rollout_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_tenant_rollout_packet",
        objectId: packet.id,
        objectHref: "/assistant/tenant-rollout-change",
        priority: packet.rolloutScore < 75 || packet.cutoverBlockerCount > 0 || packet.stakeholderGapCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint11-tenant-rollout-${packet.id}`.slice(0, 128),
        actionKind: "tenant_rollout_change_review",
        label: `Review ${packet.title}`,
        description: "Review stakeholder readiness, waves, training, communications, adoption, support, cutover, and rollback before tenant rollout.",
        payload: { packetId: packet.id, rolloutScore: packet.rolloutScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantTenantRolloutPacket.update({ where: { id: packet.id }, data: { status: "CHANGE_REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Tenant Rollout action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadTenantRolloutInputs(gate.access.tenant.id);
  const built = buildTenantRolloutPacket(inputs);
  const packet = await prisma.assistantTenantRolloutPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      rolloutScore: built.rolloutScore,
      activeUserCount: built.tenantProfile.activeUserCount,
      stakeholderGapCount: built.stakeholderMap.stakeholderGapCount,
      trainingGapCount: built.enablementPlan.trainingGapCount,
      communicationGapCount: built.communicationPlan.communicationGapCount,
      supportRiskCount: built.supportModel.supportRiskCount,
      adoptionRiskCount: built.adoptionTelemetry.adoptionRiskCount,
      cutoverBlockerCount: built.cutoverChecklist.cutoverBlockerCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      tenantProfileJson: built.tenantProfile as Prisma.InputJsonValue,
      stakeholderMapJson: built.stakeholderMap as Prisma.InputJsonValue,
      rolloutWaveJson: built.rolloutWaves as Prisma.InputJsonValue,
      enablementPlanJson: built.enablementPlan as Prisma.InputJsonValue,
      communicationPlanJson: built.communicationPlan as Prisma.InputJsonValue,
      adoptionTelemetryJson: built.adoptionTelemetry as Prisma.InputJsonValue,
      supportModelJson: built.supportModel as Prisma.InputJsonValue,
      cutoverChecklistJson: built.cutoverChecklist as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, rolloutScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_tenant_rollout_change",
      prompt: "Create Sprint 11 Tenant Rollout packet",
      answerKind: "tenant_rollout_packet",
      message: built.leadershipSummary,
      evidence: { rolloutScore: built.rolloutScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_tenant_rollout_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
