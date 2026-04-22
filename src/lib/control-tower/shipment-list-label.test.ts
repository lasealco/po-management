import { describe, expect, it } from "vitest";

import {
  controlTowerListPrimaryTitle,
  controlTowerListSecondaryRef,
  isLikelyAsnStyleShipmentNo,
} from "./shipment-list-label";

describe("isLikelyAsnStyleShipmentNo", () => {
  it("detects ASN-prefixed references", () => {
    expect(isLikelyAsnStyleShipmentNo("ASN-GEN-00409")).toBe(true);
    expect(isLikelyAsnStyleShipmentNo("  asn123  ")).toBe(true);
  });

  it("returns false for empty or non-ASN", () => {
    expect(isLikelyAsnStyleShipmentNo(null)).toBe(false);
    expect(isLikelyAsnStyleShipmentNo("PO-1")).toBe(false);
  });
});

describe("controlTowerListPrimaryTitle", () => {
  it("prefers non-ASN shipment number", () => {
    expect(
      controlTowerListPrimaryTitle({
        orderNumber: "PO-1",
        shipmentNo: "CONT-99",
        id: "clxxxxxxxxxxxxxx",
      }),
    ).toBe("CONT-99");
  });

  it("falls back to PO when shipment no looks like ASN", () => {
    expect(
      controlTowerListPrimaryTitle({
        orderNumber: "  PO-42  ",
        shipmentNo: "ASN-GEN-1",
        id: "clxxxxxxxxxxxxxx",
      }),
    ).toBe("PO-42");
  });

  it("uses shipment no or id prefix when PO empty", () => {
    expect(
      controlTowerListPrimaryTitle({
        orderNumber: "   ",
        shipmentNo: null,
        id: "clabcdefghijklmn",
      }),
    ).toBe("clabcdef");
    expect(
      controlTowerListPrimaryTitle({
        orderNumber: "",
        shipmentNo: "ASN-X",
        id: "zzzzzzzzzzzzzzzz",
      }),
    ).toBe("ASN-X");
  });
});

describe("controlTowerListSecondaryRef", () => {
  it("returns null when secondary matches primary or is empty", () => {
    expect(
      controlTowerListSecondaryRef({
        orderNumber: "PO-1",
        shipmentNo: "SHIP-1",
        id: "id1",
      }),
    ).toBeNull();
    expect(
      controlTowerListSecondaryRef({
        orderNumber: "PO-1",
        shipmentNo: null,
        id: "id1",
      }),
    ).toBeNull();
  });

  it("returns ASN ref when primary is PO", () => {
    expect(
      controlTowerListSecondaryRef({
        orderNumber: "PO-9",
        shipmentNo: "ASN-GEN-9",
        id: "id1",
      }),
    ).toBe("ASN-GEN-9");
  });
});
