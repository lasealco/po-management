export type SupplierDocumentExpiryBadge = "expired" | "expires_soon" | null;

const DEFAULT_SOON_MS = 30 * 86400000;

/**
 * UI hint for supplier document `expiresAt` (compliance reminder — not automated workflow).
 */
export function supplierDocumentExpiryBadge(
  expiresAtIso: string | null,
  nowMs: number = Date.now(),
  soonMs: number = DEFAULT_SOON_MS,
): SupplierDocumentExpiryBadge {
  if (!expiresAtIso) return null;
  const end = new Date(expiresAtIso).getTime();
  if (Number.isNaN(end)) return null;
  if (end < nowMs) return "expired";
  if (end - nowMs <= soonMs) return "expires_soon";
  return null;
}
