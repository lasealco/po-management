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
 * Query `?refresh=1` to bypass the short in-memory cache after `migrate deploy`.
 */
export async function GET(request: Request) {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;

  const url = new URL(request.url);
  const bypassCache =
    url.searchParams.get("refresh") === "1" || url.searchParams.get("refresh") === "true";

  const check = await checkInvoiceAuditDatabaseSchema({ bypassCache });
  return NextResponse.json(
    {
      ok: check.ok,
      issues: check.issues,
      requiredMigrationsHint: INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT,
      appliedPrismaMigrations: check.appliedPrismaMigrations ?? [],
      missingPrismaMigrations: check.missingPrismaMigrations ?? [],
      migrationHistoryNote: check.migrationHistoryNote ?? null,
    },
    { status: check.ok ? 200 : 503 },
  );
}
