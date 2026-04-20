import { describe, expect, it } from "vitest";

import {
  TARIFF_IMPORT_NORMALIZED_PAYLOAD_KEYS,
  TARIFF_IMPORT_STAGING_ROW_TYPE_SET,
  TARIFF_IMPORT_STAGING_ROW_TYPES,
} from "@/lib/tariff/import-pipeline";

describe("import-pipeline staging row types", () => {
  it("includes documented row types", () => {
    expect(TARIFF_IMPORT_STAGING_ROW_TYPES).toContain("RATE_LINE_CANDIDATE");
    expect(TARIFF_IMPORT_STAGING_ROW_TYPES).toContain("CHARGE_LINE_CANDIDATE");
  });

  it("exposes a set for validation", () => {
    expect(TARIFF_IMPORT_STAGING_ROW_TYPE_SET.has("RAW_ROW")).toBe(true);
    expect(TARIFF_IMPORT_STAGING_ROW_TYPE_SET.has("UNKNOWN")).toBe(false);
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
