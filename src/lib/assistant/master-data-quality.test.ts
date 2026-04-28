import { describe, expect, it } from "vitest";

import {
  buildMasterDataQualityRun,
  findMasterDataDuplicates,
  findMasterDataGaps,
  findStaleMasterDataRecords,
  scoreMasterDataQuality,
  summarizeStagingConflicts,
  type MasterDataRecord,
} from "./master-data-quality";

function product(overrides: Partial<MasterDataRecord> = {}): MasterDataRecord {
  return {
    id: "product-1",
    domain: "PRODUCT",
    label: "Blue Widget",
    code: "BW-1",
    secondaryKey: "400000000001",
    updatedAt: "2026-04-01T00:00:00.000Z",
    fields: { unit: "EA", hsCode: "1234", isActive: true },
    ...overrides,
  };
}

describe("AMP21 master data quality helpers", () => {
  it("detects duplicate records by normalized code or secondary key", () => {
    const groups = findMasterDataDuplicates([
      product({ id: "product-1", label: "Blue Widget", code: "BW-1" }),
      product({ id: "product-2", label: "Blue widget duplicate", code: "BW-1" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ domain: "PRODUCT", count: 2 });
  });

  it("finds required-field gaps by domain", () => {
    const gaps = findMasterDataGaps([
      product({ id: "product-1", code: null, fields: { unit: null } }),
      product({ id: "supplier-1", domain: "SUPPLIER", label: "ACME", code: "SUP-1", fields: { email: null, registeredCountryCode: null } }),
    ]);

    expect(gaps).toHaveLength(2);
    expect(gaps[0]?.missing.length).toBeGreaterThanOrEqual(2);
  });

  it("flags stale records using the configured age threshold", () => {
    const stale = findStaleMasterDataRecords([product({ updatedAt: "2025-01-01T00:00:00.000Z" })], "2026-04-28T00:00:00.000Z", 180);

    expect(stale).toHaveLength(1);
    expect(stale[0]?.ageDays).toBeGreaterThan(180);
  });

  it("summarizes API Hub staging conflicts", () => {
    const conflicts = summarizeStagingConflicts([
      {
        id: "row-1",
        batchId: "batch-1",
        rowIndex: 1,
        targetDomain: "PRODUCT",
        label: "Blue Widget",
        issues: ["Missing SKU", "Unknown unit"],
        mappedRecord: { name: "Blue Widget" },
      },
    ]);

    expect(conflicts[0]).toMatchObject({ severity: "HIGH", suggestedFix: expect.stringContaining("API Hub staging") });
  });

  it("builds a review-safe run with quality score and no overwrite action", () => {
    const run = buildMasterDataQualityRun({
      nowIso: "2026-04-28T00:00:00.000Z",
      records: [
        product({ id: "product-1", code: "BW-1" }),
        product({ id: "product-2", code: "BW-1", fields: { unit: null }, updatedAt: "2025-01-01T00:00:00.000Z" }),
      ],
      stagingConflicts: [
        {
          id: "row-1",
          batchId: "batch-1",
          rowIndex: 1,
          targetDomain: "PRODUCT",
          label: "Blue Widget",
          issues: ["Conflicting SKU"],
          mappedRecord: null,
        },
      ],
    });

    expect(run.duplicateCount).toBe(1);
    expect(run.gapCount).toBe(1);
    expect(run.staleCount).toBe(1);
    expect(run.conflictCount).toBe(1);
    expect(run.summary.guardrail).toContain("not overwritten automatically");
    expect(run.qualityScore).toBeLessThan(scoreMasterDataQuality({ recordCount: 2, duplicateCount: 0, gapCount: 0, staleCount: 0, conflictCount: 0 }));
  });
});
