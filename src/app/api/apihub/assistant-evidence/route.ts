import type { Prisma } from "@prisma/client";

import { buildApplyConflictExplanation, buildConnectorEvidence, buildStagingEvidence } from "@/lib/apihub/assistant-evidence";
import { apiHubError, apiHubJson, apiHubValidationError } from "@/lib/apihub/api-error";
import { listApiHubApplyConflicts } from "@/lib/apihub/ingestion-apply-conflicts-repo";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function loadAmp9Payload(tenantId: string) {
  const [connectors, stagingBatches, mappingJobs, conflicts, reviewItems] = await Promise.all([
    prisma.apiHubConnector.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        sourceKind: true,
        status: true,
        authMode: true,
        authState: true,
        healthSummary: true,
        updatedAt: true,
      },
    }),
    prisma.apiHubStagingBatch.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        rowCount: true,
        appliedAt: true,
        applySummary: true,
        updatedAt: true,
      },
    }),
    prisma.apiHubMappingAnalysisJob.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, status: true, errorMessage: true, outputProposal: true, updatedAt: true },
    }),
    listApiHubApplyConflicts({ tenantId, limit: 10, cursor: null }),
    prisma.apiHubAssistantReviewItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        title: true,
        summary: true,
        severity: true,
        status: true,
        actionQueueItemId: true,
        assistantEvidenceRecordId: true,
        createdAt: true,
      },
    }),
  ]);
  const connectorEvidence = connectors.map(buildConnectorEvidence);
  const stagingEvidence = stagingBatches.map(buildStagingEvidence);
  const conflictEvidence = conflicts.items.map((conflict) => ({
    sourceType: "apply_conflict",
    sourceId: conflict.id,
    title: `Apply conflict ${conflict.resultCode}`,
    summary: buildApplyConflictExplanation(conflict),
    severity: conflict.httpStatus >= 500 ? "ERROR" : "WARN",
    href: "/apihub/workspace?tab=apply-conflicts",
    evidence: conflict,
  }));
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      connectors: connectors.length,
      stagingBatches: stagingBatches.length,
      openStagingBatches: stagingBatches.filter((batch) => batch.status === "open").length,
      mappingJobs: mappingJobs.length,
      failedMappingJobs: mappingJobs.filter((job) => job.status === "failed").length,
      applyConflicts: conflicts.items.length,
      reviewItems: reviewItems.length,
    },
    evidence: [...conflictEvidence, ...stagingEvidence, ...connectorEvidence].slice(0, 50),
    mappingJobs: mappingJobs.map((job) => ({ ...job, updatedAt: job.updatedAt.toISOString() })),
    reviewItems: reviewItems.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
  };
}

export async function GET(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) return gate.response;
  return apiHubJson(await loadAmp9Payload(gate.ctx.tenant.id), requestId);
}

export async function POST(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) return gate.response;
  const { tenant, actorId } = gate.ctx;

  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(request, requestId, "standard");
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof o.action === "string" ? o.action : "";
  const sourceType = typeof o.sourceType === "string" && o.sourceType.trim() ? o.sourceType.trim().slice(0, 64) : "";
  const sourceId = typeof o.sourceId === "string" && o.sourceId.trim() ? o.sourceId.trim() : null;
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 240) : "";
  const summary = typeof o.summary === "string" && o.summary.trim() ? o.summary.trim().slice(0, 8000) : "";
  const href = typeof o.href === "string" && o.href.startsWith("/") ? o.href.slice(0, 2048) : "/apihub/workspace";
  if (!sourceType || !title || !summary) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Assistant evidence validation failed.", [
      { field: "sourceType/title/summary", code: "REQUIRED", message: "sourceType, title, and summary are required.", severity: "error" },
    ], requestId);
  }
  const severity =
    o.severity === "ERROR" || o.severity === "WARN" || o.severity === "INFO" ? o.severity : "INFO";
  const evidenceJson =
    o.evidence && typeof o.evidence === "object" ? (o.evidence as Prisma.InputJsonObject) : ({ title, summary, href } as Prisma.InputJsonObject);

  if (action === "create_review_item") {
    const created = await prisma.$transaction(async (tx) => {
      const evidence = await tx.assistantEvidenceRecord.create({
        data: {
          tenantId: tenant.id,
          label: title,
          href,
          excerpt: summary,
          sourceType: "APIHUB",
          confidence: severity === "ERROR" ? "HIGH" : "MEDIUM",
          createdByUserId: actorId,
        },
        select: { id: true },
      });
      const audit = await tx.assistantAuditEvent.create({
        data: {
          tenantId: tenant.id,
          actorUserId: actorId,
          surface: "apihub_assistant",
          prompt: `Review API Hub ${sourceType} ${sourceId ?? ""}`.trim(),
          answerKind: "apihub_integration_evidence",
          message: summary,
          evidence: [{ label: title, href }],
          quality: { mode: "deterministic", secretSafe: true, source: "amp9_apihub_assistant" },
          objectType: sourceType,
          objectId: sourceId,
        },
        select: { id: true },
      });
      const actionItem = await tx.assistantActionQueueItem.create({
        data: {
          tenantId: tenant.id,
          actorUserId: actorId,
          auditEventId: audit.id,
          objectType: sourceType,
          objectId: sourceId,
          objectHref: href,
          actionId: `apihub-review-${sourceType}-${sourceId ?? Date.now()}`.slice(0, 128),
          actionKind: "apihub_review",
          label: title,
          description: summary,
          payload: { sourceType, sourceId, href, evidenceRecordId: evidence.id },
          priority: severity === "ERROR" ? "HIGH" : "MEDIUM",
        },
        select: { id: true },
      });
      const review = await tx.apiHubAssistantReviewItem.create({
        data: {
          tenantId: tenant.id,
          createdByUserId: actorId,
          sourceType,
          sourceId,
          title,
          summary,
          severity,
          evidenceJson,
          actionQueueItemId: actionItem.id,
          assistantEvidenceRecordId: evidence.id,
        },
        select: { id: true, actionQueueItemId: true },
      });
      return review;
    });
    return apiHubJson({ ok: true, reviewItem: created }, requestId);
  }

  if (action === "close_review_item") {
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
    if (!id) return apiHubError(400, "VALIDATION_ERROR", "id is required.", requestId);
    const updated = await prisma.apiHubAssistantReviewItem.updateMany({
      where: { id, tenantId: tenant.id },
      data: { status: "CLOSED" },
    });
    if (updated.count === 0) return apiHubError(404, "NOT_FOUND", "Review item not found.", requestId);
    return apiHubJson({ ok: true }, requestId);
  }

  return apiHubError(400, "VALIDATION_ERROR", "Unsupported assistant evidence action.", requestId);
}
