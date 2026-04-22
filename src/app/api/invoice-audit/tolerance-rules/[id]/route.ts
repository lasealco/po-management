import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { guardInvoiceAuditSchema } from "@/app/api/invoice-audit/_lib/guard-invoice-audit-schema";
import { serializeToleranceRule } from "@/app/api/invoice-audit/_lib/serialize";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseInvoiceAuditRecordId } from "@/lib/invoice-audit/invoice-audit-id";
import { updateToleranceRuleForTenant } from "@/lib/invoice-audit/tolerance-rules";

export const dynamic = "force-dynamic";

function parseNum(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id: rawRuleId } = await ctx.params;
  const ruleId = parseInvoiceAuditRecordId(rawRuleId);
  if (!ruleId) {
    return toApiErrorResponse({ error: "Invalid rule id.", code: "BAD_INPUT", status: 400 });
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
    name?: string;
    priority?: number;
    active?: boolean;
    amountAbsTolerance?: number | null;
    percentTolerance?: number | null;
    currencyScope?: string | null;
  } = {};

  if (typeof o.name === "string") {
    if (!o.name.trim()) {
      return toApiErrorResponse({ error: "name cannot be empty.", code: "BAD_INPUT", status: 400 });
    }
    updates.name = o.name;
  }
  if (typeof o.priority === "number" && Number.isFinite(o.priority)) {
    updates.priority = o.priority;
  }
  if (typeof o.active === "boolean") {
    updates.active = o.active;
  }
  if ("currencyScope" in o) {
    updates.currencyScope =
      typeof o.currencyScope === "string" && o.currencyScope.trim()
        ? o.currencyScope.trim().toUpperCase().slice(0, 3)
        : null;
  }

  const abs = parseNum(o.amountAbsTolerance);
  if (abs !== undefined) {
    if (abs != null && !Number.isFinite(abs)) {
      return toApiErrorResponse({ error: "amountAbsTolerance must be finite.", code: "BAD_INPUT", status: 400 });
    }
    updates.amountAbsTolerance = abs;
  }
  const pct = parseNum(o.percentTolerance);
  if (pct !== undefined) {
    if (pct != null && !Number.isFinite(pct)) {
      return toApiErrorResponse({ error: "percentTolerance must be finite.", code: "BAD_INPUT", status: 400 });
    }
    updates.percentTolerance = pct;
  }

  if (Object.keys(updates).length === 0) {
    return toApiErrorResponse({ error: "No updatable fields supplied.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const updated = await updateToleranceRuleForTenant({
      tenantId: tenant.id,
      ruleId,
      ...updates,
    });
    return NextResponse.json({ rule: serializeToleranceRule(updated) });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    const msg = e instanceof Error ? e.message : String(e);
    return toApiErrorResponse({ error: msg, code: "UNHANDLED", status: 500 });
  }
}
