import { TariffGeographyType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { TARIFF_GEOGRAPHY_TYPES_ORDERED, tariffGeographyTypeLabel } from "./geography-labels";

describe("tariffGeographyTypeLabel", () => {
  it("maps every ordered type to a non-empty human label", () => {
    for (const t of TARIFF_GEOGRAPHY_TYPES_ORDERED) {
      const label = tariffGeographyTypeLabel(t);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(t);
    }
  });

  it("covers all Prisma TariffGeographyType variants", () => {
    const all = Object.values(TariffGeographyType) as TariffGeographyType[];
    expect(new Set(TARIFF_GEOGRAPHY_TYPES_ORDERED)).toEqual(new Set(all));
  });
});
