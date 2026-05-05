import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  estimateBalanceOccupiedCubeMmBf86,
  parseCapacityUtilizationSnapshotQueryBf86,
} from "./capacity-utilization-snapshot-bf86";

describe("capacity-utilization-snapshot-bf86", () => {
  it("parseCapacityUtilizationSnapshotQueryBf86 requires warehouse", () => {
    const bad = parseCapacityUtilizationSnapshotQueryBf86(new URLSearchParams({}));
    expect(bad.ok).toBe(false);
    const ok = parseCapacityUtilizationSnapshotQueryBf86(
      new URLSearchParams({ warehouseId: "wh1", days: "14", limitBins: "50", sort: "utilization" }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.warehouseId).toBe("wh1");
      expect(ok.value.windowDays).toBe(14);
      expect(ok.value.limitBins).toBe(50);
      expect(ok.value.sort).toBe("utilization_desc");
    }
  });

  it("estimateBalanceOccupiedCubeMmBf86 uses carton cube × carton count", () => {
    const mm = estimateBalanceOccupiedCubeMmBf86({
      onHandQty: new Prisma.Decimal("100"),
      cartonLengthMm: 1000,
      cartonWidthMm: 1000,
      cartonHeightMm: 1000,
      cartonUnitsPerMasterCarton: new Prisma.Decimal("10"),
    });
    expect(mm).toBe(10 * 1e9);
  });

  it("returns null when carton incomplete", () => {
    expect(
      estimateBalanceOccupiedCubeMmBf86({
        onHandQty: new Prisma.Decimal("10"),
        cartonLengthMm: null,
        cartonWidthMm: 100,
        cartonHeightMm: 100,
        cartonUnitsPerMasterCarton: new Prisma.Decimal("10"),
      }),
    ).toBe(null);
  });
});
