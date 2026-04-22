import { TariffApprovalStatus, TariffContractStatus, TariffTransportMode } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  TARIFF_APPROVAL_STATUS_SET,
  TARIFF_CONTRACT_HEADER_STATUS_SET,
  TARIFF_TRANSPORT_MODE_SET,
} from "./tariff-enum-sets";

describe("tariff-enum-sets", () => {
  it("transport modes cover the Prisma enum", () => {
    for (const v of Object.values(TariffTransportMode)) {
      expect(TARIFF_TRANSPORT_MODE_SET.has(v)).toBe(true);
    }
    expect(TARIFF_TRANSPORT_MODE_SET.size).toBe(Object.values(TariffTransportMode).length);
  });

  it("contract statuses cover the Prisma enum", () => {
    for (const v of Object.values(TariffContractStatus)) {
      expect(TARIFF_CONTRACT_HEADER_STATUS_SET.has(v)).toBe(true);
    }
  });

  it("approval statuses cover the Prisma enum", () => {
    for (const v of Object.values(TariffApprovalStatus)) {
      expect(TARIFF_APPROVAL_STATUS_SET.has(v)).toBe(true);
    }
  });
});
