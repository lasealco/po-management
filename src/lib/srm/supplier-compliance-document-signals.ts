import type { SupplierDocumentCategory } from "@prisma/client";

import { supplierDocumentExpiryBadge } from "./supplier-document-expiry";

/** Categories where an expiry date is expected for basic document control. */
const CONTROLLED_CATEGORIES: SupplierDocumentCategory[] = [
  "insurance",
  "license",
  "certificate",
];

export type ComplianceDocumentSignalSummary = {
  /** Non-archived rows used for readiness counts */
  activeTotal: number;
  archivedTotal: number;
  expired: number;
  expiresSoon: number;
  /** insurance / license / certificate rows with no `expiresAt` set */
  missingExpiryControlled: number;
};

export function summarizeComplianceDocumentSignals(
  documents: Array<{
    category: SupplierDocumentCategory;
    expiresAt: string | null;
    archivedAt: string | null;
  }>,
  nowMs: number = Date.now(),
): ComplianceDocumentSignalSummary {
  const archivedTotal = documents.filter((d) => d.archivedAt).length;
  const active = documents.filter((d) => !d.archivedAt);
  let expired = 0;
  let expiresSoon = 0;
  let missingExpiryControlled = 0;
  for (const d of active) {
    const badge = supplierDocumentExpiryBadge(d.expiresAt, nowMs);
    if (badge === "expired") expired += 1;
    else if (badge === "expires_soon") expiresSoon += 1;
    if (
      CONTROLLED_CATEGORIES.includes(d.category) &&
      (d.expiresAt == null || d.expiresAt === "")
    ) {
      missingExpiryControlled += 1;
    }
  }
  return {
    activeTotal: active.length,
    archivedTotal,
    expired,
    expiresSoon,
    missingExpiryControlled,
  };
}
