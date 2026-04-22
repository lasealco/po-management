import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findManyTenants = vi.hoisted(() => vi.fn());
const findManyCostLines = vi.hoisted(() => vi.fn());
const findManyPrefs = vi.hoisted(() => vi.fn());
const upsertFx = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findMany: findManyTenants },
    ctShipmentCostLine: { findMany: findManyCostLines },
    userPreference: { findMany: findManyPrefs },
    ctFxRate: { upsert: upsertFx },
  },
}));

import { refreshControlTowerFxRatesAllTenants } from "./fx-refresh";

describe("refreshControlTowerFxRatesAllTenants", () => {
  const savedBases = process.env.CONTROL_TOWER_FX_BASES;
  const savedTargets = process.env.CONTROL_TOWER_FX_TARGETS;
  const fetchMock = vi.fn();

  beforeEach(() => {
    findManyTenants.mockReset();
    findManyCostLines.mockReset();
    findManyPrefs.mockReset();
    upsertFx.mockReset();
    fetchMock.mockReset();
    process.env.CONTROL_TOWER_FX_BASES = "USD";
    process.env.CONTROL_TOWER_FX_TARGETS = "EUR,GBP";
    findManyTenants.mockResolvedValue([{ id: "t1" }]);
    findManyCostLines.mockResolvedValue([]);
    findManyPrefs.mockResolvedValue([]);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (savedBases === undefined) delete process.env.CONTROL_TOWER_FX_BASES;
    else process.env.CONTROL_TOWER_FX_BASES = savedBases;
    if (savedTargets === undefined) delete process.env.CONTROL_TOWER_FX_TARGETS;
    else process.env.CONTROL_TOWER_FX_TARGETS = savedTargets;
  });

  it("returns zeros when there are no tenants", async () => {
    findManyTenants.mockResolvedValueOnce([]);
    const r = await refreshControlTowerFxRatesAllTenants();
    expect(r).toEqual({ tenants: 0, pairsSeen: 0, upserts: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("upserts rates from Frankfurter JSON and counts pairs", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ base: "USD", date: "2026-04-10", rates: { EUR: 0.92, GBP: 0.79 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    upsertFx.mockResolvedValue({});

    const r = await refreshControlTowerFxRatesAllTenants();

    expect(r.tenants).toBe(1);
    expect(r.pairsSeen).toBe(2);
    expect(r.upserts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("from=USD");
    expect(String(url)).toContain("to=");
    expect(init).toMatchObject({ cache: "no-store" });
    expect(upsertFx).toHaveBeenCalledTimes(2);
    expect(upsertFx).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_baseCurrency_quoteCurrency_rateDate: {
            tenantId: "t1",
            baseCurrency: "USD",
            quoteCurrency: "EUR",
            rateDate: new Date("2026-04-10T00:00:00.000Z"),
          },
        },
        create: expect.objectContaining({
          tenantId: "t1",
          baseCurrency: "USD",
          quoteCurrency: "EUR",
          provider: "frankfurter",
        }),
      }),
    );
  });

  it("skips upsert when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const r = await refreshControlTowerFxRatesAllTenants();
    expect(r.upserts).toBe(0);
    expect(r.pairsSeen).toBe(0);
    expect(upsertFx).not.toHaveBeenCalled();
  });

  it("skips upsert when payload omits rates or date", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ base: "USD", rates: { EUR: 1 } }), { status: 200 }),
    );
    const r = await refreshControlTowerFxRatesAllTenants();
    expect(r.upserts).toBe(0);
    expect(upsertFx).not.toHaveBeenCalled();
  });

  it("merges distinct currencies from cost lines and display-currency prefs", async () => {
    findManyCostLines.mockResolvedValueOnce([{ currency: "jpy" }]);
    findManyPrefs.mockResolvedValueOnce([{ value: { currency: "cad" } }]);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ date: "2026-04-10", rates: { EUR: 0.9, GBP: 0.8, JPY: 150, CAD: 1.4 } }), {
        status: 200,
      }),
    );
    upsertFx.mockResolvedValue({});

    await refreshControlTowerFxRatesAllTenants();

    const [url] = fetchMock.mock.calls[0]!;
    const u = String(url);
    expect(u).toContain("from=USD");
    expect(u).toMatch(/to=.*EUR/);
    expect(u).toMatch(/JPY/);
    expect(u).toMatch(/CAD/);
  });
});
