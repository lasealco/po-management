import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildFinanceControlPacket,
  type FinanceControlInputs,
  type FinanceInvoiceSignal,
} from "@/lib/assistant/finance-control-tower";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireFinanceControlAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canInvoice = viewerHas(access.grantSet, "org.invoice_audit", edit ? "edit" : "view");
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  if (!canInvoice || (!canCt && !viewerHas(access.grantSet, "org.rfq", "view"))) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires invoice audit plus operational finance evidence access.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function money(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

function minorToAmount(value: bigint): number {
  return Number(value) / 100;
}

async function loadFinanceInputs(tenantId: string, grantSet: Set<string>): Promise<FinanceControlInputs> {
  const [intakes, financialSnapshots, costLines, procurementPlans, customerBriefs] = await Promise.all([
    prisma.invoiceIntake.findMany({
      where: {
        tenantId,
        OR: [
          { rollupOutcome: { in: ["WARN", "FAIL"] } },
          { financeHandoffStatus: { in: ["READY_FOR_FINANCE", "DISPUTE_QUEUED", "ACCOUNTING_READY"] } },
          { approvedForAccounting: false },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: {
        id: true,
        vendorLabel: true,
        externalInvoiceNo: true,
        currency: true,
        rollupOutcome: true,
        financeHandoffStatus: true,
        approvedForAccounting: true,
        redLineCount: true,
        amberLineCount: true,
        bookingPricingSnapshot: { select: { totalEstimatedCost: true } },
        auditResults: { select: { amountVariance: true } },
      },
    }),
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.ctShipmentFinancialSnapshot.findMany({
          where: { tenantId },
          orderBy: { asOf: "desc" },
          take: 80,
          select: {
            shipmentId: true,
            customerVisibleCost: true,
            internalCost: true,
            internalRevenue: true,
            internalNet: true,
            internalMarginPct: true,
            currency: true,
            shipment: { select: { shipmentNo: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.ctShipmentCostLine.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 200,
          select: { shipmentId: true, amountMinor: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.rfq", "view")
      ? prisma.transportationProcurementPlan.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: { id: true, recommendedCarrier: true, allocationScore: true, status: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.crm", "view")
      ? prisma.assistantCustomerBrief.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: { id: true, serviceScore: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const costByShipment = new Map<string, number>();
  for (const line of costLines) costByShipment.set(line.shipmentId, (costByShipment.get(line.shipmentId) ?? 0) + minorToAmount(line.amountMinor));

  const invoices: FinanceInvoiceSignal[] = intakes.map((intake) => ({
    id: intake.id,
    vendorLabel: intake.vendorLabel,
    externalInvoiceNo: intake.externalInvoiceNo,
    currency: intake.currency,
    rollupOutcome: intake.rollupOutcome,
    financeHandoffStatus: intake.financeHandoffStatus,
    approvedForAccounting: intake.approvedForAccounting,
    totalEstimatedCost: money(intake.bookingPricingSnapshot.totalEstimatedCost),
    totalVariance: intake.auditResults.reduce((sum, result) => sum + money(result.amountVariance), 0),
    redLineCount: intake.redLineCount,
    amberLineCount: intake.amberLineCount,
  }));

  return {
    invoices,
    shipmentCosts: financialSnapshots.map((snapshot) => ({
      id: snapshot.shipmentId,
      shipmentNo: snapshot.shipment.shipmentNo,
      currency: snapshot.currency,
      internalRevenue: snapshot.internalRevenue == null ? null : money(snapshot.internalRevenue),
      internalCost: snapshot.internalCost == null ? null : money(snapshot.internalCost),
      internalNet: snapshot.internalNet == null ? null : money(snapshot.internalNet),
      internalMarginPct: snapshot.internalMarginPct == null ? null : money(snapshot.internalMarginPct),
      costLineTotal: costByShipment.get(snapshot.shipmentId) ?? 0,
    })),
    procurementPlans,
    customerBriefs,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantFinancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        riskScore: true,
        currency: true,
        totalVariance: true,
        disputeAmount: true,
        accrualAmount: true,
        boardSummary: true,
        varianceSummaryJson: true,
        leakageJson: true,
        accrualRiskJson: true,
        updatedAt: true,
      },
    }),
    loadFinanceInputs(tenantId, grantSet),
  ]);
  return {
    signals: {
      invoices: inputs.invoices.length,
      shipmentCosts: inputs.shipmentCosts.length,
      procurementPlans: inputs.procurementPlans.length,
      customerBriefs: inputs.customerBriefs.length,
    },
    packets: packets.map((packet) => ({
      ...packet,
      totalVariance: packet.totalVariance.toString(),
      disputeAmount: packet.disputeAmount.toString(),
      accrualAmount: packet.accrualAmount.toString(),
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireFinanceControlAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireFinanceControlAccess(true);
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

  if (action === "queue_finance_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantFinancePacket.findFirst({ where: { tenantId: gate.access.tenant.id, id: packetId } });
    if (!packet) return toApiErrorResponse({ error: "Finance packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_finance_control",
        prompt: "Queue finance control packet",
        answerKind: "finance_control_packet",
        message: packet.boardSummary,
        evidence: { packetId: packet.id, variance: packet.varianceSummaryJson, leakage: packet.leakageJson } as Prisma.InputJsonValue,
        objectType: "assistant_finance_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const actionItem = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_finance_packet",
        objectId: packet.id,
        objectHref: "/assistant/finance-control",
        priority: packet.riskScore >= 70 ? "HIGH" : "MEDIUM",
        actionId: `amp19-finance-${packet.id}`.slice(0, 128),
        actionKind: "finance_packet_review",
        label: `Review finance packet: ${packet.title}`,
        description: "Approve dispute/accrual/accounting review steps. No accounting export or dispute submission is performed automatically.",
        payload: { packetId: packet.id, boardSummary: packet.boardSummary, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantFinancePacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: actionItem.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: approvalNote || null },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, packet: updated });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported finance control action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadFinanceInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildFinanceControlPacket(inputs);
  const packet = await prisma.assistantFinancePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      riskScore: built.riskScore,
      currency: built.currency.slice(0, 3).toUpperCase(),
      totalVariance: new Prisma.Decimal(String(built.totalVariance)),
      disputeAmount: new Prisma.Decimal(String(built.disputeAmount)),
      accrualAmount: new Prisma.Decimal(String(built.accrualAmount)),
      selectedIntakeId: built.disputeQueue.candidates[0]?.intakeId ?? null,
      varianceSummaryJson: built.varianceSummary as unknown as Prisma.InputJsonValue,
      leakageJson: built.leakage as unknown as Prisma.InputJsonValue,
      disputeQueueJson: built.disputeQueue as unknown as Prisma.InputJsonValue,
      accrualRiskJson: built.accrualRisk as unknown as Prisma.InputJsonValue,
      evidenceJson: built.evidence as unknown as Prisma.InputJsonValue,
      boardSummary: built.boardSummary,
    },
    select: { id: true, title: true, status: true, riskScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_finance_control",
      prompt: "Create finance control packet",
      answerKind: "finance_control_packet",
      message: built.boardSummary,
      evidence: { riskScore: built.riskScore, evidence: built.evidence } as Prisma.InputJsonObject,
      objectType: "assistant_finance_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet }, { status: 201 });
}
