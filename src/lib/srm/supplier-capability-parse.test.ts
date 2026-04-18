import { describe, expect, it } from "vitest";

import {
  parseCapabilityCreateBody,
  parseCapabilityPatchBody,
  parseModeForCreate,
  parseModeForPatch,
} from "./supplier-capability-parse";

describe("parseModeForCreate", () => {
  it("accepts null and explicit modes", () => {
    expect(parseModeForCreate(null)).toBeNull();
    expect(parseModeForCreate("")).toBeNull();
    expect(parseModeForCreate("ocean")).toBe("OCEAN");
    expect(parseModeForCreate("AIR")).toBe("AIR");
  });
  it("rejects unknown modes", () => {
    expect(parseModeForCreate("SEA")).toBe("__invalid__");
    expect(parseModeForCreate(1)).toBe("__invalid__");
  });
});

describe("parseModeForPatch", () => {
  it("clears with empty", () => {
    expect(parseModeForPatch("")).toBeNull();
    expect(parseModeForPatch(null)).toBeNull();
  });
  it("rejects empty-string-equivalent invalid types", () => {
    expect(parseModeForPatch("INVALID")).toBe("__invalid__");
  });
});

describe("parseCapabilityCreateBody", () => {
  it("requires serviceType", () => {
    const r = parseCapabilityCreateBody({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/serviceType/i);
  });
  it("parses a minimal valid payload", () => {
    const r = parseCapabilityCreateBody({
      serviceType: " Customs brokerage ",
      mode: "road",
      geography: "EU",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.serviceType).toBe("Customs brokerage");
      expect(r.data.mode).toBe("ROAD");
      expect(r.data.geography).toBe("EU");
      expect(r.data.subMode).toBeNull();
      expect(r.data.notes).toBeNull();
    }
  });
  it("honors notes when present", () => {
    const r = parseCapabilityCreateBody({ serviceType: "X", notes: "  hello  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.notes).toBe("hello");
  });
});

describe("parseCapabilityPatchBody", () => {
  it("rejects empty object", () => {
    const r = parseCapabilityPatchBody({});
    expect(r.ok).toBe(false);
  });
  it("accepts partial updates", () => {
    const r = parseCapabilityPatchBody({ geography: "APAC" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.geography).toBe("APAC");
  });
});
