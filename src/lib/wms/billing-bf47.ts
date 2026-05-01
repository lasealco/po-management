/** BF-47 — reason codes for posted invoice disputes and credit memo stubs (finance / AR handoff). */

export const POSTED_BILLING_DISPUTE_REASON_CODES = [
  "RATE_DISPUTE",
  "QUANTITY_DISPUTE",
  "SERVICE_LEVEL",
  "DUPLICATE_CHARGE",
  "OTHER",
] as const;

export type PostedBillingDisputeReasonCode = (typeof POSTED_BILLING_DISPUTE_REASON_CODES)[number];

const ALLOWED = new Set<string>(POSTED_BILLING_DISPUTE_REASON_CODES);

export function normalizeBf47ReasonCode(raw: string): PostedBillingDisputeReasonCode | null {
  const u = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (!u || !ALLOWED.has(u)) return null;
  return u as PostedBillingDisputeReasonCode;
}
