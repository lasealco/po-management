import { NextResponse } from "next/server";

import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { guardInvoiceAuditSchema } from "@/app/api/invoice-audit/_lib/guard-invoice-audit-schema";
import { serializeInvoiceChargeAlias } from "@/app/api/invoice-audit/_lib/serialize";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  createInvoiceChargeAlias,
  listInvoiceChargeAliasesForTenant,
  parseCanonicalTokensFromBody,
} from "@/lib/invoice-audit/invoice-charge-aliases";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const rows = await listInvoiceChargeAliasesForTenant({ tenantId: tenant.id });
  return NextResponse.json({ aliases: rows.map(serializeInvoiceChargeAlias) });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

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

  const pattern = typeof o.pattern === "string" ? o.pattern : "";
  const tokens = parseCanonicalTokensFromBody(o.canonicalTokens);
  if (tokens == null || tokens.length === 0) {
    return NextResponse.json(
      { error: "canonicalTokens is required (non-empty array or newline/comma-separated string)." },
      { status: 400 },
    );
  }

  const priority =
    typeof o.priority === "number" && Number.isFinite(o.priority)
      ? Math.trunc(o.priority)
      : typeof o.priority === "string" && o.priority.trim()
        ? Math.trunc(Number(o.priority))
        : 0;
  if (!Number.isFinite(priority)) {
    return NextResponse.json({ error: "priority must be a finite number." }, { status: 400 });
  }

  const active =
    typeof o.active === "boolean"
      ? o.active
      : typeof o.active === "string"
        ? o.active.toLowerCase() === "true"
        : undefined;

  try {
    const created = await createInvoiceChargeAlias({
      tenantId: tenant.id,
      pattern,
      canonicalTokens: tokens,
      name: typeof o.name === "string" ? o.name : null,
      targetKind: typeof o.targetKind === "string" ? o.targetKind : null,
      priority,
      active,
    });
    return NextResponse.json({ alias: serializeInvoiceChargeAlias(created) });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
