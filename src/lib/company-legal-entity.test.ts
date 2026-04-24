import { describe, expect, it } from "vitest";

import {
  assertMergedEffectiveDateRange,
  isOrgUnitKindLegalEntity,
  parseCreateCompanyLegalBody,
  parsePatchCompanyLegalBody,
} from "@/lib/company-legal-entity";

describe("company-legal-entity", () => {
  it("isOrgUnitKindLegalEntity", () => {
    expect(isOrgUnitKindLegalEntity("LEGAL_ENTITY")).toBe(true);
    expect(isOrgUnitKindLegalEntity("REGION")).toBe(false);
  });

  it("parseCreateCompanyLegalBody requires org and name", () => {
    expect(parseCreateCompanyLegalBody({}).ok).toBe(false);
    expect(parseCreateCompanyLegalBody({ orgUnitId: "x" }).ok).toBe(false);
    const ok = parseCreateCompanyLegalBody({
      orgUnitId: "ou1",
      registeredLegalName: "ACME GmbH",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.registeredLegalName).toBe("ACME GmbH");
      expect(ok.value.status).toBe("ACTIVE");
    }
  });

  it("parseCreateCompanyLegalBody rejects bad country code", () => {
    const r = parseCreateCompanyLegalBody({
      orgUnitId: "ou1",
      registeredLegalName: "ACME GmbH",
      addressCountryCode: "DEU",
    });
    expect(r.ok).toBe(false);
  });

  it("assertMergedEffectiveDateRange", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2025-01-01T00:00:00.000Z");
    expect(
      assertMergedEffectiveDateRange(
        { effectiveFrom: null, effectiveTo: null },
        { effectiveFrom: from, effectiveTo: to },
      ).ok,
    ).toBe(false);
    expect(
      assertMergedEffectiveDateRange(
        { effectiveFrom: from, effectiveTo: null },
        { effectiveTo: new Date("2026-12-31T00:00:00.000Z") },
      ).ok,
    ).toBe(true);
  });

  it("parsePatchCompanyLegalBody rejects empty update", () => {
    const r = parsePatchCompanyLegalBody({});
    expect(r.ok).toBe(false);
  });

  it("parsePatchCompanyLegalBody updates one field", () => {
    const r = parsePatchCompanyLegalBody({ tradeName: "New" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.tradeName).toBe("New");
  });
});
