import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { getQuoteResponseForTenant, updateQuoteResponseWithLines, type QuoteResponseLineInput } from "@/lib/rfq/quote-responses";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";

export const dynamic = "force-dynamic";

function parseLines(raw: unknown): QuoteResponseLineInput[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) throw new Error("lines must be an array.");
  return raw.map((row, idx) => {
    if (!row || typeof row !== "object") throw new Error("Invalid line.");
    const r = row as Record<string, unknown>;
    const lineType = typeof r.lineType === "string" ? r.lineType : "";
    const label = typeof r.label === "string" ? r.label : "";
    if (!lineType.trim() || !label.trim()) throw new Error("Each line needs lineType and label.");
    return {
      lineType,
      label,
      amount: typeof r.amount === "number" ? r.amount : r.amount === null ? null : undefined,
      currency: typeof r.currency === "string" ? r.currency : undefined,
      unitBasis: typeof r.unitBasis === "string" ? r.unitBasis : null,
      isIncluded: typeof r.isIncluded === "boolean" ? r.isIncluded : undefined,
      notes: typeof r.notes === "string" ? r.notes : null,
      sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : idx,
    };
  });
}

export async function GET(_request: Request, context: { params: Promise<{ responseId: string }> }) {
  const gate = await requireApiGrant("org.rfq", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { responseId } = await context.params;
  try {
    const response = await getQuoteResponseForTenant({ tenantId: tenant.id, responseId });
    return NextResponse.json({ response });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ responseId: string }> }) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { responseId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const patch: Parameters<typeof updateQuoteResponseWithLines>[0]["patch"] = {};
  if (typeof o.currency === "string") patch.currency = o.currency;
  if (o.totalAllInAmount !== undefined) {
    patch.totalAllInAmount =
      o.totalAllInAmount === null ? null : typeof o.totalAllInAmount === "number" ? o.totalAllInAmount : undefined;
  }
  if (o.validityFrom !== undefined) {
    patch.validityFrom =
      o.validityFrom === null || o.validityFrom === ""
        ? null
        : typeof o.validityFrom === "string"
          ? new Date(o.validityFrom)
          : null;
  }
  if (o.validityTo !== undefined) {
    patch.validityTo =
      o.validityTo === null || o.validityTo === ""
        ? null
        : typeof o.validityTo === "string"
          ? new Date(o.validityTo)
          : null;
  }
  if (o.includedChargesJson !== undefined) {
    patch.includedChargesJson =
      o.includedChargesJson === null ? null : (o.includedChargesJson as Prisma.InputJsonValue);
  }
  if (o.excludedChargesJson !== undefined) {
    patch.excludedChargesJson =
      o.excludedChargesJson === null ? null : (o.excludedChargesJson as Prisma.InputJsonValue);
  }
  if (o.freeTimeSummaryJson !== undefined) {
    patch.freeTimeSummaryJson =
      o.freeTimeSummaryJson === null ? null : (o.freeTimeSummaryJson as Prisma.InputJsonValue);
  }
  if (o.reviewNotes !== undefined) {
    patch.reviewNotes = typeof o.reviewNotes === "string" ? o.reviewNotes : null;
  }

  let lines: QuoteResponseLineInput[] | null | undefined;
  try {
    lines = parseLines(o.lines);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid lines.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (
    Object.keys(patch).length === 0 &&
    lines === undefined
  ) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const response = await updateQuoteResponseWithLines({
      tenantId: tenant.id,
      responseId,
      patch,
      lines,
    });
    return NextResponse.json({ response });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}
