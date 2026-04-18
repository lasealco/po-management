import { Prisma, type QuoteResponseStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { RfqRepoError } from "@/lib/rfq/rfq-repo-error";

export async function ensureDraftQuoteResponse(params: {
  tenantId: string;
  quoteRequestId: string;
  recipientId: string;
}) {
  const recipient = await prisma.quoteRequestRecipient.findFirst({
    where: {
      id: params.recipientId,
      quoteRequestId: params.quoteRequestId,
      quoteRequest: { tenantId: params.tenantId },
    },
    select: { id: true, quoteRequestId: true, response: { select: { id: true } } },
  });
  if (!recipient) throw new RfqRepoError("NOT_FOUND", "Recipient not found.");

  if (recipient.response) {
    return prisma.quoteResponse.findUniqueOrThrow({
      where: { id: recipient.response.id },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
  }

  return prisma.quoteResponse.create({
    data: {
      quoteRequestId: recipient.quoteRequestId,
      recipientId: recipient.id,
      status: "DRAFT",
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function getQuoteResponseForTenant(params: { tenantId: string; responseId: string }) {
  const row = await prisma.quoteResponse.findFirst({
    where: {
      id: params.responseId,
      quoteRequest: { tenantId: params.tenantId },
    },
    include: {
      recipient: { include: { supplier: { select: { id: true, name: true, code: true } } } },
      quoteRequest: { select: { id: true, title: true, status: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!row) throw new RfqRepoError("NOT_FOUND", "Quote response not found.");
  return row;
}

export type QuoteResponseLineInput = {
  lineType: string;
  label: string;
  amount?: number | null;
  currency?: string;
  unitBasis?: string | null;
  isIncluded?: boolean;
  notes?: string | null;
  sortOrder?: number;
};

export async function updateQuoteResponseWithLines(params: {
  tenantId: string;
  responseId: string;
  patch: Partial<{
    currency: string;
    totalAllInAmount: number | null;
    validityFrom: Date | null;
    validityTo: Date | null;
    includedChargesJson: Prisma.InputJsonValue | null;
    excludedChargesJson: Prisma.InputJsonValue | null;
    freeTimeSummaryJson: Prisma.InputJsonValue | null;
    reviewNotes: string | null;
  }>;
  lines?: QuoteResponseLineInput[] | null;
}) {
  const res = await prisma.quoteResponse.findFirst({
    where: { id: params.responseId, quoteRequest: { tenantId: params.tenantId } },
    select: { id: true, status: true },
  });
  if (!res) throw new RfqRepoError("NOT_FOUND", "Quote response not found.");
  if (res.status !== "DRAFT") {
    throw new RfqRepoError("CONFLICT", "Only draft quotes can be edited.");
  }

  const { patch, lines } = params;

  const jsonField = (v: Prisma.InputJsonValue | null | undefined) =>
    v === undefined ? undefined : v === null ? Prisma.DbNull : v;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.quoteResponse.update({
      where: { id: params.responseId },
      data: {
        ...(patch.currency != null ? { currency: patch.currency.trim().toUpperCase().slice(0, 3) } : {}),
        ...(patch.totalAllInAmount !== undefined ? { totalAllInAmount: patch.totalAllInAmount } : {}),
        ...(patch.validityFrom !== undefined ? { validityFrom: patch.validityFrom } : {}),
        ...(patch.validityTo !== undefined ? { validityTo: patch.validityTo } : {}),
        ...(patch.includedChargesJson !== undefined
          ? { includedChargesJson: jsonField(patch.includedChargesJson) }
          : {}),
        ...(patch.excludedChargesJson !== undefined
          ? { excludedChargesJson: jsonField(patch.excludedChargesJson) }
          : {}),
        ...(patch.freeTimeSummaryJson !== undefined
          ? { freeTimeSummaryJson: jsonField(patch.freeTimeSummaryJson) }
          : {}),
        ...(patch.reviewNotes !== undefined ? { reviewNotes: patch.reviewNotes?.trim() || null } : {}),
      },
    });

    if (lines != null) {
      await tx.quoteResponseLine.deleteMany({ where: { quoteResponseId: params.responseId } });
      if (lines.length > 0) {
        await tx.quoteResponseLine.createMany({
          data: lines.map((l, idx) => ({
            quoteResponseId: params.responseId,
            sortOrder: l.sortOrder ?? idx,
            lineType: l.lineType.trim(),
            label: l.label.trim(),
            amount: l.amount ?? null,
            currency: (l.currency ?? "USD").trim().toUpperCase().slice(0, 3),
            unitBasis: l.unitBasis?.trim() || null,
            isIncluded: l.isIncluded ?? true,
            notes: l.notes?.trim() || null,
          })),
        });
      }
    }

    return tx.quoteResponse.findUniqueOrThrow({
      where: { id: updated.id },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
  });
}

export async function submitQuoteResponse(params: { tenantId: string; responseId: string }) {
  const res = await prisma.quoteResponse.findFirst({
    where: { id: params.responseId, quoteRequest: { tenantId: params.tenantId } },
    include: { recipient: { select: { id: true } } },
  });
  if (!res) throw new RfqRepoError("NOT_FOUND", "Quote response not found.");
  if (res.status !== "DRAFT") throw new RfqRepoError("CONFLICT", "Only draft quotes can be submitted.");

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.quoteResponse.update({
      where: { id: params.responseId },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
      },
    });
    await tx.quoteRequestRecipient.update({
      where: { id: res.recipient.id },
      data: {
        invitationStatus: "RESPONDED",
        respondedAt: now,
      },
    });
    return updated;
  });
}

export async function updateQuoteResponseReview(params: {
  tenantId: string;
  responseId: string;
  status: QuoteResponseStatus;
  reviewNotes?: string | null;
}) {
  const res = await prisma.quoteResponse.findFirst({
    where: { id: params.responseId, quoteRequest: { tenantId: params.tenantId } },
    select: { id: true, status: true, quoteRequestId: true },
  });
  if (!res) throw new RfqRepoError("NOT_FOUND", "Quote response not found.");

  if (!["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"].includes(res.status)) {
    throw new RfqRepoError("CONFLICT", "Quote must be submitted before review actions.");
  }

  const allowed: QuoteResponseStatus[] = ["UNDER_REVIEW", "SHORTLISTED", "AWARDED", "REJECTED", "WITHDRAWN"];
  if (!allowed.includes(params.status)) {
    throw new RfqRepoError("BAD_INPUT", "Invalid review status.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.quoteResponse.update({
      where: { id: params.responseId },
      data: {
        status: params.status,
        reviewedAt: new Date(),
        ...(params.reviewNotes !== undefined ? { reviewNotes: params.reviewNotes?.trim() || null } : {}),
      },
    });
    if (params.status === "AWARDED") {
      await tx.quoteRequest.update({
        where: { id: res.quoteRequestId },
        data: { status: "AWARDED" },
      });
    }
    return updated;
  });
}
