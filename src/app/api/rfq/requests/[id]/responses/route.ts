import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { ensureDraftQuoteResponse } from "@/lib/rfq/quote-responses";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await context.params;

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
  const recipientId = typeof o.recipientId === "string" ? o.recipientId.trim() : "";
  if (!recipientId) {
    return toApiErrorResponse({ error: "recipientId is required.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const response = await ensureDraftQuoteResponse({
      tenantId: tenant.id,
      quoteRequestId: id,
      recipientId,
    });
    return NextResponse.json({ response });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}
