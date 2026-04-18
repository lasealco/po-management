import { describe, expect, it } from "vitest";

import { buildRfqCompareRows } from "@/lib/rfq/build-compare-rows";
import type { getQuoteRequestDetail } from "@/lib/rfq/quote-requests";

type QuoteDetail = Awaited<ReturnType<typeof getQuoteRequestDetail>>;

function mockResponse(p: {
  id: string;
  status: string;
  totalAllInAmount?: number | null;
  currency?: string;
}) {
  return {
    id: p.id,
    status: p.status,
    totalAllInAmount: p.totalAllInAmount ?? null,
    currency: p.currency ?? "USD",
    validityFrom: new Date("2026-01-01"),
    validityTo: new Date("2026-06-01"),
    includedChargesJson: null,
    excludedChargesJson: null,
    freeTimeSummaryJson: null,
    lines: [],
  };
}

function mockDetail(recipients: unknown[]): QuoteDetail {
  return { recipients } as QuoteDetail;
}

describe("buildRfqCompareRows", () => {
  it("flags lowest and delta when two numeric totals share a currency", () => {
    const rows = buildRfqCompareRows(
      mockDetail([
        { displayName: "Alpha", response: mockResponse({ id: "r1", status: "SUBMITTED", totalAllInAmount: 1000 }) },
        { displayName: "Beta", response: mockResponse({ id: "r2", status: "SUBMITTED", totalAllInAmount: 1150.5 }) },
      ]),
    );
    expect(rows).toHaveLength(2);
    const alpha = rows.find((x) => x.responseId === "r1");
    const beta = rows.find((x) => x.responseId === "r2");
    expect(alpha?.peerBenchmarkLabel).toBe("Lowest");
    expect(alpha?.peerBenchmarkTone).toBe("lowest");
    expect(beta?.peerBenchmarkLabel).toMatch(/^\+150\.5 vs low$/);
    expect(beta?.peerBenchmarkTone).toBe("delta");
  });

  it("does not benchmark when fewer than two numeric totals in a currency", () => {
    const rows = buildRfqCompareRows(
      mockDetail([
        { displayName: "Alpha", response: mockResponse({ id: "r1", status: "SUBMITTED", totalAllInAmount: 1000 }) },
        {
          displayName: "Beta",
          response: mockResponse({ id: "r2", status: "SUBMITTED", totalAllInAmount: null }),
        },
      ]),
    );
    expect(rows.every((r) => r.peerBenchmarkLabel == null)).toBe(true);
  });

  it("computes min per currency independently", () => {
    const rows = buildRfqCompareRows(
      mockDetail([
        {
          displayName: "EUR low",
          response: mockResponse({
            id: "e1",
            status: "SUBMITTED",
            totalAllInAmount: 900,
            currency: "EUR",
          }),
        },
        {
          displayName: "EUR high",
          response: mockResponse({
            id: "e2",
            status: "SUBMITTED",
            totalAllInAmount: 1000,
            currency: "EUR",
          }),
        },
        {
          displayName: "USD only",
          response: mockResponse({
            id: "u1",
            status: "SUBMITTED",
            totalAllInAmount: 50,
            currency: "USD",
          }),
        },
      ]),
    );
    const usd = rows.find((r) => r.responseId === "u1");
    expect(usd?.peerBenchmarkLabel).toBeNull();
    const eurLow = rows.find((r) => r.responseId === "e1");
    expect(eurLow?.peerBenchmarkLabel).toBe("Lowest");
  });
});
