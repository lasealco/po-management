import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildCustomerSuccessPacket,
  type CustomerSuccessInputs,
} from "@/lib/assistant/customer-success-account-intelligence";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function numberValue(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && value != null && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function requireCustomerSuccessAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.crm", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode) ||
    viewerHas(access.grantSet, "org.invoice_audit", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires CRM, orders, reports, Control Tower, or invoice audit access for Sprint 18.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadCustomerSuccessInputs(tenantId: string, grantSet: Set<string>): Promise<CustomerSuccessInputs> {
  const canCrm = viewerHas(grantSet, "org.crm", "view") || viewerHas(grantSet, "org.reports", "view");
  const canOrders = viewerHas(grantSet, "org.orders", "view") || viewerHas(grantSet, "org.reports", "view");
  const canCt = viewerHas(grantSet, "org.controltower", "view") || viewerHas(grantSet, "org.reports", "view");
  const canInvoice = viewerHas(grantSet, "org.invoice_audit", "view") || viewerHas(grantSet, "org.reports", "view");

  const [
    customerBriefsRaw,
    quotesRaw,
    opportunitiesRaw,
    salesOrdersRaw,
    shipmentsRaw,
    ctExceptionsRaw,
    invoiceIntakesRaw,
    financePacketsRaw,
  ] = await Promise.all([
    canCrm
      ? prisma.assistantCustomerBrief.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: {
            id: true,
            title: true,
            status: true,
            serviceScore: true,
            replyDraft: true,
            approvedReply: true,
          },
        })
      : Promise.resolve([]),
    canCrm
      ? prisma.crmQuote.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 140,
          select: { id: true, title: true, status: true, validUntil: true },
        })
      : Promise.resolve([]),
    canCrm
      ? prisma.crmOpportunity.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 140,
          select: { id: true, name: true, stage: true, closeDate: true },
        })
      : Promise.resolve([]),
    canOrders
      ? prisma.salesOrder.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 160,
          select: { id: true, soNumber: true, status: true, requestedDeliveryDate: true },
        })
      : Promise.resolve([]),
    canOrders
      ? prisma.shipment.findMany({
          where: { order: { tenantId }, customerCrmAccountId: { not: null } },
          orderBy: { updatedAt: "desc" },
          take: 180,
          select: {
            id: true,
            shipmentNo: true,
            status: true,
            customerCrmAccountId: true,
            expectedReceiveAt: true,
            shippedAt: true,
            receivedAt: true,
          },
        })
      : Promise.resolve([]),
    canCt
      ? prisma.ctException.findMany({
          where: { tenantId, status: "OPEN", shipment: { customerCrmAccountId: { not: null } } },
          orderBy: { updatedAt: "desc" },
          take: 140,
          select: {
            id: true,
            severity: true,
            shipmentId: true,
            shipment: {
              select: {
                shipmentNo: true,
                customerCrmAccount: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    canInvoice
      ? prisma.invoiceIntake.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 160,
          select: { id: true, rollupOutcome: true },
        })
      : Promise.resolve([]),
    canInvoice
      ? prisma.assistantFinancePacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, title: true, disputeAmount: true },
        })
      : Promise.resolve([]),
  ]);

  const customerBriefs = customerBriefsRaw.map((brief) => ({
    ...brief,
    replyDraft: brief.replyDraft ?? "",
    approvedReply: brief.approvedReply,
  }));

  const quotes = quotesRaw.map((quote) => ({
    id: quote.id,
    title: quote.title,
    status: String(quote.status),
    validUntil: quote.validUntil,
  }));

  const opportunities = opportunitiesRaw.map((opportunity) => ({
    id: opportunity.id,
    name: opportunity.name,
    stage: String(opportunity.stage),
    closeDate: opportunity.closeDate,
  }));

  const salesOrders = salesOrdersRaw.map((order) => ({
    id: order.id,
    soNumber: order.soNumber,
    status: String(order.status),
    requestedDeliveryDate: order.requestedDeliveryDate,
  }));

  const shipments = shipmentsRaw.map((shipment) => ({
    id: shipment.id,
    shipmentNo: shipment.shipmentNo,
    status: String(shipment.status),
    customerCrmAccountId: shipment.customerCrmAccountId,
    expectedReceiveAt: shipment.expectedReceiveAt,
    shippedAt: shipment.shippedAt,
    receivedAt: shipment.receivedAt,
  }));

  const customerCtExceptions = ctExceptionsRaw.map((exception) => ({
    id: exception.id,
    severity: String(exception.severity),
    shipmentId: exception.shipmentId,
    shipmentNo: exception.shipment.shipmentNo,
    customerAccountLabel: exception.shipment.customerCrmAccount?.name ?? null,
  }));

  const invoiceIntakes = invoiceIntakesRaw.map((invoice) => ({
    id: invoice.id,
    rollupOutcome: String(invoice.rollupOutcome),
  }));

  const financePackets = financePacketsRaw.map((packet) => ({
    id: packet.id,
    title: packet.title,
    disputeAmount: numberValue(packet.disputeAmount),
  }));

  return {
    customerBriefs,
    quotes,
    opportunities,
    salesOrders,
    shipments,
    customerCtExceptions,
    invoiceIntakes,
    financePackets,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantCustomerSuccessPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        accountScore: true,
        briefRiskCount: true,
        promiseRiskCount: true,
        pipelineRiskCount: true,
        exceptionExposureCount: true,
        disputeFinanceRiskCount: true,
        governanceGapCount: true,
        sourceSummaryJson: true,
        briefSignalsJson: true,
        promiseExecutionJson: true,
        crmPipelineJson: true,
        exceptionExposureJson: true,
        disputeFinanceJson: true,
        replyGovernanceJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadCustomerSuccessInputs(tenantId, grantSet),
  ]);
  const preview = buildCustomerSuccessPacket(inputs);
  return {
    signals: {
      ...preview.sourceSummary,
      previewAccountScore: preview.accountScore,
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
  const gate = await requireCustomerSuccessAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireCustomerSuccessAccess(true);
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

  if (action === "queue_success_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantCustomerSuccessPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Customer Success packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantCustomerSuccessPacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_customer_success",
          prompt: "Approve Sprint 18 Customer Success packet",
          answerKind: "sprint18_cs_ok",
          message:
            "Customer Success packet approved after human review. CRM records, opportunities, quotes, orders, shipments, dispute workflows, and customer replies were not posted or mutated automatically.",
          evidence: { packetId: packet.id, accountScore: packet.accountScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_customer_success_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_customer_success",
        prompt: "Queue Sprint 18 customer success command review",
        answerKind: "sprint18_cs_rev",
        message:
          "Customer success command review queued. The assistant does not post CRM updates, send governed replies, alter quotes or opportunities, reschedule shipments, or open disputes automatically.",
        evidence: { packetId: packet.id, accountScore: packet.accountScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_customer_success_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_customer_success_packet",
        objectId: packet.id,
        objectHref: "/assistant/customer-success-account-intelligence",
        priority: packet.accountScore < 72 || packet.governanceGapCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint18-customer-success-${packet.id}`.slice(0, 128),
        actionKind: "customer_success_review",
        label: `Review ${packet.title}`,
        description:
          "Review CRM-safe brief health, promise execution, pipeline hygiene, customer-facing exceptions, dispute cues, and governed reply gaps before external communications.",
        payload: { packetId: packet.id, accountScore: packet.accountScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantCustomerSuccessPacket.update({ where: { id: packet.id }, data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Customer Success action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadCustomerSuccessInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildCustomerSuccessPacket(inputs);
  const packet = await prisma.assistantCustomerSuccessPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      accountScore: built.accountScore,
      briefRiskCount: built.briefRiskCount,
      promiseRiskCount: built.promiseRiskCount,
      pipelineRiskCount: built.pipelineRiskCount,
      exceptionExposureCount: built.exceptionExposureCount,
      disputeFinanceRiskCount: built.disputeFinanceRiskCount,
      governanceGapCount: built.governanceGapCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      briefSignalsJson: built.briefSignals as Prisma.InputJsonValue,
      promiseExecutionJson: built.promiseExecution as Prisma.InputJsonValue,
      crmPipelineJson: built.crmPipeline as Prisma.InputJsonValue,
      exceptionExposureJson: built.exceptionExposure as Prisma.InputJsonValue,
      disputeFinanceJson: built.disputeFinance as Prisma.InputJsonValue,
      replyGovernanceJson: built.replyGovernance as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, accountScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_customer_success",
      prompt: "Create Sprint 18 Customer Success packet",
      answerKind: "sprint18_cs_pkt",
      message: built.leadershipSummary,
      evidence:
        { accountScore: built.accountScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_customer_success_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
