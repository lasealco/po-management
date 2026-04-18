import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { serializeAuditResult } from "@/app/api/invoice-audit/_lib/serialize";

describe("serializeAuditResult", () => {
  it("includes toleranceRule summary when relation is loaded", () => {
    const serialized = serializeAuditResult({
      id: "ar1",
      invoiceIntakeId: "in1",
      invoiceLineId: "ln1",
      bookingPricingSnapshotId: "snap1",
      toleranceRuleId: "tol1",
      outcome: "GREEN",
      discrepancyCategories: [],
      expectedAmount: new Prisma.Decimal("100"),
      amountVariance: new Prisma.Decimal("0"),
      percentVariance: new Prisma.Decimal("0"),
      snapshotMatchedJson: { kind: "CONTRACT_CHARGE", id: "c1" },
      explanation: "ok",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      toleranceRule: {
        id: "tol1",
        name: "USD default",
        priority: 10,
        active: true,
        currencyScope: "USD",
        amountAbsTolerance: new Prisma.Decimal("25"),
        percentTolerance: new Prisma.Decimal("0.015"),
      },
      line: {
        id: "ln1",
        lineNo: 1,
        rawDescription: "THC",
        amount: new Prisma.Decimal("100"),
        currency: "USD",
      },
    } as never);

    expect(serialized.toleranceRuleId).toBe("tol1");
    expect(serialized.toleranceRule).toEqual({
      id: "tol1",
      name: "USD default",
      priority: 10,
      active: true,
      currencyScope: "USD",
      amountAbsTolerance: "25",
      percentTolerance: "0.015",
    });
  });

  it("omits toleranceRule object when relation not loaded", () => {
    const serialized = serializeAuditResult({
      id: "ar1",
      invoiceIntakeId: "in1",
      invoiceLineId: "ln1",
      bookingPricingSnapshotId: "snap1",
      toleranceRuleId: null,
      outcome: "UNKNOWN",
      discrepancyCategories: [],
      expectedAmount: null,
      amountVariance: null,
      percentVariance: null,
      snapshotMatchedJson: null,
      explanation: "none",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      line: null,
    } as never);

    expect(serialized.toleranceRule).toBeNull();
  });
});
