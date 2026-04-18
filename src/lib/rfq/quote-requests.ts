import {
  Prisma,
  type QuoteClarificationVisibility,
  type QuoteRecipientInvitationStatus,
  type QuoteRequestStatus,
  type TariffTransportMode,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { RfqRepoError } from "@/lib/rfq/rfq-repo-error";

export async function listQuoteRequestsForTenant(params: { tenantId: string; take?: number }) {
  const take = Math.min(params.take ?? 100, 300);
  return prisma.quoteRequest.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { recipients: true, responses: true } },
    },
  });
}

export async function getQuoteRequestDetail(params: { tenantId: string; quoteRequestId: string }) {
  const row = await prisma.quoteRequest.findFirst({
    where: { id: params.quoteRequestId, tenantId: params.tenantId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      recipients: {
        orderBy: { createdAt: "asc" },
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          response: {
            include: { lines: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      clarifications: {
        orderBy: { createdAt: "desc" },
        take: 80,
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  if (!row) throw new RfqRepoError("NOT_FOUND", "Quote request not found.");
  return row;
}

export async function createQuoteRequest(input: {
  tenantId: string;
  title: string;
  description?: string | null;
  transportMode?: TariffTransportMode;
  originLabel: string;
  destinationLabel: string;
  equipmentSummary?: string | null;
  cargoDescription?: string | null;
  quotesDueAt?: Date | null;
  ownerUserId?: string | null;
  status?: QuoteRequestStatus;
}) {
  return prisma.quoteRequest.create({
    data: {
      tenantId: input.tenantId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      transportMode: input.transportMode ?? "OCEAN",
      originLabel: input.originLabel.trim(),
      destinationLabel: input.destinationLabel.trim(),
      equipmentSummary: input.equipmentSummary?.trim() || null,
      cargoDescription: input.cargoDescription?.trim() || null,
      ...(input.quotesDueAt !== undefined ? { quotesDueAt: input.quotesDueAt } : {}),
      ownerUserId: input.ownerUserId ?? null,
      status: input.status ?? "DRAFT",
    },
  });
}

export async function updateQuoteRequest(
  tenantId: string,
  quoteRequestId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    status: QuoteRequestStatus;
    transportMode: TariffTransportMode;
    originLabel: string;
    destinationLabel: string;
    equipmentSummary: string | null;
    cargoDescription: string | null;
    quotesDueAt: Date | null;
    lastBroadcastAt: Date | null;
  }>,
) {
  const exists = await prisma.quoteRequest.findFirst({
    where: { id: quoteRequestId, tenantId },
    select: { id: true },
  });
  if (!exists) throw new RfqRepoError("NOT_FOUND", "Quote request not found.");
  return prisma.quoteRequest.update({
    where: { id: quoteRequestId },
    data: {
      ...(patch.title != null ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      ...(patch.status != null ? { status: patch.status } : {}),
      ...(patch.transportMode != null ? { transportMode: patch.transportMode } : {}),
      ...(patch.originLabel != null ? { originLabel: patch.originLabel.trim() } : {}),
      ...(patch.destinationLabel != null ? { destinationLabel: patch.destinationLabel.trim() } : {}),
      ...(patch.equipmentSummary !== undefined ? { equipmentSummary: patch.equipmentSummary?.trim() || null } : {}),
      ...(patch.cargoDescription !== undefined ? { cargoDescription: patch.cargoDescription?.trim() || null } : {}),
      ...(patch.quotesDueAt !== undefined ? { quotesDueAt: patch.quotesDueAt } : {}),
      ...(patch.lastBroadcastAt !== undefined ? { lastBroadcastAt: patch.lastBroadcastAt } : {}),
    },
  });
}

export async function addQuoteRequestRecipient(input: {
  tenantId: string;
  quoteRequestId: string;
  supplierId?: string | null;
  displayName: string;
  contactEmail?: string | null;
}) {
  const qr = await prisma.quoteRequest.findFirst({
    where: { id: input.quoteRequestId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!qr) throw new RfqRepoError("NOT_FOUND", "Quote request not found.");

  if (input.supplierId) {
    const sup = await prisma.supplier.findFirst({
      where: { id: input.supplierId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!sup) throw new RfqRepoError("BAD_INPUT", "Supplier not found for this tenant.");
  }

  return prisma.quoteRequestRecipient.create({
    data: {
      quoteRequestId: input.quoteRequestId,
      supplierId: input.supplierId?.trim() || null,
      displayName: input.displayName.trim(),
      contactEmail: input.contactEmail?.trim() || null,
    },
  });
}

export async function markRecipientInvited(params: {
  tenantId: string;
  quoteRequestId: string;
  recipientId: string;
  metadata?: Prisma.InputJsonValue | null;
}) {
  const rec = await prisma.quoteRequestRecipient.findFirst({
    where: {
      id: params.recipientId,
      quoteRequestId: params.quoteRequestId,
      quoteRequest: { tenantId: params.tenantId },
    },
    select: { id: true },
  });
  if (!rec) throw new RfqRepoError("NOT_FOUND", "Recipient not found.");
  const meta: Prisma.InputJsonValue =
    params.metadata !== undefined && params.metadata !== null
      ? params.metadata
      : { stub: true, note: "No outbound email sent yet." };

  return prisma.quoteRequestRecipient.update({
    where: { id: params.recipientId },
    data: {
      invitationStatus: "INVITED" as QuoteRecipientInvitationStatus,
      invitedAt: new Date(),
      lastInviteMetadata: meta,
    },
  });
}

export async function removeQuoteRequestRecipient(params: {
  tenantId: string;
  quoteRequestId: string;
  recipientId: string;
}) {
  const rec = await prisma.quoteRequestRecipient.findFirst({
    where: {
      id: params.recipientId,
      quoteRequestId: params.quoteRequestId,
      quoteRequest: { tenantId: params.tenantId },
    },
    select: { id: true },
  });
  if (!rec) throw new RfqRepoError("NOT_FOUND", "Recipient not found.");
  await prisma.quoteRequestRecipient.delete({ where: { id: params.recipientId } });
}

export async function addQuoteClarification(input: {
  tenantId: string;
  quoteRequestId: string;
  authorUserId?: string | null;
  body: string;
  visibility?: QuoteClarificationVisibility;
  recipientId?: string | null;
  quoteResponseId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  const qr = await prisma.quoteRequest.findFirst({
    where: { id: input.quoteRequestId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!qr) throw new RfqRepoError("NOT_FOUND", "Quote request not found.");

  return prisma.quoteClarificationMessage.create({
    data: {
      quoteRequestId: input.quoteRequestId,
      authorUserId: input.authorUserId ?? null,
      body: input.body.trim(),
      visibility: input.visibility ?? "INTERNAL",
      recipientId: input.recipientId ?? null,
      quoteResponseId: input.quoteResponseId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
