import { describe, expect, it } from "vitest";

import {
  TARIFF_IMPORT_PARSE_STATUSES,
  TARIFF_IMPORT_PARSE_STATUS_SET,
  TARIFF_IMPORT_REVIEW_STATUSES,
  TARIFF_IMPORT_REVIEW_STATUS_SET,
  parseStatusLabel,
  reviewStatusLabel,
} from "./import-batch-statuses";

describe("parseStatusLabel", () => {
  it("maps known parse statuses", () => {
    expect(parseStatusLabel("PARSED_OK")).toBe("Parsed");
    expect(parseStatusLabel("PARSED_PARTIAL")).toBe("Parsed (partial)");
    expect(parseStatusLabel("PARSED_FAILED")).toBe("Parse failed");
  });

  it("falls back to raw string for unknown values", () => {
    expect(parseStatusLabel("FUTURE_STATUS")).toBe("FUTURE_STATUS");
  });
});

describe("reviewStatusLabel", () => {
  it("maps known review statuses", () => {
    expect(reviewStatusLabel("PENDING")).toBe("Pending review");
    expect(reviewStatusLabel("READY_TO_APPLY")).toBe("Ready to apply");
  });

  it("falls back to raw string for unknown values", () => {
    expect(reviewStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("status constants", () => {
  it("lists parse lifecycle keys", () => {
    expect(TARIFF_IMPORT_PARSE_STATUSES).toContain("UPLOADED");
    expect(TARIFF_IMPORT_PARSE_STATUSES).toContain("PARSED_OK");
  });

  it("lists review workflow keys", () => {
    expect(TARIFF_IMPORT_REVIEW_STATUSES).toContain("PENDING");
    expect(TARIFF_IMPORT_REVIEW_STATUSES).toContain("APPLIED");
  });

  it("exposes sets aligned with the canonical arrays (no duplicates)", () => {
    expect(TARIFF_IMPORT_PARSE_STATUS_SET.size).toBe(TARIFF_IMPORT_PARSE_STATUSES.length);
    expect(TARIFF_IMPORT_REVIEW_STATUS_SET.size).toBe(TARIFF_IMPORT_REVIEW_STATUSES.length);
    for (const s of TARIFF_IMPORT_PARSE_STATUSES) {
      expect(TARIFF_IMPORT_PARSE_STATUS_SET.has(s)).toBe(true);
    }
    for (const s of TARIFF_IMPORT_REVIEW_STATUSES) {
      expect(TARIFF_IMPORT_REVIEW_STATUS_SET.has(s)).toBe(true);
    }
  });
});
