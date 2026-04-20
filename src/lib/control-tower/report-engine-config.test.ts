import { describe, expect, it } from "vitest";

import { sanitizeCtReportConfig } from "./report-engine";

describe("sanitizeCtReportConfig", () => {
  it("keeps exceptionCode filter when provided", () => {
    const config = sanitizeCtReportConfig({
      filters: { exceptionCode: "LATE_DOC" },
    });
    expect(config.filters?.exceptionCode).toBe("LATE_DOC");
  });

  it("forces openExceptions measure for exceptionCatalog dimension", () => {
    const config = sanitizeCtReportConfig({
      dimension: "exceptionCatalog",
      measure: "shipments",
    });
    expect(config.measure).toBe("openExceptions");
  });
});
