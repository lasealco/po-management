import { describe, expect, it } from "vitest";

import { parseAttachTariffApplicationRequestBody } from "@/lib/tariff/attach-tariff-application-request-body";

describe("parseAttachTariffApplicationRequestBody", () => {
  it("accepts minimal payload with defaults", () => {
    expect(parseAttachTariffApplicationRequestBody({ contractVersionId: "  ver_1  " })).toEqual({
      ok: true,
      body: {
        contractVersionId: "ver_1",
        isPrimary: true,
        source: "MANUAL",
        polCode: null,
        podCode: null,
        equipmentType: null,
        appliedNotes: null,
      },
    });
  });

  it("passes through optional fields", () => {
    const r = parseAttachTariffApplicationRequestBody({
      contractVersionId: "v1",
      isPrimary: false,
      source: "RATING_ENGINE",
      polCode: "DEHAM",
      podCode: "USCHI",
      equipmentType: "40HC",
      appliedNotes: "note",
    });
    expect(r).toEqual({
      ok: true,
      body: {
        contractVersionId: "v1",
        isPrimary: false,
        source: "RATING_ENGINE",
        polCode: "DEHAM",
        podCode: "USCHI",
        equipmentType: "40HC",
        appliedNotes: "note",
      },
    });
  });

  it("defaults isPrimary and source when types are not boolean or string", () => {
    expect(
      parseAttachTariffApplicationRequestBody({
        contractVersionId: "v1",
        isPrimary: "yes",
        source: 404,
      }),
    ).toEqual({
      ok: true,
      body: {
        contractVersionId: "v1",
        isPrimary: true,
        source: "MANUAL",
        polCode: null,
        podCode: null,
        equipmentType: null,
        appliedNotes: null,
      },
    });
  });

  it("ignores non-string optional UNLOC and equipment fields", () => {
    const r = parseAttachTariffApplicationRequestBody({
      contractVersionId: "v1",
      polCode: 12345,
      podCode: null,
      equipmentType: ["40HC"],
      appliedNotes: true,
    } as unknown);
    expect(r).toEqual({
      ok: true,
      body: {
        contractVersionId: "v1",
        isPrimary: true,
        source: "MANUAL",
        polCode: null,
        podCode: null,
        equipmentType: null,
        appliedNotes: null,
      },
    });
  });

  it("rejects non-objects and empty contractVersionId", () => {
    expect(parseAttachTariffApplicationRequestBody(null)).toEqual({
      ok: false,
      error: "Expected object body.",
    });
    expect(parseAttachTariffApplicationRequestBody({})).toEqual({
      ok: false,
      error: "contractVersionId is required.",
    });
    expect(parseAttachTariffApplicationRequestBody({ contractVersionId: "   " })).toEqual({
      ok: false,
      error: "contractVersionId is required.",
    });
    expect(parseAttachTariffApplicationRequestBody({ contractVersionId: 1 })).toEqual({
      ok: false,
      error: "contractVersionId is required.",
    });
  });
});
