import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
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
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id: rawId } = await ctx.params;
  const aliasId = parseInvoiceAuditRecordId(rawId);
  if (!aliasId) {
    return toApiErrorResponse({ error: "Invalid alias id.", code: "BAD_INPUT", status: 400 });
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
      return toApiErrorResponse({ error: "canonicalTokens: use array or string.", code: "BAD_INPUT", status: 400 });
    }
    if (tokens.length === 0) {
      return toApiErrorResponse({ error: "canonicalTokens cannot be empty.", code: "BAD_INPUT", status: 400 });
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
    return toApiErrorResponse({ error: "No updatable fields supplied.", code: "BAD_INPUT", status: 400 });
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
    return toApiErrorResponse({ error: msg, code: "UNHANDLED", status: 500 });
  }
}
