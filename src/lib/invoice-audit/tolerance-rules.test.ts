import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoiceToleranceRule: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import {
  getToleranceRuleForTenant,
  pickToleranceRuleForIntake,
  updateToleranceRuleForTenant,
} from "@/lib/invoice-audit/tolerance-rules";

const mockRow = {
  id: "rule-1",
  tenantId: "tenant-1",
  name: "Demo default",
  priority: 10,
  active: true,
  amountAbsTolerance: new Prisma.Decimal("25"),
  percentTolerance: new Prisma.Decimal("0.015"),
  currencyScope: null as string | null,
  categoryScope: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pickToleranceRuleForIntake", () => {
  it("returns currency-scoped rule before global fallback", async () => {
    vi.mocked(prisma.invoiceToleranceRule.findMany).mockResolvedValue([
      { id: "scoped-usd", currencyScope: "USD", priority: 5, active: true },
      { id: "global", currencyScope: null, priority: 100, active: true },
    ] as never);
    const r = await pickToleranceRuleForIntake({ tenantId: "tenant-1", currency: "usd" });
    expect(r?.id).toBe("scoped-usd");
  });

  it("returns global rule when no currency scope matches", async () => {
    vi.mocked(prisma.invoiceToleranceRule.findMany).mockResolvedValue([
      { id: "global", currencyScope: null, priority: 10, active: true },
      { id: "eur-only", currencyScope: "EUR", priority: 99, active: true },
    ] as never);
    const r = await pickToleranceRuleForIntake({ tenantId: "tenant-1", currency: "USD" });
    expect(r?.id).toBe("global");
  });

  it("returns null when no active rules exist", async () => {
    vi.mocked(prisma.invoiceToleranceRule.findMany).mockResolvedValue([]);
    const r = await pickToleranceRuleForIntake({ tenantId: "tenant-1", currency: "USD" });
    expect(r).toBeNull();
  });
});

describe("getToleranceRuleForTenant", () => {
  it("throws NOT_FOUND when the rule is missing", async () => {
    vi.mocked(prisma.invoiceToleranceRule.findFirst).mockResolvedValue(null);
    await expect(getToleranceRuleForTenant({ tenantId: "tenant-1", ruleId: "missing" })).rejects.toSatisfy(
      (e: unknown) => e instanceof InvoiceAuditError && e.code === "NOT_FOUND",
    );
  });
});

describe("updateToleranceRuleForTenant", () => {
  beforeEach(() => {
    vi.mocked(prisma.invoiceToleranceRule.findFirst).mockResolvedValue(mockRow as never);
  });

  it("throws BAD_INPUT when no fields are supplied", async () => {
    await expect(
      updateToleranceRuleForTenant({ tenantId: "tenant-1", ruleId: "rule-1" }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
    expect(prisma.invoiceToleranceRule.update).not.toHaveBeenCalled();
  });

  it("persists active flag changes", async () => {
    vi.mocked(prisma.invoiceToleranceRule.update).mockResolvedValue({ ...mockRow, active: false } as never);
    const out = await updateToleranceRuleForTenant({
      tenantId: "tenant-1",
      ruleId: "rule-1",
      active: false,
    });
    expect(out.active).toBe(false);
    expect(prisma.invoiceToleranceRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: { active: false },
    });
  });

  it("maps numeric tolerances to Prisma decimals", async () => {
    vi.mocked(prisma.invoiceToleranceRule.update).mockResolvedValue(mockRow as never);
    await updateToleranceRuleForTenant({
      tenantId: "tenant-1",
      ruleId: "rule-1",
      amountAbsTolerance: 40,
      percentTolerance: 0.02,
    });
    const call = vi.mocked(prisma.invoiceToleranceRule.update).mock.calls[0]![0];
    expect(String((call.data as { amountAbsTolerance: Prisma.Decimal }).amountAbsTolerance)).toBe("40");
    expect(String((call.data as { percentTolerance: Prisma.Decimal }).percentTolerance)).toBe("0.02");
  });
});
