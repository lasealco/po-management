import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  BF82_GENESIS_HASH_HEX,
  bf82FoldChain,
  canonicalMovementJsonBf82,
  movementEntryDigestHexBf82,
  parseMovementAuditChainQueryBf82,
  type InventoryMovementBf82CanonInput,
} from "@/lib/wms/movement-audit-chain-bf82";

const baseRow = (over: Partial<InventoryMovementBf82CanonInput> = {}): InventoryMovementBf82CanonInput => ({
  id: "mv1",
  tenantId: "t1",
  warehouseId: "w1",
  binId: null,
  productId: "p1",
  movementType: "RECEIPT",
  quantity: new Prisma.Decimal("10"),
  referenceType: null,
  referenceId: null,
  note: null,
  custodySegmentJson: null,
  co2eEstimateGrams: null,
  co2eStubJson: null,
  co2eScope3UpstreamHintGramsBf97: null,
  createdById: "u1",
  createdAt: new Date("2026-01-15T12:00:00.000Z"),
  ...over,
});

describe("movement-audit-chain-bf82", () => {
  it("parses cap bounds", () => {
    const hi = parseMovementAuditChainQueryBf82(new URLSearchParams("cap=50000"));
    expect(hi.cap).toBe(1000);
    const lo = parseMovementAuditChainQueryBf82(new URLSearchParams("cap=0"));
    expect(lo.cap).toBe(1);
    const def = parseMovementAuditChainQueryBf82(new URLSearchParams(""));
    expect(def.cap).toBe(200);
  });

  it("canonical JSON is key-stable", () => {
    const a = canonicalMovementJsonBf82(
      baseRow({
        co2eStubJson: { z: 1, a: 2 },
        custodySegmentJson: { minTempC: 2 },
      }),
    );
    const b = canonicalMovementJsonBf82(
      baseRow({
        co2eStubJson: { a: 2, z: 1 },
        custodySegmentJson: { minTempC: 2 },
      }),
    );
    expect(a).toBe(b);
    expect(a).toContain('"a":2');
    expect(a).toContain('"minTempC":2');
  });

  it("folds chain deterministically", () => {
    const r1 = baseRow({ id: "a", quantity: new Prisma.Decimal("1") });
    const r2 = baseRow({
      id: "b",
      quantity: new Prisma.Decimal("2"),
      createdAt: new Date("2026-01-15T12:01:00.000Z"),
    });
    const d1 = movementEntryDigestHexBf82(r1);
    const d2 = movementEntryDigestHexBf82(r2);
    const c1 = bf82FoldChain(BF82_GENESIS_HASH_HEX, d1);
    const c2 = bf82FoldChain(c1, d2);
    expect(d1).toHaveLength(64);
    expect(c2).toHaveLength(64);
    expect(c2).toMatch(/^[0-9a-f]{64}$/);
    const d1b = movementEntryDigestHexBf82(baseRow({ id: "a", quantity: new Prisma.Decimal("1") }));
    expect(d1b).toBe(d1);
  });

  it("quantity change alters digest", () => {
    const dA = movementEntryDigestHexBf82(baseRow({ quantity: new Prisma.Decimal("1") }));
    const dB = movementEntryDigestHexBf82(baseRow({ quantity: new Prisma.Decimal("2") }));
    expect(dA).not.toBe(dB);
  });

  it("includes BF-97 upstream hint grams only when set (digest stability)", () => {
    const without = movementEntryDigestHexBf82(baseRow());
    const withNull = movementEntryDigestHexBf82(baseRow({ co2eScope3UpstreamHintGramsBf97: null }));
    expect(without).toBe(withNull);
    const withVal = movementEntryDigestHexBf82(
      baseRow({ co2eScope3UpstreamHintGramsBf97: new Prisma.Decimal("12.5") }),
    );
    expect(withVal).not.toBe(without);
  });
});
