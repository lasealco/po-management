import { describe, expect, it } from "vitest";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

import { assertTariffGeographyValidityWindow } from "./geography-groups";

describe("assertTariffGeographyValidityWindow", () => {
  it("allows null bounds", () => {
    expect(() => assertTariffGeographyValidityWindow(null, null)).not.toThrow();
    expect(() => assertTariffGeographyValidityWindow(new Date("2024-01-01"), null)).not.toThrow();
  });

  it("allows same-day window", () => {
    const d = new Date("2024-06-01T00:00:00.000Z");
    expect(() => assertTariffGeographyValidityWindow(d, d)).not.toThrow();
  });

  it("rejects validFrom after validTo", () => {
    expect(() =>
      assertTariffGeographyValidityWindow(new Date("2024-12-01"), new Date("2024-01-01")),
    ).toThrow(TariffRepoError);
  });
});
