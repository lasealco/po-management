import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { submitQuoteResponse } from "@/lib/rfq/quote-responses";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ responseId: string }> }) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { responseId } = await context.params;
  try {
    const response = await submitQuoteResponse({ tenantId: tenant.id, responseId });
    return NextResponse.json({ response });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}
