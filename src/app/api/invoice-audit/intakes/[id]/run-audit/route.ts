import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { guardInvoiceAuditSchema } from "@/app/api/invoice-audit/_lib/guard-invoice-audit-schema";
import { serializeAuditResult, serializeInvoiceLine } from "@/app/api/invoice-audit/_lib/serialize";
import { requireApiGrant } from "@/lib/authz";
import { parseInvoiceAuditRecordId } from "@/lib/invoice-audit/invoice-audit-id";
import { runInvoiceAuditForIntake } from "@/lib/invoice-audit/invoice-intakes";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.invoice_audit", "edit");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id: rawId } = await ctx.params;
  const id = parseInvoiceAuditRecordId(rawId);
  if (!id) {
    return toApiErrorResponse({ error: "Invalid intake id.", code: "BAD_INPUT", status: 400 });
  }

  let toleranceRuleId: string | null = null;
  const raw = await request.text();
  if (raw.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
    }
    if (body && typeof body === "object") {
      const o = body as Record<string, unknown>;
      if (typeof o.toleranceRuleId === "string" && o.toleranceRuleId.trim()) {
        const tid = parseInvoiceAuditRecordId(o.toleranceRuleId.trim());
        if (!tid) {
          return toApiErrorResponse({ error: "Invalid toleranceRuleId.", code: "BAD_INPUT", status: 400 });
        }
        toleranceRuleId = tid;
      }
    }
  }

  try {
    const row = await runInvoiceAuditForIntake({
      tenantId: tenant.id,
      invoiceIntakeId: id,
      toleranceRuleId,
    });
    return NextResponse.json({
      intake: {
        id: row.id,
        status: row.status,
        rollupOutcome: row.rollupOutcome,
        greenLineCount: row.greenLineCount,
        amberLineCount: row.amberLineCount,
        redLineCount: row.redLineCount,
        unknownLineCount: row.unknownLineCount,
        auditRunError: row.auditRunError,
        lastAuditAt: row.lastAuditAt?.toISOString() ?? null,
        lines: row.lines.map(serializeInvoiceLine),
        auditResults: row.auditResults.map(serializeAuditResult),
      },
    });
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    const msg = e instanceof Error ? e.message : String(e);
    return toApiErrorResponse({ error: `Audit failed: ${msg}`, code: "UNHANDLED", status: 500 });
  }
}
