export type InvoiceAuditErrorCode =
  | "NOT_FOUND"
  | "BAD_INPUT"
  | "FORBIDDEN"
  | "CONFLICT"
  /** Database missing invoice-audit tables/columns (migrations not applied). */
  | "SCHEMA_NOT_READY";

/** Domain errors from invoice-audit libs; `src/app/api/invoice-audit/_lib/invoice-audit-api-error` maps these to HTTP. */
export class InvoiceAuditError extends Error {
  readonly code: InvoiceAuditErrorCode;

  constructor(code: InvoiceAuditErrorCode, message: string) {
    super(message);
    this.name = "InvoiceAuditError";
    this.code = code;
  }
}
