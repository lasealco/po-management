import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  checkInvoiceAuditDatabaseSchema,
  clearInvoiceAuditSchemaCheckCacheForTests,
} from "@/lib/invoice-audit/invoice-audit-db-readiness";

beforeEach(() => {
  clearInvoiceAuditSchemaCheckCacheForTests();
  vi.mocked(prismaMock.$queryRaw).mockReset();
});

describe("checkInvoiceAuditDatabaseSchema", () => {
  it("returns ok when table and column counts match", async () => {
    vi.mocked(prismaMock.$queryRaw)
      .mockResolvedValueOnce([{ c: BigInt(5) }])
      .mockResolvedValueOnce([{ c: BigInt(6) }])
      .mockResolvedValueOnce([{ c: BigInt(2) }]);

    const out = await checkInvoiceAuditDatabaseSchema();
    expect(out.ok).toBe(true);
    expect(out.issues).toHaveLength(0);
  });

  it("reports missing tables", async () => {
    vi.mocked(prismaMock.$queryRaw)
      .mockResolvedValueOnce([{ c: BigInt(2) }])
      .mockResolvedValueOnce([{ c: BigInt(6) }])
      .mockResolvedValueOnce([{ c: BigInt(2) }]);

    const out = await checkInvoiceAuditDatabaseSchema();
    expect(out.ok).toBe(false);
    expect(out.issues.some((m) => m.includes("Expected 5"))).toBe(true);
  });

  it("reports information_schema errors", async () => {
    vi.mocked(prismaMock.$queryRaw).mockRejectedValue(new Error("connection refused"));

    const out = await checkInvoiceAuditDatabaseSchema();
    expect(out.ok).toBe(false);
    expect(out.issues[0]).toContain("information_schema");
  });
});
