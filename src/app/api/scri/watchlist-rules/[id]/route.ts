import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  zodValidationApiExtra,
  zodValidationSummary,
} from "@/lib/scri/ingest-validation";
import { scriWatchlistRulePatchSchema } from "@/lib/scri/schemas/watchlist-rule-write";
import { deleteWatchlistRuleForTenant, updateWatchlistRuleForTenant } from "@/lib/scri/watchlist-repo";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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

  const parsed = scriWatchlistRulePatchSchema.safeParse(body);
  if (!parsed.success) {
    return toApiErrorResponse({
      error: zodValidationSummary(parsed.error),
      code: "BAD_INPUT",
      status: 400,
      extra: zodValidationApiExtra(parsed.error),
    });
  }

  const { id } = await ctx.params;
  const rule = await updateWatchlistRuleForTenant(tenant.id, id, parsed.data);
  if (!rule) {
    return toApiErrorResponse({ error: "Rule not found.", code: "NOT_FOUND", status: 404 });
  }
  return NextResponse.json({ ok: true, rule });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.scri", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await ctx.params;
  const ok = await deleteWatchlistRuleForTenant(tenant.id, id);
  if (!ok) {
    return toApiErrorResponse({ error: "Rule not found.", code: "NOT_FOUND", status: 404 });
  }
  return NextResponse.json({ ok: true });
}
