import type { Prisma, PrismaClient } from "@prisma/client";

/** Accepts `prisma` or a `$transaction` client — both expose `srmSupplierDocumentAuditLog.create`. */
type SrmDocumentAuditLogClient = Pick<PrismaClient, "srmSupplierDocumentAuditLog">;

export async function appendSrmSupplierDocumentAudit(
  prisma: SrmDocumentAuditLogClient,
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
