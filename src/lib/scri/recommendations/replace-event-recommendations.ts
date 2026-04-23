import type { Prisma } from "@prisma/client";

import type { DeterministicScriRecommendationRow } from "@/lib/scri/recommendations/build-deterministic-recommendations";

export async function replaceScriEventRecommendations(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  rows: DeterministicScriRecommendationRow[],
): Promise<void> {
  await tx.scriEventRecommendation.deleteMany({ where: { eventId } });
  if (!rows.length) return;
  await tx.scriEventRecommendation.createMany({
    data: rows.map((r) => ({
      tenantId,
      eventId,
      recommendationType: r.recommendationType,
      targetObjectType: r.targetObjectType ?? null,
      targetObjectId: r.targetObjectId ?? null,
      priority: r.priority,
      confidence: r.confidence,
      expectedEffect: r.expectedEffect ?? null,
    })),
  });
}
