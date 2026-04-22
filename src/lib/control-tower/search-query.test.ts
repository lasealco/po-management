import { describe, expect, it } from "vitest";

import {
  appendAssistToSearchParams,
  effectiveControlTowerQParam,
  hasStructuredSearchInput,
  controlTowerShipmentsTextQuery,
  isProbableControlTowerShipmentCuid,
  mergeRawControlTowerSearchInput,
  parseControlTowerProductTraceParam,
} from "./search-query";

describe("parseControlTowerProductTraceParam", () => {
  it("accepts trimmed alphanumeric tokens", () => {
    expect(parseControlTowerProductTraceParam("  SKU-1.a  ")).toBe("SKU-1.a");
  });

  it("rejects empty, too long, or invalid characters", () => {
    expect(parseControlTowerProductTraceParam("")).toBeUndefined();
    expect(parseControlTowerProductTraceParam("   ")).toBeUndefined();
    expect(parseControlTowerProductTraceParam("a".repeat(81))).toBeUndefined();
    expect(parseControlTowerProductTraceParam("bad code")).toBeUndefined();
  });

  it("rejects shipment cuid-shaped ids (use q= for id search)", () => {
    expect(parseControlTowerProductTraceParam("cl9k2abcdefghijklmnopqrs")).toBeUndefined();
  });
});

describe("effectiveControlTowerQParam", () => {
  it("prefers q over productTrace", () => {
    expect(effectiveControlTowerQParam("  PO-1  ", "SKU")).toBe("PO-1");
  });

  it("falls back to productTrace when q is blank", () => {
    expect(effectiveControlTowerQParam("", "SKU-9")).toBe("SKU-9");
    expect(effectiveControlTowerQParam(null, "SKU-9")).toBe("SKU-9");
  });
});

describe("appendAssistToSearchParams", () => {
  it("sets query keys from sanitized-style filters", () => {
    const sp = new URLSearchParams();
    appendAssistToSearchParams(
      sp,
      {
        q: "  find  ",
        mode: "OCEAN",
        status: "IN_TRANSIT",
        onlyOverdueEta: true,
        lane: "DEHAMUSCHI",
        supplierId: "c0000000000000000000",
        shipmentSource: "PO",
        routeAction: "Send booking",
        exceptionCode: "DELAY",
      },
      { take: 25 },
    );
    expect(sp.get("q")).toBe("find");
    expect(sp.get("mode")).toBe("OCEAN");
    expect(sp.get("status")).toBe("IN_TRANSIT");
    expect(sp.get("onlyOverdueEta")).toBe("1");
    expect(sp.get("lane")).toBe("DEHAMUSCHI");
    expect(sp.get("supplierId")).toBe("c0000000000000000000");
    expect(sp.get("shipmentSource")).toBe("PO");
    expect(sp.get("routeAction")).toBe("Send booking");
    expect(sp.get("exceptionCode")).toBe("DELAY");
    expect(sp.get("take")).toBe("25");
  });

  it("sets productTrace from productTraceQ", () => {
    const sp = new URLSearchParams();
    appendAssistToSearchParams(sp, { productTraceQ: "  SKU-1  " });
    expect(sp.get("productTrace")).toBe("SKU-1");
  });

  it("omits productTrace when productTraceQ is not a valid trace token", () => {
    const sp = new URLSearchParams();
    appendAssistToSearchParams(sp, { productTraceQ: `c${"0".repeat(19)}` });
    expect(sp.has("productTrace")).toBe(false);
  });

  it("omits shipmentSource when not PO or UNLINKED", () => {
    const sp = new URLSearchParams();
    appendAssistToSearchParams(sp, { shipmentSource: undefined });
    expect(sp.has("shipmentSource")).toBe(false);
  });

  it("sets customer, carrier, port codes, dispatch owner, and alert type", () => {
    const sp = new URLSearchParams();
    appendAssistToSearchParams(sp, {
      customerCrmAccountId: " crm-1 ",
      carrierSupplierId: " car-sup-1 ",
      originCode: " DEHAM ",
      destinationCode: " USNYC ",
      dispatchOwnerUserId: " user-owner ",
      alertType: " COLLAB_MENTION ",
    });
    expect(sp.get("customerCrmAccountId")).toBe("crm-1");
    expect(sp.get("carrierSupplierId")).toBe("car-sup-1");
    expect(sp.get("originCode")).toBe("DEHAM");
    expect(sp.get("destinationCode")).toBe("USNYC");
    expect(sp.get("dispatchOwnerUserId")).toBe("user-owner");
    expect(sp.get("alertType")).toBe("COLLAB_MENTION");
  });
});

