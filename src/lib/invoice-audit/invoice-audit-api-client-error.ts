/** JSON body shape returned by invoice-audit API routes on errors. */
export type InvoiceAuditApiErrorPayload = {
  error?: string;
  code?: string;
  migrationsHint?: string;
};

/**
 * Human-readable message for client-side fetch handlers (matches API `jsonFromInvoiceAuditError` extras).
 */
export function formatInvoiceAuditApiError(data: InvoiceAuditApiErrorPayload, httpStatus: number): string {
  const err = typeof data.error === "string" ? data.error.trim() : "";
  const hint = typeof data.migrationsHint === "string" ? data.migrationsHint.trim() : "";
  if (data.code === "SCHEMA_NOT_READY" && hint) {
    const head = err || "Invoice audit database is not ready.";
    return `${head} ${hint}`.trim();
  }
  if (err) return err;
  return `Request failed (${httpStatus})`;
}
