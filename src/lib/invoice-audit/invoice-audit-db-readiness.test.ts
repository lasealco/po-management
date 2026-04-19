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

function mockHappySchemaAndMigrations() {
  vi.mocked(prismaMock.$queryRaw)
    .mockResolvedValueOnce([{ c: BigInt(5) }])
    .mockResolvedValueOnce([{ c: BigInt(6) }])
    .mockResolvedValueOnce([{ c: BigInt(2) }])
    .mockResolvedValueOnce([
      { migration_name: "20260419100000_invoice_audit_foundation" },
      { migration_name: "20260420120000_invoice_audit_ocean_matching" },
      { migration_name: "20260421103000_invoice_intake_accounting_handoff" },
    ]);
}

describe("checkInvoiceAuditDatabaseSchema", () => {
  it("returns ok when table and column counts match", async () => {
    mockHappySchemaAndMigrations();

    const out = await checkInvoiceAuditDatabaseSchema();
    expect(out.ok).toBe(true);
    expect(out.issues).toHaveLength(0);
    expect(out.appliedPrismaMigrations).toHaveLength(3);
    expect(out.missingPrismaMigrations).toBeUndefined();
  });

  it("reports missing tables", async () => {
    vi.mocked(prismaMock.$queryRaw)
      .mockResolvedValueOnce([{ c: BigInt(2) }])
      .mockResolvedValueOnce([{ c: BigInt(6) }])
      .mockResolvedValueOnce([{ c: BigInt(2) }])
      .mockResolvedValueOnce([
        { migration_name: "20260419100000_invoice_audit_foundation" },
        { migration_name: "20260420120000_invoice_audit_ocean_matching" },
        { migration_name: "20260421103000_invoice_intake_accounting_handoff" },
      ]);

    const out = await checkInvoiceAuditDatabaseSchema();
    expect(out.ok).toBe(false);
    expect(out.issues.some((m) => m.includes("Expected 5"))).toBe(true);
  });

  it("fails when Prisma migration history is incomplete", async () => {
    vi.mocked(prismaMock.$queryRaw).mockReset();
    vi.mocked(prismaMock.$queryRaw)
      .mockResolvedValueOnce([{ c: BigInt(5) }])
      .mockResolvedValueOnce([{ c: BigInt(6) }])
      .mockResolvedValueOnce([{ c: BigInt(2) }])
      .mockResolvedValueOnce([{ migration_name: "20260419100000_invoice_audit_foundation" }]);

    const out = await checkInvoiceAuditDatabaseSchema();
    expect(out.ok).toBe(false);
    expect(out.missingPrismaMigrations?.length).toBe(2);
    expect(out.issues.some((m) => m.includes("Prisma migration history"))).toBe(true);
  });

  it("sets migrationHistoryNote when _prisma_migrations is unreadable", async () => {
    vi.mocked(prismaMock.$queryRaw).mockReset();
    vi.mocked(prismaMock.$queryRaw)
      .mockResolvedValueOnce([{ c: BigInt(5) }])
      .mockResolvedValueOnce([{ c: BigInt(6) }])
      .mockResolvedValueOnce([{ c: BigInt(2) }])
      .mockRejectedValueOnce(new Error("permission denied"));

    const out = await checkInvoiceAuditDatabaseSchema();
    expect(out.ok).toBe(true);
    expect(out.migrationHistoryNote).toContain("_prisma_migrations");
  });

  it("bypassCache skips prior cached result", async () => {
    mockHappySchemaAndMigrations();
    await checkInvoiceAuditDatabaseSchema();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(4);
    await checkInvoiceAuditDatabaseSchema();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(4);
    mockHappySchemaAndMigrations();
    await checkInvoiceAuditDatabaseSchema({ bypassCache: true });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(8);
  });

  it("reports information_schema errors", async () => {
    vi.mocked(prismaMock.$queryRaw).mockRejectedValue(new Error("connection refused"));

    const out = await checkInvoiceAuditDatabaseSchema();
    expect(out.ok).toBe(false);
    expect(out.issues[0]).toContain("information_schema");
  });
});
