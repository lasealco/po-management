import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  zodValidationApiExtra,
  zodValidationSummary,
} from "@/lib/scri/ingest-validation";
import { scriWatchlistRuleCreateSchema } from "@/lib/scri/schemas/watchlist-rule-write";
import { createWatchlistRule, listWatchlistRulesForTenant } from "@/lib/scri/watchlist-repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.scri", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const rules = await listWatchlistRulesForTenant(tenant.id);
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.scri", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const parsed = scriWatchlistRuleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return toApiErrorResponse({
      error: zodValidationSummary(parsed.error),
      code: "BAD_INPUT",
      status: 400,
      extra: zodValidationApiExtra(parsed.error),
    });
  }

  const rule = await createWatchlistRule(tenant.id, parsed.data);
  return NextResponse.json({ ok: true, rule }, { status: 201 });
}
