export type MasterDataDomain = "PRODUCT" | "SUPPLIER" | "CUSTOMER" | "LOCATION" | "INTEGRATION";
export type MasterDataSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MasterDataRecord = {
  id: string;
  domain: MasterDataDomain;
  label: string;
  code: string | null;
  secondaryKey?: string | null;
  updatedAt: string;
  fields: Record<string, string | number | boolean | null | undefined>;
};

export type StagingConflictSignal = {
  id: string;
  batchId: string;
  rowIndex: number;
  targetDomain: MasterDataDomain | "UNKNOWN";
  label: string;
  issues: string[];
  mappedRecord: Record<string, unknown> | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isBlank(value: unknown) {
  return value == null || (typeof value === "string" && value.trim().length === 0);
}

function ageDays(updatedAt: string, nowIso: string) {
  const ms = Date.parse(nowIso) - Date.parse(updatedAt);
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : 0;
}

function severityFromScore(score: number): MasterDataSeverity {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

const REQUIRED_FIELDS: Record<MasterDataDomain, string[]> = {
  PRODUCT: ["label", "code", "unit"],
  SUPPLIER: ["label", "code", "email", "registeredCountryCode"],
  CUSTOMER: ["label", "website", "owner"],
  LOCATION: ["label", "code", "countryCode"],
  INTEGRATION: ["label"],
};

export function findMasterDataDuplicates(records: MasterDataRecord[]) {
  const groups = new Map<string, MasterDataRecord[]>();
  for (const record of records) {
    const nameKey = normalizeText(record.label);
    const secondaryKey = normalizeText(record.secondaryKey);
    const key = `${record.domain}:${record.code?.trim().toLowerCase() || secondaryKey || nameKey}`;
    if (!nameKey && !record.code && !secondaryKey) continue;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return Array.from(groups.entries())
    .map(([dedupeKey, items]) => ({
      dedupeKey,
      domain: items[0]?.domain ?? "PRODUCT",
      count: items.length,
      labels: Array.from(new Set(items.map((item) => item.label))).slice(0, 6),
      recordIds: items.map((item) => item.id),
      severity: severityFromScore(45 + items.length * 18),
      rationale: "Records share a normalized code, website, or name key and should be reviewed before automation depends on them.",
    }))
    .filter((group) => group.count > 1)
    .sort((a, b) => b.count - a.count || a.dedupeKey.localeCompare(b.dedupeKey));
}

export function findMasterDataGaps(records: MasterDataRecord[]) {
  return records
    .map((record) => {
      const required = REQUIRED_FIELDS[record.domain];
      const missing = required.filter((field) => (field === "label" ? isBlank(record.label) : field === "code" ? isBlank(record.code) : isBlank(record.fields[field])));
      return {
        domain: record.domain,
        recordId: record.id,
        label: record.label,
        missing,
        severity: severityFromScore(missing.length * 24),
        suggestedFix: missing.length ? `Enrich ${missing.join(", ")} before enabling automated matching or downstream sync.` : "No required-field gap.",
      };
    })
    .filter((gap) => gap.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length || a.label.localeCompare(b.label));
}

export function findStaleMasterDataRecords(records: MasterDataRecord[], nowIso = new Date().toISOString(), staleAfterDays = 180) {
  return records
    .map((record) => {
      const days = ageDays(record.updatedAt, nowIso);
      return {
        domain: record.domain,
        recordId: record.id,
        label: record.label,
        ageDays: days,
        severity: severityFromScore(Math.min(100, days / 3)),
        suggestedReview: `${record.domain.toLowerCase()} master record has not been refreshed for ${days} days.`,
      };
    })
    .filter((row) => row.ageDays >= staleAfterDays)
    .sort((a, b) => b.ageDays - a.ageDays);
}

export function summarizeStagingConflicts(conflicts: StagingConflictSignal[]) {
  return conflicts
    .map((conflict) => ({
      ...conflict,
      severity: severityFromScore(40 + conflict.issues.length * 18),
      suggestedFix: "Review API Hub staging row mapping before applying it to canonical master data.",
    }))
    .sort((a, b) => b.issues.length - a.issues.length || a.label.localeCompare(b.label));
}

export function scoreMasterDataQuality(input: {
  recordCount: number;
  duplicateCount: number;
  gapCount: number;
  staleCount: number;
  conflictCount: number;
}) {
  const total = Math.max(1, input.recordCount);
  const penalty =
    Math.min(35, (input.duplicateCount / total) * 120) +
    Math.min(30, (input.gapCount / total) * 90) +
    Math.min(20, (input.staleCount / total) * 55) +
    Math.min(25, input.conflictCount * 4);
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function buildMasterDataQualityRun(input: {
  records: MasterDataRecord[];
  stagingConflicts: StagingConflictSignal[];
  nowIso?: string;
}) {
  const duplicates = findMasterDataDuplicates(input.records);
  const gaps = findMasterDataGaps(input.records);
  const staleRecords = findStaleMasterDataRecords(input.records, input.nowIso);
  const conflicts = summarizeStagingConflicts(input.stagingConflicts);
  const qualityScore = scoreMasterDataQuality({
    recordCount: input.records.length,
    duplicateCount: duplicates.length,
    gapCount: gaps.length,
    staleCount: staleRecords.length,
    conflictCount: conflicts.length,
  });
  const byDomain = input.records.reduce<Record<string, number>>((acc, record) => {
    acc[record.domain] = (acc[record.domain] ?? 0) + 1;
    return acc;
  }, {});
  const summary = {
    recordCount: input.records.length,
    byDomain,
    qualityScore,
    blockers: {
      duplicates: duplicates.length,
      gaps: gaps.length,
      staleRecords: staleRecords.length,
      stagingConflicts: conflicts.length,
    },
    guardrail: "Assistant proposes review work only; canonical products, suppliers, customers, locations, and API Hub rows are not overwritten automatically.",
  };
  const enrichmentPlan = {
    steps: [
      { step: "Dedupe", owner: "Master data owner", action: "Review duplicate groups and choose canonical records before merge work." },
      { step: "Complete required fields", owner: "Domain owners", action: "Fill missing codes, country, owner, website, and unit fields from approved sources." },
      { step: "Refresh stale records", owner: "Operations", action: "Confirm active status, addresses, contacts, and integration mappings for stale records." },
      { step: "Resolve staging conflicts", owner: "Integration owner", action: "Fix API Hub staging mappings before applying rows to source modules." },
      { step: "Approve changes", owner: "Data governance", action: "Queue approved master-data changes; no silent overwrite by assistant." },
    ],
    priorityObjects: [
      ...duplicates.slice(0, 5).map((item) => ({ type: "DUPLICATE", domain: item.domain, ids: item.recordIds, severity: item.severity })),
      ...gaps.slice(0, 5).map((item) => ({ type: "GAP", domain: item.domain, ids: [item.recordId], severity: item.severity })),
      ...conflicts.slice(0, 5).map((item) => ({ type: "STAGING_CONFLICT", domain: item.targetDomain, ids: [item.id], severity: item.severity })),
    ],
  };

  return {
    title: `Master data quality run: score ${qualityScore}/100`,
    status: "DRAFT",
    qualityScore,
    duplicateCount: duplicates.length,
    gapCount: gaps.length,
    staleCount: staleRecords.length,
    conflictCount: conflicts.length,
    summary,
    duplicateGroups: duplicates,
    gapAnalysis: gaps,
    staleRecords,
    conflicts,
    enrichmentPlan,
  };
}
