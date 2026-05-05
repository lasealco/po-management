import { describe, expect, it } from "vitest";

import { fungibleWaveSlot } from "./allocation-strategy";
import {
  binCubeInsufficientTier,
  computeCartonCubeMm3,
  effectivePickCartonCapBf89,
  estimatePickCubeMm3,
  estimatePickCubeMm3Bf89,
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

describe("effectivePickCartonCapBf89", () => {
  it("returns min of warehouse cap and per-SKU slice when both set", () => {
    expect(effectivePickCartonCapBf89(48, 12)).toBe(12);
    expect(effectivePickCartonCapBf89(48, "12")).toBe(12);
  });

  it("returns whichever side is present", () => {
    expect(effectivePickCartonCapBf89(48, null)).toBe(48);
    expect(effectivePickCartonCapBf89(null, 24)).toBe(24);
    expect(effectivePickCartonCapBf89(undefined, undefined)).toBeNull();
  });
});

describe("estimatePickCubeMm3Bf89", () => {
  it("prefers master carton estimate when dims resolve", () => {
    const r = estimatePickCubeMm3Bf89(10, {
      cartonLengthMm: 10,
      cartonWidthMm: 10,
      cartonHeightMm: 10,
      cartonUnitsPerMasterCarton: 5,
    });
    expect(r.source).toBe("master_carton");
    expect(r.cubeMm3).toBe(2 * 1000);
  });

  it("uses unit cm³ when master carton estimate is unavailable", () => {
    const r = estimatePickCubeMm3Bf89(4, {
      cartonLengthMm: null,
      cartonWidthMm: null,
      cartonHeightMm: null,
      cartonUnitsPerMasterCarton: null,
      wmsUnitCubeCm3Bf89: 25,
    });
    expect(r.source).toBe("unit_bf89");
    expect(r.cubeMm3).toBe(100_000);
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

  it("prefers cross-dock staging within the same cube-feasibility tier", () => {
    const bins = [
      fungibleWaveSlot({
        binId: "norm",
        binCode: "N",
        available: 50,
        binCapacityCubeMm3: 10_000,
      }),
      fungibleWaveSlot({
        binId: "xd",
        binCode: "X",
        available: 50,
        binCapacityCubeMm3: 10_000,
        isCrossDockStaging: true,
      }),
    ];
    const ordered = orderPickSlotsMinBinTouchesCubeAware(bins, R, hints);
    expect(ordered[0]?.binId).toBe("xd");
  });

  it("uses BF-89 unit cube when master dims cannot estimate pick cube", () => {
    const bins = [
      fungibleWaveSlot({
        binId: "tight",
        binCode: "T",
        available: 100,
        binCapacityCubeMm3: 80_000,
      }),
      fungibleWaveSlot({
        binId: "roomy",
        binCode: "R",
        available: 100,
        binCapacityCubeMm3: 500_000,
      }),
    ];
    const ordered = orderPickSlotsMinBinTouchesCubeAware(bins, 10, {
      cartonLengthMm: null,
      cartonWidthMm: null,
      cartonHeightMm: null,
      cartonUnitsPerMasterCarton: null,
      wmsUnitCubeCm3Bf89: 40,
    });
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