describe("isProbableControlTowerShipmentCuid", () => {
  it("matches compact cuid-shaped ids used for shipment primary keys", () => {
    expect(isProbableControlTowerShipmentCuid("cl9k2abcdefghijklmnopqrs")).toBe(true);
    expect(isProbableControlTowerShipmentCuid("SKU-1")).toBe(false);
    expect(isProbableControlTowerShipmentCuid("cshort")).toBe(false);
  });
});

describe("controlTowerShipmentsTextQuery", () => {
  it("returns productTrace when the full trimmed input is a valid token", () => {
    expect(controlTowerShipmentsTextQuery("  SKU-1  ")).toEqual({ productTrace: "SKU-1" });
  });

  it("returns q for probable shipment ids, not productTrace", () => {
    expect(controlTowerShipmentsTextQuery("cl9k2abcdefghijklmnopqrs")).toEqual({
      q: "cl9k2abcdefghijklmnopqrs",
    });
  });

  it("returns q for empty, whitespace-only, or non-trace text", () => {
    expect(controlTowerShipmentsTextQuery("")).toBeNull();
    expect(controlTowerShipmentsTextQuery("   ")).toBeNull();
    expect(controlTowerShipmentsTextQuery("PO 123")).toEqual({ q: "PO 123" });
  });
});

describe("mergeRawControlTowerSearchInput", () => {
  it("uses productTrace only when the full input is a valid trace token and q is unset", () => {
    const sp = new URLSearchParams();
    mergeRawControlTowerSearchInput(sp, "  SKU-1.a  ");
    expect(sp.get("productTrace")).toBe("SKU-1.a");
    expect(sp.has("q")).toBe(false);
  });

  it("sets q for free text or when q is already present from assist", () => {
    const sp1 = new URLSearchParams();
    mergeRawControlTowerSearchInput(sp1, "PO 123");
    expect(sp1.get("q")).toBe("PO 123");
    expect(sp1.has("productTrace")).toBe(false);

    const sp2 = new URLSearchParams();
    sp2.set("q", "from-assist");
    mergeRawControlTowerSearchInput(sp2, "SKU-1");
    expect(sp2.get("q")).toBe("from-assist");
    expect(sp2.has("productTrace")).toBe(false);
  });

  it("does nothing when assist already set q (even if raw differs)", () => {
    const sp = new URLSearchParams();
    appendAssistToSearchParams(sp, { q: "from-assist", productTraceQ: "SKU-1" });
    mergeRawControlTowerSearchInput(sp, "other-raw");
    expect(sp.get("q")).toBe("from-assist");
    expect(sp.get("productTrace")).toBe("SKU-1");
  });
});

describe("hasStructuredSearchInput", () => {
  it("is false when only free-text q is set", () => {
    expect(hasStructuredSearchInput({ q: "hello" })).toBe(false);
  });

  it("is true when any structured dimension is present", () => {
    expect(hasStructuredSearchInput({ mode: "AIR" })).toBe(true);
    expect(hasStructuredSearchInput({ productTraceQ: "SKU" })).toBe(true);
    expect(hasStructuredSearchInput({ shipmentSource: "UNLINKED" })).toBe(true);
  });

  it("is false when only whitespace structured tokens are set", () => {
    expect(hasStructuredSearchInput({ dispatchOwnerUserId: "   " })).toBe(false);
    expect(hasStructuredSearchInput({ lane: "\t" })).toBe(false);
    expect(hasStructuredSearchInput({ exceptionCode: "  " })).toBe(false);
    expect(hasStructuredSearchInput({ productTraceQ: "" })).toBe(false);
  });
});
