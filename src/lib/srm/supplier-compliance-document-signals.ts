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

export type ComplianceDocumentFinding = {
  id: string;
  title: string;
  category: SupplierDocumentCategory;
  kind: "expired" | "expires_soon" | "missing_expiry";
};

/**
 * Active rows that need buyer attention (expiry posture or missing expiry on controlled categories).
 * A single document may appear once per kind; `missing_expiry` is only added when there is no expiry date.
 */
export function listComplianceDocumentFindings(
  documents: Array<{
    id: string;
    title: string;
    category: SupplierDocumentCategory;
    expiresAt: string | null;
    archivedAt: string | null;
  }>,
  nowMs: number = Date.now(),
): ComplianceDocumentFinding[] {
  const findings: ComplianceDocumentFinding[] = [];
  for (const d of documents) {
    if (d.archivedAt) continue;
    const badge = supplierDocumentExpiryBadge(d.expiresAt, nowMs);
    if (badge === "expired") {
      findings.push({
        id: d.id,
        title: d.title,
        category: d.category,
        kind: "expired",
      });
    } else if (badge === "expires_soon") {
      findings.push({
        id: d.id,
        title: d.title,
        category: d.category,
        kind: "expires_soon",
      });
    }
    if (
      CONTROLLED_CATEGORIES.includes(d.category) &&
      (d.expiresAt == null || d.expiresAt === "")
    ) {
      findings.push({
        id: d.id,
        title: d.title,
        category: d.category,
        kind: "missing_expiry",
      });
    }
  }
  const rank = (k: ComplianceDocumentFinding["kind"]) =>
    k === "expired" ? 0 : k === "expires_soon" ? 1 : 2;
  return findings.sort((a, b) => {
    const dr = rank(a.kind) - rank(b.kind);
    if (dr !== 0) return dr;
    return a.title.localeCompare(b.title);
  });
}

/** True for non-archived rows that appear in {@link listComplianceDocumentFindings}. */
export function activeDocumentNeedsComplianceAttention(
  d: {
    category: SupplierDocumentCategory;
    expiresAt: string | null;
    archivedAt: string | null;
  },
  nowMs: number = Date.now(),
): boolean {
  if (d.archivedAt) return false;
  const badge = supplierDocumentExpiryBadge(d.expiresAt, nowMs);
  if (badge === "expired" || badge === "expires_soon") return true;
  return (
    CONTROLLED_CATEGORIES.includes(d.category) &&
    (d.expiresAt == null || d.expiresAt === "")
  );
}

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
