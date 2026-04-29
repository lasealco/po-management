import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildMasterDataGovernancePacket,
  type MasterDataGovernanceInputs,
} from "@/lib/assistant/master-data-governance-enrichment";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function issuesPresent(issues: Prisma.JsonValue | null): boolean {
  if (issues === null || issues === undefined) return false;
  if (Array.isArray(issues)) return issues.length > 0;
  if (typeof issues === "object") return Object.keys(issues as Record<string, unknown>).length > 0;
  return true;
}

async function requireMasterDataGovernanceAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.apihub", mode) ||
    viewerHas(access.grantSet, "org.settings", mode) ||
    viewerHas(access.grantSet, "org.products", mode) ||
    viewerHas(access.grantSet, "org.suppliers", mode) ||
    viewerHas(access.grantSet, "org.reports", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires API Hub, settings, products, suppliers, or reports access for Sprint 21.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadMasterDataGovernanceInputs(tenantId: string, grantSet: Set<string>): Promise<MasterDataGovernanceInputs> {
  const canMdm =
    viewerHas(grantSet, "org.settings", "view") ||
    viewerHas(grantSet, "org.apihub", "view") ||
    viewerHas(grantSet, "org.products", "view") ||
    viewerHas(grantSet, "org.suppliers", "view") ||
    viewerHas(grantSet, "org.reports", "view");

  const [
    masterDataRunsRaw,
    openStagingBatchesRaw,
    stagingRowsSample,
    hubReviewsRaw,
    failedMappingJobsRaw,
    failedIngestionRunsRaw,
  ] = await Promise.all([
    canMdm
      ? prisma.assistantMasterDataQualityRun.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 90,
          select: {
            id: true,
            title: true,
            duplicateCount: true,
            gapCount: true,
            staleCount: true,
            conflictCount: true,
          },
        })
      : Promise.resolve([]),
    canMdm
      ? prisma.apiHubStagingBatch.findMany({
          where: { tenantId, status: "open" },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { id: true, title: true, rowCount: true },
        })
      : Promise.resolve([]),
    canMdm
      ? prisma.apiHubStagingRow.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 620,
          select: { issues: true },
        })
      : Promise.resolve([]),
    canMdm
      ? prisma.apiHubAssistantReviewItem.findMany({
          where: { tenantId, status: "OPEN" },
          orderBy: { updatedAt: "desc" },
          take: 140,
          select: { id: true, title: true, status: true, severity: true },
        })
      : Promise.resolve([]),
    canMdm
      ? prisma.apiHubMappingAnalysisJob.findMany({
          where: { tenantId, status: "failed" },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { id: true, status: true },
        })
      : Promise.resolve([]),
    canMdm
      ? prisma.apiHubIngestionRun.findMany({
          where: { tenantId, status: "failed" },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { id: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const stagingRowsWithIssueFlags = stagingRowsSample.reduce((total, row) => total + (issuesPresent(row.issues) ? 1 : 0), 0);

  return {
    masterDataRuns: masterDataRunsRaw,
    openStagingBatches: openStagingBatchesRaw.map((batch) => ({
      id: batch.id,
      title: batch.title,
      rowCount: batch.rowCount,
    })),
    stagingRowsWithIssueFlags,
    hubReviews: hubReviewsRaw.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      severity: item.severity,
    })),
    failedMappingJobs: failedMappingJobsRaw,
    failedIngestionRuns: failedIngestionRunsRaw,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantMasterDataGovernancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        governanceScore: true,
        duplicateClusterRiskCount: true,
        staleRecordRiskCount: true,
        stagingConflictRiskCount: true,
        hubReviewRiskCount: true,
        canonicalConflictRiskCount: true,
        enrichmentQueueRiskCount: true,
        sourceSummaryJson: true,
        duplicateClustersJson: true,
        staleRecordsJson: true,
        stagingConflictsJson: true,
        hubReviewQueueJson: true,
        canonicalConflictJson: true,
        enrichmentQueueJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadMasterDataGovernanceInputs(tenantId, grantSet),
  ]);
  const preview = buildMasterDataGovernancePacket(inputs);
  return {
    signals: {
      ...preview.sourceSummary,
      previewGovernanceScore: preview.governanceScore,
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
  const gate = await requireMasterDataGovernanceAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireMasterDataGovernanceAccess(true);
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

  if (action === "queue_mdm_governance_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantMasterDataGovernancePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Master data governance packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantMasterDataGovernancePacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_master_data_governance",
          prompt: "Approve Sprint 21 Master Data Governance packet",
          answerKind: "sprint21_mdg_ok",
          message:
            "Master data governance packet approved after human review. MDM merges, staging promotions, enrichment publishes, connector edits, and ingestion replays were not executed automatically.",
          evidence: { packetId: packet.id, governanceScore: packet.governanceScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_master_data_governance_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_master_data_governance",
        prompt: "Queue Sprint 21 master data governance review",
        answerKind: "sprint21_mdg_rev",
        message:
          "Master data governance review queued. The assistant does not merge masters, apply staging rows, publish enrichment, retry ingestion, or alter connectors automatically.",
        evidence: { packetId: packet.id, governanceScore: packet.governanceScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_master_data_governance_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_master_data_governance_packet",
        objectId: packet.id,
        objectHref: "/assistant/master-data-governance-enrichment",
        priority: packet.governanceScore < 72 || packet.stagingConflictRiskCount > 2 ? "HIGH" : "MEDIUM",
        actionId: `sprint21-master-data-governance-${packet.id}`.slice(0, 128),
        actionKind: "mdm_governance_review",
        label: `Review ${packet.title}`,
        description:
          "Review duplicate/stale posture, API Hub staging conflicts, integration review backlog, canonical conflicts, and enrichment queues before MDM execution.",
        payload: { packetId: packet.id, governanceScore: packet.governanceScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantMasterDataGovernancePacket.update({ where: { id: packet.id }, data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Master Data Governance action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadMasterDataGovernanceInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildMasterDataGovernancePacket(inputs);
  const packet = await prisma.assistantMasterDataGovernancePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      governanceScore: built.governanceScore,
      duplicateClusterRiskCount: built.duplicateClusterRiskCount,
      staleRecordRiskCount: built.staleRecordRiskCount,
      stagingConflictRiskCount: built.stagingConflictRiskCount,
      hubReviewRiskCount: built.hubReviewRiskCount,
      canonicalConflictRiskCount: built.canonicalConflictRiskCount,
      enrichmentQueueRiskCount: built.enrichmentQueueRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      duplicateClustersJson: built.duplicateClustersJson as Prisma.InputJsonValue,
      staleRecordsJson: built.staleRecordsJson as Prisma.InputJsonValue,
      stagingConflictsJson: built.stagingConflictsJson as Prisma.InputJsonValue,
      hubReviewQueueJson: built.hubReviewQueueJson as Prisma.InputJsonValue,
      canonicalConflictJson: built.canonicalConflictJson as Prisma.InputJsonValue,
      enrichmentQueueJson: built.enrichmentQueueJson as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, governanceScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_master_data_governance",
      prompt: "Create Sprint 21 Master Data Governance packet",
      answerKind: "sprint21_mdg_pkt",
      message: built.leadershipSummary,
      evidence:
        {
          governanceScore: built.governanceScore,
          sourceSummary: built.sourceSummary,
          responsePlan: built.responsePlan,
          rollbackPlan: built.rollbackPlan,
        } as Prisma.InputJsonObject,
      objectType: "assistant_master_data_governance_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
