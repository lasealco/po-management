export type InvoiceAuditErrorCode = "NOT_FOUND" | "BAD_INPUT" | "FORBIDDEN" | "CONFLICT";

export class InvoiceAuditError extends Error {
  readonly code: InvoiceAuditErrorCode;

  constructor(code: InvoiceAuditErrorCode, message: string) {
    super(message);
    this.name = "InvoiceAuditError";
    this.code = code;
  }
}
