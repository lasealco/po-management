import { describe, expect, it } from "vitest";

import { TariffRepoError } from "./tariff-repo-error";
import {
  assertTariffVersionAllowsLineMutations,
  assertTariffVersionRowMutable,
  isTariffContractVersionFrozen,
} from "./version-guards";

describe("isTariffContractVersionFrozen", () => {
  it("is true only when approval and contract status are both APPROVED", () => {
    expect(isTariffContractVersionFrozen({ approvalStatus: "APPROVED", status: "APPROVED" })).toBe(true);
    expect(isTariffContractVersionFrozen({ approvalStatus: "APPROVED", status: "DRAFT" })).toBe(false);
    expect(isTariffContractVersionFrozen({ approvalStatus: "PENDING", status: "APPROVED" })).toBe(false);
    expect(isTariffContractVersionFrozen({ approvalStatus: "NOT_REQUIRED", status: "DRAFT" })).toBe(false);
  });
});

describe("assertTariffVersionAllowsLineMutations", () => {
  it("throws VERSION_FROZEN when the version is frozen", () => {
    try {
      assertTariffVersionAllowsLineMutations({ approvalStatus: "APPROVED", status: "APPROVED" });
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TariffRepoError);
      expect((e as TariffRepoError).code).toBe("VERSION_FROZEN");
      expect((e as TariffRepoError).message).toMatch(/rate lines, charge lines, and free-time rules cannot be changed/);
    }
  });

  it("allows mutations when not fully approved", () => {
    expect(() =>
      assertTariffVersionAllowsLineMutations({ approvalStatus: "NOT_REQUIRED", status: "DRAFT" }),
    ).not.toThrow();
  });
});

describe("assertTariffVersionRowMutable", () => {
  it("throws VERSION_FROZEN when the version is frozen", () => {
    try {
      assertTariffVersionRowMutable({ approvalStatus: "APPROVED", status: "APPROVED" });
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TariffRepoError);
      expect((e as TariffRepoError).code).toBe("VERSION_FROZEN");
      expect((e as TariffRepoError).message).toMatch(/the version record cannot be updated/);
    }
  });

  it("allows updates when not fully approved", () => {
    expect(() => assertTariffVersionRowMutable({ approvalStatus: "PENDING", status: "UNDER_REVIEW" })).not.toThrow();
  });
});
