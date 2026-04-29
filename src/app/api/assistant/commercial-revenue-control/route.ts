import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildCommercialRevenueControlPacket, type CommercialRevenueControlInputs } from "@/lib/assistant/commercial-revenue-control";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireCommercialRevenueAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.crm", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.invoice_audit", mode) ||
    viewerHas(access.grantSet, "org.tariffs", mode) ||
    viewerHas(access.grantSet, "org.rfq", mode) ||
    viewerHas(access.grantSet, "org.reports", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires CRM, orders, invoice audit, tariffs/RFQ, or reports access for Commercial & Revenue Control.", code: "FORBIDDEN", status: 403 }),
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
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

async function loadCommercialInputs(tenantId: string, grantSet: Set<string>): Promise<CommercialRevenueControlInputs> {
  const canCrm = viewerHas(grantSet, "org.crm", "view") || viewerHas(grantSet, "org.reports", "view");
  const canOrders = viewerHas(grantSet, "org.orders", "view") || viewerHas(grantSet, "org.reports", "view");
  const canInvoice = viewerHas(grantSet, "org.invoice_audit", "view") || viewerHas(grantSet, "org.reports", "view");
  const canPricing = viewerHas(grantSet, "org.tariffs", "view") || viewerHas(grantSet, "org.rfq", "view") || viewerHas(grantSet, "org.reports", "view");
  const [revenuePackets, financePackets, contractPackets, customerBriefs, quotes, salesOrders, pricingSnapshots, invoiceIntakes, actionQueue] = await Promise.all([
    prisma.assistantRevenueOperationsPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, revenueScore: true, quoteCount: true, opportunityCount: true, feasibilityRiskCount: true, pricingRiskCount: true, approvalStepCount: true, selectedQuoteId: true },
    }),
    prisma.assistantFinancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, riskScore: true, currency: true, totalVariance: true, disputeAmount: true, accrualAmount: true },
    }),
    prisma.assistantContractCompliancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, complianceScore: true, obligationCount: true, complianceGapCount: true, renewalRiskCount: true },
    }),
    canCrm
      ? prisma.assistantCustomerBrief.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { id: true, title: true, status: true, serviceScore: true },
        })
      : Promise.resolve([]),
    canCrm
      ? prisma.crmQuote.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, title: true, status: true, quoteNumber: true, validUntil: true, currency: true, subtotal: true, account: { select: { name: true } }, lines: { select: { id: true } } },
        })
      : Promise.resolve([]),
    canOrders
      ? prisma.salesOrder.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, soNumber: true, status: true, customerName: true, currency: true, assistantReviewStatus: true, lines: { select: { lineTotal: true } } },
        })
      : Promise.resolve([]),
    canPricing
      ? prisma.bookingPricingSnapshot.findMany({
          where: { tenantId },
          orderBy: { frozenAt: "desc" },
          take: 100,
          select: { id: true, sourceType: true, sourceSummary: true, currency: true, totalEstimatedCost: true, frozenAt: true, basisSide: true, incoterm: true },
        })
      : Promise.resolve([]),
    canInvoice
      ? prisma.invoiceIntake.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, externalInvoiceNo: true, vendorLabel: true, status: true, currency: true, rollupOutcome: true, redLineCount: true, amberLineCount: true, approvedForAccounting: true },
        })
      : Promise.resolve([]),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);
  return {
    revenuePackets,
    financePackets: financePackets.map((packet) => ({ ...packet, totalVariance: numberValue(packet.totalVariance), disputeAmount: numberValue(packet.disputeAmount), accrualAmount: numberValue(packet.accrualAmount) })),
    contractPackets,
    customerBriefs,
    quotes: quotes.map((quote) => ({
      id: quote.id,
      title: quote.title,
      status: quote.status,
      quoteNumber: quote.quoteNumber,
      accountName: quote.account.name,
      subtotal: numberValue(quote.subtotal),
      currency: quote.currency,
      lineCount: quote.lines.length,
      validUntil: quote.validUntil?.toISOString() ?? null,
      daysUntilExpiry: daysUntil(quote.validUntil),
    })),
    salesOrders: salesOrders.map((order) => ({
      id: order.id,
      soNumber: order.soNumber,
      status: order.status,
      customerName: order.customerName,
      currency: order.currency,
      lineCount: order.lines.length,
      totalValue: numberValue(order.lines.reduce((sum, line) => sum + numberValue(line.lineTotal), 0)),
      assistantReviewStatus: order.assistantReviewStatus,
    })),
    pricingSnapshots: pricingSnapshots.map((snapshot) => ({ ...snapshot, sourceType: String(snapshot.sourceType), totalEstimatedCost: numberValue(snapshot.totalEstimatedCost), frozenAt: snapshot.frozenAt.toISOString() })),
    invoiceIntakes: invoiceIntakes.map((invoice) => ({ ...invoice, status: String(invoice.status), rollupOutcome: String(invoice.rollupOutcome) })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantCommercialRevenueControlPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        commercialScore: true,
        quoteRiskCount: true,
        pricingRiskCount: true,
        invoiceRiskCount: true,
        marginLeakageCount: true,
        contractRiskCount: true,
        customerRiskCount: true,
        sourceSummaryJson: true,
        quoteToCashJson: true,
        pricingDisciplineJson: true,
        marginLeakageJson: true,
        invoiceAuditJson: true,
        customerCommercialJson: true,
        contractHandoffJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadCommercialInputs(tenantId, grantSet),
  ]);
  const preview = buildCommercialRevenueControlPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewCommercialScore: preview.commercialScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireCommercialRevenueAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireCommercialRevenueAccess(true);
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

  if (action === "queue_commercial_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantCommercialRevenueControlPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Commercial & Revenue Control packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantCommercialRevenueControlPacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_commercial_revenue_control",
          prompt: "Approve Sprint 6 Commercial & Revenue Control packet",
          answerKind: "commercial_revenue_control_approved",
          message: "Commercial & Revenue Control packet approved after human review. Quotes, prices, pricing snapshots, tariffs, RFQs, invoices, accounting approvals, contracts, sales orders, opportunity stages, customer promises, and customer communications were not changed automatically.",
          evidence: { packetId: packet.id, commercialScore: packet.commercialScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_commercial_revenue_control_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_commercial_revenue_control",
        prompt: "Queue Sprint 6 Commercial & Revenue Control review",
        answerKind: "commercial_revenue_control_review",
        message: "Commercial and revenue control review queued. The assistant does not mutate quotes, prices, pricing snapshots, tariffs, RFQs, invoices, accounting approvals, contracts, sales orders, opportunity stages, customer promises, or customer communications.",
        evidence: { packetId: packet.id, commercialScore: packet.commercialScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_commercial_revenue_control_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_commercial_revenue_control_packet",
        objectId: packet.id,
        objectHref: "/assistant/commercial-revenue-control",
        priority: packet.commercialScore < 70 || packet.invoiceRiskCount > 0 || packet.pricingRiskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint6-commercial-revenue-${packet.id}`.slice(0, 128),
        actionKind: "commercial_revenue_control_review",
        label: `Review ${packet.title}`,
        description: "Review quote-to-cash, pricing, invoice audit, margin leakage, customer language, and contract handoff before execution.",
        payload: { packetId: packet.id, commercialScore: packet.commercialScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantCommercialRevenueControlPacket.update({ where: { id: packet.id }, data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Commercial & Revenue Control action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadCommercialInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildCommercialRevenueControlPacket(inputs);
  const packet = await prisma.assistantCommercialRevenueControlPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      commercialScore: built.commercialScore,
      quoteRiskCount: built.quoteToCash.quoteRiskCount,
      pricingRiskCount: built.pricingDiscipline.pricingRiskCount,
      invoiceRiskCount: built.invoiceAudit.invoiceRiskCount,
      marginLeakageCount: built.marginLeakage.marginLeakageCount,
      contractRiskCount: built.contractHandoff.contractRiskCount,
      customerRiskCount: built.customerCommercial.customerRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      quoteToCashJson: built.quoteToCash as Prisma.InputJsonValue,
      pricingDisciplineJson: built.pricingDiscipline as Prisma.InputJsonValue,
      marginLeakageJson: built.marginLeakage as Prisma.InputJsonValue,
      invoiceAuditJson: built.invoiceAudit as Prisma.InputJsonValue,
      customerCommercialJson: built.customerCommercial as Prisma.InputJsonValue,
      contractHandoffJson: built.contractHandoff as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, commercialScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_commercial_revenue_control",
      prompt: "Create Sprint 6 Commercial & Revenue Control packet",
      answerKind: "commercial_revenue_control_packet",
      message: built.leadershipSummary,
      evidence: { commercialScore: built.commercialScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_commercial_revenue_control_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
