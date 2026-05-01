import { describe, expect, it } from "vitest";

import { fungibleWaveSlot } from "./allocation-strategy";
import {
  findMinimalFeasibleSlotSubset,
  nextCombination,
  orderPickSlotsSolverPrototype,
  SOLVER_PROTOTYPE_MAX_SLOTS_FOR_EXACT,
} from "./pick-wave-solver-prototype";

describe("nextCombination", () => {
  it("iterates C(4,2) in lex order", () => {
    const comb = [0, 1];
    const seen: string[] = [comb.join(",")];
    while (nextCombination(comb, 4)) {
      seen.push(comb.join(","));
    }
    expect(seen).toEqual(["0,1", "0,2", "0,3", "1,2", "1,3", "2,3"]);
  });
});

describe("findMinimalFeasibleSlotSubset", () => {
  it("returns a single slot when one bin covers R", () => {
    const slots = [
      fungibleWaveSlot({ binId: "a", binCode: "A", available: 5 }),
      fungibleWaveSlot({ binId: "c", binCode: "C", available: 50 }),
    ];
    const sub = findMinimalFeasibleSlotSubset(slots, 12);
    expect(sub?.map((s) => s.binCode)).toEqual(["C"]);
  });

  it("returns first lex minimal pair when k=1 impossible", () => {
    const slots = [
      fungibleWaveSlot({ binId: "a", binCode: "A", available: 10 }),
      fungibleWaveSlot({ binId: "b", binCode: "B", available: 10 }),
      fungibleWaveSlot({ binId: "c", binCode: "C", available: 12 }),
    ];
    const sub = findMinimalFeasibleSlotSubset(slots, 15);
    expect(sub?.map((s) => s.binCode).sort()).toEqual(["A", "B"]);
  });
});

describe("orderPickSlotsSolverPrototype", () => {
  it("orders within minimal subset using BF-15 (golden path)", () => {
    const slots = [
      fungibleWaveSlot({ binId: "a", binCode: "A", available: 10 }),
      fungibleWaveSlot({ binId: "b", binCode: "B", available: 10 }),
      fungibleWaveSlot({ binId: "c", binCode: "C", available: 12 }),
    ];
    const ordered = orderPickSlotsSolverPrototype(slots, 15, "BF15");
    expect(ordered.map((s) => s.binCode)).toEqual(["A", "B"]);
  });

  it("falls back to greedy across all slots when too many rows for exact search", () => {
    const slots = Array.from({ length: SOLVER_PROTOTYPE_MAX_SLOTS_FOR_EXACT + 1 }, (_, i) =>
      fungibleWaveSlot({
        binId: `b${i}`,
        binCode: `B-${String(i).padStart(2, "0")}`,
        available: i === 0 ? 100 : 1,
      }),
    );
    const ordered = orderPickSlotsSolverPrototype(slots, 5, "BF15");
    expect(ordered.length).toBe(slots.length);
  });
});
