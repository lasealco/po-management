import type { SupplierDocumentCategory } from "@prisma/client";

import {
  supplierDocumentDaysUntilExpiry,
  supplierDocumentExpiryBadge,
  supplierDocumentExpirySummaryPhrase,
} from "./supplier-document-expiry";

/** Categories where evidence is expected for basic readiness (slot + expiry rules). */
export const SRM_CONTROLLED_DOCUMENT_CATEGORIES: SupplierDocumentCategory[] = [
  "insurance",
  "license",
  "certificate",
];

export type ComplianceDocumentSignalSummary = {
  /** Non-archived rows used for readiness counts */
  activeTotal: number;
  archivedTotal: number;
  expired: number;
  /** Active rows with expiry in the critical window (not yet past). */
  expiresCritical: number;
  expiresSoon: number;
  /** insurance / license / certificate rows with no `expiresAt` set */
  missingExpiryControlled: number;
  /** Active supplier has no non-archived row for that controlled category at all */
  missingControlledSlots: number;
};

export type ComplianceDocumentFindingKind =
  | "expired"
  | "expires_critical"
  | "expires_soon"
  | "missing_expiry"
  | "missing_document";

export type ComplianceDocumentFinding = {
  id: string;
  title: string;
  category: SupplierDocumentCategory;
  kind: ComplianceDocumentFindingKind;
  /** Extra line for expiry-based rows (days / window). */
  detail?: string | null;
};

/** Active supplier is missing an entire controlled document category (no row on file). */
export function listMissingControlledDocumentTypes(
  documents: Array<{ category: SupplierDocumentCategory; archivedAt: string | null }>,
): SupplierDocumentCategory[] {
  const active = documents.filter((d) => !d.archivedAt);
  const present = new Set(active.map((d) => d.category));
  return SRM_CONTROLLED_DOCUMENT_CATEGORIES.filter((c) => !present.has(c));
}

/**
 * Active rows that need buyer attention (expiry posture, missing expiry on controlled rows, or
 * missing entire controlled categories).
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
    const detail =
      badge === "expired" || badge === "expires_critical" || badge === "expires_soon"
        ? supplierDocumentExpirySummaryPhrase(d.expiresAt, nowMs)
        : null;
    if (badge === "expired") {
      findings.push({
        id: d.id,
        title: d.title,
        category: d.category,
        kind: "expired",
        detail,
      });
    } else if (badge === "expires_critical") {
      findings.push({
        id: d.id,
        title: d.title,
        category: d.category,
        kind: "expires_critical",
        detail,
      });
    } else if (badge === "expires_soon") {
      findings.push({
        id: d.id,
        title: d.title,
        category: d.category,
        kind: "expires_soon",
        detail,
      });
    }
    if (
      SRM_CONTROLLED_DOCUMENT_CATEGORIES.includes(d.category) &&
      (d.expiresAt == null || d.expiresAt === "")
    ) {
      findings.push({
        id: d.id,
        title: d.title,
        category: d.category,
        kind: "missing_expiry",
        detail: "Controlled category — add an expiry date or archive if not applicable.",
      });
    }
  }

  for (const cat of listMissingControlledDocumentTypes(documents)) {
    const label =
      cat === "insurance" ? "Insurance" : cat === "license" ? "License" : "Certificate";
    findings.push({
      id: `__missing_slot_${cat}`,
      title: `No ${label.toLowerCase()} document on file`,
      category: cat,
      kind: "missing_document",
      detail: `Register a ${label.toLowerCase()} row on the Documents tab (or waive with an explicit note in a commercial/other row if your policy allows).`,
    });
  }

  const rank = (k: ComplianceDocumentFindingKind) =>
    k === "expired"
      ? 0
      : k === "expires_critical"
        ? 1
        : k === "expires_soon"
          ? 2
          : k === "missing_expiry"
            ? 3
            : 4;
  return findings.sort((a, b) => {
    const dr = rank(a.kind) - rank(b.kind);
    if (dr !== 0) return dr;
    return a.title.localeCompare(b.title);
  });
}

/** True for non-archived rows that appear in {@link listComplianceDocumentFindings} (row-level only). */
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
  if (badge === "expired" || badge === "expires_critical" || badge === "expires_soon") return true;
  return (
    SRM_CONTROLLED_DOCUMENT_CATEGORIES.includes(d.category) &&
    (d.expiresAt == null || d.expiresAt === "")
  );
}

/** Supplier-level gap: any controlled category has no active document row. */
export function supplierHasMissingControlledDocumentSlots(
  documents: Array<{ category: SupplierDocumentCategory; archivedAt: string | null }>,
): boolean {
  return listMissingControlledDocumentTypes(documents).length > 0;
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
  let expiresCritical = 0;
  let expiresSoon = 0;
  let missingExpiryControlled = 0;
  for (const d of active) {
    const badge = supplierDocumentExpiryBadge(d.expiresAt, nowMs);
    if (badge === "expired") expired += 1;
    else if (badge === "expires_critical") expiresCritical += 1;
    else if (badge === "expires_soon") expiresSoon += 1;
    if (
      SRM_CONTROLLED_DOCUMENT_CATEGORIES.includes(d.category) &&
      (d.expiresAt == null || d.expiresAt === "")
    ) {
      missingExpiryControlled += 1;
    }
  }
  return {
    activeTotal: active.length,
    archivedTotal,
    expired,
    expiresCritical,
    expiresSoon,
    missingExpiryControlled,
    missingControlledSlots: listMissingControlledDocumentTypes(documents).length,
  };
}

/** Single score for dashboards: 100 = no findings, 0 = worst. */
export function complianceDocumentReadinessScore(
  summary: ComplianceDocumentSignalSummary,
): number {
  const penalty =
    summary.expired * 25 +
    summary.expiresCritical * 12 +
    summary.expiresSoon * 6 +
    summary.missingExpiryControlled * 10 +
    summary.missingControlledSlots * 15;
  return Math.max(0, 100 - Math.min(100, penalty));
}
