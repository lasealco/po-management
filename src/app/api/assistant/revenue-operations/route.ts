import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildRevenueOperationsPacket, type RevenueOperationsInputs, type RevenueQuoteInput } from "@/lib/assistant/revenue-operations";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireRevenueOpsAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canOpen =
    viewerHas(access.grantSet, "org.crm", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.orders", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view");
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires CRM, orders, or settings access for revenue operations.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function numberValue(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

function daysUntil(date: Date | null) {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

async function loadRevenueInputs(tenantId: string): Promise<RevenueOperationsInputs> {
  const [quotes, opportunities, salesOrders, latestPlanning, financePackets, contractPackets, ctExceptions] = await Promise.all([
    prisma.crmQuote.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        title: true,
        status: true,
        quoteNumber: true,
        validUntil: true,
        currency: true,
        subtotal: true,
        account: { select: { name: true, strategicFlag: true } },
        opportunity: { select: { name: true, stage: true, probability: true } },
        lines: { select: { id: true } },
      },
    }),
    prisma.crmOpportunity.findMany({
      where: { tenantId, stage: { notIn: ["LOST", "WON_LIVE"] } },
      take: 200,
      select: { id: true },
    }),
    prisma.salesOrder.findMany({
      where: { tenantId, status: { not: "CLOSED" } },
      take: 500,
      select: { id: true },
    }),
    prisma.assistantContinuousPlanningPacket.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      select: { planHealthScore: true, inventoryCoveragePct: true, transportRiskCount: true },
    }),
    prisma.assistantFinancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { riskScore: true },
    }),
    prisma.assistantContractCompliancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { complianceGapCount: true, renewalRiskCount: true },
    }),
    prisma.ctException.findMany({
      where: { tenantId, status: { not: "RESOLVED" } },
      take: 300,
      select: { id: true },
    }),
  ]);
  const quoteInputs: RevenueQuoteInput[] = quotes.map((quote) => ({
    id: quote.id,
    title: quote.title,
    status: quote.status,
    quoteNumber: quote.quoteNumber,
    accountName: quote.account.name,
    opportunityName: quote.opportunity?.name ?? null,
    opportunityStage: quote.opportunity?.stage ?? null,
    probability: quote.opportunity?.probability ?? null,
    subtotal: numberValue(quote.subtotal),
    currency: quote.currency,
    lineCount: quote.lines.length,
    validUntil: quote.validUntil?.toISOString() ?? null,
    daysUntilExpiry: daysUntil(quote.validUntil),
    strategicAccount: quote.account.strategicFlag,
  }));
  return {
    quotes: quoteInputs,
    opportunityCount: opportunities.length,
    openOrderCount: salesOrders.length,
    inventoryCoveragePct: latestPlanning?.inventoryCoveragePct ?? 50,
    planHealthScore: latestPlanning?.planHealthScore ?? 70,
    transportRiskCount: latestPlanning?.transportRiskCount ?? ctExceptions.length,
    financeRiskScore: financePackets.reduce((sum, packet) => sum + packet.riskScore, 0),
    contractRiskCount: contractPackets.reduce((sum, packet) => sum + packet.complianceGapCount + packet.renewalRiskCount, 0),
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantRevenueOperationsPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        revenueScore: true,
        quoteCount: true,
        opportunityCount: true,
        feasibilityRiskCount: true,
        pricingRiskCount: true,
        approvalStepCount: true,
        selectedQuoteId: true,
        commercialSnapshotJson: true,
        feasibilityJson: true,
        pricingEvidenceJson: true,
        approvalRouteJson: true,
        customerDraftJson: true,
        contractHandoffJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadRevenueInputs(tenantId),
  ]);
  const preview = buildRevenueOperationsPacket(inputs);
  return {
    signals: {
      revenueScore: preview.revenueScore,
      quoteCount: preview.quoteCount,
      opportunityCount: preview.opportunityCount,
      feasibilityRisks: preview.feasibilityRiskCount,
      pricingRisks: preview.pricingRiskCount,
      approvalSteps: preview.approvalStepCount,
      selectedQuoteId: preview.selectedQuoteId,
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
  const gate = await requireRevenueOpsAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireRevenueOpsAccess(true);
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

  if (action === "queue_revenue_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantRevenueOperationsPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Revenue operations packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_revenue_operations",
        prompt: "Queue assistant revenue operations review",
        answerKind: "assistant_revenue_operations_review",
        message: "Assistant revenue operations packet queued for human review. CRM quotes, opportunities, customer communications, sales orders, inventory, shipments, and contract records were not mutated automatically.",
        evidence: { packetId: packet.id, revenueScore: packet.revenueScore, selectedQuoteId: packet.selectedQuoteId, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_revenue_operations_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_revenue_operations_packet",
        objectId: packet.id,
        objectHref: "/assistant/revenue-operations",
        priority: packet.feasibilityRiskCount > 0 || packet.pricingRiskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `amp36-revenue-${packet.id}`.slice(0, 128),
        actionKind: "assistant_revenue_operations_review",
        label: `Review revenue packet: ${packet.title}`,
        description: "Review quote feasibility, pricing evidence, approval routing, customer language, and contract handoff before execution.",
        payload: { packetId: packet.id, revenueScore: packet.revenueScore, selectedQuoteId: packet.selectedQuoteId, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantRevenueOperationsPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported revenue operations action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadRevenueInputs(gate.access.tenant.id);
  const built = buildRevenueOperationsPacket(inputs);
  const packet = await prisma.assistantRevenueOperationsPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      revenueScore: built.revenueScore,
      quoteCount: built.quoteCount,
      opportunityCount: built.opportunityCount,
      feasibilityRiskCount: built.feasibilityRiskCount,
      pricingRiskCount: built.pricingRiskCount,
      approvalStepCount: built.approvalStepCount,
      selectedQuoteId: built.selectedQuoteId,
      commercialSnapshotJson: built.commercialSnapshot as Prisma.InputJsonValue,
      feasibilityJson: built.feasibility as Prisma.InputJsonValue,
      pricingEvidenceJson: built.pricingEvidence as Prisma.InputJsonValue,
      approvalRouteJson: built.approvalRoute as Prisma.InputJsonValue,
      customerDraftJson: built.customerDraft as Prisma.InputJsonValue,
      contractHandoffJson: built.contractHandoff as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, revenueScore: true, selectedQuoteId: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_revenue_operations",
      prompt: "Create assistant revenue operations packet",
      answerKind: "assistant_revenue_operations_packet",
      message: built.leadershipSummary,
      evidence: {
        commercialSnapshot: built.commercialSnapshot,
        feasibility: built.feasibility,
        pricingEvidence: built.pricingEvidence,
        approvalRoute: built.approvalRoute,
        contractHandoff: built.contractHandoff,
        rollbackPlan: built.rollbackPlan,
      } as Prisma.InputJsonObject,
      objectType: "assistant_revenue_operations_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
