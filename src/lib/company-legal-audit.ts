import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CompanyLegalEntityAuditAction = "CREATE" | "UPDATE" | "DELETE";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Append-only audit for company legal profile changes (org scope enforced at API before call).
 */
export function recordCompanyLegalEntityAudit(
  db: Db,
  input: {
    tenantId: string;
    orgUnitId: string;
    actorUserId: string;
    action: CompanyLegalEntityAuditAction;
    companyLegalEntityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<unknown> {
  return db.companyLegalEntityAuditLog.create({
    data: {
      tenantId: input.tenantId,
      orgUnitId: input.orgUnitId,
      actorUserId: input.actorUserId,
      action: input.action,
      companyLegalEntityId: input.companyLegalEntityId ?? null,
      metadata: input.metadata === undefined ? undefined : input.metadata,
    },
  });
}
