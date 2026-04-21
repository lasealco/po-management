import { describe, expect, it } from "vitest";

import { isValidTwinScenarioDraftCuid, parseTwinScenarioDraftQueryValue } from "./twin-scenario-draft-id";

describe("isValidTwinScenarioDraftCuid", () => {
  it("accepts plausible Prisma-style ids", () => {
    expect(isValidTwinScenarioDraftCuid("clxxxxxxxxxxxxxxxxxxxxxx")).toBe(true);
    expect(isValidTwinScenarioDraftCuid("cmj7k2b3n0000xxxxxxxxxxxxxx")).toBe(true);
  });

  it("rejects too short, bad charset, or oversize", () => {
    expect(isValidTwinScenarioDraftCuid("short")).toBe(false);
    expect(isValidTwinScenarioDraftCuid("1startswithnumber")).toBe(false);
    expect(isValidTwinScenarioDraftCuid("has space")).toBe(false);
    expect(isValidTwinScenarioDraftCuid(`${"a".repeat(130)}`)).toBe(false);
  });
});

describe("parseTwinScenarioDraftQueryValue", () => {
  it("returns missing for empty / undefined", () => {
    expect(parseTwinScenarioDraftQueryValue(undefined)).toEqual({ status: "missing" });
    expect(parseTwinScenarioDraftQueryValue("")).toEqual({ status: "missing" });
    expect(parseTwinScenarioDraftQueryValue("   ")).toEqual({ status: "missing" });
  });

  it("returns invalid for malformed values", () => {
    expect(parseTwinScenarioDraftQueryValue("not-a-valid-id-string")).toEqual({ status: "invalid" });
  });

  it("normalizes ok ids to lowercase", () => {
    const id = "clxxxxxxxxxxxxxxxxxxxxxx";
    expect(parseTwinScenarioDraftQueryValue(id)).toEqual({ status: "ok", id });
    expect(parseTwinScenarioDraftQueryValue(id.toUpperCase())).toEqual({ status: "ok", id });
  });

  it("uses first array entry", () => {
    const id = "clxxxxxxxxxxxxxxxxxxxxxx";
    expect(parseTwinScenarioDraftQueryValue([id, "other"])).toEqual({ status: "ok", id });
  });
});
