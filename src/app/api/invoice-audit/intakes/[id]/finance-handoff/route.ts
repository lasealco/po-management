import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { guardInvoiceAuditSchema } from "@/app/api/invoice-audit/_lib/guard-invoice-audit-schema";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  buildAccountingPacket,
  buildDisputeDraft,
  buildFinanceHandoffSummary,
  parseInvoiceFinanceHandoffStatus,
  type InvoiceFinanceHandoffLine,
} from "@/lib/invoice-audit/finance-handoff";
import { parseInvoiceAuditRecordId } from "@/lib/invoice-audit/invoice-audit-id";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function loadFinanceHandoff(tenantId: string, intakeId: string) {
  const intake = await prisma.invoiceIntake.findFirst({
    where: { id: intakeId, tenantId },
    include: {
      bookingPricingSnapshot: {
        select: {
          id: true,
          sourceType: true,
          sourceRecordId: true,
          sourceSummary: true,
          currency: true,
          totalEstimatedCost: true,
          breakdownJson: true,
          frozenAt: true,
        },
      },
      lines: { orderBy: { lineNo: "asc" } },
      auditResults: {
        orderBy: { createdAt: "asc" },
        include: {
          line: { select: { lineNo: true, rawDescription: true, amount: true, currency: true } },
        },
      },
    },
  });
  if (!intake) return null;
  const resultByLineId = new Map(intake.auditResults.map((result) => [result.invoiceLineId, result]));
  const lines: InvoiceFinanceHandoffLine[] = intake.lines.map((line) => {
    const result = resultByLineId.get(line.id);
    return {
      lineNo: line.lineNo,
      description: line.rawDescription,
      currency: line.currency,
      amount: line.amount.toString(),
      outcome: result?.outcome ?? "UNKNOWN",
      expectedAmount: result?.expectedAmount?.toString() ?? null,
      amountVariance: result?.amountVariance?.toString() ?? null,
      explanation: result?.explanation ?? "No audit result for this line.",
    };
  });
  const summary = buildFinanceHandoffSummary({
    vendorLabel: intake.vendorLabel,
    externalInvoiceNo: intake.externalInvoiceNo,
    rollupOutcome: intake.rollupOutcome,
    currency: intake.currency,
    snapshotTotal: intake.bookingPricingSnapshot.totalEstimatedCost.toString(),
    snapshotSourceSummary: intake.bookingPricingSnapshot.sourceSummary,
    lines,
  });
  const disputeDraft = buildDisputeDraft({
    vendorLabel: intake.vendorLabel,
    externalInvoiceNo: intake.externalInvoiceNo,
    lines,
  });
  const packet = buildAccountingPacket({
    intakeId: intake.id,
    snapshotId: intake.bookingPricingSnapshot.id,
    rollupOutcome: intake.rollupOutcome,
    reviewDecision: intake.reviewDecision,
    approvedForAccounting: intake.approvedForAccounting,
    summary,
    lines,
  });
  return {
    intake: {
      id: intake.id,
      status: intake.status,
      vendorLabel: intake.vendorLabel,
      externalInvoiceNo: intake.externalInvoiceNo,
      currency: intake.currency,
      rollupOutcome: intake.rollupOutcome,
      reviewDecision: intake.reviewDecision,
      approvedForAccounting: intake.approvedForAccounting,
      financeHandoffStatus: intake.financeHandoffStatus,
      financeHandoffSummary: intake.financeHandoffSummary,
      disputeDraft: intake.disputeDraft,
      accountingPacketJson: intake.accountingPacketJson,
      financeHandoffUpdatedAt: intake.financeHandoffUpdatedAt?.toISOString() ?? null,
    },
    snapshot: {
      id: intake.bookingPricingSnapshot.id,
      sourceType: intake.bookingPricingSnapshot.sourceType,
      sourceRecordId: intake.bookingPricingSnapshot.sourceRecordId,
      sourceSummary: intake.bookingPricingSnapshot.sourceSummary,
      totalEstimatedCost: intake.bookingPricingSnapshot.totalEstimatedCost.toString(),
      currency: intake.bookingPricingSnapshot.currency,
      frozenAt: intake.bookingPricingSnapshot.frozenAt.toISOString(),
    },
    lines,
    generated: { financeHandoffSummary: summary, disputeDraft, accountingPacketJson: packet },
  };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id: rawId } = await ctx.params;
  const id = parseInvoiceAuditRecordId(rawId);
  if (!id) return toApiErrorResponse({ error: "Invalid intake id.", code: "BAD_INPUT", status: 400 });
  const payload = await loadFinanceHandoff(tenant.id, id);
  if (!payload) return toApiErrorResponse({ error: "Invoice intake not found.", code: "NOT_FOUND", status: 404 });
  return NextResponse.json(payload);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;
  const tenant = await getDemoTenant();
  const actorUserId = await getActorUserId();
  if (!tenant || !actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id: rawId } = await ctx.params;
  const id = parseInvoiceAuditRecordId(rawId);
  if (!id) return toApiErrorResponse({ error: "Invalid intake id.", code: "BAD_INPUT", status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = Object.prototype.hasOwnProperty.call(record, "financeHandoffStatus")
    ? parseInvoiceFinanceHandoffStatus(record.financeHandoffStatus)
    : null;
  if (Object.prototype.hasOwnProperty.call(record, "financeHandoffStatus") && !status) {
    return toApiErrorResponse({ error: "Invalid financeHandoffStatus.", code: "BAD_INPUT", status: 400 });
  }
  const summary =
    typeof record.financeHandoffSummary === "string" ? record.financeHandoffSummary.trim().slice(0, 12_000) : undefined;
  const disputeDraft = typeof record.disputeDraft === "string" ? record.disputeDraft.trim().slice(0, 12_000) : undefined;
  const accountingPacketJson =
    record.accountingPacketJson && typeof record.accountingPacketJson === "object" && !Array.isArray(record.accountingPacketJson)
      ? (record.accountingPacketJson as Prisma.InputJsonObject)
      : undefined;

  const existing = await prisma.invoiceIntake.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, externalInvoiceNo: true },
  });
  if (!existing) return toApiErrorResponse({ error: "Invoice intake not found.", code: "NOT_FOUND", status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceIntake.update({
      where: { id: existing.id },
      data: {
        ...(summary !== undefined ? { financeHandoffSummary: summary || null } : {}),
        ...(disputeDraft !== undefined ? { disputeDraft: disputeDraft || null } : {}),
        ...(accountingPacketJson !== undefined ? { accountingPacketJson } : {}),
        ...(status ? { financeHandoffStatus: status } : {}),
        financeHandoffUpdatedAt: new Date(),
      },
      select: { id: true, financeHandoffStatus: true },
    });
    await tx.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        surface: "invoice_audit_detail",
        prompt: `Update invoice finance handoff ${existing.externalInvoiceNo ?? existing.id}`,
        answerKind: "invoice_finance_handoff",
        message: `Updated invoice finance handoff status ${row.financeHandoffStatus}.`,
        evidence: [{ label: existing.externalInvoiceNo ?? existing.id, href: `/invoice-audit/${existing.id}` }],
        quality: { mode: "human_review", source: "amp5_invoice_finance_handoff" },
        objectType: "invoice_intake",
        objectId: existing.id,
      },
    });
    return row;
  });
  return NextResponse.json({ ok: true, intake: updated });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;
  const tenant = await getDemoTenant();
  const actorUserId = await getActorUserId();
  if (!tenant || !actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id: rawId } = await ctx.params;
  const id = parseInvoiceAuditRecordId(rawId);
  if (!id) return toApiErrorResponse({ error: "Invalid intake id.", code: "BAD_INPUT", status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof record.action === "string" ? record.action : "";
  if (action !== "queue_dispute" && action !== "queue_accounting_packet") {
    return toApiErrorResponse({ error: "Unsupported finance handoff action.", code: "BAD_INPUT", status: 400 });
  }
  const text = typeof record.text === "string" && record.text.trim() ? record.text.trim().slice(0, 12_000) : "";
  if (!text) return toApiErrorResponse({ error: "text is required.", code: "BAD_INPUT", status: 400 });

  const intake = await prisma.invoiceIntake.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, externalInvoiceNo: true, approvedForAccounting: true },
  });
  if (!intake) return toApiErrorResponse({ error: "Invoice intake not found.", code: "NOT_FOUND", status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const audit = await tx.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        surface: "invoice_audit_detail",
        prompt: action === "queue_dispute" ? "Queue invoice dispute note" : "Queue accounting packet",
        answerKind: action,
        message:
          action === "queue_dispute"
            ? `Queued invoice dispute note for ${intake.externalInvoiceNo ?? intake.id}.`
            : `Queued accounting packet for ${intake.externalInvoiceNo ?? intake.id}.`,
        evidence: [{ label: intake.externalInvoiceNo ?? intake.id, href: `/invoice-audit/${intake.id}` }],
        quality: { mode: "human_approved", source: "amp5_invoice_finance_handoff" },
        objectType: "invoice_intake",
        objectId: intake.id,
      },
    });
    const item = await tx.assistantActionQueueItem.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "invoice_intake",
        objectId: intake.id,
        actionId: action,
        actionKind: action === "queue_dispute" ? "copy_text" : "accounting_packet",
        label:
          action === "queue_dispute"
            ? `Send invoice dispute note ${intake.externalInvoiceNo ?? intake.id}`
            : `Review accounting packet ${intake.externalInvoiceNo ?? intake.id}`,
        description:
          action === "queue_dispute"
            ? "Review/copy this dispute note through the approved vendor channel."
            : "Review this accounting packet before downstream posting/export.",
        payload: { intakeId: intake.id, text },
      },
      select: { id: true, status: true },
    });
    await tx.invoiceIntake.update({
      where: { id: intake.id },
      data: {
        financeHandoffStatus: action === "queue_dispute" ? "DISPUTE_QUEUED" : "ACCOUNTING_READY",
        financeHandoffUpdatedAt: new Date(),
      },
    });
    return item;
  });
  return NextResponse.json({ ok: true, actionQueueItem: result });
}
