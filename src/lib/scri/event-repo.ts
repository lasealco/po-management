import { prisma } from "@/lib/prisma";

const baseInclude = {
  sources: { orderBy: { createdAt: "asc" as const } },
  geographies: true,
} as const;

export async function listScriEventsForTenant(tenantId: string, take: number) {
  return prisma.scriExternalEvent.findMany({
    where: { tenantId },
    orderBy: [{ discoveredTime: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(take, 1), 100),
    include: {
      ...baseInclude,
      affectedEntities: { select: { objectType: true } },
    },
  });
}

export async function getScriEventForTenant(tenantId: string, id: string) {
  return prisma.scriExternalEvent.findFirst({
    where: { id, tenantId },
    include: {
      ...baseInclude,
      affectedEntities: { orderBy: { matchConfidence: "desc" } },
    },
  });
}
