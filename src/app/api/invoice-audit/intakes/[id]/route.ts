import { NextResponse } from "next/server";

import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { serializeAuditResult, serializeInvoiceLine } from "@/app/api/invoice-audit/_lib/serialize";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getInvoiceIntakeForTenant, setInvoiceIntakeReview } from "@/lib/invoice-audit/invoice-intakes";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id } = await ctx.params;
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
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        receivedAt: row.receivedAt.toISOString(),
        bookingPricingSnapshot: {
          ...row.bookingPricingSnapshot,
          totalEstimatedCost: row.bookingPricingSnapshot.totalEstimatedCost.toString(),
          frozenAt: row.bookingPricingSnapshot.frozenAt.toISOString(),
        },
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

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const reviewDecision = typeof o.reviewDecision === "string" ? o.reviewDecision.trim().toUpperCase() : "";
  if (reviewDecision !== "APPROVED" && reviewDecision !== "OVERRIDDEN") {
    return NextResponse.json(
      { error: "reviewDecision must be APPROVED or OVERRIDDEN." },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  try {
    const updated = await setInvoiceIntakeReview({
      tenantId: tenant.id,
      invoiceIntakeId: id,
      reviewDecision: reviewDecision === "APPROVED" ? "APPROVED" : "OVERRIDDEN",
      reviewNote: typeof o.reviewNote === "string" ? o.reviewNote : null,
      reviewedByUserId: actorId,
    });
    return NextResponse.json({
      intake: {
        id: updated.id,
        reviewDecision: updated.reviewDecision,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, code: "UNHANDLED" }, { status: 500 });
  }
}
