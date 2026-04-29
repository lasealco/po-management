import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildAdvancedProgramPacket, getAdvancedProgramConfig, type AdvancedProgramSignals } from "@/lib/assistant/advanced-programs";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ programKey: string }> };

async function requireAdvancedProgramAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const canOpen =
    viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.orders", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.wms", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.controltower", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.suppliers", edit ? "edit" : "view");
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires settings, orders, WMS, operations, or supplier access.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function numberValue(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function loadSignals(tenantId: string): Promise<AdvancedProgramSignals> {
  const [
    products,
    productDocs,
    suppliers,
    supplierDocs,
    inventory,
    wmsTasks,
    purchaseOrders,
    salesOrders,
    shipments,
    ctExceptions,
    crmQuotes,
    tariffContracts,
    financePackets,
    contractPackets,
    planningPacket,
    simulationPackets,
    networkPackets,
    invoiceIntakes,
    openActionItems,
    evidenceRecords,
    staleEvidenceRecords,
    reviewExamples,
    activePlaybooks,
    activePlaybookRuns,
    auditEvents,
  ] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.productDocument.count({ where: { product: { tenantId } } }),
    prisma.supplier.count({ where: { tenantId, isActive: true } }),
    prisma.srmSupplierDocument.findMany({ where: { tenantId, status: "active" }, select: { expiresAt: true }, take: 500 }),
    prisma.inventoryBalance.findMany({ where: { tenantId }, select: { onHandQty: true, allocatedQty: true, onHold: true }, take: 2500 }),
    prisma.wmsTask.count({ where: { tenantId, status: "OPEN" } }),
    prisma.purchaseOrder.count({ where: { tenantId, splitParentId: null } }),
    prisma.salesOrder.count({ where: { tenantId, status: { not: "CLOSED" } } }),
    prisma.shipment.count({ where: { order: { tenantId } } }),
    prisma.ctException.count({ where: { tenantId, status: { not: "RESOLVED" } } }),
    prisma.crmQuote.count({ where: { tenantId } }),
    prisma.tariffContractHeader.count({ where: { tenantId } }),
    prisma.assistantFinancePacket.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" }, take: 10, select: { riskScore: true } }),
    prisma.assistantContractCompliancePacket.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" }, take: 10, select: { complianceGapCount: true, renewalRiskCount: true } }),
    prisma.assistantContinuousPlanningPacket.findFirst({ where: { tenantId }, orderBy: { updatedAt: "desc" }, select: { planHealthScore: true } }),
    prisma.assistantSimulationStudioPacket.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" }, take: 5, select: { dataFreshnessRiskCount: true } }),
    prisma.assistantNetworkDesignPacket.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" }, take: 5, select: { serviceRiskCount: true, costRiskCount: true } }),
    prisma.invoiceIntake.count({ where: { tenantId } }),
    prisma.assistantActionQueueItem.count({ where: { tenantId, status: "PENDING" } }),
    prisma.assistantEvidenceRecord.count({ where: { tenantId, archivedAt: null } }),
    prisma.assistantEvidenceRecord.count({ where: { tenantId, archivedAt: { not: null } } }),
    prisma.assistantReviewExample.count({ where: { tenantId } }),
    prisma.assistantPlaybookTemplate.count({ where: { tenantId, isActive: true } }),
    prisma.assistantPlaybookRun.count({ where: { tenantId, completedAt: null } }),
    prisma.assistantAuditEvent.count({ where: { tenantId } }),
  ]);
  const now = Date.now();
  return {
    products,
    activeSuppliers: suppliers,
    supplierDocs: supplierDocs.length,
    expiringSupplierDocs: supplierDocs.filter((doc) => doc.expiresAt && doc.expiresAt.getTime() - now < 1000 * 60 * 60 * 24 * 30).length,
    productDocs,
    inventoryRows: inventory.length,
    onHandUnits: inventory.reduce((sum, row) => sum + numberValue(row.onHandQty), 0),
    allocatedUnits: inventory.reduce((sum, row) => sum + numberValue(row.allocatedQty), 0),
    heldInventoryRows: inventory.filter((row) => row.onHold).length,
    openWmsTasks: wmsTasks,
    openPurchaseOrders: purchaseOrders,
    openSalesOrders: salesOrders,
    shipments,
    shipmentExceptions: ctExceptions,
    crmQuotes,
    tariffContracts,
    financeRiskScore: financePackets.reduce((sum, packet) => sum + packet.riskScore, 0),
    contractRiskCount: contractPackets.reduce((sum, packet) => sum + packet.complianceGapCount + packet.renewalRiskCount, 0),
    planningHealthScore: planningPacket?.planHealthScore ?? 70,
    simulationRiskCount: simulationPackets.reduce((sum, packet) => sum + packet.dataFreshnessRiskCount, 0),
    networkRiskCount: networkPackets.reduce((sum, packet) => sum + packet.serviceRiskCount + packet.costRiskCount, 0),
    invoiceIntakes,
    openActionItems,
    evidenceRecords,
    staleEvidenceRecords,
    reviewExamples,
    activePlaybooks,
    activePlaybookRuns,
    auditEvents,
  };
}

