import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";

const SCHEMA_NOT_READY_HINT =
  "Apply npm run db:migrate (or prisma migrate deploy) on this DATABASE_URL. Then GET or open /invoice-audit/readiness?refresh=1. Vercel: do not set SKIP_DB_MIGRATE=1 unless migrations run elsewhere on the same DB.";

export function jsonFromInvoiceAuditError(e: unknown): NextResponse | null {
  if (!(e instanceof InvoiceAuditError)) return null;
  const status =
    e.code === "NOT_FOUND"
      ? 404
      : e.code === "CONFLICT"
        ? 409
        : e.code === "FORBIDDEN"
          ? 403
          : e.code === "SCHEMA_NOT_READY"
            ? 503
            : 400;
  return toApiErrorResponse({
    error: e.message,
    code: e.code,
    status,
    extra: e.code === "SCHEMA_NOT_READY" ? { migrationsHint: SCHEMA_NOT_READY_HINT } : undefined,
  });
}
