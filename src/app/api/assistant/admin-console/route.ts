import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  DEFAULT_ASSISTANT_ADMIN_THRESHOLDS,
  buildAssistantCompliancePacket,
  buildPermissionMatrix,
  evaluateAssistantAdminReadiness,
  normalizeAssistantAdminThresholds,
} from "@/lib/assistant/admin-console";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { GLOBAL_PERMISSION_CATALOG } from "@/lib/permission-catalog";
import { prisma } from "@/lib/prisma";

const CONTROL_KEY = "assistant_admin_console";

function arrayOfStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 30);
}

async function requireSettingsAccess(mode: "view" | "edit") {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  if (!viewerHas(access.grantSet, "org.settings", mode)) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: `Forbidden: requires org.settings ${mode}.`, code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

export async function buildAssistantAdminConsoleSnapshot(tenantId: string) {
  const [
    control,
    roles,
    rolePermissions,
    audits,
    releaseGate,
    policies,
    actionStats,
    approvedPromptCount,
    activePlaybookCount,
  ] = await Promise.all([
    prisma.assistantAdminControl.findUnique({ where: { tenantId_controlKey: { tenantId, controlKey: CONTROL_KEY } } }),
    prisma.role.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.rolePermission.findMany({
      where: { role: { tenantId }, effect: "allow", workflowStatusId: null },
      select: { roleId: true, resource: true, action: true },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { evidence: true, quality: true },
    }),
    prisma.assistantReleaseGate.findFirst({
      where: { tenantId, gateKey: "assistant_quality_release" },
      orderBy: { evaluatedAt: "desc" },
      select: { status: true, score: true, threshold: true, evaluatedAt: true },
    }),
    prisma.assistantAutomationPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, actionKind: true, label: true, status: true, readinessScore: true, threshold: true, updatedAt: true },
    }),
    prisma.assistantActionQueueItem.groupBy({
      by: ["status", "priority"],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.assistantPromptLibraryItem.count({ where: { tenantId, status: "APPROVED" } }),
    prisma.assistantPlaybookTemplate.count({ where: { tenantId, isActive: true } }),
  ]);

  const evidenceCoveragePct = Math.round(
    (audits.filter((audit) => {
      const evidence = audit.evidence;
      if (Array.isArray(evidence)) return evidence.length > 0;
      if (evidence && typeof evidence === "object") return Object.keys(evidence).length > 0;
      return audit.quality != null;
    }).length / Math.max(1, audits.length)) * 100,
  );
  const thresholds = normalizeAssistantAdminThresholds(control?.thresholdsJson ?? DEFAULT_ASSISTANT_ADMIN_THRESHOLDS);
  const openHighPriorityActionCount = actionStats
    .filter((row) => row.priority === "HIGH" && row.status === "PENDING")
    .reduce((sum, row) => sum + row._count._all, 0);
  const signals = {
    evidenceCoveragePct,
    latestReleaseGateScore: releaseGate?.score ?? 0,
    latestReleaseGateStatus: releaseGate?.status ?? null,
    enabledAutomationCount: policies.filter((policy) => policy.status === "ENABLED").length,
    pausedAutomationCount: policies.filter((policy) => policy.status === "PAUSED").length,
    openHighPriorityActionCount,
    approvedPromptCount,
    activePlaybookCount,
  };
  const readiness = evaluateAssistantAdminReadiness(signals, thresholds);
  const permissionMatrix = buildPermissionMatrix(GLOBAL_PERMISSION_CATALOG, rolePermissions);
  return {
    generatedAt: new Date().toISOString(),
    control: {
      rolloutMode: control?.rolloutMode ?? "PILOT",
      pilotRoles: arrayOfStrings(control?.pilotRolesJson),
      pilotSites: arrayOfStrings(control?.pilotSitesJson),
      thresholds,
      flags: control?.flagsJson ?? { assistantEnabled: true, requireEvidence: true, allowControlledAutomation: false },
      packetStatus: control?.packetStatus ?? "DRAFT",
      packet: control?.packetJson ?? null,
      updatedAt: control?.updatedAt.toISOString() ?? null,
    },
    roles,
    permissionMatrix,
    releaseGate: releaseGate
      ? { ...releaseGate, evaluatedAt: releaseGate.evaluatedAt.toISOString() }
      : null,
    policies: policies.map((policy) => ({ ...policy, updatedAt: policy.updatedAt.toISOString() })),
    signals,
    readiness,
  };
}

