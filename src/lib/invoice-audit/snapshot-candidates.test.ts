import { describe, expect, it } from "vitest";

import demoInvoiceAuditSnapshotBreakdown from "../../../prisma/invoice-audit-demo-snapshot.breakdown.json";
import { DISCREPANCY_CATEGORY } from "@/lib/invoice-audit/discrepancy-categories";
import {
  extractSnapshotPriceCandidates,
  summarizeContractGeographyFromCandidates,
} from "@/lib/invoice-audit/snapshot-candidates";

describe("invoice audit demo seed snapshot fixture (prisma/invoice-audit-demo-snapshot.breakdown.json)", () => {
  it("parses for audit pipeline (kept in sync with db:seed:invoice-audit-demo auto-snapshot)", () => {
    const out = extractSnapshotPriceCandidates(demoInvoiceAuditSnapshotBreakdown);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.sourceType).toBe("QUOTE_RESPONSE");
    expect(out.candidates.filter((c) => c.kind === "RFQ_LINE")).toHaveLength(3);
    expect(out.rfqGrandTotal).toBe(3015);
    expect(out.contractGrandTotal).toBeNull();
    expect(out.rfqRouteLocodes?.pol).toBe("USNYC");
    expect(out.rfqRouteLocodes?.pod).toBe("DEHAM");
  });
});

