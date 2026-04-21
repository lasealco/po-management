import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { TWIN_HEALTH_INDEX_STUB } from "@/lib/supply-chain-twin/kpi-stub";
import {
  clearSupplyChainTwinReadinessCacheForTests,
  getSupplyChainTwinReadinessSnapshot,
} from "@/lib/supply-chain-twin/readiness";

beforeEach(() => {
  clearSupplyChainTwinReadinessCacheForTests();
  vi.mocked(prismaMock.$queryRaw).mockReset();
});

describe("getSupplyChainTwinReadinessSnapshot", () => {
  it("returns ok when all twin tables exist", async () => {
    vi.mocked(prismaMock.$queryRaw).mockResolvedValueOnce([
      { table_name: "SupplyChainTwinEntitySnapshot" },
      { table_name: "SupplyChainTwinEntityEdge" },
      { table_name: "SupplyChainTwinIngestEvent" },
      { table_name: "SupplyChainTwinRiskSignal" },
    ]);

    const out = await getSupplyChainTwinReadinessSnapshot();

    expect(out).toEqual({ ok: true, reasons: [], healthIndex: TWIN_HEALTH_INDEX_STUB });
  });

  it("returns not ok with a reason per missing table", async () => {
    vi.mocked(prismaMock.$queryRaw).mockResolvedValueOnce([{ table_name: "SupplyChainTwinEntitySnapshot" }]);

    const out = await getSupplyChainTwinReadinessSnapshot();

    expect(out.ok).toBe(false);
    expect(out.healthIndex).toEqual(TWIN_HEALTH_INDEX_STUB);
    expect(out.reasons).toHaveLength(3);
    expect(out.reasons.some((r) => r.includes("SupplyChainTwinEntityEdge"))).toBe(true);
    expect(out.reasons.some((r) => r.includes("SupplyChainTwinIngestEvent"))).toBe(true);
    expect(out.reasons.some((r) => r.includes("SupplyChainTwinRiskSignal"))).toBe(true);
    expect(out.reasons.every((r) => r.includes("db:migrate"))).toBe(true);
  });

  it("returns not ok when schema query throws", async () => {
    vi.mocked(prismaMock.$queryRaw).mockRejectedValueOnce(new Error("connection refused"));

    const out = await getSupplyChainTwinReadinessSnapshot();

    expect(out.ok).toBe(false);
    expect(out.healthIndex).toEqual(TWIN_HEALTH_INDEX_STUB);
    expect(out.reasons.length).toBeGreaterThanOrEqual(1);
    expect(out.reasons[0]).toMatch(/Could not verify/i);
  });
});
