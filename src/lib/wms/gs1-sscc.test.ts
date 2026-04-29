import { describe, expect, it } from "vitest";

import {
  buildSscc18DemoBody17,
  buildSscc18DemoFromOutbound,
  computeGs1Mod10CheckDigit,
  formatSscc18FromBody17,
  verifyGs1Mod10CheckDigit,
} from "./gs1-sscc";

describe("computeGs1Mod10CheckDigit", () => {
  it("validates full strings via verifyGs1Mod10CheckDigit", () => {
    const body = "036000291452";
    const check = computeGs1Mod10CheckDigit(body);
    expect(verifyGs1Mod10CheckDigit(`${body}${check}`)).toBe(true);
  });

  it("round-trips verify on random 17-digit bodies", () => {
    const body = "01234567890123456";
    const full = formatSscc18FromBody17(body);
    expect(full.length).toBe(18);
    expect(verifyGs1Mod10CheckDigit(full)).toBe(true);
  });
});

describe("buildSscc18DemoFromOutbound", () => {
  it("produces 18-digit SSCC with valid check digit", () => {
    const sscc = buildSscc18DemoFromOutbound("clxyzOutboundSeed123", "0614141");
    expect(sscc).toMatch(/^\d{18}$/);
    expect(verifyGs1Mod10CheckDigit(sscc)).toBe(true);
  });

  it("is stable for the same outbound id and prefix", () => {
    const a = buildSscc18DemoFromOutbound("same-id", "07614141");
    const b = buildSscc18DemoFromOutbound("same-id", "07614141");
    expect(a).toBe(b);
  });

  it("buildSscc18DemoBody17 prefixes extension + company prefix + serial", () => {
    const body = buildSscc18DemoBody17({
      outboundId: "oid1",
      companyPrefixDigits: "07614141",
      extensionDigit: "3",
    });
    expect(body).toMatch(/^\d{17}$/);
    expect(body.startsWith("307614141")).toBe(true);
  });
});
