import {
  InvoiceAuditLineOutcome,
  InvoiceAuditRollupOutcome,
  InvoiceReviewDecision,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import { auditOceanInvoiceLine } from "@/lib/invoice-audit/ocean-line-match";
import { extractSnapshotPriceCandidates } from "@/lib/invoice-audit/snapshot-candidates";
import { pickToleranceRuleForIntake } from "@/lib/invoice-audit/tolerance-rules";

const DEFAULT_ABS_TOL = 25;
const DEFAULT_PCT_TOL = 0.015;

export async function listInvoiceIntakesForTenant(params: { tenantId: string; take?: number }) {
  const take = Math.min(params.take ?? 150, 400);
  return prisma.invoiceIntake.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take,
    include: {
      bookingPricingSnapshot: { select: { id: true, sourceSummary: true, currency: true, frozenAt: true } },
      _count: { select: { lines: true } },
    },
  });
}

/** Recent intakes tied to a snapshot (e.g. pricing snapshot detail cross-links). */
export async function listInvoiceIntakesForSnapshot(params: {
  tenantId: string;
  snapshotId: string;
  previewLimit?: number;
}) {
  const limit = Math.min(params.previewLimit ?? 8, 25);
  const rows = await prisma.invoiceIntake.findMany({
    where: { tenantId: params.tenantId, bookingPricingSnapshotId: params.snapshotId },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      receivedAt: true,
      vendorLabel: true,
      externalInvoiceNo: true,
      status: true,
      rollupOutcome: true,
    },
  });
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export async function getInvoiceIntakeForTenant(params: { tenantId: string; intakeId: string }) {
  const row = await prisma.invoiceIntake.findFirst({
    where: { id: params.intakeId, tenantId: params.tenantId },
    include: {
      bookingPricingSnapshot: {
        select: {
          id: true,
          sourceType: true,
          sourceRecordId: true,
          sourceSummary: true,
          currency: true,
          totalEstimatedCost: true,
          frozenAt: true,
          shipmentBookingId: true,
          shipmentBooking: {
            select: { id: true, bookingNo: true, shipmentId: true },
          },
        },
      },
      lines: { orderBy: { lineNo: "asc" } },
      auditResults: {
        orderBy: { createdAt: "asc" },
        include: {
          line: {
            select: {
              id: true,
              lineNo: true,
              rawDescription: true,
              amount: true,
              currency: true,
            },
          },
          toleranceRule: {
            select: {
              id: true,
              name: true,
              priority: true,
              active: true,
              currencyScope: true,
              amountAbsTolerance: true,
              percentTolerance: true,
            },
          },
        },
      },
    },
  });
  if (!row) throw new InvoiceAuditError("NOT_FOUND", "Invoice intake not found.");
  return row;
}

function rollupFromCounts(g: number, a: number, r: number, u: number): InvoiceAuditRollupOutcome {
  if (r > 0) return "FAIL";
  if (a > 0 || u > 0) return "WARN";
  if (g > 0) return "PASS";
  return "NONE";
}

