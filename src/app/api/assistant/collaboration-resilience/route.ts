import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildCollaborationResiliencePacket, type CollaborationResilienceInputs } from "@/lib/assistant/collaboration-resilience";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireCollaborationResilienceAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.srm", mode) ||
    viewerHas(access.grantSet, "org.suppliers", mode) ||
    viewerHas(access.grantSet, "org.crm", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode) ||
    viewerHas(access.grantSet, "org.wms", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires reports, supplier/SRM, CRM, Control Tower, or WMS access for Collaboration & Resilience.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadCollaborationInputs(tenantId: string, grantSet: Set<string>): Promise<CollaborationResilienceInputs> {
  const [partnerPackets, customerBriefs, exceptionIncidents, sustainabilityPackets, frontlinePackets, supplierTasks, products, externalEvents, actionQueue] = await Promise.all([
    prisma.assistantPartnerEcosystemPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, readinessScore: true, partnerCount: true, mappingIssueCount: true, openReviewCount: true },
    }),
    viewerHas(grantSet, "org.crm", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantCustomerBrief.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: { id: true, title: true, status: true, serviceScore: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.controltower", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantExceptionIncident.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: { id: true, title: true, status: true, severity: true, severityScore: true, customerImpact: true },
        })
      : Promise.resolve([]),
    prisma.assistantSustainabilityPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, sustainabilityScore: true, estimatedCo2eKg: true, missingDataCount: true, recommendationCount: true },
    }),
    viewerHas(grantSet, "org.wms", "view") || viewerHas(grantSet, "org.srm", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantFrontlinePacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: { id: true, title: true, status: true, readinessScore: true, frontlineTaskCount: true, evidenceGapCount: true, offlineRiskCount: true, exceptionCount: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.srm", "view") || viewerHas(grantSet, "org.suppliers", "view")
      ? prisma.supplierOnboardingTask.findMany({
          where: { tenantId },
          orderBy: [{ done: "asc" }, { dueAt: "asc" }, { updatedAt: "desc" }],
          take: 120,
          select: { id: true, title: true, done: true, dueAt: true, supplier: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, sku: true, productCode: true, name: true, categoryId: true, ean: true, hsCode: true, supplierOfficeId: true, productSuppliers: { take: 1, select: { supplierId: true } } },
    }),
    prisma.scriExternalEvent.findMany({
      where: { tenantId, reviewState: { in: ["NEW", "UNDER_REVIEW", "WATCH", "ACTION_REQUIRED"] } },
      orderBy: [{ severity: "desc" }, { discoveredTime: "desc" }],
      take: 80,
      select: { id: true, eventType: true, title: true, severity: true, confidence: true, reviewState: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);

  return {
    partnerPackets,
    customerBriefs,
    exceptionIncidents,
    sustainabilityPackets: sustainabilityPackets.map((packet) => ({ ...packet, estimatedCo2eKg: Number(packet.estimatedCo2eKg) })),
    frontlinePackets,
    supplierTasks: supplierTasks.map((task) => ({ id: task.id, title: task.title, done: task.done, dueAt: task.dueAt?.toISOString() ?? null, supplierName: task.supplier.name })),
    productSignals: products.map((product) => ({
      id: product.id,
      sku: product.sku ?? product.productCode,
      name: product.name,
      hasCategory: Boolean(product.categoryId),
      hasDimensions: Boolean(product.ean || product.hsCode),
      hasTraceability: Boolean(product.supplierOfficeId || product.productSuppliers.length > 0),
    })),
    externalEvents: externalEvents.map((event) => ({ id: event.id, eventType: event.eventType, title: event.title, severity: String(event.severity), confidence: event.confidence, reviewState: String(event.reviewState) })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantCollaborationResiliencePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        resilienceScore: true,
        partnerGapCount: true,
        promiseRiskCount: true,
        climateRiskCount: true,
        passportGapCount: true,
        workforceRiskCount: true,
        safetySignalCount: true,
        sourceSummaryJson: true,
        collaborationHubJson: true,
        promiseReconciliationJson: true,
        resiliencePlanJson: true,
        passportReadinessJson: true,
        workforceSafetyJson: true,
        externalRiskJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadCollaborationInputs(tenantId, grantSet),
  ]);
  const preview = buildCollaborationResiliencePacket(inputs);
  return {
    signals: {
      partnerPackets: inputs.partnerPackets.length,
      customerBriefs: inputs.customerBriefs.length,
      exceptionIncidents: inputs.exceptionIncidents.length,
      sustainabilityPackets: inputs.sustainabilityPackets.length,
      frontlinePackets: inputs.frontlinePackets.length,
      supplierTasks: inputs.supplierTasks.length,
      products: inputs.productSignals.length,
      externalEvents: inputs.externalEvents.length,
      actionQueueItems: inputs.actionQueue.length,
      previewResilienceScore: preview.resilienceScore,
    },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireCollaborationResilienceAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireCollaborationResilienceAccess(true);
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

  if (action === "queue_resilience_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantCollaborationResiliencePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Collaboration & Resilience packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantCollaborationResiliencePacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_collaboration_resilience",
          prompt: "Approve Sprint 5 Collaboration & Resilience packet",
          answerKind: "collaboration_resilience_approved",
          message: "Collaboration & Resilience packet approved after human review. Supplier/customer collaboration, promises, shipments, routes, ESG claims, product passports, workforce plans, safety incidents, and source records were not changed automatically.",
          evidence: { packetId: packet.id, resilienceScore: packet.resilienceScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_collaboration_resilience_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_collaboration_resilience",
        prompt: "Queue Sprint 5 Collaboration & Resilience review",
        answerKind: "collaboration_resilience_review",
        message: "Collaboration and resilience review queued. The assistant does not mutate supplier/customer collaboration records, promises, shipments, routes, ESG claims, product passports, workforce plans, safety incidents, or operational source records.",
        evidence: { packetId: packet.id, resilienceScore: packet.resilienceScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_collaboration_resilience_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_collaboration_resilience_packet",
        objectId: packet.id,
        objectHref: "/assistant/collaboration-resilience",
        priority: packet.resilienceScore < 70 || packet.safetySignalCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint5-collaboration-resilience-${packet.id}`.slice(0, 128),
        actionKind: "collaboration_resilience_review",
        label: `Review ${packet.title}`,
        description: "Review supplier/customer collaboration, promises, resilience, passports, workforce, and safety before operational changes.",
        payload: { packetId: packet.id, resilienceScore: packet.resilienceScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantCollaborationResiliencePacket.update({ where: { id: packet.id }, data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Collaboration & Resilience action.", code: "BAD_INPUT", status: 400 });

  const inputs = await loadCollaborationInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildCollaborationResiliencePacket(inputs);
  const packet = await prisma.assistantCollaborationResiliencePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      resilienceScore: built.resilienceScore,
      partnerGapCount: built.collaborationHub.partnerGapCount,
      promiseRiskCount: built.promiseReconciliation.promiseRiskCount,
      climateRiskCount: built.resiliencePlan.climateRiskCount,
      passportGapCount: built.passportReadiness.passportGapCount,
      workforceRiskCount: built.workforceSafety.workforceRiskCount,
      safetySignalCount: built.workforceSafety.safetySignalCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      collaborationHubJson: built.collaborationHub as Prisma.InputJsonValue,
      promiseReconciliationJson: built.promiseReconciliation as Prisma.InputJsonValue,
      resiliencePlanJson: built.resiliencePlan as Prisma.InputJsonValue,
      passportReadinessJson: built.passportReadiness as Prisma.InputJsonValue,
      workforceSafetyJson: built.workforceSafety as Prisma.InputJsonValue,
      externalRiskJson: built.externalRisk as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, resilienceScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_collaboration_resilience",
      prompt: "Create Sprint 5 Collaboration & Resilience packet",
      answerKind: "collaboration_resilience_packet",
      message: built.leadershipSummary,
      evidence: { resilienceScore: built.resilienceScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_collaboration_resilience_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
