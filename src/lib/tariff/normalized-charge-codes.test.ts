import { describe, expect, it } from "vitest";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

import {
  parseCreateNormalizedChargeCodeBody,
  parsePatchNormalizedChargeCodeBody,
} from "./normalized-charge-codes";
import { assertValidChargeCatalogCode, normalizeChargeCatalogCode } from "./normalized-charge-catalog-shared";

describe("normalizeChargeCatalogCode", () => {
  it("uppercases and collapses spaces to underscores", () => {
    expect(normalizeChargeCatalogCode("  wh handling  ")).toBe("WH_HANDLING");
  });
});

describe("assertValidChargeCatalogCode", () => {
  it("accepts valid codes", () => {
    expect(() => assertValidChargeCatalogCode("OHC")).not.toThrow();
    expect(() => assertValidChargeCatalogCode("DOC_FEE")).not.toThrow();
  });

  it("rejects invalid patterns", () => {
    expect(() => assertValidChargeCatalogCode("x")).toThrow(TariffRepoError);
    expect(() => assertValidChargeCatalogCode("bad-code!")).toThrow(TariffRepoError);
  });
});

describe("parseCreateNormalizedChargeCodeBody", () => {
  it("parses a minimal valid body", () => {
    const b = parseCreateNormalizedChargeCodeBody({
      code: "  doc_fee ",
      displayName: "Documentation",
      chargeFamily: "ADMIN_OTHER",
      transportMode: "OCEAN",
      isLocalCharge: true,
      isSurcharge: false,
    });
    expect(b.code).toBe("  doc_fee ");
    expect(b.displayName).toBe("Documentation");
    expect(b.chargeFamily).toBe("ADMIN_OTHER");
    expect(b.transportMode).toBe("OCEAN");
    expect(b.isLocalCharge).toBe(true);
    expect(b.isSurcharge).toBe(false);
  });

  it("rejects invalid chargeFamily", () => {
    expect(() =>
      parseCreateNormalizedChargeCodeBody({
        code: "X",
        displayName: "Y",
        chargeFamily: "NOT_A_FAMILY",
      }),
    ).toThrow(TariffRepoError);
  });
});

describe("parsePatchNormalizedChargeCodeBody", () => {
  it("parses displayName-only patch", () => {
    const p = parsePatchNormalizedChargeCodeBody({ displayName: "Updated" });
    expect(p.displayName).toBe("Updated");
  });

  it("rejects empty patch", () => {
    expect(() => parsePatchNormalizedChargeCodeBody({})).toThrow(TariffRepoError);
  });

  it("rejects non-boolean flags", () => {
    expect(() => parsePatchNormalizedChargeCodeBody({ active: "yes" as unknown as boolean })).toThrow(
      TariffRepoError,
    );
  });
});
