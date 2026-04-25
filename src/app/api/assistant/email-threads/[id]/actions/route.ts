import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { analyzeEmailSalesOrderAction } from "@/lib/assistant/email-action-analysis";
import { isAssistantEmailPilotEnabled } from "@/lib/assistant/email-pilot";
import { getActorUserId, getViewerGrantSet, requireApiGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { nextSalesOrderNumber } from "@/lib/sales-orders";
import { resolveServedOrgUnitIdForTenant } from "@/lib/served-org-unit";

export const dynamic = "force-dynamic";

function pilotGate() {
  if (!isAssistantEmailPilotEnabled()) {
    return toApiErrorResponse({ error: "Assistant email pilot is disabled.", code: "FEATURE_DISABLED", status: 404 });
  }
  return null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const pg = pilotGate();
  if (pg) return pg;

  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id } = await context.params;

  const thread = await prisma.assistantEmailThread.findFirst({
    where: { id, tenantId: tenant.id },
    include: { salesOrder: { select: { id: true, soNumber: true, status: true } } },
  });
  if (!thread) return toApiErrorResponse({ error: "Thread not found.", code: "NOT_FOUND", status: 404 });

  const intent = await analyzeEmailSalesOrderAction({
    tenantId: tenant.id,
    subject: thread.subject,
    bodyText: thread.bodyText,
    linkedCrmAccountId: thread.linkedCrmAccountId,
  });

  return NextResponse.json({
    ok: true,
    existingSalesOrder: thread.salesOrder,
    intent,
    steps: [
      { id: "review", label: "Review inbound", status: "done" },
      { id: "detect", label: "Detect order intent", status: intent.kind === "ready" ? "done" : "needs_input" },
      { id: "draft_so", label: "Create draft SO", status: thread.salesOrder ? "done" : "available" },
      { id: "reply", label: "Draft customer reply", status: thread.draftReply ? "done" : "available" },
    ],
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const pg = pilotGate();
  if (pg) return pg;

  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  if (!viewerHas(access.grantSet, "org.orders", "edit")) {
    return toApiErrorResponse({ error: "You need org.orders edit to create a sales order.", code: "FORBIDDEN", status: 403 });
  }
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id } = await context.params;

  const thread = await prisma.assistantEmailThread.findFirst({
    where: { id, tenantId: tenant.id },
    include: { salesOrder: { select: { id: true, soNumber: true, status: true } } },
  });
  if (!thread) return toApiErrorResponse({ error: "Thread not found.", code: "NOT_FOUND", status: 404 });
  if (thread.salesOrder) {
    return NextResponse.json({ ok: true, salesOrder: thread.salesOrder, alreadyCreated: true });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const action = body && typeof body === "object" ? (body as Record<string, unknown>).action : null;
  if (action !== "create_sales_order") {
    return toApiErrorResponse({ error: "Unsupported action.", code: "BAD_INPUT", status: 400 });
  }

  const intent = await analyzeEmailSalesOrderAction({
    tenantId: tenant.id,
    subject: thread.subject,
    bodyText: thread.bodyText,
    linkedCrmAccountId: thread.linkedCrmAccountId,
  });
  if (intent.kind !== "ready") {
    return toApiErrorResponse({ error: intent.message, code: "NEEDS_INPUT", status: 409 });
  }

  const servedResolved = await resolveServedOrgUnitIdForTenant(tenant.id, intent.createPayload.servedOrgUnitId);
  if (!servedResolved.ok) {
    return toApiErrorResponse({ error: servedResolved.error, code: "BAD_INPUT", status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const soNumber = await nextSalesOrderNumber(tenant.id);
    const row = await tx.salesOrder.create({
      data: {
        tenantId: tenant.id,
        soNumber,
        status: "DRAFT",
        customerName: intent.summary.accountName,
        customerCrmAccountId: intent.createPayload.customerCrmAccountId,
        externalRef: `Email ${thread.id}: ${intent.createPayload.externalRef}`.slice(0, 2_000),
        requestedDeliveryDate: intent.createPayload.requestedDeliveryDate
          ? new Date(intent.createPayload.requestedDeliveryDate)
          : null,
        notes: [
          "Created from Assistant Mail action (MP5).",
          `Source email: ${thread.subject}`,
          intent.createPayload.notes,
        ].join("\n\n").slice(0, 12_000),
        servedOrgUnitId: servedResolved.value,
        createdById: actorId,
      },
      select: { id: true, soNumber: true, status: true },
    });
    await tx.assistantEmailThread.update({
      where: { id: thread.id },
      data: { salesOrderId: row.id, linkedCrmAccountId: intent.createPayload.customerCrmAccountId },
    });
    return row;
  });

  return NextResponse.json({ ok: true, salesOrder: created, intent });
}
