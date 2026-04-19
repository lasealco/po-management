/**
 * Validates route/body ids for invoice-audit APIs (Prisma cuid-style and similar).
 * Rejects empty, oversized, and obviously invalid strings before hitting the DB.
 */
const RECORD_ID_RE = /^[a-z0-9]{7,40}$/i;

export function parseInvoiceAuditRecordId(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t || t.length > 40) return null;
  if (!RECORD_ID_RE.test(t)) return null;
  return t;
}
