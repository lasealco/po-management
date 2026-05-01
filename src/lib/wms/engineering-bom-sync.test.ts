import { describe, expect, it } from "vitest";

import { parseEngineeringBomLinesJson } from "./engineering-bom-sync";

describe("parseEngineeringBomLinesJson", () => {
  it("treats null as empty", () => {
    expect(parseEngineeringBomLinesJson(null)).toEqual({ ok: true, lines: [] });
  });

  it("parses sku + plannedQty", () => {
    const r = parseEngineeringBomLinesJson([{ sku: "ABC", plannedQty: 2 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]?.sku).toBe("ABC");
    expect(r.lines[0]?.plannedQty).toBe(2);
    expect(r.lines[0]?.lineNo).toBe(1);
  });

  it("accepts componentSku alias", () => {
    const r = parseEngineeringBomLinesJson([{ componentSku: " X ", plannedQty: 1 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]?.sku).toBe("X");
  });

  it("sorts by explicit lineNo", () => {
    const r = parseEngineeringBomLinesJson([
      { lineNo: 3, sku: "c", plannedQty: 1 },
      { lineNo: 1, sku: "a", plannedQty: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines.map((x) => x.sku)).toEqual(["a", "c"]);
  });

  it("rejects non-array", () => {
    expect(parseEngineeringBomLinesJson({}).ok).toBe(false);
  });
});
