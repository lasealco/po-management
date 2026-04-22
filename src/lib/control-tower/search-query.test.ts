import { describe, expect, it } from "vitest";

import { appendAssistToSearchParams, hasStructuredSearchInput } from "./search-query";

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

  it("omits shipmentSource when not PO or UNLINKED", () => {
    const sp = new URLSearchParams();
    appendAssistToSearchParams(sp, { shipmentSource: undefined });
    expect(sp.has("shipmentSource")).toBe(false);
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
});
