import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { guardInvoiceAuditSchema } from "@/app/api/invoice-audit/_lib/guard-invoice-audit-schema";
import {
  serializeBookingPricingSnapshotForIntakeApi,
  serializeInvoiceIntakeListRow,
} from "@/app/api/invoice-audit/_lib/serialize";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { parseInvoiceAuditRecordId } from "@/lib/invoice-audit/invoice-audit-id";
import { createInvoiceIntakeWithLines, listInvoiceIntakesForTenant } from "@/lib/invoice-audit/invoice-intakes";
import { getDemoTenant } from "@/lib/demo-tenant";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const intakes = await listInvoiceIntakesForTenant({ tenantId: tenant.id, take: 200 });
  return NextResponse.json({ intakes: intakes.map(serializeInvoiceIntakeListRow) });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected JSON object.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;
  const rawSnapId = typeof o.bookingPricingSnapshotId === "string" ? o.bookingPricingSnapshotId.trim() : "";
  if (!rawSnapId) {
    return toApiErrorResponse({ error: "bookingPricingSnapshotId is required.", code: "BAD_INPUT", status: 400 });
  }
  const bookingPricingSnapshotId = parseInvoiceAuditRecordId(rawSnapId);
  if (!bookingPricingSnapshotId) {
    return toApiErrorResponse({ error: "bookingPricingSnapshotId is invalid.", code: "BAD_INPUT", status: 400 });
  }
  const linesRaw = o.lines;
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
    return toApiErrorResponse({ error: "lines must be a non-empty array.", code: "BAD_INPUT", status: 400 });
  }

  const lines: Array<{
    lineNo: number;
    rawDescription: string;
    normalizedLabel?: string | null;
    currency: string;
    amount: string | number;
    unitBasis?: string | null;
    equipmentType?: string | null;
    chargeStructureHint?: string | null;
    quantity?: string | number | null;
    sourceRowJson?: Prisma.InputJsonValue | null;
    parseConfidence?: string | null;
  }> = [];

  for (const row of linesRaw) {
    if (!row || typeof row !== "object") {
      return toApiErrorResponse({ error: "Each line must be an object.", code: "BAD_INPUT", status: 400 });
    }
    const ln = row as Record<string, unknown>;
    const lineNo = typeof ln.lineNo === "number" ? ln.lineNo : Number(ln.lineNo);
    if (!Number.isFinite(lineNo)) {
      return toApiErrorResponse({ error: "Each line needs a numeric lineNo.", code: "BAD_INPUT", status: 400 });
    }
    const rawDescription = typeof ln.rawDescription === "string" ? ln.rawDescription : "";
    const currency = typeof ln.currency === "string" ? ln.currency : "USD";
    if (ln.amount === undefined || ln.amount === null) {
      return toApiErrorResponse({ error: `Line ${lineNo}: amount is required.`, code: "BAD_INPUT", status: 400 });
    }
    const csh = typeof ln.chargeStructureHint === "string" ? ln.chargeStructureHint.trim().toUpperCase() : "";
    if (csh && csh !== "ALL_IN" && csh !== "ITEMIZED") {
      return toApiErrorResponse({
        error: `Line ${lineNo}: chargeStructureHint must be ALL_IN, ITEMIZED, or omitted.`,
        code: "BAD_INPUT",
        status: 400,
      });
    }
    lines.push({
      lineNo,
      rawDescription,
      normalizedLabel: typeof ln.normalizedLabel === "string" ? ln.normalizedLabel : null,
      currency,
      amount: typeof ln.amount === "number" || typeof ln.amount === "string" ? ln.amount : String(ln.amount),
      unitBasis: typeof ln.unitBasis === "string" ? ln.unitBasis : null,
      equipmentType: typeof ln.equipmentType === "string" ? ln.equipmentType : null,
      chargeStructureHint: csh || null,
      quantity:
        ln.quantity === undefined || ln.quantity === null
          ? null
          : typeof ln.quantity === "number" || typeof ln.quantity === "string"
            ? ln.quantity
            : null,
      sourceRowJson: (ln.sourceRowJson as Prisma.InputJsonValue | undefined) ?? null,
      parseConfidence: typeof ln.parseConfidence === "string" ? ln.parseConfidence : null,
    });
  }

  const invoiceDate =
    typeof o.invoiceDate === "string" && o.invoiceDate.trim()
      ? new Date(o.invoiceDate.trim())
      : null;
  if (invoiceDate && Number.isNaN(invoiceDate.getTime())) {
    return toApiErrorResponse({ error: "invoiceDate is not a valid date.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const created = await createInvoiceIntakeWithLines({
      tenantId: tenant.id,
      createdByUserId: actorId,
      bookingPricingSnapshotId,
      externalInvoiceNo: typeof o.externalInvoiceNo === "string" ? o.externalInvoiceNo : null,
      vendorLabel: typeof o.vendorLabel === "string" ? o.vendorLabel : null,
      invoiceDate,
      currency: typeof o.currency === "string" ? o.currency : undefined,
      rawSourceNotes: typeof o.rawSourceNotes === "string" ? o.rawSourceNotes : null,
      polCode: typeof o.polCode === "string" ? o.polCode : null,
      podCode: typeof o.podCode === "string" ? o.podCode : null,
      lines,
    });
    return NextResponse.json({
      intake: {
        ...created,
        lines: created.lines.map((l) => ({
          ...l,
          amount: l.amount.toString(),
          quantity: l.quantity?.toString() ?? null,
        })),
        bookingPricingSnapshot: serializeBookingPricingSnapshotForIntakeApi(created.bookingPricingSnapshot),
      },
    });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    const msg = e instanceof Error ? e.message : String(e);
    return toApiErrorResponse({ error: `Create failed: ${msg}`, code: "UNHANDLED", status: 500 });
  }
}
