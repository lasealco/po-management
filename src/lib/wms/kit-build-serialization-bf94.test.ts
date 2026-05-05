import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  decimalIsPositiveInteger,
  parseKitBuildBf94BodyFields,
  validateBf94AgainstKitDeltas,
} from "./kit-build-serialization-bf94";

describe("parseKitBuildBf94BodyFields", () => {
  it("defaults empty", () => {
    const r = parseKitBuildBf94BodyFields({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.outputSerialNos.length).toBe(0);
  });

  it("parses output + consumed", () => {
    const r = parseKitBuildBf94BodyFields({
      kitBuildBf94OutputSerialNos: ["KIT-SN-001"],
      kitBuildBf94ConsumedSerials: [{ bomLineId: "bl1", serialNo: "CMP-001" }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.outputSerialNos).toEqual(["KIT-SN-001"]);
      expect(r.value.consumedSerials.length).toBe(1);
    }
  });

  it("rejects duplicate outputs", () => {
    const r = parseKitBuildBf94BodyFields({
      kitBuildBf94OutputSerialNos: ["a", "a"],
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateBf94AgainstKitDeltas", () => {
  const deltas = new Map([
    ["a", new Prisma.Decimal("2")],
    ["b", new Prisma.Decimal("0")],
  ]);

  it("requires integer kit qty for outputs", () => {
    const r = validateBf94AgainstKitDeltas({
      kitQty: new Prisma.Decimal("1.5"),
      deltas,
      bf94: { outputSerialNos: ["x"], consumedSerials: [] },
    });
    expect(r.ok).toBe(false);
  });

  it("matches consumed counts per line", () => {
    const ok = validateBf94AgainstKitDeltas({
      kitQty: new Prisma.Decimal("1"),
      deltas,
      bf94: {
        outputSerialNos: ["OUT1"],
        consumedSerials: [
          { bomLineId: "a", serialNo: "s1" },
          { bomLineId: "a", serialNo: "s2" },
        ],
      },
    });
    expect(ok.ok).toBe(true);
  });

  it("fails when consumed missing line", () => {
    const r = validateBf94AgainstKitDeltas({
      kitQty: new Prisma.Decimal("1"),
      deltas,
      bf94: {
        outputSerialNos: ["OUT1"],
        consumedSerials: [{ bomLineId: "a", serialNo: "s1" }],
      },
    });
    expect(r.ok).toBe(false);
  });
});

describe("decimalIsPositiveInteger", () => {
  it("detects integers", () => {
    expect(decimalIsPositiveInteger(new Prisma.Decimal("3"))).toBe(true);
    expect(decimalIsPositiveInteger(new Prisma.Decimal("3.5"))).toBe(false);
  });
});
