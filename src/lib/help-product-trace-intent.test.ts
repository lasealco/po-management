import { describe, expect, it } from "vitest";

import { extractProductTraceOpenPathQueryFromUserMessage } from "@/lib/help-product-trace-intent";

describe("extractProductTraceOpenPathQueryFromUserMessage", () => {
  it("parses looking for product <code>", () => {
    expect(extractProductTraceOpenPathQueryFromUserMessage("I am looking for product corr-roll")).toBe("corr-roll");
  });

  it("parses find item <code>", () => {
    expect(extractProductTraceOpenPathQueryFromUserMessage("find item ABC-12")).toBe("ABC-12");
  });

  it("parses PKG tokens", () => {
    expect(extractProductTraceOpenPathQueryFromUserMessage("show PKG-CORR-ROLL on the map")).toBe("PKG-CORR-ROLL");
  });

  it("parses SKU: prefix", () => {
    expect(extractProductTraceOpenPathQueryFromUserMessage("SKU:demo-widget-1")).toBe("demo-widget-1");
  });

  it("parses trace:# token", () => {
    expect(extractProductTraceOpenPathQueryFromUserMessage("trace:#MY-CODE")).toBe("MY-CODE");
  });

  it("does not treat product trace as a code", () => {
    expect(extractProductTraceOpenPathQueryFromUserMessage("open product trace page")).toBeUndefined();
  });

  it("does not capture from bare trace verb", () => {
    expect(extractProductTraceOpenPathQueryFromUserMessage("trace the shipment")).toBeUndefined();
  });
});
