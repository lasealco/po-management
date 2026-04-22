import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Upper bound for list endpoints (contract scope + object-type tail). */
export const TARIFF_AUDIT_LOG_MAX_TAKE = 200;

export async function recordTariffAuditLog(input: {
  objectType: string;
  objectId: string;
  action: string;
  userId: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  const objectType = input.objectType.trim();
  if (!objectType) {
    throw new Error("recordTariffAuditLog: objectType is required.");
  }
  await prisma.tariffAuditLog.create({
    data: {
      objectType,
      objectId: input.objectId,
      action: input.action,
      userId: input.userId,
      oldValue:
        input.oldValue === undefined
          ? undefined
          : (input.oldValue as Prisma.InputJsonValue),
      newValue:
        input.newValue === undefined
          ? undefined
          : (input.newValue as Prisma.InputJsonValue),
    },
  });
}

export async function listTariffAuditLogsForContractScope(params: {
  headerId: string;
  versionIds: string[];
  /** Rate/charge/free-time line ids tied to this version (optional). */
  relatedLineObjectIds?: string[];
  take?: number;
}) {
  const take = Math.min(Math.max(params.take ?? 40, 1), TARIFF_AUDIT_LOG_MAX_TAKE);
  const versionIds = params.versionIds.filter(Boolean);
  const related = (params.relatedLineObjectIds ?? []).filter(Boolean);
  const or: Prisma.TariffAuditLogWhereInput[] = [
    { objectType: "contract_header", objectId: params.headerId },
  ];
  if (versionIds.length > 0) {
    or.push({ objectType: "contract_version", objectId: { in: versionIds } });
  }
  if (related.length > 0) {
    or.push({
      AND: [
        { objectId: { in: related } },
        {
          objectType: {
            in: ["tariff_rate_line", "tariff_charge_line", "tariff_free_time_rule"],
          },
        },
      ],
    });
  }
  return prisma.tariffAuditLog.findMany({
    where: { OR: or },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

/** e.g. global `normalized_charge_code` maintenance outside a single contract version. */
export async function listTariffAuditLogsByObjectType(params: { objectType: string; take?: number }) {
  const take = Math.min(Math.max(params.take ?? 40, 1), TARIFF_AUDIT_LOG_MAX_TAKE);
  return prisma.tariffAuditLog.findMany({
    where: { objectType: params.objectType },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
