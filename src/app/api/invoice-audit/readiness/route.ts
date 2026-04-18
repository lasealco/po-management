import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import {
  checkInvoiceAuditDatabaseSchema,
  INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT,
} from "@/lib/invoice-audit/invoice-audit-db-readiness";

export const dynamic = "force-dynamic";

/**
 * Operator-friendly JSON: whether Postgres has invoice-audit tables/columns.
 * Does not require a tenant body; still requires invoice_audit view grant.
 */
export async function GET() {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;

  const check = await checkInvoiceAuditDatabaseSchema();
  return NextResponse.json(
    {
      ok: check.ok,
      issues: check.issues,
      requiredMigrationsHint: INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT,
    },
    { status: check.ok ? 200 : 503 },
  );
}
