import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  parseSalesOrderAssistantLines,
  parseSalesOrderAssistantReviewStatus,
} from "@/lib/sales-orders/assistant-intake-review";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const draftReply =
    typeof record.assistantDraftReply === "string" ? record.assistantDraftReply.trim().slice(0, 12_000) : undefined;
  const reviewNote =
    typeof record.assistantReviewNote === "string" ? record.assistantReviewNote.trim().slice(0, 12_000) : undefined;
  const reviewStatus = Object.prototype.hasOwnProperty.call(record, "assistantReviewStatus")
    ? parseSalesOrderAssistantReviewStatus(record.assistantReviewStatus)
    : null;
  if (Object.prototype.hasOwnProperty.call(record, "assistantReviewStatus") && !reviewStatus) {
    return toApiErrorResponse({ error: "Invalid assistantReviewStatus.", code: "BAD_INPUT", status: 400 });
  }

  const parsedLines = parseSalesOrderAssistantLines(record.lines);
  if (!parsedLines.ok) {
    return toApiErrorResponse({ error: parsedLines.error, code: "BAD_INPUT", status: 400 });
  }

  const existing = await prisma.salesOrder.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, soNumber: true, assistantReviewStatus: true },
  });
  if (!existing) return toApiErrorResponse({ error: "Sales order not found.", code: "NOT_FOUND", status: 404 });

  for (const line of parsedLines.lines) {
    if (!line.productId) continue;
    const product = await prisma.product.findFirst({
      where: { id: line.productId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!product) {
      return toApiErrorResponse({ error: `Product not found for line: ${line.description}`, code: "NOT_FOUND", status: 404 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const header = await tx.salesOrder.update({
      where: { id: existing.id },
      data: {
        ...(draftReply !== undefined ? { assistantDraftReply: draftReply || null } : {}),
        ...(reviewStatus ? { assistantReviewStatus: reviewStatus } : {}),
        ...(reviewNote !== undefined ? { assistantReviewNote: reviewNote || null } : {}),
        ...(reviewStatus && reviewStatus !== "PENDING"
          ? { assistantReviewedAt: new Date(), assistantReviewedById: actorUserId }
          : {}),
      },
      select: { id: true, soNumber: true, assistantReviewStatus: true, assistantDraftReply: true },
    });

    if (Array.isArray(record.lines)) {
      await tx.salesOrderLine.deleteMany({ where: { tenantId: tenant.id, salesOrderId: existing.id } });
      for (const [index, line] of parsedLines.lines.entries()) {
        const lineTotal = Number((line.quantity * line.unitPrice).toFixed(2));
        await tx.salesOrderLine.create({
          data: {
            tenantId: tenant.id,
            salesOrderId: existing.id,
            lineNo: index + 1,
            productId: line.productId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal,
            currency: line.currency,
            source: "assistant_review",
          },
        });
      }
    }

    await tx.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        surface: "sales_order_detail",
        prompt: `Review assistant intake for sales order ${existing.soNumber}`,
        answerKind: "sales_order_intake_review",
        message: reviewStatus
          ? `Assistant sales intake marked ${reviewStatus} for ${existing.soNumber}.`
          : `Assistant sales intake updated for ${existing.soNumber}.`,
        evidence: [
          { label: `Sales order ${existing.soNumber}`, href: `/sales-orders/${existing.id}` },
          ...parsedLines.lines.map((line) => ({
            label: line.description,
            href: line.productId ? `/products/${line.productId}` : `/sales-orders/${existing.id}`,
          })),
        ],
        quality: {
          mode: "human_review",
          previousStatus: existing.assistantReviewStatus,
          nextStatus: header.assistantReviewStatus,
          lineCount: parsedLines.lines.length,
          hasDraftReply: Boolean(header.assistantDraftReply),
        },
        objectType: "sales_order",
        objectId: existing.id,
      },
    });

    return header;
  });

  return NextResponse.json({ ok: true, salesOrder: updated });
}
