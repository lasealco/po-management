import { describe, expect, it } from "vitest";

import { parseInboundAsnAdviseLines } from "./inbound-asn-advise";

describe("parseInboundAsnAdviseLines (BF-59)", () => {
  it("accepts minimal lines", () => {
    const r = parseInboundAsnAdviseLines([{ quantityExpected: 10 }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines).toHaveLength(1);
      expect(r.lines[0].quantityExpected).toBe("10.000");
      expect(r.lines[0].lineNo).toBeNull();
    }
  });

  it("rejects empty array", () => {
    expect(parseInboundAsnAdviseLines([]).ok).toBe(false);
  });

  it("maps aliases and trims", () => {
    const r = parseInboundAsnAdviseLines([
      {
        lineNo: 1,
        productSku: " ABC ",
        qty: 2.5,
        lotCode: "L1",
      },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines[0].productSku).toBe("ABC");
      expect(r.lines[0].quantityExpected).toBe("2.500");
      expect(r.lines[0].lotCode).toBe("L1");
    }
  });
});
