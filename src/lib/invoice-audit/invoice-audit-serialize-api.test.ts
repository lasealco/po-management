import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  serializeInvoiceIntakeListRow,
  serializeInvoiceLine,
  serializeToleranceRule,
} from "@/app/api/invoice-audit/_lib/serialize";

describe("serializeInvoiceLine", () => {
  it("stringifies decimals and ISO dates", () => {
    const now = new Date("2026-03-15T10:00:00.000Z");
    const out = serializeInvoiceLine({
      id: "ln1",
      invoiceIntakeId: "in1",
      lineNo: 2,
      rawDescription: "THC origin",
      normalizedLabel: "THC",
      currency: "USD",
      amount: new Prisma.Decimal("185.5"),
      unitBasis: "PER_CONTAINER",
      equipmentType: "40HC",
      chargeStructureHint: "ITEMIZED",
      quantity: new Prisma.Decimal("1"),
      sourceRowJson: { row: 2 },
      parseConfidence: "HIGH",
      createdAt: now,
      updatedAt: now,
    } as never);

    expect(out.amount).toBe("185.5");
    expect(out.quantity).toBe("1");
    expect(out.createdAt).toBe("2026-03-15T10:00:00.000Z");
    expect(out.lineNo).toBe(2);
  });

  it("maps null quantity and tolerances to null strings where applicable", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const out = serializeInvoiceLine({
      id: "ln1",
      invoiceIntakeId: "in1",
      lineNo: 1,
      rawDescription: "X",
      normalizedLabel: null,
      currency: "USD",
      amount: new Prisma.Decimal("0"),
      unitBasis: null,
      equipmentType: null,
      chargeStructureHint: null,
      quantity: null,
      sourceRowJson: null,
      parseConfidence: null,
      createdAt: now,
      updatedAt: now,
    } as never);

    expect(out.quantity).toBeNull();
    expect(out.normalizedLabel).toBeNull();
  });
});

describe("serializeToleranceRule", () => {
  it("stringifies amount and percent tolerances", () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    const out = serializeToleranceRule({
      id: "t1",
      tenantId: "ten1",
      name: "USD ocean",
      priority: 5,
      active: true,
      amountAbsTolerance: new Prisma.Decimal("25"),
      percentTolerance: new Prisma.Decimal("0.015"),
      currencyScope: "USD",
      categoryScope: null,
      createdAt: now,
      updatedAt: now,
    } as never);

    expect(out.amountAbsTolerance).toBe("25");
    expect(out.percentTolerance).toBe("0.015");
  });

  it("uses null for missing decimal tolerances", () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    const out = serializeToleranceRule({
      id: "t1",
      tenantId: "ten1",
      name: "Open",
      priority: 0,
      active: true,
      amountAbsTolerance: null,
      percentTolerance: null,
      currencyScope: "ANY",
      categoryScope: null,
      createdAt: now,
      updatedAt: now,
    } as never);

    expect(out.amountAbsTolerance).toBeNull();
    expect(out.percentTolerance).toBeNull();
  });
});

describe("serializeInvoiceIntakeListRow", () => {
  const frozen = new Date("2026-04-01T12:00:00.000Z");
  const received = new Date("2026-04-02T08:00:00.000Z");
  const baseRow = {
    id: "in1",
    tenantId: "ten1",
    status: "REVIEWED",
    bookingPricingSnapshotId: "snap1",
    externalInvoiceNo: "INV-9",
    vendorLabel: "Carrier",
    invoiceDate: new Date("2026-03-20T15:30:00.000Z"),
    currency: "USD",
    rollupOutcome: "GREEN",
    greenLineCount: 3,
    amberLineCount: 0,
    redLineCount: 0,
    unknownLineCount: 0,
    reviewDecision: null,
    receivedAt: received,
    lastAuditAt: new Date("2026-04-02T09:00:00.000Z"),
    auditRunError: null,
    parseError: null,
    bookingPricingSnapshot: {
      id: "snap1",
      sourceSummary: "Contract v3",
      currency: "USD",
      frozenAt: frozen,
    },
  };

  it("formats invoiceDate as YYYY-MM-DD and snapshot frozenAt as ISO", () => {
    const out = serializeInvoiceIntakeListRow({ ...baseRow, _count: { lines: 3 } } as never);
    expect(out.invoiceDate).toBe("2026-03-20");
    expect(out.bookingPricingSnapshot.frozenAt).toBe("2026-04-01T12:00:00.000Z");
    expect(out.parsedLineCount).toBe(3);
  });

  it("defaults parsedLineCount to 0 when _count is absent", () => {
    const out = serializeInvoiceIntakeListRow(baseRow as never);
    expect(out.parsedLineCount).toBe(0);
  });

  it("maps null invoiceDate and lastAuditAt", () => {
    const out = serializeInvoiceIntakeListRow({
      ...baseRow,
      invoiceDate: null,
      lastAuditAt: null,
    } as never);
    expect(out.invoiceDate).toBeNull();
    expect(out.lastAuditAt).toBeNull();
  });
});
