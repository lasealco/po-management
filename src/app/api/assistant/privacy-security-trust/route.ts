import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildPrivacySecurityTrustPacket, type PrivacySecurityTrustInputs } from "@/lib/assistant/privacy-security-trust";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requirePrivacySecurityTrustAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.settings", mode) ||
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.apihub", mode) ||
    viewerHas(access.grantSet, "org.scri", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings, reports, API Hub, or SCRI access for Privacy, Security & Trust.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function evidencePresent(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

async function loadPrivacySecurityTrustInputs(tenantId: string, grantSet: Set<string>): Promise<PrivacySecurityTrustInputs> {
  const [governancePackets, agentGovernancePackets, observabilityIncidents, audits, actionQueue, automationPolicies, externalEvents] = await Promise.all([
    viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantGovernancePacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            governanceScore: true,
            exportRecordCount: true,
            deletionRequestCount: true,
            legalHoldBlockCount: true,
            privacyRiskCount: true,
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantAgentGovernancePacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            governanceScore: true,
            highRiskAgentCount: true,
            toolScopeCount: true,
            promptAssetCount: true,
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantObservabilityIncident.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            healthScore: true,
            failureCount: true,
            evidenceGapCount: true,
            automationRiskCount: true,
          },
        })
      : Promise.resolve([]),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { id: true, surface: true, answerKind: true, objectType: true, objectId: true, evidence: true, quality: true, feedback: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
    viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantAutomationPolicy.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: { id: true, actionKind: true, label: true, status: true, readinessScore: true, threshold: true, rollbackPlan: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.scri", "view")
      ? prisma.scriExternalEvent.findMany({
          where: { tenantId, reviewState: { in: ["NEW", "UNDER_REVIEW", "WATCH", "ACTION_REQUIRED"] } },
          orderBy: [{ severity: "desc" }, { discoveredTime: "desc" }],
          take: 80,
          select: { id: true, eventType: true, title: true, severity: true, confidence: true, reviewState: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    governancePackets,
    agentGovernancePackets,
    observabilityIncidents,
    audits: audits.map((audit) => ({
      id: audit.id,
      surface: audit.surface,
      answerKind: audit.answerKind,
      objectType: audit.objectType,
      objectId: audit.objectId,
      evidencePresent: evidencePresent(audit.evidence),
      qualityPresent: audit.quality != null,
      feedback: audit.feedback,
    })),
    actionQueue,
    automationPolicies,
    externalEvents: externalEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      severity: String(event.severity),
      confidence: event.confidence,
      reviewState: String(event.reviewState),
    })),
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantPrivacySecurityTrustPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        trustScore: true,
        privacyRiskCount: true,
        dsrRequestCount: true,
        transferRiskCount: true,
        identityRiskCount: true,
        securityExceptionCount: true,
        threatSignalCount: true,
        sourceSummaryJson: true,
        consentPostureJson: true,
        dataSubjectRightsJson: true,
        dataTransferJson: true,
        identityAccessJson: true,
        securityExceptionJson: true,
        threatExposureJson: true,
        trustAssuranceJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadPrivacySecurityTrustInputs(tenantId, grantSet),
  ]);
  const preview = buildPrivacySecurityTrustPacket(inputs);
  return {
    signals: {
      governancePackets: inputs.governancePackets.length,
      agentGovernancePackets: inputs.agentGovernancePackets.length,
      observabilityIncidents: inputs.observabilityIncidents.length,
      auditEvents: inputs.audits.length,
      actionQueueItems: inputs.actionQueue.length,
      automationPolicies: inputs.automationPolicies.length,
      externalEvents: inputs.externalEvents.length,
      previewTrustScore: preview.trustScore,
      previewTrustBlockers: preview.trustAssurance.blockers.length,
    },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requirePrivacySecurityTrustAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requirePrivacySecurityTrustAccess(true);
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

  if (action === "queue_trust_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantPrivacySecurityTrustPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Privacy, Security & Trust packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantPrivacySecurityTrustPacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_privacy_security_trust",
          prompt: "Approve Sprint 3 Privacy, Security & Trust packet",
          answerKind: "privacy_security_trust_approved",
          message: "Privacy, Security & Trust packet approved after human review. Consent, DSR, transfer, identity, entitlement, security exception, threat response, and operational source records were not changed automatically.",
          evidence: { packetId: packet.id, trustScore: packet.trustScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_privacy_security_trust_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_privacy_security_trust",
        prompt: "Queue Sprint 3 Privacy, Security & Trust review",
        answerKind: "privacy_security_trust_review",
        message: "Privacy, Security & Trust review queued. The assistant does not mutate consent, DSR, transfer, identity, entitlement, security exception, threat response, automation policy, or operational source records.",
        evidence: { packetId: packet.id, trustScore: packet.trustScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_privacy_security_trust_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_privacy_security_trust_packet",
        objectId: packet.id,
        objectHref: "/assistant/privacy-security-trust",
        priority: packet.trustScore < 70 || packet.securityExceptionCount > 0 || packet.threatSignalCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint3-privacy-security-trust-${packet.id}`.slice(0, 128),
        actionKind: "privacy_security_trust_review",
        label: `Review ${packet.title}`,
        description: "Review consent, DSR, data transfer, identity access, security exceptions, threat exposure, and trust assurance before remediation.",
        payload: { packetId: packet.id, trustScore: packet.trustScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantPrivacySecurityTrustPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id },
    });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported Privacy, Security & Trust action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadPrivacySecurityTrustInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildPrivacySecurityTrustPacket(inputs);
  const packet = await prisma.assistantPrivacySecurityTrustPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      trustScore: built.trustScore,
      privacyRiskCount: built.consentPosture.consentReviewCandidates.length,
      dsrRequestCount: built.dataSubjectRights.requestCount,
      transferRiskCount: built.dataTransfer.transferRiskCount,
      identityRiskCount: built.identityAccess.identityRiskCount,
      securityExceptionCount: built.securityExceptions.exceptionCount,
      threatSignalCount: built.threatExposure.threatSignalCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      consentPostureJson: built.consentPosture as Prisma.InputJsonValue,
      dataSubjectRightsJson: built.dataSubjectRights as Prisma.InputJsonValue,
      dataTransferJson: built.dataTransfer as Prisma.InputJsonValue,
      identityAccessJson: built.identityAccess as Prisma.InputJsonValue,
      securityExceptionJson: built.securityExceptions as Prisma.InputJsonValue,
      threatExposureJson: built.threatExposure as Prisma.InputJsonValue,
      trustAssuranceJson: built.trustAssurance as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, trustScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_privacy_security_trust",
      prompt: "Create Sprint 3 Privacy, Security & Trust packet",
      answerKind: "privacy_security_trust_packet",
      message: built.leadershipSummary,
      evidence: {
        trustScore: built.trustScore,
        sourceSummary: built.sourceSummary,
        trustAssurance: built.trustAssurance,
        rollbackPlan: built.rollbackPlan,
      } as Prisma.InputJsonObject,
      objectType: "assistant_privacy_security_trust_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
