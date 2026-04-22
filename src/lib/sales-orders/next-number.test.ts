import { beforeEach, describe, expect, it, vi } from "vitest";

import { nextSalesOrderNumber } from "./next-number";

const prismaMock = vi.hoisted(() => ({
  salesOrder: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("nextSalesOrderNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.salesOrder.findFirst.mockResolvedValue(null);
  });

  it("returns SO-{timeSuffix} when no collision", async () => {
    const n = await nextSalesOrderNumber("t1");
    expect(n).toMatch(/^SO-\d{6}$/);
    expect(prismaMock.salesOrder.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", soNumber: n },
      select: { id: true },
    });
  });

  it("appends -1, -2, … when recent stamps collide", async () => {
    prismaMock.salesOrder.findFirst
      .mockResolvedValueOnce({ id: "x" })
      .mockResolvedValueOnce({ id: "y" })
      .mockResolvedValue(null);
    const n = await nextSalesOrderNumber("tenant-a");
    expect(n).toMatch(/^SO-\d{6}-2$/);
    expect(prismaMock.salesOrder.findFirst).toHaveBeenCalledTimes(3);
  });

  it("falls back to random suffix after max retries", async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({ id: "dup" });
    const n = await nextSalesOrderNumber("t1");
    expect(n).toMatch(/^SO-\d{6}-\d+$/);
    expect(n.split("-").length).toBeGreaterThanOrEqual(3);
    expect(prismaMock.salesOrder.findFirst.mock.calls.length).toBeGreaterThanOrEqual(8);
  });
});
