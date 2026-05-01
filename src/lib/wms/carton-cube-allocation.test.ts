import { describe, expect, it } from "vitest";

import { fungibleWaveSlot } from "./allocation-strategy";
import {
  binCubeInsufficientTier,
  computeCartonCubeMm3,
  estimatePickCubeMm3,
  orderPickSlotsMinBinTouchesCubeAware,
  orderPickSlotsMinBinTouchesReservePickFaceCubeAware,
} from "./carton-cube-allocation";

describe("computeCartonCubeMm3", () => {
  it("returns L×W×H when all positive integers", () => {
    expect(computeCartonCubeMm3(100, 200, 300)).toBe(100 * 200 * 300);
  });

  it("returns null when any dimension missing or non-positive", () => {
    expect(computeCartonCubeMm3(null, 1, 1)).toBeNull();
    expect(computeCartonCubeMm3(1, 0, 1)).toBeNull();
  });
});

describe("estimatePickCubeMm3", () => {
  const hints = {
    cartonLengthMm: 10,
    cartonWidthMm: 10,
    cartonHeightMm: 10,
    cartonUnitsPerMasterCarton: 5,
  };

  it("uses ceil(qty/units) × carton cube", () => {
    const cartonCube = 1000;
    expect(estimatePickCubeMm3(11, hints)).toBe(3 * cartonCube);
    expect(estimatePickCubeMm3(10, hints)).toBe(2 * cartonCube);
  });

  it("defaults units-per-carton to 1 when unset", () => {
    expect(
      estimatePickCubeMm3(3, {
        cartonLengthMm: 2,
        cartonWidthMm: 3,
        cartonHeightMm: 4,
        cartonUnitsPerMasterCarton: null,
      }),
    ).toBe(3 * 24);
  });
});

describe("binCubeInsufficientTier", () => {
  it("is 1 only when both pick cube and bin capacity known and pick exceeds bin", () => {
    expect(binCubeInsufficientTier(100, 200)).toBe(0);
    expect(binCubeInsufficientTier(300, 200)).toBe(1);
    expect(binCubeInsufficientTier(300, null)).toBe(0);
    expect(binCubeInsufficientTier(null, 50)).toBe(0);
  });
});

describe("orderPickSlotsMinBinTouchesCubeAware", () => {
  const hints = {
    cartonLengthMm: 100,
    cartonWidthMm: 100,
    cartonHeightMm: 100,
    cartonUnitsPerMasterCarton: 100,
  };
  /** One carton = 1e6 mm³; remaining 50 units → one carton. */
  const R = 50;

  it("deprioritizes bins with insufficient capacity vs estimated pick cube before BF-15 tie-break", () => {
    const bins = [
      fungibleWaveSlot({
        binId: "tight",
        binCode: "T",
        available: 100,
        binCapacityCubeMm3: 500_000,
      }),
      fungibleWaveSlot({
        binId: "roomy",
        binCode: "R",
        available: 10,
        binCapacityCubeMm3: 2_000_000,
      }),
    ];
    const ordered = orderPickSlotsMinBinTouchesCubeAware(bins, R, hints);
    expect(ordered.map((s) => s.binId)).toEqual(["roomy", "tight"]);
  });

  it("falls back to BF-15 when hints do not yield pick cube", () => {
    const bins = [
      fungibleWaveSlot({ binId: "a", binCode: "A", available: 5 }),
      fungibleWaveSlot({ binId: "b", binCode: "B", available: 20 }),
    ];
    const ordered = orderPickSlotsMinBinTouchesCubeAware(bins, 10, {
      cartonLengthMm: null,
      cartonWidthMm: 10,
      cartonHeightMm: 10,
      cartonUnitsPerMasterCarton: 1,
    });
    expect(ordered[0]?.binId).toBe("b");
  });
});

describe("orderPickSlotsMinBinTouchesReservePickFaceCubeAware", () => {
  const hints = {
    cartonLengthMm: 10,
    cartonWidthMm: 10,
    cartonHeightMm: 10,
    cartonUnitsPerMasterCarton: 100,
  };

  it("applies cube tier then BF-23 pick-face preference", () => {
    const bins = [
      fungibleWaveSlot({
        binId: "faceBig",
        binCode: "F",
        available: 50,
        isPickFace: true,
        binCapacityCubeMm3: 10_000,
      }),
      fungibleWaveSlot({
        binId: "bulkOk",
        binCode: "B",
        available: 50,
        isPickFace: false,
        binCapacityCubeMm3: 10_000,
      }),
    ];
    const ordered = orderPickSlotsMinBinTouchesReservePickFaceCubeAware(bins, 40, hints);
    expect(ordered[0]?.binId).toBe("bulkOk");
  });
});
