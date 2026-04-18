import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { markRecipientInvited, removeQuoteRequestRecipient } from "@/lib/rfq/quote-requests";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; recipientId: string }> }) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id, recipientId } = await context.params;
  try {
    await removeQuoteRequestRecipient({ tenantId: tenant.id, quoteRequestId: id, recipientId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}

/** Stub “send invite” — records INVITED + metadata only (no mailbox integration). */
export async function POST(request: Request, context: { params: Promise<{ id: string; recipientId: string }> }) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id, recipientId } = await context.params;

  let metadata: unknown = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && "metadata" in body) metadata = (body as { metadata?: unknown }).metadata;
  } catch {
    /* optional body */
  }

  try {
    const recipient = await markRecipientInvited({
      tenantId: tenant.id,
      quoteRequestId: id,
      recipientId,
      metadata: metadata === undefined || metadata === null ? null : (metadata as object),
    });
    return NextResponse.json({ recipient });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}
