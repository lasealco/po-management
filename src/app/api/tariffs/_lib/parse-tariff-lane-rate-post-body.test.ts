import { describe, expect, it } from "vitest";

import { parseTariffLaneRatePostBody } from "./parse-tariff-lane-rate-post-body";

describe("parseTariffLaneRatePostBody", () => {
  it("requires pol and pod", () => {
    expect(parseTariffLaneRatePostBody({ pol: "", pod: "USCHI" }).ok).toBe(false);
    expect(parseTariffLaneRatePostBody({ pol: "DEHAM", pod: "  " }).ok).toBe(false);
  });

  it("rejects invalid transportMode", () => {
    const r = parseTariffLaneRatePostBody({
      pol: "DEHAM",
      pod: "USCHI",
      transportMode: "SUBMARINE",
    });
    expect(r).toEqual({ ok: false, error: "Invalid transportMode." });
  });

  it("rejects invalid asOf", () => {
    const r = parseTariffLaneRatePostBody({
      pol: "DEHAM",
      pod: "USCHI",
      asOf: "not-a-date",
    });
    expect(r).toEqual({ ok: false, error: "Invalid asOf date." });
  });

  it("defaults equipment, mode, and asOf when omitted", () => {
    const r = parseTariffLaneRatePostBody({ pol: "DEHAM", pod: "USCHI" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.equipment).toBe("40HC");
    expect(r.value.transportMode).toBe("OCEAN");
    expect(r.value.pol).toBe("DEHAM");
    expect(r.value.providerIds).toBeUndefined();
  });

  it("normalizes equipment and clamps maxResults", () => {
    const r = parseTariffLaneRatePostBody({
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40' HC",
      maxResults: 999,
      providerIds: ["  a  ", "b"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.equipment).toBe("40HC");
    expect(r.value.maxResults).toBe(50);
    expect(r.value.providerIds).toEqual(["a", "b"]);
  });

  it("rejects non-array providerIds", () => {
    const r = parseTariffLaneRatePostBody({
      pol: "DEHAM",
      pod: "USCHI",
      providerIds: "x",
    });
    expect(r).toMatchObject({ ok: false });
  });
});
