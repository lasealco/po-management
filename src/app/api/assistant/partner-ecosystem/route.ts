import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildPartnerEcosystemPacket,
  type PartnerConnectorSignal,
  type PartnerMappingSignal,
  type PartnerSignal,
} from "@/lib/assistant/partner-ecosystem";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requirePartnerEcosystemAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canApiHub = viewerHas(access.grantSet, "org.apihub", edit ? "edit" : "view");
  const canPartners = viewerHas(access.grantSet, "org.suppliers", "view") || viewerHas(access.grantSet, "org.crm", "view");
  if (!canApiHub || !canPartners) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires API Hub plus supplier or CRM partner evidence access.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function jsonIssueCount(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.length;
  const record = value as Record<string, unknown>;
  for (const key of ["issues", "errors", "warnings", "validation"]) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate.length;
  }
  return Object.keys(record).length > 0 ? 1 : 0;
}

async function loadPartnerEcosystemInputs(tenantId: string, grantSet: Set<string>) {
  const [connectors, stagingBatches, mappingJobs, reviewItems, suppliers, crmAccounts] = await Promise.all([
    prisma.apiHubConnector.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        name: true,
        sourceKind: true,
        authMode: true,
        authState: true,
        status: true,
        healthSummary: true,
        lastSyncAt: true,
      },
    }),
    prisma.apiHubStagingBatch.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        status: true,
        rowCount: true,
        updatedAt: true,
        rows: { take: 25, select: { issues: true } },
      },
    }),
    prisma.apiHubMappingAnalysisJob.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, status: true, errorMessage: true, outputProposal: true, updatedAt: true },
    }),
    prisma.apiHubAssistantReviewItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, severity: true, updatedAt: true },
    }),
    viewerHas(grantSet, "org.suppliers", "view")
      ? prisma.supplier.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: {
            id: true,
            name: true,
            isActive: true,
            registeredCountryCode: true,
            _count: { select: { portalLinkedUsers: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.crm", "view")
      ? prisma.crmAccount.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: {
            id: true,
            name: true,
            lifecycle: true,
            segment: true,
            _count: { select: { customerPortalUsers: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const connectorSignals: PartnerConnectorSignal[] = connectors.map((connector) => ({
    id: connector.id,
    name: connector.name,
    sourceKind: connector.sourceKind,
    authMode: connector.authMode,
    authState: connector.authState,
    status: connector.status,
    healthSummary: connector.healthSummary,
    lastSyncAt: connector.lastSyncAt?.toISOString() ?? null,
  }));
  const mappingSignals: PartnerMappingSignal[] = [
    ...stagingBatches.map((batch) => ({
      id: batch.id,
      sourceType: "STAGING_BATCH" as const,
      title: batch.title ?? `Staging batch ${batch.id.slice(0, 8)}`,
      status: batch.status,
      rowCount: batch.rowCount,
      issueCount: batch.rows.reduce((sum, row) => sum + jsonIssueCount(row.issues), 0),
      updatedAt: batch.updatedAt.toISOString(),
    })),
    ...mappingJobs.map((job) => ({
      id: job.id,
      sourceType: "MAPPING_JOB" as const,
      title: `Mapping job ${job.id.slice(0, 8)}`,
      status: job.status,
      issueCount: job.status === "failed" || job.errorMessage ? 1 : 0,
      severity: job.status === "failed" ? "ERROR" : "INFO",
      updatedAt: job.updatedAt.toISOString(),
    })),
    ...reviewItems.map((item) => ({
      id: item.id,
      sourceType: "REVIEW_ITEM" as const,
      title: item.title,
      status: item.status,
      issueCount: item.status === "CLOSED" ? 0 : 1,
      severity: item.severity,
      updatedAt: item.updatedAt.toISOString(),
    })),
  ];
  const partnerSignals: PartnerSignal[] = [
    ...suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      type: "SUPPLIER" as const,
      portalLinked: supplier._count.portalLinkedUsers > 0,
      status: supplier.isActive ? "active" : "inactive",
      countryCode: supplier.registeredCountryCode,
    })),
    ...crmAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: "CUSTOMER" as const,
      portalLinked: account._count.customerPortalUsers > 0,
      status: String(account.lifecycle).toLowerCase(),
      countryCode: account.segment,
    })),
  ];
  return { connectors: connectorSignals, mappings: mappingSignals, partners: partnerSignals };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantPartnerEcosystemPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        readinessScore: true,
        connectorCount: true,
        partnerCount: true,
        mappingIssueCount: true,
        openReviewCount: true,
        sourceSummaryJson: true,
        connectorReadinessJson: true,
        partnerScopeJson: true,
        mappingReviewJson: true,
        onboardingPlanJson: true,
        launchChecklistJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadPartnerEcosystemInputs(tenantId, grantSet),
  ]);
  const preview = buildPartnerEcosystemPacket(inputs);
  return {
    signals: {
      connectors: inputs.connectors.length,
      partners: inputs.partners.length,
      mappings: inputs.mappings.length,
      previewReadinessScore: preview.readinessScore,
      previewOpenReviewCount: preview.openReviewCount,
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
  const gate = await requirePartnerEcosystemAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requirePartnerEcosystemAccess(true);
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

  if (action === "queue_launch_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantPartnerEcosystemPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Partner ecosystem packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_partner_ecosystem",
        prompt: "Queue partner ecosystem launch review",
        answerKind: "partner_ecosystem_review",
        message: "Partner ecosystem packet queued for human review. Connectors, staging rows, portal scopes, and partner playbooks were not launched automatically.",
        evidence: { packetId: packet.id, readinessScore: packet.readinessScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_partner_ecosystem_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_partner_ecosystem_packet",
        objectId: packet.id,
        objectHref: "/assistant/partner-ecosystem",
        priority: packet.readinessScore < 65 || packet.openReviewCount > 3 ? "HIGH" : "MEDIUM",
        actionId: `amp25-partner-${packet.id}`.slice(0, 128),
        actionKind: "partner_ecosystem_launch_review",
        label: `Review partner launch: ${packet.title}`,
        description: "Approve connector readiness, partner portal scope, mapping evidence, and playbook launch before enabling ecosystem workflows.",
        payload: { packetId: packet.id, readinessScore: packet.readinessScore, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantPartnerEcosystemPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported partner ecosystem action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadPartnerEcosystemInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildPartnerEcosystemPacket(inputs);
  const packet = await prisma.assistantPartnerEcosystemPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      readinessScore: built.readinessScore,
      connectorCount: built.connectorCount,
      partnerCount: built.partnerCount,
      mappingIssueCount: built.mappingIssueCount,
      openReviewCount: built.openReviewCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      connectorReadinessJson: built.connectorReadiness as Prisma.InputJsonValue,
      partnerScopeJson: built.partnerScope as Prisma.InputJsonValue,
      mappingReviewJson: built.mappingReview as Prisma.InputJsonValue,
      onboardingPlanJson: built.onboardingPlan as Prisma.InputJsonValue,
      launchChecklistJson: built.launchChecklist as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, readinessScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_partner_ecosystem",
      prompt: "Create partner ecosystem packet",
      answerKind: "partner_ecosystem_packet",
      message: built.leadershipSummary,
      evidence: { readinessScore: built.readinessScore, launchChecklist: built.launchChecklist } as Prisma.InputJsonObject,
      objectType: "assistant_partner_ecosystem_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
