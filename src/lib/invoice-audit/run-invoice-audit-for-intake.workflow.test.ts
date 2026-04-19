import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  invoiceIntake,
  invoiceChargeAlias,
  invoiceToleranceRule,
  invoiceAuditResult,
  txInvoiceIntake,
  $transaction,
} = vi.hoisted(() => {
  const intake = {
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const chargeAlias = { findMany: vi.fn() };
  const toleranceRule = { findMany: vi.fn(), findFirst: vi.fn() };
  const auditResult = {
    deleteMany: vi.fn(),
    create: vi.fn(),
  };
  const txIntake = { update: vi.fn() };
  const tx = {
    invoiceAuditResult: auditResult,
    invoiceIntake: txIntake,
  };
  const trx = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  const mock = {
    invoiceIntake: intake,
    invoiceChargeAlias: chargeAlias,
    invoiceToleranceRule: toleranceRule,
    $transaction: trx,
  };
  return {
    prismaMock: mock,
    invoiceIntake: intake,
    invoiceChargeAlias: chargeAlias,
    invoiceToleranceRule: toleranceRule,
    invoiceAuditResult: auditResult,
    txInvoiceIntake: txIntake,
    $transaction: trx,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { runInvoiceAuditForIntake } from "@/lib/invoice-audit/invoice-intakes";

const rfqBreakdown = {
  sourceType: "QUOTE_RESPONSE",
  quoteRequest: {
    originLabel: "Port USNYC",
    destinationLabel: "DEHAM",
  },
  lines: [
    {
      id: "l1",
      lineType: "FREIGHT",
      label: "Ocean FCL 40HC base",
      amount: "2500",
      currency: "USD",
      unitBasis: "PER_CONTAINER",
      isIncluded: false,
      notes: "",
    },
  ],
  totals: { grand: 2500 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(invoiceChargeAlias.findMany).mockResolvedValue([]);
  vi.mocked(invoiceToleranceRule.findMany).mockResolvedValue([]);
  vi.mocked(invoiceToleranceRule.findFirst).mockResolvedValue(null);
  vi.mocked(invoiceIntake.update).mockResolvedValue({} as never);
  vi.mocked(invoiceAuditResult.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(invoiceAuditResult.create).mockResolvedValue({ id: "ar1" } as never);
  vi.mocked(txInvoiceIntake.update).mockResolvedValue({} as never);
  vi.mocked(invoiceIntake.findFirst).mockImplementation(async (args: { include?: Record<string, unknown> }) => {
    if (args.include && "auditResults" in args.include) {
      return makeAuditedIntakeForFetch() as never;
    }
    return makeParsedIntakeForRun() as never;
  });
});

function makeParsedIntakeForRun() {
  return {
    id: "in_take_1",
    tenantId: "tenant_1",
    status: "PARSED",
    currency: "USD",
    polCode: "USNYC",
    podCode: "DEHAM",
    bookingPricingSnapshotId: "snap_1",
    lines: [
      {
        id: "line_1",
        lineNo: 1,
        rawDescription: "Ocean FCL 40HC base freight",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("2500"),
        unitBasis: "PER_CONTAINER",
        equipmentType: "40HC",
        chargeStructureHint: "ITEMIZED",
      },
    ],
    bookingPricingSnapshot: {
      id: "snap_1",
      tenantId: "tenant_1",
      breakdownJson: rfqBreakdown,
    },
  };
}

function makeAuditedIntakeForFetch() {
  const base = makeParsedIntakeForRun();
  const line = base.lines[0]!;
  return {
    ...base,
    status: "AUDITED",
    rollupOutcome: "PASS",
    greenLineCount: 1,
    amberLineCount: 0,
    redLineCount: 0,
    unknownLineCount: 0,
    auditRunError: null,
    lastAuditAt: new Date("2026-04-18T12:00:00.000Z"),
    reviewDecision: "NONE",
    approvedForAccounting: false,
    bookingPricingSnapshot: {
      id: "snap_1",
      sourceType: "QUOTE_RESPONSE",
      sourceRecordId: "q1",
      sourceSummary: "Demo RFQ",
      currency: "USD",
      totalEstimatedCost: new Prisma.Decimal("2500"),
      frozenAt: new Date("2026-04-01T00:00:00.000Z"),
    },
    lines: [line],
    auditResults: [
      {
        id: "ar1",
        invoiceLineId: line.id,
        outcome: "GREEN",
        discrepancyCategories: [],
        expectedAmount: new Prisma.Decimal("2500"),
        amountVariance: new Prisma.Decimal("0"),
        explanation: "ok",
        snapshotMatchedJson: { id: "l1", kind: "RFQ_LINE" },
        toleranceRule: null,
        line,
      },
    ],
  };
}

describe("runInvoiceAuditForIntake (workflow, mocked Prisma)", () => {
  it("loads intake, clears prior errors, runs matcher in a transaction, then returns AUDITED intake", async () => {
    const row = await runInvoiceAuditForIntake({
      tenantId: "tenant_1",
      invoiceIntakeId: "in_take_1",
    });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(invoiceAuditResult.deleteMany).toHaveBeenCalledWith({
      where: { invoiceIntakeId: "in_take_1" },
    });
    expect(invoiceAuditResult.create).toHaveBeenCalledTimes(1);
    const createArg = vi.mocked(invoiceAuditResult.create).mock.calls[0]![0] as {
      data: { outcome: string; invoiceLineId: string };
    };
    expect(createArg.data.outcome).toBe("GREEN");
    expect(createArg.data.invoiceLineId).toBe("line_1");

    expect(txInvoiceIntake.update).toHaveBeenCalledWith({
      where: { id: "in_take_1" },
      data: expect.objectContaining({
        status: "AUDITED",
        rollupOutcome: "PASS",
        greenLineCount: 1,
        reviewDecision: "NONE",
        approvedForAccounting: false,
      }),
    });

    expect(invoiceIntake.findFirst).toHaveBeenCalled();
    expect(row.status).toBe("AUDITED");
    expect(row.rollupOutcome).toBe("PASS");
    expect(row.auditResults).toHaveLength(1);
    expect(row.auditResults[0]?.outcome).toBe("GREEN");
  });

  it("marks FAILED when snapshot breakdown cannot be extracted", async () => {
    vi.mocked(invoiceIntake.findFirst).mockImplementation(async (args: { include?: Record<string, unknown> }) => {
      if (args.include && "auditResults" in args.include) {
        return makeAuditedIntakeForFetch() as never;
      }
      const bad = makeParsedIntakeForRun();
      return {
        ...bad,
        bookingPricingSnapshot: {
          ...bad.bookingPricingSnapshot,
          breakdownJson: { sourceType: "QUOTE_RESPONSE" },
        },
      } as never;
    });

    const { InvoiceAuditError } = await import("@/lib/invoice-audit/invoice-audit-error");
    await expect(
      runInvoiceAuditForIntake({ tenantId: "tenant_1", invoiceIntakeId: "in_take_1" }),
    ).rejects.toSatisfy((e: unknown) => e instanceof InvoiceAuditError && e.code === "BAD_INPUT");

    expect($transaction).not.toHaveBeenCalled();
    const failUpdate = vi.mocked(invoiceIntake.update).mock.calls.find(
      (c) => (c[0] as { data?: { status?: string } }).data?.status === "FAILED",
    );
    expect(failUpdate).toBeTruthy();
  });
});