export async function GET() {
  const gate = await requireSettingsAccess("view");
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildAssistantAdminConsoleSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireSettingsAccess("edit");
  if (!gate.ok) return gate.response;
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof o.action === "string" ? o.action : "";
  const snapshot = await buildAssistantAdminConsoleSnapshot(gate.access.tenant.id);

  if (action === "save_control") {
    const rolloutMode = typeof o.rolloutMode === "string" && o.rolloutMode.trim() ? o.rolloutMode.trim().toUpperCase().slice(0, 32) : "PILOT";
    const pilotRoles = arrayOfStrings(o.pilotRoles);
    const pilotSites = arrayOfStrings(o.pilotSites);
    const thresholds = normalizeAssistantAdminThresholds(o.thresholds);
    const flags = o.flags && typeof o.flags === "object" ? (o.flags as Prisma.InputJsonObject) : { assistantEnabled: true, requireEvidence: true };
    const control = await prisma.assistantAdminControl.upsert({
      where: { tenantId_controlKey: { tenantId: gate.access.tenant.id, controlKey: CONTROL_KEY } },
      update: {
        rolloutMode,
        pilotRolesJson: pilotRoles,
        pilotSitesJson: pilotSites,
        thresholdsJson: thresholds as unknown as Prisma.InputJsonValue,
        flagsJson: flags,
        updatedByUserId: actorUserId,
      },
      create: {
        tenantId: gate.access.tenant.id,
        controlKey: CONTROL_KEY,
        rolloutMode,
        pilotRolesJson: pilotRoles,
        pilotSitesJson: pilotSites,
        thresholdsJson: thresholds as unknown as Prisma.InputJsonValue,
        flagsJson: flags,
        updatedByUserId: actorUserId,
      },
      select: { id: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_admin_console",
        prompt: "Save assistant admin rollout control",
        answerKind: "admin_control",
        message: `Saved assistant rollout mode ${rolloutMode}.`,
        evidence: { controlId: control.id, rolloutMode, pilotRoles, pilotSites, thresholds } as Prisma.InputJsonValue,
        objectType: "assistant_admin_control",
        objectId: control.id,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "export_packet") {
    const packet = buildAssistantCompliancePacket({
      generatedAt: new Date().toISOString(),
      tenant: gate.access.tenant,
      rolloutMode: snapshot.control.rolloutMode,
      pilotRoles: snapshot.control.pilotRoles,
      pilotSites: snapshot.control.pilotSites,
      thresholds: snapshot.control.thresholds,
      signals: snapshot.signals,
      readiness: snapshot.readiness,
      permissionMatrix: snapshot.permissionMatrix.map((row) => ({
        resource: row.resource,
        action: row.action,
        label: row.label,
        grantedRoleCount: row.grantedRoleCount,
      })),
    });
    const control = await prisma.assistantAdminControl.upsert({
      where: { tenantId_controlKey: { tenantId: gate.access.tenant.id, controlKey: CONTROL_KEY } },
      update: {
        packetJson: packet as unknown as Prisma.InputJsonValue,
        packetStatus: snapshot.readiness.status === "READY" ? "READY" : "BLOCKED",
        updatedByUserId: actorUserId,
      },
      create: {
        tenantId: gate.access.tenant.id,
        controlKey: CONTROL_KEY,
        thresholdsJson: snapshot.control.thresholds as unknown as Prisma.InputJsonValue,
        flagsJson: snapshot.control.flags as Prisma.InputJsonValue,
        packetJson: packet as unknown as Prisma.InputJsonValue,
        packetStatus: snapshot.readiness.status === "READY" ? "READY" : "BLOCKED",
        updatedByUserId: actorUserId,
      },
      select: { id: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_admin_console",
        prompt: "Export assistant compliance packet",
        answerKind: "compliance_packet",
        message: `Exported assistant compliance packet with status ${packet.readiness.status}.`,
        evidence: packet as unknown as Prisma.InputJsonValue,
        objectType: "assistant_admin_control",
        objectId: control.id,
      },
    });
    return NextResponse.json({ ok: true, packet });
  }

  return toApiErrorResponse({ error: "Unsupported assistant admin action.", code: "BAD_INPUT", status: 400 });
}
