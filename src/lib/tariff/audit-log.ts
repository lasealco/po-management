import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function recordTariffAuditLog(input: {
  objectType: string;
  objectId: string;
  action: string;
  userId: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.tariffAuditLog.create({
    data: {
      objectType: input.objectType,
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
  const take = params.take ?? 40;
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
