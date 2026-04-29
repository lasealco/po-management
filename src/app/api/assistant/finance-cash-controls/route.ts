import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildFinanceCashControlPacket, type FinanceCashControlInputs } from "@/lib/assistant/finance-cash-controls";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireFinanceCashAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.crm", mode) ||
    viewerHas(access.grantSet, "org.invoice_audit", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode) ||
    viewerHas(access.grantSet, "org.wms", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires reports, orders, CRM, invoice audit, control tower, or WMS access for Finance Cash Controls.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function num(value: Prisma.Decimal | number | bigint | null | undefined, divisor = 1) {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value) / divisor;
  if (typeof value === "number") return value / divisor;
  return value.toNumber() / divisor;
}

function daysUntil(date: Date | null) {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

async function loadFinanceCashInputs(tenantId: string, grantSet: Set<string>): Promise<FinanceCashControlInputs> {
  const canReports = viewerHas(grantSet, "org.reports", "view");
  const canInvoice = canReports || viewerHas(grantSet, "org.invoice_audit", "view");
  const canControlTower = canReports || viewerHas(grantSet, "org.controltower", "view");
  const canWms = canReports || viewerHas(grantSet, "org.wms", "view");
  const canCrm = canReports || viewerHas(grantSet, "org.crm", "view");
  const canOrders = canReports || viewerHas(grantSet, "org.orders", "view");

  const [financePackets, revenuePackets, commercialPackets, invoiceIntakes, financialSnapshots, shipmentCostLines, wmsInvoiceRuns, quotes, salesOrders, actionQueue] = await Promise.all([
    prisma.assistantFinancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, title: true, status: true, riskScore: true, currency: true, totalVariance: true, disputeAmount: true, accrualAmount: true },
    }),
    prisma.assistantRevenueOperationsPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, title: true, status: true, revenueScore: true, quoteCount: true, pricingRiskCount: true, feasibilityRiskCount: true },
    }),
    prisma.assistantCommercialRevenueControlPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, commercialScore: true, marginLeakageCount: true, invoiceRiskCount: true, quoteRiskCount: true, contractRiskCount: true },
    }),
    canInvoice
      ? prisma.invoiceIntake.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 160,
          select: { id: true, externalInvoiceNo: true, vendorLabel: true, status: true, currency: true, rollupOutcome: true, redLineCount: true, amberLineCount: true, approvedForAccounting: true, financeHandoffStatus: true, accountingApprovedAt: true },
        })
      : Promise.resolve([]),
    canControlTower
      ? prisma.ctShipmentFinancialSnapshot.findMany({
          where: { tenantId },
          orderBy: { asOf: "desc" },
          take: 160,
          select: { id: true, shipmentId: true, currency: true, internalRevenue: true, internalCost: true, internalNet: true, internalMarginPct: true, asOf: true, shipment: { select: { shipmentNo: true } } },
        })
      : Promise.resolve([]),
    canControlTower
      ? prisma.ctShipmentCostLine.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 240,
          select: { id: true, shipmentId: true, vendor: true, amountMinor: true, currency: true, createdAt: true, shipment: { select: { shipmentNo: true } } },
        })
      : Promise.resolve([]),
    canWms
      ? prisma.wmsBillingInvoiceRun.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 120,
          select: { id: true, runNo: true, status: true, totalAmount: true, currency: true, periodFrom: true, periodTo: true, lines: { select: { id: true } } },
        })
      : Promise.resolve([]),
    canCrm
      ? prisma.crmQuote.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 160,
          select: { id: true, title: true, status: true, subtotal: true, currency: true, validUntil: true, account: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canOrders
      ? prisma.salesOrder.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 160,
          select: { id: true, soNumber: true, status: true, customerName: true, currency: true, lines: { select: { lineTotal: true } } },
        })
      : Promise.resolve([]),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);

  return {
    financePackets: financePackets.map((packet) => ({ ...packet, totalVariance: num(packet.totalVariance), disputeAmount: num(packet.disputeAmount), accrualAmount: num(packet.accrualAmount) })),
    revenuePackets,
    commercialPackets,
    invoiceIntakes: invoiceIntakes.map((invoice) => ({ ...invoice, status: String(invoice.status), rollupOutcome: String(invoice.rollupOutcome), accountingApprovedAt: invoice.accountingApprovedAt?.toISOString() ?? null })),
    financialSnapshots: financialSnapshots.map((snapshot) => ({
      id: snapshot.id,
      shipmentId: snapshot.shipmentId,
      shipmentNo: snapshot.shipment.shipmentNo,
      currency: snapshot.currency,
      internalRevenue: snapshot.internalRevenue == null ? null : num(snapshot.internalRevenue),
      internalCost: snapshot.internalCost == null ? null : num(snapshot.internalCost),
      internalNet: snapshot.internalNet == null ? null : num(snapshot.internalNet),
      internalMarginPct: snapshot.internalMarginPct == null ? null : num(snapshot.internalMarginPct),
      asOf: snapshot.asOf.toISOString(),
    })),
    shipmentCostLines: shipmentCostLines.map((line) => ({
      id: line.id,
      shipmentId: line.shipmentId,
      shipmentNo: line.shipment.shipmentNo,
      vendorName: line.vendor,
      currency: line.currency,
      amount: num(line.amountMinor, 100),
      status: "RECORDED",
      occurredAt: line.createdAt.toISOString(),
    })),
    wmsInvoiceRuns: wmsInvoiceRuns.map((run) => ({ id: run.id, runNo: run.runNo, status: String(run.status), totalAmount: num(run.totalAmount), currency: run.currency, periodFrom: run.periodFrom.toISOString(), periodTo: run.periodTo.toISOString(), lineCount: run.lines.length })),
    quotes: quotes.map((quote) => ({ id: quote.id, title: quote.title, status: String(quote.status), accountName: quote.account.name, subtotal: num(quote.subtotal), currency: quote.currency, validUntil: quote.validUntil?.toISOString() ?? null, daysUntilExpiry: daysUntil(quote.validUntil) })),
    salesOrders: salesOrders.map((order) => ({ id: order.id, soNumber: order.soNumber, status: String(order.status), customerName: order.customerName, currency: order.currency, totalValue: num(order.lines.reduce((sum, line) => sum.plus(line.lineTotal), new Prisma.Decimal(0))), lineCount: order.lines.length })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantFinanceCashControlPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        financeScore: true,
        currency: true,
        cashExposureAmount: true,
        receivableRiskAmount: true,
        payableRiskAmount: true,
        marginLeakageAmount: true,
        accountingBlockerCount: true,
        billingExceptionCount: true,
        closeControlGapCount: true,
        sourceSummaryJson: true,
        cashPostureJson: true,
        receivablesJson: true,
        payablesJson: true,
        accountingHandoffJson: true,
        marginLeakageJson: true,
        warehouseBillingJson: true,
        closeControlJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadFinanceCashInputs(tenantId, grantSet),
  ]);
  const preview = buildFinanceCashControlPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewFinanceScore: preview.financeScore },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      cashExposureAmount: num(packet.cashExposureAmount),
      receivableRiskAmount: num(packet.receivableRiskAmount),
      payableRiskAmount: num(packet.payableRiskAmount),
      marginLeakageAmount: num(packet.marginLeakageAmount),
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireFinanceCashAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireFinanceCashAccess(true);
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

  if (action === "queue_controller_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantFinanceCashControlPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Finance cash control packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantFinanceCashControlPacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_finance_cash_controls",
          prompt: "Approve Sprint 12 Finance Cash Control packet",
          answerKind: "finance_cash_control_approved",
          message: "Finance Cash Control packet approved after human review. Invoices, journals, accounting exports, vendor payments, customer billing, close state, and financial records were not changed automatically.",
          evidence: { packetId: packet.id, financeScore: packet.financeScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_finance_cash_control_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_finance_cash_controls",
        prompt: "Queue Sprint 12 controller review",
        answerKind: "finance_cash_controller_review",
        message: "Controller review queued. The assistant does not approve invoices, post journals, export accounting files, pay vendors, bill customers, close periods, or mutate finance records.",
        evidence: { packetId: packet.id, financeScore: packet.financeScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_finance_cash_control_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_finance_cash_control_packet",
        objectId: packet.id,
        objectHref: "/assistant/finance-cash-controls",
        priority: packet.financeScore < 75 || packet.accountingBlockerCount > 0 || packet.closeControlGapCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint12-finance-cash-${packet.id}`.slice(0, 128),
        actionKind: "finance_cash_controller_review",
        label: `Review ${packet.title}`,
        description: "Review cash exposure, receivables, payables, accounting handoff, margin leakage, WMS billing, and close controls before financial execution.",
        payload: { packetId: packet.id, financeScore: packet.financeScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantFinanceCashControlPacket.update({ where: { id: packet.id }, data: { status: "CONTROLLER_REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Finance Cash Control action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadFinanceCashInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildFinanceCashControlPacket(inputs);
  const packet = await prisma.assistantFinanceCashControlPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      financeScore: built.financeScore,
      currency: built.currency,
      cashExposureAmount: built.cashPosture.cashExposureAmount,
      receivableRiskAmount: built.receivables.receivableRiskAmount,
      payableRiskAmount: built.payables.payableRiskAmount,
      marginLeakageAmount: built.marginLeakage.marginLeakageAmount,
      accountingBlockerCount: built.accountingHandoff.accountingBlockerCount,
      billingExceptionCount: built.warehouseBilling.billingExceptionCount,
      closeControlGapCount: built.closeControl.closeControlGapCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      cashPostureJson: built.cashPosture as Prisma.InputJsonValue,
      receivablesJson: built.receivables as Prisma.InputJsonValue,
      payablesJson: built.payables as Prisma.InputJsonValue,
      accountingHandoffJson: built.accountingHandoff as Prisma.InputJsonValue,
      marginLeakageJson: built.marginLeakage as Prisma.InputJsonValue,
      warehouseBillingJson: built.warehouseBilling as Prisma.InputJsonValue,
      closeControlJson: built.closeControl as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, financeScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_finance_cash_controls",
      prompt: "Create Sprint 12 Finance Cash Control packet",
      answerKind: "finance_cash_control_packet",
      message: built.leadershipSummary,
      evidence: { financeScore: built.financeScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_finance_cash_control_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
