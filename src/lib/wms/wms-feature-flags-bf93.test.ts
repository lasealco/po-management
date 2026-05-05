import { describe, expect, it } from "vitest";

import {
  extractWmsFeatureFlagsBf93FlagBag,
  mapWmsFeatureFlagsBf93ForPayload,
  validateWmsFeatureFlagsBf93FromPost,
  validateWmsFeatureFlagsBf93StoredDocument,
  WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION,
} from "./wms-feature-flags-bf93";

describe("validateWmsFeatureFlagsBf93FromPost", () => {
  it("accepts nested flags object", () => {
    const r = validateWmsFeatureFlagsBf93FromPost({ flags: { rollWaveUi: true, pilotTier: "B" } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.doc.schemaVersion).toBe(WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION);
      expect(r.doc.flags.rollWaveUi).toBe(true);
      expect(r.doc.flags.pilotTier).toBe("B");
    }
  });

  it("accepts flat bag", () => {
    const r = validateWmsFeatureFlagsBf93FromPost({ foo: false, schemaVersion: "ignored" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc.flags.foo).toBe(false);
  });

  it("rejects invalid keys", () => {
    const r = validateWmsFeatureFlagsBf93FromPost({ "9bad": true });
    expect(r.ok).toBe(false);
  });

  it("rejects nested flag values", () => {
    const r = validateWmsFeatureFlagsBf93FromPost({ flags: { x: { nested: 1 } } });
    expect(r.ok).toBe(false);
  });
});

describe("validateWmsFeatureFlagsBf93StoredDocument", () => {
  it("requires bf93.v1 envelope", () => {
    expect(
      validateWmsFeatureFlagsBf93StoredDocument({
        schemaVersion: WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION,
        flags: {},
      }).ok,
    ).toBe(true);
    expect(validateWmsFeatureFlagsBf93StoredDocument({ flags: {} }).ok).toBe(false);
  });
});

describe("mapWmsFeatureFlagsBf93ForPayload", () => {
  it("returns null for unset column", () => {
    expect(mapWmsFeatureFlagsBf93ForPayload(undefined)).toBe(null);
  });

  it("surfaces parse errors", () => {
    const m = mapWmsFeatureFlagsBf93ForPayload({ schemaVersion: "wrong", flags: {} });
    expect(m?.parseError).toBeTruthy();
    expect(Object.keys(m?.flags ?? {}).length).toBe(0);
  });
});

describe("extractWmsFeatureFlagsBf93FlagBag", () => {
  it("returns null for arrays", () => {
    expect(extractWmsFeatureFlagsBf93FlagBag([])).toBe(null);
  });
});
