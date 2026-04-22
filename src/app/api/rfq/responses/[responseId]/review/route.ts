import type { QuoteResponseStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { updateQuoteResponseReview } from "@/lib/rfq/quote-responses";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<string>(["UNDER_REVIEW", "SHORTLISTED", "AWARDED", "REJECTED", "WITHDRAWN"]);

export async function POST(request: Request, context: { params: Promise<{ responseId: string }> }) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { responseId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;
  const status = typeof o.status === "string" ? o.status.trim() : "";
  if (!ALLOWED.has(status)) {
    return toApiErrorResponse({ error: "Invalid review status.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const response = await updateQuoteResponseReview({
      tenantId: tenant.id,
      responseId,
      status: status as QuoteResponseStatus,
      reviewNotes: typeof o.reviewNotes === "string" ? o.reviewNotes : undefined,
    });
    return NextResponse.json({ response });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}
