import { TariffSourceType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { TARIFF_CONTRACT_VERSION_SOURCE_TYPES, TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET } from "./contract-version-source-types";

describe("TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET", () => {
  it("contains every declared source type", () => {
    for (const t of TARIFF_CONTRACT_VERSION_SOURCE_TYPES) {
      expect(TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET.has(t)).toBe(true);
    }
  });

  it("has no extras beyond the tuple", () => {
    expect(TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET.size).toBe(TARIFF_CONTRACT_VERSION_SOURCE_TYPES.length);
  });

  it("matches Prisma TariffSourceType enum values", () => {
    const prismaVals = Object.values(TariffSourceType);
    expect(new Set(prismaVals)).toEqual(new Set(TARIFF_CONTRACT_VERSION_SOURCE_TYPES));
  });
});
