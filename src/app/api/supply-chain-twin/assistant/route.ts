import type { Prisma } from "@prisma/client";

import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
} from "../_lib/sctwin-api-log";
import {
  buildTwinAssistantSummary,
  buildTwinRiskPlaybookSummary,
  buildTwinScenarioDraftFromPrompt,
  computeTwinGraphConfidence,
  type TwinAssistantGraphMetrics,
} from "@/lib/supply-chain-twin/assistant";
import { createScenarioDraft } from "@/lib/supply-chain-twin/scenarios-draft-repo";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROUTE_GET = "GET /api/supply-chain-twin/assistant";
const ROUTE_POST = "POST /api/supply-chain-twin/assistant";

export async function loadTwinAssistantSnapshot(tenantId: string) {
  const [entityCount, edgeCount, entityKinds, openRiskCount, scenarioCount, recentRisks, recentScenarios, insights] =
    await Promise.all([
      prisma.supplyChainTwinEntitySnapshot.count({ where: { tenantId } }),
      prisma.supplyChainTwinEntityEdge.count({ where: { tenantId } }),
      prisma.supplyChainTwinEntitySnapshot.groupBy({
        by: ["entityKind"],
        where: { tenantId },
        _count: { _all: true },
        orderBy: { _count: { entityKind: "desc" } },
        take: 12,
      }),
      prisma.supplyChainTwinRiskSignal.count({ where: { tenantId, acknowledged: false } }),
      prisma.supplyChainTwinScenarioDraft.count({ where: { tenantId, status: { not: "archived" } } }),
      prisma.supplyChainTwinRiskSignal.findMany({
        where: { tenantId, acknowledged: false },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: { id: true, code: true, severity: true, title: true, detail: true, createdAt: true },
      }),
      prisma.supplyChainTwinScenarioDraft.findMany({
        where: { tenantId, status: { not: "archived" } },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      prisma.supplyChainTwinAssistantInsight.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          prompt: true,
          summary: true,
          graphConfidenceScore: true,
          scenarioDraftId: true,
          riskSignalId: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

  const metrics: TwinAssistantGraphMetrics = {
    entityCount,
    edgeCount,
    entityKinds: entityKinds.map((row) => ({ entityKind: row.entityKind, count: row._count._all })),
    openRiskCount,
    scenarioCount,
  };
  const graphConfidenceScore = computeTwinGraphConfidence(metrics);
  return {
    metrics: { ...metrics, graphConfidenceScore },
    summary: buildTwinAssistantSummary(metrics),
    missingEdges: [
      edgeCount < entityCount ? "Graph has fewer edges than entities; relationship coverage is thin." : null,
      entityKinds.length < 4 ? "Twin is missing broad cross-module coverage across orders, shipments, inventory, and suppliers." : null,
      openRiskCount > 0 ? "Open risk signals need scenario/playbook links before acknowledgement." : null,
    ].filter((line): line is string => Boolean(line)),
    recentRisks: recentRisks.map((risk) => ({
      ...risk,
      createdAt: risk.createdAt.toISOString(),
      playbookSummary: buildTwinRiskPlaybookSummary(risk),
    })),
    recentScenarios: recentScenarios.map((scenario) => ({ ...scenario, updatedAt: scenario.updatedAt.toISOString() })),
    insights: insights.map((insight) => ({ ...insight, createdAt: insight.createdAt.toISOString() })),
  };
}

export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    return twinApiJson(await loadTwinAssistantSnapshot(gate.access.tenant.id), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({ route: ROUTE_GET, phase: "assistant", errorCode: "UNHANDLED_EXCEPTION", detail: name, requestId });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    const { access } = gate;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return twinApiErrorJson("Request body must be valid JSON.", 400, requestId, "BODY_JSON_INVALID");
    }
    const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "close_insight") {
      const insightId = typeof body.insightId === "string" ? body.insightId.trim() : "";
      if (!insightId) return twinApiErrorJson("insightId is required.", 400, requestId, "BODY_VALIDATION_FAILED");
      const updated = await prisma.supplyChainTwinAssistantInsight.updateMany({
        where: { id: insightId, tenantId: access.tenant.id },
        data: { status: "CLOSED" },
      });
      if (updated.count === 0) return twinApiErrorJson("Not found.", 404, requestId);
      return twinApiJson({ ok: true }, undefined, requestId);
    }

    if (action !== "create_scenario_insight") {
      logSctwinApiWarn({ route: ROUTE_POST, phase: "validation", errorCode: "ACTION_UNSUPPORTED", requestId });
      return twinApiErrorJson("Unsupported assistant action.", 400, requestId, "ACTION_UNSUPPORTED");
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 2000) {
      return twinApiErrorJson("prompt is required and must be at most 2000 characters.", 400, requestId, "BODY_VALIDATION_FAILED");
    }
    const riskSignalId = typeof body.riskSignalId === "string" && body.riskSignalId.trim() ? body.riskSignalId.trim() : null;
    const snapshot = await loadTwinAssistantSnapshot(access.tenant.id);
    const risk = riskSignalId
      ? await prisma.supplyChainTwinRiskSignal.findFirst({
          where: { tenantId: access.tenant.id, id: riskSignalId },
          select: { id: true, code: true, severity: true, title: true, detail: true },
        })
      : null;
    const draftJson = buildTwinScenarioDraftFromPrompt({
      prompt,
      confidenceScore: snapshot.metrics.graphConfidenceScore,
      openRiskCount: snapshot.metrics.openRiskCount,
      entityKinds: snapshot.metrics.entityKinds,
    });
    const scenario = await createScenarioDraft(access.tenant.id, {
      title: `Assistant twin scenario: ${prompt.slice(0, 80)}`,
      draft: draftJson as Prisma.InputJsonValue,
      actorId: access.user.id,
    });
    const summary = [
      `Created scenario draft "${scenario.title ?? scenario.id}" from assistant prompt.`,
      snapshot.summary,
      risk ? buildTwinRiskPlaybookSummary(risk) : "No risk signal was linked.",
    ].join("\n\n");
    const evidence = {
      source: "AMP10_TWIN_ASSISTANT",
      prompt,
      graph: snapshot.metrics,
      missingEdges: snapshot.missingEdges,
      linkedRisk: risk,
      scenarioDraftId: scenario.id,
    };
    const auditEvent = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: access.tenant.id,
        actorUserId: access.user.id,
        surface: "supply-chain-twin-assistant",
        prompt,
        answerKind: "scenario",
        message: summary,
        evidence: evidence as Prisma.InputJsonValue,
        objectType: "supply_chain_twin_scenario",
        objectId: scenario.id,
      },
      select: { id: true },
    });
    const evidenceRecord = await prisma.assistantEvidenceRecord.create({
      data: {
        tenantId: access.tenant.id,
        auditEventId: auditEvent.id,
        label: "Supply Chain Twin graph confidence",
        sourceType: "supply_chain_twin",
        href: `/supply-chain-twin/scenarios/${scenario.id}`,
        excerpt: summary.slice(0, 800),
        confidence: snapshot.metrics.graphConfidenceScore >= 75 ? "HIGH" : snapshot.metrics.graphConfidenceScore >= 45 ? "MEDIUM" : "LOW",
      },
      select: { id: true },
    });
    const actionItem = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: access.tenant.id,
        actorUserId: access.user.id,
        auditEventId: auditEvent.id,
        objectType: "supply_chain_twin_scenario",
        objectId: scenario.id,
        objectHref: `/supply-chain-twin/scenarios/${scenario.id}`,
        priority: snapshot.metrics.openRiskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `amp10-review-${scenario.id}`.slice(0, 128),
        actionKind: "review_twin_scenario",
        label: "Review assistant twin scenario",
        description: summary.slice(0, 1000),
        payload: evidence as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const insight = await prisma.supplyChainTwinAssistantInsight.create({
      data: {
        tenantId: access.tenant.id,
        createdByUserId: access.user.id,
        prompt,
        summary,
        graphConfidenceScore: snapshot.metrics.graphConfidenceScore,
        scenarioDraftId: scenario.id,
        riskSignalId: risk?.id ?? null,
        actionQueueItemId: actionItem.id,
        assistantEvidenceRecordId: evidenceRecord.id,
        evidenceJson: evidence as Prisma.InputJsonValue,
      },
      select: { id: true, status: true, scenarioDraftId: true, createdAt: true },
    });
    return twinApiJson({ insight: { ...insight, createdAt: insight.createdAt.toISOString() } }, { status: 201 }, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({ route: ROUTE_POST, phase: "assistant", errorCode: "UNHANDLED_EXCEPTION", detail: name, requestId });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
