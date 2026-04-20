import { describe, expect, it } from "vitest";

import {
  TARIFFS_MODULE_BASE_PATH,
  TARIFF_CONTRACTS_DIRECTORY_PATH,
  TARIFF_HELP_OPEN_PATHS,
  TARIFF_NEW_CONTRACT_PATH,
  TARIFF_RATING_PATH,
  tariffContractHeaderPath,
  tariffContractVersionPath,
  tariffGeographyGroupPath,
  tariffImportBatchPath,
  tariffLaneRatingPath,
} from "@/lib/tariff/tariff-workbench-urls";

describe("TARIFF_HELP_OPEN_PATHS", () => {
  it("has unique paths under the tariffs module", () => {
    expect(new Set(TARIFF_HELP_OPEN_PATHS).size).toBe(TARIFF_HELP_OPEN_PATHS.length);
    for (const p of TARIFF_HELP_OPEN_PATHS) {
      expect(p === TARIFFS_MODULE_BASE_PATH || p.startsWith(`${TARIFFS_MODULE_BASE_PATH}/`)).toBe(true);
    }
  });
});

describe("tariffContractHeaderPath", () => {
  it("builds header path under directory constant", () => {
    expect(tariffContractHeaderPath("hdr1")).toBe(`${TARIFF_CONTRACTS_DIRECTORY_PATH}/hdr1`);
  });
});

describe("TARIFF_NEW_CONTRACT_PATH", () => {
  it("lives under directory path", () => {
    expect(TARIFF_NEW_CONTRACT_PATH).toBe(`${TARIFF_CONTRACTS_DIRECTORY_PATH}/new`);
  });
});

describe("tariffLaneRatingPath", () => {
  it("returns base rating path without shipment", () => {
    expect(tariffLaneRatingPath()).toBe(TARIFF_RATING_PATH);
    expect(tariffLaneRatingPath({ shipmentId: null })).toBe(TARIFF_RATING_PATH);
  });

  it("appends shipmentId when provided", () => {
    expect(tariffLaneRatingPath({ shipmentId: "abc def" })).toBe(`${TARIFF_RATING_PATH}?shipmentId=abc%20def`);
  });
});

describe("tariffGeographyGroupPath / tariffImportBatchPath", () => {
  it("builds segment paths under module base", () => {
    expect(tariffGeographyGroupPath("g1")).toBe(`${TARIFFS_MODULE_BASE_PATH}/geography/g1`);
    expect(tariffImportBatchPath("b1")).toBe(`${TARIFFS_MODULE_BASE_PATH}/import/b1`);
  });
});

describe("tariffContractVersionPath", () => {
  it("returns base path without query when shipmentId omitted", () => {
    expect(tariffContractVersionPath("h1", "v1")).toBe(`${TARIFF_CONTRACTS_DIRECTORY_PATH}/h1/versions/v1`);
  });

  it("appends encoded shipmentId when provided", () => {
    expect(tariffContractVersionPath("h1", "v1", { shipmentId: "ship a/b" })).toBe(
      `${TARIFF_CONTRACTS_DIRECTORY_PATH}/h1/versions/v1?shipmentId=ship%20a%2Fb`,
    );
  });

  it("ignores blank shipmentId", () => {
    expect(tariffContractVersionPath("h1", "v1", { shipmentId: "   " })).toBe(
      `${TARIFF_CONTRACTS_DIRECTORY_PATH}/h1/versions/v1`,
    );
  });
});
