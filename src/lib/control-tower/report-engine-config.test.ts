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

  it("forces openExceptions measure for exceptionRootCause dimension", () => {
    const config = sanitizeCtReportConfig({
      dimension: "exceptionRootCause",
      measure: "volumeCbm",
    });
    expect(config.measure).toBe("openExceptions");
  });

  it("applies defaults and clamps topN for invalid input", () => {
    expect(sanitizeCtReportConfig(null)).toMatchObject({
      chartType: "bar",
      dimension: "month",
      measure: "shipments",
      compareMeasure: null,
      dateField: "shippedAt",
      topN: 12,
    });
    expect(sanitizeCtReportConfig({ topN: 0 }).topN).toBe(1);
    expect(sanitizeCtReportConfig({ topN: 999 }).topN).toBe(50);
  });

  it("preserves bookingEta date field and compare measure when valid", () => {
    const config = sanitizeCtReportConfig({
      dateField: "bookingEta",
      compareMeasure: "onTimePct",
      title: "  R4  ",
    });
    expect(config.dateField).toBe("bookingEta");
    expect(config.compareMeasure).toBe("onTimePct");
    expect(config.title).toBe("R4");
  });

  it("parses filter flags and string fields", () => {
    const config = sanitizeCtReportConfig({
      filters: {
        status: "IN_TRANSIT",
        onlyOpenExceptions: true,
        lane: "USWC",
      },
    });
    expect(config.filters?.status).toBe("IN_TRANSIT");
    expect(config.filters?.onlyOpenExceptions).toBe(true);
    expect(config.filters?.lane).toBe("USWC");
  });
});
