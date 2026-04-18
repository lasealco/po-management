const MS_PER_DAY = 86400000;

/** Default “expiring soon” window for supplier document `expiresAt` (compliance reminder). */
export const DOCUMENT_EXPIRY_SOON_DAYS = 30;

/** Tighter window inside “soon” for stronger readiness signals. */
export const DOCUMENT_EXPIRY_CRITICAL_DAYS = 14;

export type SupplierDocumentExpiryBadge =
  | "expired"
  | "expires_critical"
  | "expires_soon"
  | null;

export type SupplierDocumentExpiryOptions = {
  /** Override soon window (defaults to {@link DOCUMENT_EXPIRY_SOON_DAYS}). */
  soonDays?: number;
  /** Override critical window (defaults to {@link DOCUMENT_EXPIRY_CRITICAL_DAYS}). */
  criticalDays?: number;
};

function soonAndCriticalMs(opts?: SupplierDocumentExpiryOptions) {
  const soonDays = opts?.soonDays ?? DOCUMENT_EXPIRY_SOON_DAYS;
  const criticalDaysRaw = opts?.criticalDays ?? DOCUMENT_EXPIRY_CRITICAL_DAYS;
  const criticalDays = Math.min(criticalDaysRaw, soonDays);
  return {
    soonMs: soonDays * MS_PER_DAY,
    criticalMs: criticalDays * MS_PER_DAY,
  };
}

/**
 * UI / readiness hint for supplier document `expiresAt` (not automated enforcement).
 * Returns `expires_critical` when within the critical window but not yet past; `expires_soon` when
 * within the full “soon” window but outside critical; `expired` when past.
 */
export function supplierDocumentExpiryBadge(
  expiresAtIso: string | null,
  nowMs: number = Date.now(),
  opts?: SupplierDocumentExpiryOptions,
): SupplierDocumentExpiryBadge {
  if (!expiresAtIso) return null;
  const end = new Date(expiresAtIso).getTime();
  if (Number.isNaN(end)) return null;
  if (end < nowMs) return "expired";
  const remaining = end - nowMs;
  const { soonMs, criticalMs } = soonAndCriticalMs(opts);
  if (remaining <= criticalMs) return "expires_critical";
  if (remaining <= soonMs) return "expires_soon";
  return null;
}

/** Whole days until expiry (ceil); negative = already expired. */
export function supplierDocumentDaysUntilExpiry(
  expiresAtIso: string | null,
  nowMs: number = Date.now(),
): number | null {
  if (!expiresAtIso) return null;
  const end = new Date(expiresAtIso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - nowMs) / MS_PER_DAY);
}

/** Short phrase for readiness tables (English, buyer-facing). */
export function supplierDocumentExpirySummaryPhrase(
  expiresAtIso: string | null,
  nowMs: number = Date.now(),
  opts?: SupplierDocumentExpiryOptions,
): string | null {
  const badge = supplierDocumentExpiryBadge(expiresAtIso, nowMs, opts);
  if (badge === "expired") return "Past expiry date";
  const days = supplierDocumentDaysUntilExpiry(expiresAtIso, nowMs);
  if (days == null) return null;
  const { soonMs, criticalMs } = soonAndCriticalMs(opts);
  const soonDays = Math.round(soonMs / MS_PER_DAY);
  const criticalDays = Math.round(criticalMs / MS_PER_DAY);
  if (badge === "expires_critical") {
    return `Expires in ${days} day(s) (≤${criticalDays}d window)`;
  }
  if (badge === "expires_soon") {
    return `Expires in ${days} day(s) (≤${soonDays}d window)`;
  }
  return null;
}
