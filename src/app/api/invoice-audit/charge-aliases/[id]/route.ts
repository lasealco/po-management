import { NextResponse } from "next/server";

import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { guardInvoiceAuditSchema } from "@/app/api/invoice-audit/_lib/guard-invoice-audit-schema";
import { serializeInvoiceChargeAlias } from "@/app/api/invoice-audit/_lib/serialize";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseInvoiceAuditRecordId } from "@/lib/invoice-audit/invoice-audit-id";
import {
  parseCanonicalTokensFromBody,
  updateInvoiceChargeAliasForTenant,
} from "@/lib/invoice-audit/invoice-charge-aliases";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id: rawId } = await ctx.params;
  const aliasId = parseInvoiceAuditRecordId(rawId);
  if (!aliasId) {
    return NextResponse.json({ error: "Invalid alias id." }, { status: 400 });
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

  const updates: {
    name?: string | null;
    pattern?: string;
    canonicalTokens?: string[];
    targetKind?: string | null;
    priority?: number;
    active?: boolean;
  } = {};

  if ("name" in o) {
    updates.name = typeof o.name === "string" ? o.name : null;
  }
  if (typeof o.pattern === "string") {
    updates.pattern = o.pattern;
  }
  if ("canonicalTokens" in o) {
    const tokens = parseCanonicalTokensFromBody(o.canonicalTokens);
    if (tokens == null) {
      return NextResponse.json({ error: "canonicalTokens: use array or string." }, { status: 400 });
    }
    if (tokens.length === 0) {
      return NextResponse.json({ error: "canonicalTokens cannot be empty." }, { status: 400 });
    }
    updates.canonicalTokens = tokens;
  }
  if ("targetKind" in o) {
    if (o.targetKind == null || o.targetKind === "") {
      updates.targetKind = null;
    } else if (typeof o.targetKind === "string") {
      updates.targetKind = o.targetKind;
    }
  }
  if (typeof o.priority === "number" && Number.isFinite(o.priority)) {
    updates.priority = Math.trunc(o.priority);
  }
  if (typeof o.priority === "string" && o.priority.trim()) {
    const pr = Math.trunc(Number(o.priority));
    if (Number.isFinite(pr)) updates.priority = pr;
  }
  if (typeof o.active === "boolean") {
    updates.active = o.active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updatable fields supplied." }, { status: 400 });
  }

  try {
    const updated = await updateInvoiceChargeAliasForTenant({
      tenantId: tenant.id,
      aliasId,
      ...updates,
    });
    return NextResponse.json({ alias: serializeInvoiceChargeAlias(updated) });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
