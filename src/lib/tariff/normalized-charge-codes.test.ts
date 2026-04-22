import type { TariffNormalizedChargeCode } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

import {
  parseCreateNormalizedChargeCodeBody,
  parsePatchNormalizedChargeCodeBody,
  toChargeCatalogRowJson,
} from "./normalized-charge-codes";
import { assertValidChargeCatalogCode, normalizeChargeCatalogCode } from "./normalized-charge-catalog-shared";

describe("normalizeChargeCatalogCode", () => {
  it("uppercases and collapses spaces to underscores", () => {
    expect(normalizeChargeCatalogCode("  wh handling  ")).toBe("WH_HANDLING");
  });

  it("collapses other whitespace runs to a single underscore", () => {
    expect(normalizeChargeCatalogCode("a\tb\nc")).toBe("A_B_C");
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

  it("allows explicit null transportMode and rejects invalid modes", () => {
    const b = parseCreateNormalizedChargeCodeBody({
      code: "AB",
      displayName: "Name",
      chargeFamily: "ADMIN_OTHER",
      transportMode: null,
    });
    expect(b.transportMode).toBeNull();

    expect(() =>
      parseCreateNormalizedChargeCodeBody({
        code: "AB",
        displayName: "Name",
        chargeFamily: "ADMIN_OTHER",
        transportMode: "SEA",
      }),
    ).toThrow(/Invalid transportMode/);
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

  it("accepts transportMode null to clear mode", () => {
    const p = parsePatchNormalizedChargeCodeBody({ transportMode: null });
    expect(p.transportMode).toBeNull();
  });

  it("rejects invalid transportMode on patch", () => {
    expect(() => parsePatchNormalizedChargeCodeBody({ transportMode: "INVALID" })).toThrow(/Invalid transportMode/);
  });
});

describe("toChargeCatalogRowJson", () => {
  it("maps Prisma row fields to API JSON without extra keys", () => {
    const row = {
      id: "cc-1",
      code: "DOC",
      displayName: "Documentation",
      chargeFamily: "ADMIN_OTHER",
      transportMode: "OCEAN",
      isLocalCharge: true,
      isSurcharge: false,
      active: true,
    } as unknown as TariffNormalizedChargeCode;
    expect(toChargeCatalogRowJson(row)).toEqual({
      id: "cc-1",
      code: "DOC",
      displayName: "Documentation",
      chargeFamily: "ADMIN_OTHER",
      transportMode: "OCEAN",
      isLocalCharge: true,
      isSurcharge: false,
      active: true,
    });
  });
});
