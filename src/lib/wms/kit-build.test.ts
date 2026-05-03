import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  computeKitBuildLineDeltas,
  parseKitBuildTaskNote,
  serializeKitBuildTaskPayload,
  validateKitBuildLinePicks,
} from "./kit-build";

describe("kit-build payload", () => {
  it("round-trips note JSON", () => {
    const p = {
      v: 1 as const,
      bomRepresentsOutputUnits: 10,
      lines: [{ bomLineId: "a", binId: "b", lotCode: "" }],
    };
    const note = serializeKitBuildTaskPayload(p);
    expect(parseKitBuildTaskNote(note)).toEqual(p);
  });

  it("returns null for invalid JSON", () => {
    expect(parseKitBuildTaskNote("{")).toBeNull();
    expect(parseKitBuildTaskNote(null)).toBeNull();
  });
});

describe("computeKitBuildLineDeltas", () => {
  it("scales planned totals by kit quantity / bom scale", () => {
    const lines = [
      { id: "L1", plannedQty: new Prisma.Decimal(100), consumedQty: new Prisma.Decimal(0) },
    ];
    const r = computeKitBuildLineDeltas(lines, 3, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.deltas.get("L1")!.toString()).toBe("30");
  });

  it("zero delta when line already fully consumed", () => {
    const lines = [
      { id: "L1", plannedQty: new Prisma.Decimal(10), consumedQty: new Prisma.Decimal(10) },
    ];
    const r = computeKitBuildLineDeltas(lines, 1, 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.deltas.get("L1")!.toNumber()).toBe(0);
  });

  it("rejects over-build vs remaining", () => {
    const lines = [
      { id: "L1", plannedQty: new Prisma.Decimal(10), consumedQty: new Prisma.Decimal(0) },
    ];
    const r = computeKitBuildLineDeltas(lines, 5, 1);
    expect(r.ok).toBe(false);
  });
});

describe("validateKitBuildLinePicks", () => {
  it("requires picks only for positive deltas", () => {
    const deltas = new Map<string, Prisma.Decimal>([
      ["a", new Prisma.Decimal(1)],
      ["b", new Prisma.Decimal(0)],
    ]);
    const ok = validateKitBuildLinePicks(deltas, [{ bomLineId: "a", binId: "x", lotCode: "" }]);
    expect(ok.ok).toBe(true);
  });

  it("rejects missing pick", () => {
    const deltas = new Map<string, Prisma.Decimal>([["a", new Prisma.Decimal(1)]]);
    const ok = validateKitBuildLinePicks(deltas, []);
    expect(ok.ok).toBe(false);
  });
});
