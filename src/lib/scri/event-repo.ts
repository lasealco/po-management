import { prisma } from "@/lib/prisma";

const baseInclude = {
  sources: { orderBy: { createdAt: "asc" as const } },
  geographies: true,
} as const;

export async function listScriEventsForTenant(
  tenantId: string,
  take: number,
  opts?: { clusterKey?: string | null },
) {
  const clusterKey = opts?.clusterKey?.trim();
  return prisma.scriExternalEvent.findMany({
    where: {
      tenantId,
      ...(clusterKey ? { clusterKey } : {}),
    },
    orderBy: [{ discoveredTime: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(take, 1), 100),
    include: {
      ...baseInclude,
      owner: { select: { id: true, name: true, email: true } },
      affectedEntities: { select: { objectType: true } },
    },
  });
}

export async function getScriEventForTenant(tenantId: string, id: string) {
  return prisma.scriExternalEvent.findFirst({
    where: { id, tenantId },
    include: {
      ...baseInclude,
      owner: { select: { id: true, name: true, email: true } },
      affectedEntities: { orderBy: { matchConfidence: "desc" } },
      reviewLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      taskLinks: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}
