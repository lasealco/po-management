import type { Prisma, PrismaClient } from "@prisma/client";

export async function appendSrmSupplierDocumentAudit(
  prisma: PrismaClient,
  args: {
    tenantId: string;
    documentId: string;
    actorUserId: string;
    action: string;
    details?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await prisma.srmSupplierDocumentAuditLog.create({
    data: {
      tenantId: args.tenantId,
      documentId: args.documentId,
      actorUserId: args.actorUserId,
      action: args.action,
      details: args.details === undefined ? undefined : (args.details as Prisma.InputJsonValue),
    },
  });
}