async function buildSnapshot(tenantId: string, programKey: string) {
  const config = getAdvancedProgramConfig(programKey);
  if (!config) return null;
  const [packets, signals] = await Promise.all([
    prisma.assistantAdvancedProgramPacket.findMany({
      where: { tenantId, programKey: config.key },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        ampNumber: true,
        programKey: true,
        programTitle: true,
        title: true,
        status: true,
        programScore: true,
        signalCount: true,
        riskCount: true,
        recommendationCount: true,
        approvalStepCount: true,
        sourceSummaryJson: true,
        assessmentJson: true,
        recommendationJson: true,
        approvalPlanJson: true,
        artifactJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadSignals(tenantId),
  ]);
  const preview = buildAdvancedProgramPacket({ programKey: config.key, signals });
  return {
    config: { ampNumber: config.ampNumber, key: config.key, slug: config.slug, title: config.title, surfaceTitle: config.surfaceTitle, navLabel: config.navLabel },
    signals,
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { programKey } = await context.params;
  const gate = await requireAdvancedProgramAccess(false);
  if (!gate.ok) return gate.response;
  const snapshot = await buildSnapshot(gate.access.tenant.id, programKey);
  if (!snapshot) return toApiErrorResponse({ error: "Advanced program not found.", code: "NOT_FOUND", status: 404 });
  return NextResponse.json(snapshot);
}

export async function POST(request: Request, context: RouteContext) {
  const { programKey } = await context.params;
  const config = getAdvancedProgramConfig(programKey);
  if (!config) return toApiErrorResponse({ error: "Advanced program not found.", code: "NOT_FOUND", status: 404 });
  const gate = await requireAdvancedProgramAccess(true);
  if (!gate.ok) return gate.response;
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "queue_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    const packet = await prisma.assistantAdvancedProgramPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id, programKey: config.key } });
    if (!packet) return toApiErrorResponse({ error: "Advanced program packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: `assistant_amp${config.ampNumber}_${config.key}`,
        prompt: `Queue AMP${config.ampNumber} advanced program review`,
        answerKind: "assistant_advanced_program_review",
        message: `AMP${config.ampNumber} ${config.surfaceTitle} packet queued for human review. ${config.noMutation} were not mutated automatically.`,
        evidence: { packetId: packet.id, programScore: packet.programScore, riskCount: packet.riskCount, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_advanced_program_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_advanced_program_packet",
        objectId: packet.id,
        objectHref: `/assistant/advanced-programs/${config.slug}`,
        priority: packet.riskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `amp${config.ampNumber}-${packet.id}`.slice(0, 128),
        actionKind: `assistant_amp${config.ampNumber}_review`,
        label: `Review AMP${config.ampNumber}: ${packet.title}`,
        description: `Review ${config.artifactLabel} evidence before downstream execution.`,
        payload: { packetId: packet.id, programKey: config.key, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantAdvancedProgramPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, config.key) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported advanced program action.", code: "BAD_INPUT", status: 400 });
  const signals = await loadSignals(gate.access.tenant.id);
  const built = buildAdvancedProgramPacket({ programKey: config.key, signals });
  const packet = await prisma.assistantAdvancedProgramPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      ampNumber: built.ampNumber,
      programKey: built.programKey,
      programTitle: built.programTitle,
      title: built.title,
      status: built.status,
      programScore: built.programScore,
      signalCount: built.signalCount,
      riskCount: built.riskCount,
      recommendationCount: built.recommendationCount,
      approvalStepCount: built.approvalStepCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      assessmentJson: built.assessment as Prisma.InputJsonValue,
      recommendationJson: built.recommendation as Prisma.InputJsonValue,
      approvalPlanJson: built.approvalPlan as Prisma.InputJsonValue,
      artifactJson: built.artifact as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, ampNumber: true, programScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: `assistant_amp${config.ampNumber}_${config.key}`,
      prompt: `Create AMP${config.ampNumber} advanced program packet`,
      answerKind: "assistant_advanced_program_packet",
      message: built.leadershipSummary,
      evidence: { sourceSummary: built.sourceSummary, assessment: built.assessment, recommendation: built.recommendation, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_advanced_program_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, config.key) }, { status: 201 });
}
