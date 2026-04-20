import { describe, expect, it } from "vitest";

import { TARIFF_IMPORT_STAGING_ROW_TYPE_SET, TARIFF_IMPORT_STAGING_ROW_TYPES } from "@/lib/tariff/import-pipeline";

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
