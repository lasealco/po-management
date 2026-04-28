import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildCustomerActivityLog,
  buildCustomerBrief,
  type CustomerIntelligenceInputs,
} from "@/lib/assistant/customer-intelligence";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireCustomerIntelligenceAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  if (!viewerHas(access.grantSet, "org.crm", edit ? "edit" : "view")) {
    return { ok: false as const, response: toApiErrorResponse({ error: `Forbidden: requires org.crm ${edit ? "edit" : "view"}.`, code: "FORBIDDEN", status: 403 }) };
  }
  return { ok: true as const, access };
}

function iso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

async function buildSnapshot(tenantId: string) {
  const [accounts, briefs] = await Promise.all([
    prisma.crmAccount.findMany({
      where: { tenantId, lifecycle: "ACTIVE" },
      orderBy: [{ strategicFlag: "desc" }, { updatedAt: "desc" }],
      take: 80,
      select: { id: true, name: true, accountType: true, industry: true, segment: true, strategicFlag: true },
    }),
    prisma.assistantCustomerBrief.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        crmAccountId: true,
        title: true,
        status: true,
        serviceScore: true,
        replyDraft: true,
        approvedReply: true,
        operationsSummaryJson: true,
        riskSummaryJson: true,
        redactionJson: true,
        updatedAt: true,
        crmAccount: { select: { name: true } },
      },
    }),
  ]);
  return {
    accounts,
    briefs: briefs.map((brief) => ({ ...brief, updatedAt: brief.updatedAt.toISOString() })),
  };
}

async function loadBriefInputs(params: {
  tenantId: string;
  accountId: string;
  grantSet: Set<string>;
  canViewSensitive: boolean;
}): Promise<CustomerIntelligenceInputs & { canViewSensitive: boolean }> {
  const account = await prisma.crmAccount.findFirst({
    where: { tenantId: params.tenantId, id: params.accountId },
    select: {
      id: true,
      name: true,
      industry: true,
      segment: true,
      strategicFlag: true,
      activities: { orderBy: { updatedAt: "desc" }, take: 8, select: { subject: true, status: true, dueDate: true } },
    },
  });
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");

  const [orders, shipments, invoices, incidents] = await Promise.all([
    viewerHas(params.grantSet, "org.orders", "view")
      ? prisma.salesOrder.findMany({
          where: { tenantId: params.tenantId, customerCrmAccountId: account.id },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, soNumber: true, status: true, requestedDeliveryDate: true, assistantReviewStatus: true },
        })
      : Promise.resolve([]),
    viewerHas(params.grantSet, "org.controltower", "view")
      ? prisma.shipment.findMany({
          where: { order: { tenantId: params.tenantId }, customerCrmAccountId: account.id },
          orderBy: { updatedAt: "desc" },
          take: 25,
          select: {
            id: true,
            shipmentNo: true,
            status: true,
            expectedReceiveAt: true,
            receivedAt: true,
            _count: { select: { ctExceptions: { where: { status: "OPEN" } }, ctAlerts: { where: { status: "OPEN" } } } },
          },
        })
      : Promise.resolve([]),
    viewerHas(params.grantSet, "org.invoice_audit", "view")
      ? prisma.invoiceIntake.findMany({
          where: {
            tenantId: params.tenantId,
            rollupOutcome: { in: ["WARN", "FAIL"] },
            bookingPricingSnapshot: { shipmentBooking: { shipment: { customerCrmAccountId: account.id } } },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, externalInvoiceNo: true, rollupOutcome: true, redLineCount: true, amberLineCount: true },
        })
      : Promise.resolve([]),
    prisma.assistantExceptionIncident.findMany({
      where: { tenantId: params.tenantId, status: { not: "CLOSED" }, customerImpact: { contains: account.name, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, title: true, severity: true, status: true, customerImpact: true },
    }),
  ]);

  return {
    accountName: account.name,
    industry: account.industry,
    segment: account.segment,
    strategicFlag: account.strategicFlag,
    activities: account.activities.map((activity) => ({
      subject: activity.subject,
      status: activity.status,
      dueDate: iso(activity.dueDate),
    })),
    orders: orders.map((order) => ({
      id: order.id,
      soNumber: order.soNumber,
      status: order.status,
      requestedDeliveryDate: iso(order.requestedDeliveryDate),
      assistantReviewStatus: order.assistantReviewStatus,
    })),
    shipments: shipments.map((shipment) => ({
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      status: shipment.status,
      expectedReceiveAt: iso(shipment.expectedReceiveAt),
      receivedAt: iso(shipment.receivedAt),
      openExceptionCount: shipment._count.ctExceptions,
      openAlertCount: shipment._count.ctAlerts,
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      externalInvoiceNo: invoice.externalInvoiceNo,
      rollupOutcome: invoice.rollupOutcome,
      redLineCount: invoice.redLineCount,
      amberLineCount: invoice.amberLineCount,
    })),
    incidents: incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      customerImpact: incident.customerImpact,
    })),
    canViewSensitive: params.canViewSensitive,
  };
}

