import { describe, expect, it } from "vitest";

import {
  TARIFF_IMPORT_NORMALIZED_PAYLOAD_KEYS,
  TARIFF_IMPORT_PIPELINE_STAGES,
  TARIFF_IMPORT_STAGING_ROW_TYPE_SET,
  TARIFF_IMPORT_STAGING_ROW_TYPES,
} from "@/lib/tariff/import-pipeline";
import { TARIFF_IMPORT_STAGING_ROW_TYPES as stagingRowTypesFromBatchStatuses } from "@/lib/tariff/import-batch-statuses";

describe("import-pipeline stages", () => {
  it("lists six ordered lifecycle stages for docs and UI", () => {
    expect(TARIFF_IMPORT_PIPELINE_STAGES).toEqual([
      "upload",
      "parse",
      "normalize",
      "review",
      "promote",
      "audit",
    ]);
  });

  it("uses six unique stage ids", () => {
    expect(new Set(TARIFF_IMPORT_PIPELINE_STAGES).size).toBe(TARIFF_IMPORT_PIPELINE_STAGES.length);
  });
});

describe("import-pipeline staging row types", () => {
  it("re-exports the same tuple through import-batch-statuses (single source of truth)", () => {
    expect(stagingRowTypesFromBatchStatuses).toBe(TARIFF_IMPORT_STAGING_ROW_TYPES);
  });

  it("includes documented row types", () => {
    expect(TARIFF_IMPORT_STAGING_ROW_TYPES).toContain("RATE_LINE_CANDIDATE");
    expect(TARIFF_IMPORT_STAGING_ROW_TYPES).toContain("CHARGE_LINE_CANDIDATE");
  });

  it("includes promotable row kinds used by promote-staging-import", () => {
    expect(TARIFF_IMPORT_STAGING_ROW_TYPE_SET.has("RATE_LINE_CANDIDATE")).toBe(true);
    expect(TARIFF_IMPORT_STAGING_ROW_TYPE_SET.has("CHARGE_LINE_CANDIDATE")).toBe(true);
  });

  it("exposes a set for validation", () => {
    expect(TARIFF_IMPORT_STAGING_ROW_TYPE_SET.has("RAW_ROW")).toBe(true);
    expect(TARIFF_IMPORT_STAGING_ROW_TYPE_SET.has("UNKNOWN")).toBe(false);
  });

  it("set size matches the tuple so every staging type is listed exactly once", () => {
    expect(TARIFF_IMPORT_STAGING_ROW_TYPE_SET.size).toBe(TARIFF_IMPORT_STAGING_ROW_TYPES.length);
    for (const t of TARIFF_IMPORT_STAGING_ROW_TYPES) {
      expect(TARIFF_IMPORT_STAGING_ROW_TYPE_SET.has(t)).toBe(true);
    }
  });
});

describe("import-pipeline normalized payload keys", () => {
  it("maps stable field names to matching JSON keys", () => {
    expect(TARIFF_IMPORT_NORMALIZED_PAYLOAD_KEYS.contractNumber).toBe("contractNumber");
    expect(TARIFF_IMPORT_NORMALIZED_PAYLOAD_KEYS.amount).toBe("amount");
  });

  it("uses unique string values for every normalized field", () => {
    const vals = Object.values(TARIFF_IMPORT_NORMALIZED_PAYLOAD_KEYS);
    expect(new Set(vals).size).toBe(vals.length);
  });
});
