import { NextResponse } from "next/server";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";

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
  return NextResponse.json(
    {
      error: e.message,
      code: e.code,
      ...(e.code === "SCHEMA_NOT_READY"
        ? {
            migrationsHint:
              "Apply prisma migrate deploy (or npm run db:migrate locally). Vercel: unset SKIP_DB_MIGRATE unless you migrate elsewhere.",
          }
        : {}),
    },
    { status },
  );
}
