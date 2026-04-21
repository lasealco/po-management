import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    supplyChainTwinEntitySnapshot: { count: vi.fn() },
    supplyChainTwinEntityEdge: { count: vi.fn() },
    supplyChainTwinIngestEvent: { count: vi.fn() },
    supplyChainTwinRiskSignal: { count: vi.fn() },
    supplyChainTwinScenarioDraft: { count: vi.fn() },
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
  vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.count).mockReset();
  vi.mocked(prismaMock.supplyChainTwinEntityEdge.count).mockReset();
  vi.mocked(prismaMock.supplyChainTwinIngestEvent.count).mockReset();
  vi.mocked(prismaMock.supplyChainTwinRiskSignal.count).mockReset();
  vi.mocked(prismaMock.supplyChainTwinScenarioDraft.count).mockReset();
});

describe("getSupplyChainTwinReadinessSnapshot", () => {
  it("returns ok when all twin tables exist", async () => {
    vi.mocked(prismaMock.$queryRaw).mockResolvedValueOnce([
      { table_name: "SupplyChainTwinEntitySnapshot" },
      { table_name: "SupplyChainTwinEntityEdge" },
      { table_name: "SupplyChainTwinIngestEvent" },
      { table_name: "SupplyChainTwinRiskSignal" },
      { table_name: "SupplyChainTwinScenarioDraft" },
    ]);
    vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.count).mockResolvedValueOnce(1);
    vi.mocked(prismaMock.supplyChainTwinEntityEdge.count).mockResolvedValueOnce(0);
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.count).mockResolvedValueOnce(0);
    vi.mocked(prismaMock.supplyChainTwinRiskSignal.count).mockResolvedValueOnce(0);
    vi.mocked(prismaMock.supplyChainTwinScenarioDraft.count).mockResolvedValueOnce(0);

    const out = await getSupplyChainTwinReadinessSnapshot();

    expect(out).toEqual({ ok: true, reasons: [], healthIndex: TWIN_HEALTH_INDEX_STUB, hasTwinData: true });
  });

  it("returns not ok with a reason per missing table", async () => {
    vi.mocked(prismaMock.$queryRaw).mockResolvedValueOnce([{ table_name: "SupplyChainTwinEntitySnapshot" }]);

    const out = await getSupplyChainTwinReadinessSnapshot();

    expect(out.ok).toBe(false);
    expect(out.healthIndex).toEqual(TWIN_HEALTH_INDEX_STUB);
    expect(out.reasons).toHaveLength(4);
    expect(out.reasons.some((r) => r.includes("SupplyChainTwinEntityEdge"))).toBe(true);
    expect(out.reasons.some((r) => r.includes("SupplyChainTwinIngestEvent"))).toBe(true);
    expect(out.reasons.some((r) => r.includes("SupplyChainTwinRiskSignal"))).toBe(true);
    expect(out.reasons.some((r) => r.includes("SupplyChainTwinScenarioDraft"))).toBe(true);
    expect(out.reasons.every((r) => r.includes("db:migrate"))).toBe(true);
    expect(out.hasTwinData).toBe(false);
  });

  it("returns not ok when schema query throws", async () => {
    vi.mocked(prismaMock.$queryRaw).mockRejectedValueOnce(new Error("connection refused"));

    const out = await getSupplyChainTwinReadinessSnapshot();

    expect(out.ok).toBe(false);
    expect(out.healthIndex).toEqual(TWIN_HEALTH_INDEX_STUB);
    expect(out.reasons.length).toBeGreaterThanOrEqual(1);
    expect(out.reasons[0]).toMatch(/Could not verify/i);
    expect(out.hasTwinData).toBeNull();
  });
});
