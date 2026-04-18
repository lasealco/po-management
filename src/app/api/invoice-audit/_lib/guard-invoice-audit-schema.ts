import { NextResponse } from "next/server";

import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { ensureInvoiceAuditSchemaReady } from "@/lib/invoice-audit/invoice-audit-db-readiness";

/** Returns a JSON NextResponse when migrations/schema are not ready; otherwise null. */
export async function guardInvoiceAuditSchema(): Promise<NextResponse | null> {
  try {
    await ensureInvoiceAuditSchemaReady();
  } catch (e) {
    const j = jsonFromInvoiceAuditError(e);
    if (j) return j;
    throw e;
  }
  return null;
}