export async function GET() {
  const gate = await requireCustomerIntelligenceAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireCustomerIntelligenceAccess(true);
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

  if (action === "approve_reply") {
    const briefId = typeof body.briefId === "string" ? body.briefId.trim() : "";
    const approvedReply = typeof body.approvedReply === "string" ? body.approvedReply.trim() : "";
    if (!briefId || !approvedReply) return toApiErrorResponse({ error: "briefId and approvedReply are required.", code: "BAD_INPUT", status: 400 });
    const brief = await prisma.assistantCustomerBrief.findFirst({
      where: { tenantId: gate.access.tenant.id, id: briefId },
      include: { crmAccount: { select: { name: true } } },
    });
    if (!brief) return toApiErrorResponse({ error: "Brief not found.", code: "NOT_FOUND", status: 404 });
    const activityLog = buildCustomerActivityLog({ accountName: brief.crmAccount.name, reply: approvedReply, approvedBy: actorUserId });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_customer_intelligence",
        prompt: "Approve customer-ready reply",
        answerKind: "customer_reply",
        message: `Approved customer reply for ${brief.crmAccount.name}.`,
        evidence: { briefId: brief.id, activityLog } as Prisma.InputJsonObject,
        objectType: "assistant_customer_brief",
        objectId: brief.id,
      },
      select: { id: true },
    });
    const actionItem = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_customer_brief",
        objectId: brief.id,
        objectHref: "/assistant/customer-intelligence",
        priority: brief.serviceScore < 60 ? "HIGH" : "MEDIUM",
        actionId: `amp18-customer-reply-${brief.id}`.slice(0, 128),
        actionKind: "customer_reply_send_review",
        label: `Review customer reply: ${brief.crmAccount.name}`,
        description: "Human-approved customer update. Sending is still manual; no external message is sent automatically.",
        payload: { briefId: brief.id, approvedReply, activityLog } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantCustomerBrief.update({
      where: { id: brief.id },
      data: {
        status: "REPLY_APPROVED",
        approvedReply,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
        activityLogJson: activityLog as Prisma.InputJsonObject,
        actionQueueItemId: actionItem.id,
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, brief: updated });
  }

  if (action !== "create_brief") {
    return toApiErrorResponse({ error: "Unsupported customer intelligence action.", code: "BAD_INPUT", status: 400 });
  }

  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  if (!accountId) return toApiErrorResponse({ error: "accountId is required.", code: "BAD_INPUT", status: 400 });
  try {
    const inputs = await loadBriefInputs({
      tenantId: gate.access.tenant.id,
      accountId,
      grantSet: gate.access.grantSet,
      canViewSensitive: viewerHas(gate.access.grantSet, "org.invoice_audit", "view") && viewerHas(gate.access.grantSet, "org.crm", "edit"),
    });
    const built = buildCustomerBrief(inputs);
    const brief = await prisma.assistantCustomerBrief.create({
      data: {
        tenantId: gate.access.tenant.id,
        crmAccountId: accountId,
        createdByUserId: actorUserId,
        title: built.title,
        status: "DRAFT",
        serviceScore: built.serviceScore,
        accountSnapshotJson: built.accountSnapshot as unknown as Prisma.InputJsonValue,
        operationsSummaryJson: built.operationsSummary as unknown as Prisma.InputJsonValue,
        riskSummaryJson: built.riskSummary as unknown as Prisma.InputJsonValue,
        evidenceJson: built.evidence as unknown as Prisma.InputJsonValue,
        redactionJson: built.redaction as unknown as Prisma.InputJsonValue,
        replyDraft: built.replyDraft,
      },
      select: { id: true, title: true, serviceScore: true, status: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_customer_intelligence",
        prompt: `Create customer intelligence brief for ${inputs.accountName}`,
        answerKind: "customer_brief",
        message: built.replyDraft,
        evidence: { accountId, serviceScore: built.serviceScore, redaction: built.redaction } as Prisma.InputJsonObject,
        objectType: "crm_account",
        objectId: accountId,
      },
    });
    return NextResponse.json({ ok: true, brief }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "ACCOUNT_NOT_FOUND") {
      return toApiErrorResponse({ error: "Account not found.", code: "NOT_FOUND", status: 404 });
    }
    throw e;
  }
}
