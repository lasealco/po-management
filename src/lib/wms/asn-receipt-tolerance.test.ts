import { describe, expect, it } from "vitest";

import {
  evaluateShipmentReceiveAgainstAsnTolerance,
  generateDockGrnReference,
} from "./asn-receipt-tolerance";

describe("evaluateShipmentReceiveAgainstAsnTolerance", () => {
  it("treats missing tolerance as withinTolerance", () => {
    const r = evaluateShipmentReceiveAgainstAsnTolerance(
      [{ shipmentItemId: "a", quantityShipped: 100, quantityReceived: 50 }],
      null,
    );
    expect(r.policyApplied).toBe(false);
    expect(r.withinTolerance).toBe(true);
    expect(r.lines[0]?.ok).toBe(true);
  });

  it("allows line within pct band", () => {
    const r = evaluateShipmentReceiveAgainstAsnTolerance(
      [{ shipmentItemId: "a", quantityShipped: 100, quantityReceived: 96 }],
      5,
    );
    expect(r.policyApplied).toBe(true);
    expect(r.withinTolerance).toBe(true);
    expect(r.lines[0]?.deltaPctOfShipped).toBeCloseTo(4);
  });

  it("flags line outside pct band", () => {
    const r = evaluateShipmentReceiveAgainstAsnTolerance(
      [{ shipmentItemId: "a", quantityShipped: 100, quantityReceived: 94 }],
      5,
    );
    expect(r.withinTolerance).toBe(false);
    expect(r.lines[0]?.ok).toBe(false);
  });

  it("handles shipped 0 as ok only when received 0", () => {
    const okZero = evaluateShipmentReceiveAgainstAsnTolerance(
      [{ shipmentItemId: "a", quantityShipped: 0, quantityReceived: 0 }],
      5,
    );
    expect(okZero.withinTolerance).toBe(true);

    const bad = evaluateShipmentReceiveAgainstAsnTolerance(
      [{ shipmentItemId: "a", quantityShipped: 0, quantityReceived: 1 }],
      5,
    );
    expect(bad.withinTolerance).toBe(false);
  });
});

describe("generateDockGrnReference", () => {
  it("prefixes GRN with UTC date and receipt suffix", () => {
    const dt = new Date(Date.UTC(2026, 4, 6, 12, 0, 0));
    const g = generateDockGrnReference("ckxyz0123456789abcdefghij", dt);
    expect(g.startsWith("GRN-20260506-")).toBe(true);
    expect(g.length).toBeGreaterThan(16);
  });
});
