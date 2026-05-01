import { describe, expect, it } from "vitest";

import { parseConsumeWorkOrderBomQuantity, parseReplaceWorkOrderBomLinesPayload } from "./work-order-bom";

describe("parseReplaceWorkOrderBomLinesPayload", () => {
  it("rejects non-array", () => {
    const r = parseReplaceWorkOrderBomLinesPayload({});
    expect(r.ok).toBe(false);
  });

  it("assigns line numbers when omitted", () => {
    const r = parseReplaceWorkOrderBomLinesPayload([
      { componentProductId: "p1", plannedQty: 2 },
      { componentProductId: "p2", plannedQty: 1.5 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines.map((l) => l.lineNo)).toEqual([1, 2]);
    expect(r.lines[0]?.componentProductId).toBe("p1");
    expect(r.lines[0]?.plannedQty.toString()).toBe("2");
    expect(r.lines[1]?.plannedQty.toString()).toBe("1.5");
  });

  it("sorts by explicit lineNo", () => {
    const r = parseReplaceWorkOrderBomLinesPayload([
      { lineNo: 3, componentProductId: "c", plannedQty: 1 },
      { lineNo: 1, componentProductId: "a", plannedQty: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines.map((l) => l.lineNo)).toEqual([1, 3]);
    expect(r.lines[0]?.componentProductId).toBe("a");
  });

  it("rejects duplicate lineNo", () => {
    const r = parseReplaceWorkOrderBomLinesPayload([
      { lineNo: 1, componentProductId: "a", plannedQty: 1 },
      { lineNo: 1, componentProductId: "b", plannedQty: 1 },
    ]);
    expect(r.ok).toBe(false);
  });

  it("rejects non-positive planned qty", () => {
    expect(parseReplaceWorkOrderBomLinesPayload([{ componentProductId: "a", plannedQty: 0 }]).ok).toBe(false);
  });
});

describe("parseConsumeWorkOrderBomQuantity", () => {
  it("parses positive qty", () => {
    const r = parseConsumeWorkOrderBomQuantity(3.25);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.qty.toString()).toBe("3.25");
  });

  it("rejects zero", () => {
    expect(parseConsumeWorkOrderBomQuantity(0).ok).toBe(false);
  });
});
