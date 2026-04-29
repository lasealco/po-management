import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildDataIntegrationPacket, type DataIntegrationInputs } from "@/lib/assistant/data-integration-control";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireDataIntegrationAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.apihub", mode) ||
    viewerHas(access.grantSet, "org.settings", mode) ||
    viewerHas(access.grantSet, "org.products", mode) ||
    viewerHas(access.grantSet, "org.suppliers", mode) ||
    viewerHas(access.grantSet, "org.crm", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires API Hub, settings, product, supplier, CRM, or Control Tower access for Data & Integration Control.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function countRules(value: Prisma.JsonValue): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const rules = (value as Record<string, unknown>).rules ?? (value as Record<string, unknown>).mappings;
    return Array.isArray(rules) ? rules.length : Object.keys(value).length;
  }
  return 0;
}

function issueCount(value: Prisma.JsonValue | null | undefined): number {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object") {
    const raw = (value as Record<string, unknown>).issues ?? (value as Record<string, unknown>).errors ?? (value as Record<string, unknown>).warnings;
    return Array.isArray(raw) ? raw.length : Object.keys(value).length;
  }
  return 1;
}

function textFromJson(value: Prisma.JsonValue | null | undefined, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "string" ? next : null;
}

async function loadDataIntegrationInputs(tenantId: string): Promise<DataIntegrationInputs> {
  const [
    connectors,
    ingestionRuns,
    mappingTemplates,
    mappingJobs,
    stagingBatches,
    stagingRows,
    assistantReviewItems,
    masterDataRuns,
    twinIngestEvents,
    actionQueue,
  ] = await Promise.all([
    prisma.apiHubConnector.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 180,
      select: { id: true, name: true, sourceKind: true, authMode: true, authState: true, authConfigRef: true, status: true, lastSyncAt: true, healthSummary: true },
    }),
    prisma.apiHubIngestionRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, connectorId: true, status: true, triggerKind: true, errorCode: true, errorMessage: true, appliedAt: true, finishedAt: true },
    }),
    prisma.apiHubMappingTemplate.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: { id: true, name: true, description: true, rules: true },
    }),
    prisma.apiHubMappingAnalysisJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { id: true, status: true, errorMessage: true, outputProposal: true, stagingBatches: { select: { id: true } } },
    }),
    prisma.apiHubStagingBatch.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: { id: true, title: true, status: true, rowCount: true, appliedAt: true, applySummary: true },
    }),
    prisma.apiHubStagingRow.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, batchId: true, rowIndex: true, mappedRecord: true, issues: true },
    }),
    prisma.apiHubAssistantReviewItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: { id: true, sourceType: true, sourceId: true, title: true, severity: true, status: true },
    }),
    prisma.assistantMasterDataQualityRun.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, title: true, status: true, qualityScore: true, duplicateCount: true, gapCount: true, staleCount: true, conflictCount: true },
    }),
    prisma.supplyChainTwinIngestEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, type: true, idempotencyKey: true, createdAt: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);
  return {
    connectors: connectors.map((connector) => ({ ...connector, lastSyncAt: connector.lastSyncAt?.toISOString() ?? null })),
    ingestionRuns: ingestionRuns.map((run) => ({ ...run, appliedAt: run.appliedAt?.toISOString() ?? null, finishedAt: run.finishedAt?.toISOString() ?? null })),
    mappingTemplates: mappingTemplates.map((template) => ({ id: template.id, name: template.name, description: template.description, ruleCount: countRules(template.rules) })),
    mappingJobs: mappingJobs.map((job) => ({ id: job.id, status: job.status, errorMessage: job.errorMessage, hasProposal: job.outputProposal != null, stagingBatchCount: job.stagingBatches.length })),
    stagingBatches: stagingBatches.map((batch) => ({ id: batch.id, title: batch.title, status: batch.status, rowCount: batch.rowCount, appliedAt: batch.appliedAt?.toISOString() ?? null, hasApplySummary: batch.applySummary != null })),
    stagingRows: stagingRows.map((row) => ({
      id: row.id,
      batchId: row.batchId,
      rowIndex: row.rowIndex,
      hasMappedRecord: row.mappedRecord != null,
      issueCount: issueCount(row.issues),
      targetDomain: textFromJson(row.mappedRecord, "target") ?? textFromJson(row.mappedRecord, "domain"),
      label: textFromJson(row.mappedRecord, "name") ?? textFromJson(row.mappedRecord, "label") ?? `Staging row ${row.rowIndex}`,
    })),
    assistantReviewItems,
    masterDataRuns,
    twinIngestEvents: twinIngestEvents.map((event) => ({ id: event.id, type: event.type, hasIdempotencyKey: Boolean(event.idempotencyKey), createdAt: event.createdAt.toISOString() })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantDataIntegrationPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        integrationScore: true,
        connectorCount: true,
        blockedConnectorCount: true,
        mappingGapCount: true,
        stagingRiskCount: true,
        masterDataRiskCount: true,
        twinIngestRiskCount: true,
        launchActionCount: true,
        sourceSummaryJson: true,
        connectorReadinessJson: true,
        dataContractJson: true,
        mappingReviewJson: true,
        stagingReviewJson: true,
        masterDataQualityJson: true,
        twinIngestJson: true,
        launchChecklistJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadDataIntegrationInputs(tenantId),
  ]);
  const preview = buildDataIntegrationPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewIntegrationScore: preview.integrationScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireDataIntegrationAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireDataIntegrationAccess(true);
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

  if (action === "queue_integration_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantDataIntegrationPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Data integration packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantDataIntegrationPacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_data_integration_control",
          prompt: "Approve Sprint 9 Data Integration packet",
          answerKind: "data_integration_approved",
          message: "Data & Integration Control packet approved after human review. Connectors, credentials, staging rows, mappings, master data, twin ingest, partner access, syncs, and downstream records were not changed automatically.",
          evidence: { packetId: packet.id, integrationScore: packet.integrationScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_data_integration_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_data_integration_control",
        prompt: "Queue Sprint 9 Data Integration review",
        answerKind: "data_integration_review",
        message: "Data integration launch review queued. The assistant does not activate connectors, change credentials, apply staging rows, mutate master data, append twin ingest events, expose partner access, or trigger syncs.",
        evidence: { packetId: packet.id, integrationScore: packet.integrationScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_data_integration_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_data_integration_packet",
        objectId: packet.id,
        objectHref: "/assistant/data-integration-control",
        priority: packet.integrationScore < 70 || packet.blockedConnectorCount > 0 || packet.stagingRiskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint9-data-integration-${packet.id}`.slice(0, 128),
        actionKind: "data_integration_launch_review",
        label: `Review ${packet.title}`,
        description: "Review connector readiness, contracts, mappings, staging rows, MDM, twin ingest, launch checklist, and rollback before integration rollout.",
        payload: { packetId: packet.id, integrationScore: packet.integrationScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantDataIntegrationPacket.update({ where: { id: packet.id }, data: { status: "INTEGRATION_REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Data Integration action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadDataIntegrationInputs(gate.access.tenant.id);
  const built = buildDataIntegrationPacket(inputs);
  const packet = await prisma.assistantDataIntegrationPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      integrationScore: built.integrationScore,
      connectorCount: built.connectorReadiness.connectorCount,
      blockedConnectorCount: built.connectorReadiness.blockedConnectorCount,
      mappingGapCount: built.mappingReview.mappingGapCount,
      stagingRiskCount: built.stagingReview.stagingRiskCount,
      masterDataRiskCount: built.masterDataQuality.masterDataRiskCount,
      twinIngestRiskCount: built.twinIngest.twinIngestRiskCount,
      launchActionCount: built.launchChecklist.launchActionCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      connectorReadinessJson: built.connectorReadiness as Prisma.InputJsonValue,
      dataContractJson: built.dataContract as Prisma.InputJsonValue,
      mappingReviewJson: built.mappingReview as Prisma.InputJsonValue,
      stagingReviewJson: built.stagingReview as Prisma.InputJsonValue,
      masterDataQualityJson: built.masterDataQuality as Prisma.InputJsonValue,
      twinIngestJson: built.twinIngest as Prisma.InputJsonValue,
      launchChecklistJson: built.launchChecklist as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, integrationScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_data_integration_control",
      prompt: "Create Sprint 9 Data Integration packet",
      answerKind: "data_integration_packet",
      message: built.leadershipSummary,
      evidence: { integrationScore: built.integrationScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_data_integration_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
