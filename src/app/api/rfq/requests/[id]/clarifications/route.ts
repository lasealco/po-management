import type { QuoteClarificationVisibility } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { addQuoteClarification } from "@/lib/rfq/quote-requests";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";

export const dynamic = "force-dynamic";

const VIS = new Set<string>(["INTERNAL", "RECIPIENTS"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
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
  const text = typeof o.body === "string" ? o.body.trim() : "";
  if (!text) {
    return toApiErrorResponse({ error: "body is required.", code: "BAD_INPUT", status: 400 });
  }

  const visibilityRaw = typeof o.visibility === "string" ? o.visibility.trim() : "INTERNAL";
  if (!VIS.has(visibilityRaw)) {
    return toApiErrorResponse({ error: "Invalid visibility.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const message = await addQuoteClarification({
      tenantId: tenant.id,
      quoteRequestId: id,
      authorUserId: actorId,
      body: text,
      visibility: visibilityRaw as QuoteClarificationVisibility,
      recipientId: typeof o.recipientId === "string" ? o.recipientId.trim() || null : null,
      quoteResponseId: typeof o.quoteResponseId === "string" ? o.quoteResponseId.trim() || null : null,
      metadata: o.metadata && typeof o.metadata === "object" ? (o.metadata as object) : null,
    });
    return NextResponse.json({ message });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}
