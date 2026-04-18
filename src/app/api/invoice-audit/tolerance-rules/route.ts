import { NextResponse } from "next/server";

import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { serializeToleranceRule } from "@/app/api/invoice-audit/_lib/serialize";
import { requireApiGrant } from "@/lib/authz";
import { createToleranceRule, listToleranceRulesForTenant } from "@/lib/invoice-audit/tolerance-rules";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const rules = await listToleranceRulesForTenant({ tenantId: tenant.id });
  return NextResponse.json({ rules: rules.map(serializeToleranceRule) });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;

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
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const amountAbsTolerance =
    typeof o.amountAbsTolerance === "number"
      ? o.amountAbsTolerance
      : typeof o.amountAbsTolerance === "string" && o.amountAbsTolerance.trim()
        ? Number(o.amountAbsTolerance)
        : null;
  const percentTolerance =
    typeof o.percentTolerance === "number"
      ? o.percentTolerance
      : typeof o.percentTolerance === "string" && o.percentTolerance.trim()
        ? Number(o.percentTolerance)
        : null;

  if (amountAbsTolerance != null && !Number.isFinite(amountAbsTolerance)) {
    return NextResponse.json({ error: "amountAbsTolerance must be finite." }, { status: 400 });
  }
  if (percentTolerance != null && !Number.isFinite(percentTolerance)) {
    return NextResponse.json({ error: "percentTolerance must be finite." }, { status: 400 });
  }

  try {
    const created = await createToleranceRule({
      tenantId: tenant.id,
      name,
      priority: typeof o.priority === "number" ? o.priority : undefined,
      amountAbsTolerance,
      percentTolerance,
      currencyScope: typeof o.currencyScope === "string" ? o.currencyScope : null,
    });
    return NextResponse.json({ rule: serializeToleranceRule(created) });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
