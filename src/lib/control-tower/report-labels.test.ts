import { describe, expect, it } from "vitest";

import {
  dateFieldLabel,
  dimensionLabel,
  formatReportDateWindowLine,
  metricLabel,
} from "./report-labels";

describe("metricLabel", () => {
  it("maps known measures", () => {
    expect(metricLabel("onTimePct")).toBe("On-time %");
    expect(metricLabel("shippingSpend")).toBe("Shipping spend (est.)");
  });

  it("defaults unknown measures to Shipments", () => {
    expect(metricLabel("custom")).toBe("Shipments");
  });
});

describe("dimensionLabel", () => {
  it("maps known dimensions", () => {
    expect(dimensionLabel("lane")).toBe("Lane (origin → destination)");
    expect(dimensionLabel("none")).toBe("All");
  });

  it("defaults unknown dimensions", () => {
    expect(dimensionLabel("foo")).toBe("Category");
  });
});

describe("dateFieldLabel", () => {
  it("maps known fields and passes through others", () => {
    expect(dateFieldLabel("shippedAt")).toBe("Ship date");
    expect(dateFieldLabel("custom")).toBe("custom");
  });
});

describe("formatReportDateWindowLine", () => {
  it("returns null when both bounds empty", () => {
    expect(
      formatReportDateWindowLine({ dateField: "shippedAt", dateFrom: null, dateTo: "  " }),
    ).toBeNull();
  });

  it("formats both bounds with shortened ISO dates", () => {
    const line = formatReportDateWindowLine({
      dateField: "receivedAt",
      dateFrom: "2024-01-01T12:00:00.000Z",
      dateTo: "2024-01-31",
    });
    expect(line).toBe("Date window (Received date, UTC): 2024-01-01 … 2024-01-31");
  });

  it("formats from-only and until-only", () => {
    expect(
      formatReportDateWindowLine({ dateField: "bookingEta", dateFrom: "2024-06-01", dateTo: null }),
    ).toBe("Date window (Booking ETA, UTC): from 2024-06-01");
    expect(
      formatReportDateWindowLine({ dateField: "shippedAt", dateFrom: null, dateTo: "2024-12-31" }),
    ).toBe("Date window (Ship date, UTC): until 2024-12-31");
  });

  it("truncates long non-ISO strings", () => {
    const long = "x".repeat(60);
    const line = formatReportDateWindowLine({
      dateField: "shippedAt",
      dateFrom: long,
      dateTo: null,
    });
    expect(line).toContain("…");
    expect(line!.length).toBeLessThan(long.length + 80);
  });
});
