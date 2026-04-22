import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { guardInvoiceAuditSchema } from "@/app/api/invoice-audit/_lib/guard-invoice-audit-schema";
import {
  serializeAuditResult,
  serializeBookingPricingSnapshotForIntakeApi,
  serializeInvoiceLine,
} from "@/app/api/invoice-audit/_lib/serialize";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { parseInvoiceAuditRecordId } from "@/lib/invoice-audit/invoice-audit-id";
import { parseInvoiceIntakePatchBody } from "@/lib/invoice-audit/invoice-intake-patch-parse";
import {
  getInvoiceIntakeForTenant,
  patchInvoiceIntakeReviewAndAccounting,
  setInvoiceIntakeAccountingHandoff,
  setInvoiceIntakeRawSourceNotes,
  setInvoiceIntakeReview,
} from "@/lib/invoice-audit/invoice-intakes";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const { id: rawId } = await ctx.params;
  const id = parseInvoiceAuditRecordId(rawId);
  if (!id) {
    return toApiErrorResponse({ error: "Invalid intake id.", code: "BAD_INPUT", status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  try {
    const row = await getInvoiceIntakeForTenant({ tenantId: tenant.id, intakeId: id });
    return NextResponse.json({
      intake: {
        id: row.id,
        tenantId: row.tenantId,
        status: row.status,
        bookingPricingSnapshotId: row.bookingPricingSnapshotId,
        externalInvoiceNo: row.externalInvoiceNo,
        vendorLabel: row.vendorLabel,
        invoiceDate: row.invoiceDate?.toISOString().slice(0, 10) ?? null,
        currency: row.currency,
        polCode: row.polCode,
        podCode: row.podCode,
        rawSourceNotes: row.rawSourceNotes,
        parseError: row.parseError,
        parseWarnings: row.parseWarnings,
        auditRunError: row.auditRunError,
        lastAuditAt: row.lastAuditAt?.toISOString() ?? null,
        rollupOutcome: row.rollupOutcome,
        greenLineCount: row.greenLineCount,
        amberLineCount: row.amberLineCount,
        redLineCount: row.redLineCount,
        unknownLineCount: row.unknownLineCount,
        reviewDecision: row.reviewDecision,
        reviewNote: row.reviewNote,
        reviewedByUserId: row.reviewedByUserId,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        approvedForAccounting: row.approvedForAccounting,
        accountingApprovedByUserId: row.accountingApprovedByUserId,
        accountingApprovedAt: row.accountingApprovedAt?.toISOString() ?? null,
        accountingApprovalNote: row.accountingApprovalNote,
        createdByUserId: row.createdByUserId,
        receivedAt: row.receivedAt.toISOString(),
        bookingPricingSnapshot: serializeBookingPricingSnapshotForIntakeApi(row.bookingPricingSnapshot),
        lines: row.lines.map(serializeInvoiceLine),
        auditResults: row.auditResults.map(serializeAuditResult),
      },
    });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    throw e;
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const id = parseInvoiceAuditRecordId(rawId);
  if (!id) {
    return toApiErrorResponse({ error: "Invalid intake id.", code: "BAD_INPUT", status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const parsed = parseInvoiceIntakePatchBody(body);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: "BAD_INPUT", status: parsed.status });
  }
  const p = parsed.value;

  try {
    if (p.hasReview && p.reviewDecision) {
      if (p.hasAccounting && p.approvedForAccounting != null) {
        await patchInvoiceIntakeReviewAndAccounting({
          tenantId: tenant.id,
          invoiceIntakeId: id,
          actorUserId: actorId,
          reviewDecision: p.reviewDecision,
          reviewNote: p.reviewNote,
          approvedForAccounting: p.approvedForAccounting,
          accountingApprovalNote: p.accountingApprovalNote,
        });
      } else {
        await setInvoiceIntakeReview({
          tenantId: tenant.id,
          invoiceIntakeId: id,
          reviewDecision: p.reviewDecision,
          reviewNote: p.reviewNote,
          reviewedByUserId: actorId,
        });
      }
    } else if (p.hasAccounting && p.approvedForAccounting != null) {
      await setInvoiceIntakeAccountingHandoff({
        tenantId: tenant.id,
        invoiceIntakeId: id,
        approvedForAccounting: p.approvedForAccounting,
        accountingApprovalNote: p.accountingApprovalNote,
        actorUserId: actorId,
      });
    }

    if (p.hasRawSourceNotes) {
      await setInvoiceIntakeRawSourceNotes({
        tenantId: tenant.id,
        invoiceIntakeId: id,
        rawSourceNotes: p.rawSourceNotes,
      });
    }

    const row = await getInvoiceIntakeForTenant({ tenantId: tenant.id, intakeId: id });
    return NextResponse.json({
      intake: {
        id: row.id,
        reviewDecision: row.reviewDecision,
        reviewNote: row.reviewNote,
        reviewedByUserId: row.reviewedByUserId,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        approvedForAccounting: row.approvedForAccounting,
        accountingApprovedByUserId: row.accountingApprovedByUserId,
        accountingApprovedAt: row.accountingApprovedAt?.toISOString() ?? null,
        accountingApprovalNote: row.accountingApprovalNote,
        createdByUserId: row.createdByUserId,
        rawSourceNotes: row.rawSourceNotes,
      },
    });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    const msg = e instanceof Error ? e.message : String(e);
    return toApiErrorResponse({ error: msg, code: "UNHANDLED", status: 500 });
  }
}