export async function createInvoiceIntakeWithLines(input: {
  tenantId: string;
  createdByUserId?: string | null;
  bookingPricingSnapshotId: string;
  externalInvoiceNo?: string | null;
  vendorLabel?: string | null;
  invoiceDate?: Date | null;
  currency?: string;
  rawSourceNotes?: string | null;
  polCode?: string | null;
  podCode?: string | null;
  lines: Array<{
    lineNo: number;
    rawDescription: string;
    normalizedLabel?: string | null;
    currency: string;
    amount: string | number;
    unitBasis?: string | null;
    quantity?: string | number | null;
    equipmentType?: string | null;
    chargeStructureHint?: string | null;
    sourceRowJson?: Prisma.InputJsonValue | null;
    parseConfidence?: string | null;
  }>;
}) {
  const snap = await prisma.bookingPricingSnapshot.findFirst({
    where: { id: input.bookingPricingSnapshotId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!snap) {
    throw new InvoiceAuditError("BAD_INPUT", "Pricing snapshot not found for this tenant.");
  }

  if (!input.lines.length) {
    throw new InvoiceAuditError("BAD_INPUT", "At least one invoice line is required.");
  }

  const parseWarnings: string[] = [];
  for (const ln of input.lines) {
    if (!ln.rawDescription?.trim()) {
      throw new InvoiceAuditError("BAD_INPUT", `Line ${ln.lineNo}: rawDescription is required.`);
    }
    const amt = typeof ln.amount === "number" ? ln.amount : Number(ln.amount);
    if (!Number.isFinite(amt)) {
      throw new InvoiceAuditError("BAD_INPUT", `Line ${ln.lineNo}: amount must be a finite number.`);
    }
  }

  const currency = (input.currency ?? "USD").toUpperCase().slice(0, 3);

  return prisma.$transaction(async (tx) => {
    const intake = await tx.invoiceIntake.create({
      data: {
        tenantId: input.tenantId,
        status: "PARSED",
        bookingPricingSnapshotId: input.bookingPricingSnapshotId,
        externalInvoiceNo: input.externalInvoiceNo?.trim() || null,
        vendorLabel: input.vendorLabel?.trim() || null,
        invoiceDate: input.invoiceDate ?? null,
        currency,
        rawSourceNotes: input.rawSourceNotes?.trim() || null,
        polCode: input.polCode?.trim().toUpperCase().slice(0, 8) || null,
        podCode: input.podCode?.trim().toUpperCase().slice(0, 8) || null,
        parseError: null,
        parseWarnings: parseWarnings.length ? parseWarnings : undefined,
        rollupOutcome: "PENDING",
        createdByUserId: input.createdByUserId ?? null,
      },
    });

    for (const ln of input.lines) {
      const amt = typeof ln.amount === "number" ? ln.amount : Number(ln.amount);
      const hint = ln.chargeStructureHint?.trim().toUpperCase();
      const chargeStructureHint =
        hint === "ALL_IN" || hint === "ITEMIZED" ? hint.slice(0, 24) : null;
      await tx.invoiceLine.create({
        data: {
          invoiceIntakeId: intake.id,
          lineNo: ln.lineNo,
          rawDescription: ln.rawDescription.trim(),
          normalizedLabel: ln.normalizedLabel?.trim() || null,
          currency: ln.currency.toUpperCase().slice(0, 3),
          amount: new Prisma.Decimal(String(amt)),
          unitBasis: ln.unitBasis?.trim() || null,
          equipmentType: ln.equipmentType?.trim().toUpperCase().slice(0, 32) || null,
          chargeStructureHint,
          quantity:
            ln.quantity === null || ln.quantity === undefined
              ? null
              : new Prisma.Decimal(String(typeof ln.quantity === "number" ? ln.quantity : Number(ln.quantity))),
          sourceRowJson: ln.sourceRowJson ?? undefined,
          parseConfidence: ln.parseConfidence?.trim() || null,
        },
      });
    }

    return tx.invoiceIntake.findFirstOrThrow({
      where: { id: intake.id },
      include: {
        bookingPricingSnapshot: { select: { id: true, sourceSummary: true, currency: true, frozenAt: true } },
        lines: { orderBy: { lineNo: "asc" } },
      },
    });
  });
}

export async function runInvoiceAuditForIntake(params: {
  tenantId: string;
  invoiceIntakeId: string;
  toleranceRuleId?: string | null;
}) {
  const intake = await prisma.invoiceIntake.findFirst({
    where: { id: params.invoiceIntakeId, tenantId: params.tenantId },
    include: {
      lines: { orderBy: { lineNo: "asc" } },
      bookingPricingSnapshot: true,
    },
  });
  if (!intake) throw new InvoiceAuditError("NOT_FOUND", "Invoice intake not found.");

  if (intake.bookingPricingSnapshot.tenantId !== intake.tenantId) {
    throw new InvoiceAuditError("BAD_INPUT", "Snapshot tenant mismatch (data integrity).");
  }

  if (!intake.lines.length) {
    await prisma.invoiceIntake.update({
      where: { id: intake.id },
      data: {
        status: "FAILED",
        auditRunError: "Cannot run audit: invoice has no lines.",
        rollupOutcome: "NONE",
      },
    });
    throw new InvoiceAuditError("BAD_INPUT", "Cannot run audit: invoice has no lines.");
  }

  await prisma.invoiceIntake.update({
    where: { id: intake.id },
    data: {
      auditRunError: null,
      ...(intake.status === "FAILED" ? { status: "PARSED" as const } : {}),
    },
  });

  const extracted = extractSnapshotPriceCandidates(intake.bookingPricingSnapshot.breakdownJson);
  if (!extracted.ok) {
    await prisma.invoiceIntake.update({
      where: { id: intake.id },
      data: {
        status: "FAILED",
        auditRunError: extracted.error,
        rollupOutcome: "NONE",
      },
    });
    throw new InvoiceAuditError("BAD_INPUT", extracted.error);
  }

  const { candidates, sourceType, rfqGrandTotal, contractGrandTotal } = extracted;

  const aliasRows = await prisma.invoiceChargeAlias.findMany({
    where: { tenantId: intake.tenantId, active: true },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
  const aliases = aliasRows.map((r) => ({
    pattern: r.pattern.trim().toLowerCase(),
    canonicalTokens: Array.isArray(r.canonicalTokens) ? r.canonicalTokens.map((x) => String(x)) : [],
    targetKind: r.targetKind,
    priority: r.priority,
  }));

  let rule =
    params.toleranceRuleId != null && params.toleranceRuleId.trim()
      ? await prisma.invoiceToleranceRule.findFirst({
          where: { id: params.toleranceRuleId.trim(), tenantId: params.tenantId, active: true },
        })
      : null;
  if (params.toleranceRuleId?.trim() && !rule) {
    throw new InvoiceAuditError("NOT_FOUND", "Tolerance rule not found or inactive.");
  }
  if (!rule) {
    rule = await pickToleranceRuleForIntake({ tenantId: params.tenantId, currency: intake.currency });
  }

  const amountAbsTolerance = Number(rule?.amountAbsTolerance ?? DEFAULT_ABS_TOL);
  const percentTolerance = Number(rule?.percentTolerance ?? DEFAULT_PCT_TOL);
  if (!Number.isFinite(amountAbsTolerance) || !Number.isFinite(percentTolerance)) {
    await prisma.invoiceIntake.update({
      where: { id: intake.id },
      data: {
        status: "FAILED",
        auditRunError: "Tolerance rule has non-finite amount or percent tolerance.",
        rollupOutcome: "NONE",
      },
    });
    throw new InvoiceAuditError("BAD_INPUT", "Tolerance rule has invalid numeric tolerances.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceAuditResult.deleteMany({ where: { invoiceIntakeId: intake.id } });

      let g = 0;
      let a = 0;
      let r = 0;
      let u = 0;

      const lineCount = intake.lines.length;

      for (const line of intake.lines) {
        const computed = auditOceanInvoiceLine({
          invoiceLine: {
            rawDescription: line.rawDescription,
            normalizedLabel: line.normalizedLabel,
            currency: line.currency,
            amount: line.amount,
            unitBasis: line.unitBasis,
            equipmentType: line.equipmentType,
            chargeStructureHint: line.chargeStructureHint,
          },
          intake: {
            polCode: intake.polCode,
            podCode: intake.podCode,
          },
          candidates,
          snapshotSourceType: sourceType,
          rfqGrandTotal,
          contractGrandTotal,
          aliases,
          amountAbsTolerance,
          percentTolerance,
          toleranceRuleId: rule?.id ?? null,
          invoiceLineCount: lineCount,
        });

        const outcome = computed.outcome as InvoiceAuditLineOutcome;
        if (outcome === "GREEN") g += 1;
        else if (outcome === "AMBER") a += 1;
        else if (outcome === "RED") r += 1;
        else u += 1;

        await tx.invoiceAuditResult.create({
          data: {
            invoiceIntakeId: intake.id,
            invoiceLineId: line.id,
            bookingPricingSnapshotId: intake.bookingPricingSnapshotId,
            toleranceRuleId: computed.toleranceRuleId,
            outcome,
            discrepancyCategories: computed.discrepancyCategories,
            expectedAmount: computed.expectedAmount,
            amountVariance: computed.amountVariance,
            percentVariance: computed.percentVariance,
            snapshotMatchedJson: computed.snapshotMatchedJson ?? Prisma.JsonNull,
            explanation: computed.explanation,
          },
        });
      }

      const rollup = rollupFromCounts(g, a, r, u);

      await tx.invoiceIntake.update({
        where: { id: intake.id },
        data: {
          status: "AUDITED",
          auditRunError: null,
          lastAuditAt: new Date(),
          rollupOutcome: rollup,
          greenLineCount: g,
          amberLineCount: a,
          redLineCount: r,
          unknownLineCount: u,
          reviewDecision: "NONE",
          reviewNote: null,
          reviewedByUserId: null,
          reviewedAt: null,
          approvedForAccounting: false,
          accountingApprovedAt: null,
          accountingApprovedByUserId: null,
          accountingApprovalNote: null,
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.invoiceIntake.update({
      where: { id: intake.id },
      data: {
        status: "FAILED",
        auditRunError: `Audit engine error: ${msg}`,
        rollupOutcome: "NONE",
      },
    });
    throw e;
  }

  return getInvoiceIntakeForTenant({ tenantId: params.tenantId, intakeId: intake.id });
}

export async function setInvoiceIntakeReview(params: {
  tenantId: string;
  invoiceIntakeId: string;
  reviewDecision: "APPROVED" | "OVERRIDDEN";
  reviewNote?: string | null;
  reviewedByUserId: string;
}) {
  const intake = await prisma.invoiceIntake.findFirst({
    where: { id: params.invoiceIntakeId, tenantId: params.tenantId },
    select: { id: true, status: true },
  });
  if (!intake) throw new InvoiceAuditError("NOT_FOUND", "Invoice intake not found.");
  if (intake.status !== "AUDITED") {
    throw new InvoiceAuditError(
      "CONFLICT",
      `Review is only allowed after a successful audit (current status: ${intake.status}).`,
    );
  }

  const decision: InvoiceReviewDecision =
    params.reviewDecision === "APPROVED" ? "APPROVED" : "OVERRIDDEN";

  return prisma.invoiceIntake.update({
    where: { id: intake.id },
    data: {
      reviewDecision: decision,
      reviewNote: params.reviewNote?.trim() || null,
      reviewedByUserId: params.reviewedByUserId,
      reviewedAt: new Date(),
      approvedForAccounting: false,
      accountingApprovedAt: null,
      accountingApprovedByUserId: null,
      accountingApprovalNote: null,
    },
    include: {
      bookingPricingSnapshot: {
        select: {
          id: true,
          sourceSummary: true,
          currency: true,
          frozenAt: true,
        },
      },
      lines: { orderBy: { lineNo: "asc" } },
      auditResults: true,
    },
  });
}

/**
 * Single transaction when the UI saves finance review and accounting handoff together
 * (avoids a torn state if the second update failed mid-flight).
 */
const RAW_SOURCE_NOTES_MAX_LEN = 12_000;

export async function setInvoiceIntakeRawSourceNotes(params: {
  tenantId: string;
  invoiceIntakeId: string;
  rawSourceNotes: string | null;
}) {
  const intake = await prisma.invoiceIntake.findFirst({
    where: { id: params.invoiceIntakeId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!intake) throw new InvoiceAuditError("NOT_FOUND", "Invoice intake not found.");

  const trimmed = typeof params.rawSourceNotes === "string" ? params.rawSourceNotes.trim() : "";
  const value = trimmed.length === 0 ? null : trimmed;
  if (value && value.length > RAW_SOURCE_NOTES_MAX_LEN) {
    throw new InvoiceAuditError(
      "BAD_INPUT",
      `rawSourceNotes cannot exceed ${RAW_SOURCE_NOTES_MAX_LEN} characters.`,
    );
  }

  await prisma.invoiceIntake.update({
    where: { id: intake.id },
    data: { rawSourceNotes: value },
  });
}

export async function patchInvoiceIntakeReviewAndAccounting(params: {
  tenantId: string;
  invoiceIntakeId: string;
  actorUserId: string;
  reviewDecision: "APPROVED" | "OVERRIDDEN";
  reviewNote: string | null;
  approvedForAccounting: boolean;
  accountingApprovalNote: string | null;
}) {
  const decision: InvoiceReviewDecision =
    params.reviewDecision === "APPROVED" ? "APPROVED" : "OVERRIDDEN";

  return prisma.$transaction(async (tx) => {
    const intake = await tx.invoiceIntake.findFirst({
      where: { id: params.invoiceIntakeId, tenantId: params.tenantId },
      select: { id: true, status: true },
    });
    if (!intake) throw new InvoiceAuditError("NOT_FOUND", "Invoice intake not found.");
    if (intake.status !== "AUDITED") {
      throw new InvoiceAuditError(
        "CONFLICT",
        `Review is only allowed after a successful audit (current status: ${intake.status}).`,
      );
    }

    await tx.invoiceIntake.update({
      where: { id: intake.id },
      data: {
        reviewDecision: decision,
        reviewNote: params.reviewNote?.trim() || null,
        reviewedByUserId: params.actorUserId,
        reviewedAt: new Date(),
        approvedForAccounting: false,
        accountingApprovedAt: null,
        accountingApprovedByUserId: null,
        accountingApprovalNote: null,
      },
    });

    const now = new Date();
    await tx.invoiceIntake.update({
      where: { id: intake.id },
      data: params.approvedForAccounting
        ? {
            approvedForAccounting: true,
            accountingApprovedAt: now,
            accountingApprovedByUserId: params.actorUserId,
            accountingApprovalNote: params.accountingApprovalNote?.trim() || null,
          }
        : {
            approvedForAccounting: false,
            accountingApprovedAt: null,
            accountingApprovedByUserId: null,
            accountingApprovalNote: null,
          },
    });

    return tx.invoiceIntake.findFirstOrThrow({
      where: { id: intake.id },
      include: {
        bookingPricingSnapshot: {
          select: {
            id: true,
            sourceSummary: true,
            currency: true,
            frozenAt: true,
          },
        },
        lines: { orderBy: { lineNo: "asc" } },
        auditResults: true,
      },
    });
  });
}

export async function setInvoiceIntakeAccountingHandoff(params: {
  tenantId: string;
  invoiceIntakeId: string;
  approvedForAccounting: boolean;
  accountingApprovalNote?: string | null;
  actorUserId: string;
}) {
  const intake = await prisma.invoiceIntake.findFirst({
    where: { id: params.invoiceIntakeId, tenantId: params.tenantId },
    select: { id: true, status: true, reviewDecision: true },
  });
  if (!intake) throw new InvoiceAuditError("NOT_FOUND", "Invoice intake not found.");
  if (intake.status !== "AUDITED") {
    throw new InvoiceAuditError(
      "CONFLICT",
      `Accounting handoff is only allowed after a successful audit (current status: ${intake.status}).`,
    );
  }
  if (intake.reviewDecision === "NONE") {
    throw new InvoiceAuditError(
      "CONFLICT",
      "Record a finance review decision (Approve or Override) before marking accounting handoff.",
    );
  }

  const now = new Date();
  return prisma.invoiceIntake.update({
    where: { id: intake.id },
    data: params.approvedForAccounting
      ? {
          approvedForAccounting: true,
          accountingApprovedAt: now,
          accountingApprovedByUserId: params.actorUserId,
          accountingApprovalNote: params.accountingApprovalNote?.trim() || null,
        }
      : {
          approvedForAccounting: false,
          accountingApprovedAt: null,
          accountingApprovedByUserId: null,
          accountingApprovalNote: null,
        },
    include: {
      bookingPricingSnapshot: {
        select: {
          id: true,
          sourceSummary: true,
          currency: true,
          frozenAt: true,
        },
      },
      lines: { orderBy: { lineNo: "asc" } },
      auditResults: true,
    },
  });
}