describe("extractSnapshotPriceCandidates", () => {
  it("parses TARIFF_CONTRACT_VERSION rate and charge lines", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "TARIFF_CONTRACT_VERSION",
      rateLines: [
        {
          id: "r1",
          rateType: "FCL",
          equipmentType: "40HC",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "2100",
          originScope: { code: "USNYC" },
          destinationScope: { code: "DEHAM" },
        },
      ],
      chargeLines: [
        {
          id: "c1",
          rawChargeName: "THC origin",
          normalizedCode: "THC",
          equipmentScope: "40HC",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "185",
          isIncluded: false,
          isMandatory: true,
          geographyScope: { code: "USNYC" },
        },
      ],
      totals: { grand: 2285 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.sourceType).toBe("TARIFF_CONTRACT_VERSION");
    expect(out.rfqGrandTotal).toBeNull();
    expect(out.contractGrandTotal).toBe(2285);
    expect(out.rfqRouteLocodes).toBeNull();
    const rates = out.candidates.filter((c) => c.kind === "CONTRACT_RATE");
    const charges = out.candidates.filter((c) => c.kind === "CONTRACT_CHARGE");
    expect(rates).toHaveLength(1);
    expect(rates[0]!.equipmentHint).toBe("40HC");
    expect(rates[0]!.originCode).toBe("USNYC");
    expect(rates[0]!.destCode).toBe("DEHAM");
    expect(charges).toHaveLength(1);
    expect(charges[0]!.label).toContain("THC");
    expect(charges[0]!.equipmentHint).toBe("40HC");
    expect(charges[0]!.originCode).toBe("USNYC");
  });

  it("maps quoteRequest origin/destination labels to RFQ_LINE POL/POD hints (UN/LOCODE)", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "QUOTE_RESPONSE",
      quoteRequest: {
        originLabel: "Export USNYC / PANYNJ",
        destinationLabel: "DEHAM Hamburg",
      },
      lines: [
        {
          id: "l1",
          lineType: "FREIGHT",
          label: "Ocean FCL",
          amount: "3200",
          currency: "USD",
          unitBasis: "PER_CONTAINER",
          isIncluded: false,
        },
      ],
      totals: { grand: 3200 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.candidates[0]!.originCode).toBe("USNYC");
    expect(out.candidates[0]!.destCode).toBe("DEHAM");
    expect(out.rfqRouteLocodes).toEqual({ pol: "USNYC", pod: "DEHAM" });
  });

  it("parses QUOTE_RESPONSE lines and totals.grand", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "QUOTE_RESPONSE",
      lines: [
        {
          id: "l1",
          lineType: "FREIGHT",
          label: "Ocean FCL 40HC",
          amount: "3200",
          currency: "USD",
          unitBasis: "PER_CONTAINER",
          isIncluded: false,
          notes: "",
        },
      ],
      totals: { grand: 3250 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.rfqGrandTotal).toBe(3250);
    expect(out.contractGrandTotal).toBeNull();
    expect(out.candidates[0]!.kind).toBe("RFQ_LINE");
    expect(out.candidates[0]!.equipmentHint).toBe("40HC");
    expect(out.rfqRouteLocodes).toEqual({ pol: null, pod: null });
  });

  it("returns null contractGrandTotal when contract breakdown omits totals.grand", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "TARIFF_CONTRACT_VERSION",
      rateLines: [
        {
          id: "r1",
          rateType: "FCL",
          equipmentType: "40HC",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "100",
          originScope: null,
          destinationScope: null,
        },
      ],
      chargeLines: [],
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.contractGrandTotal).toBeNull();
    expect(out.rfqRouteLocodes).toBeNull();
  });

  it("summarizes contract FCL geography from candidates", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "TARIFF_CONTRACT_VERSION",
      rateLines: [
        {
          id: "r1",
          rateType: "FCL",
          equipmentType: "40HC",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "100",
          originScope: { code: "USNYC" },
          destinationScope: { code: "DEHAM" },
        },
        {
          id: "r2",
          rateType: "FCL",
          equipmentType: "20DV",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "80",
          originScope: { code: "USORF" },
          destinationScope: { code: "DEHAM" },
        },
      ],
      chargeLines: [],
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(summarizeContractGeographyFromCandidates(out.candidates)).toEqual({
      polCodes: ["USNYC", "USORF"],
      podCodes: ["DEHAM"],
    });
  });

  it("fails on unknown sourceType", () => {
    const out = extractSnapshotPriceCandidates({ sourceType: "OTHER", rateLines: [] });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.category).toBe(DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR);
  });

  it("fails when breakdownJson is not an object", () => {
    const out = extractSnapshotPriceCandidates(null);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.category).toBe(DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR);
    expect(out.error).toMatch(/not an object/i);
  });

  it("fails when QUOTE_RESPONSE snapshot has no lines array", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "QUOTE_RESPONSE",
      lines: "not-an-array",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.category).toBe(DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR);
    expect(out.error).toMatch(/lines/i);
  });

  it("returns null geography summary when only contract charges exist", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "TARIFF_CONTRACT_VERSION",
      rateLines: [],
      chargeLines: [
        {
          id: "c1",
          rawChargeName: "DOC FEE",
          normalizedCode: null,
          equipmentScope: null,
          unitBasis: "PER_SHIPMENT",
          currency: "USD",
          amount: "50",
          isIncluded: false,
          isMandatory: true,
          geographyScope: null,
        },
      ],
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(summarizeContractGeographyFromCandidates(out.candidates)).toBeNull();
  });

  it("flattens COMPOSITE_CONTRACT_VERSION components into contract candidates", () => {
    const out = extractSnapshotPriceCandidates({
      composite: true,
      compositeKind: "MULTI_CONTRACT_VERSION",
      mergedTotals: { grand: 2150 },
      components: [
        {
          role: "PRE_CARRIAGE",
          rateLines: [],
          chargeLines: [
            {
              id: "chg1",
              rawChargeName: "Pickup",
              normalizedCode: "PRE_CARRIAGE",
              equipmentScope: null,
              unitBasis: "PER_CONTAINER",
              currency: "USD",
              amount: "150",
              isIncluded: false,
              isMandatory: true,
              geographyScope: { code: "USNYC" },
            },
          ],
        },
        {
          role: "MAIN_OCEAN",
          rateLines: [
            {
              id: "r1",
              rateType: "FCL",
              equipmentType: "40HC",
              unitBasis: "PER_CONTAINER",
              currency: "USD",
              amount: "2000",
              originScope: { code: "USNYC" },
              destinationScope: { code: "DEHAM" },
            },
          ],
          chargeLines: [],
        },
      ],
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.sourceType).toBe("TARIFF_CONTRACT_VERSION");
    expect(out.contractGrandTotal).toBe(2150);
    const charges = out.candidates.filter((c) => c.kind === "CONTRACT_CHARGE");
    const rates = out.candidates.filter((c) => c.kind === "CONTRACT_RATE");
    expect(charges).toHaveLength(1);
    expect(charges[0]!.label).toContain("PRE_CARRIAGE");
    expect(rates).toHaveLength(1);
    expect(rates[0]!.label).toContain("MAIN_OCEAN");
  });
});
