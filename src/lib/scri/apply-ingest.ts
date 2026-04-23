import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { ScriIngestBody } from "@/lib/scri/schemas/ingest-body";

export async function applyScriIngest(tenantId: string, body: ScriIngestBody) {
  const eventTime = body.eventTime ? new Date(body.eventTime) : null;
  const structuredPayload = (body.structuredPayload ?? {}) as Prisma.InputJsonValue;
  const reviewState = body.reviewState ?? undefined;

  return prisma.$transaction(async (tx) => {
    const row = await tx.scriExternalEvent.upsert({
      where: {
        tenantId_ingestKey: { tenantId, ingestKey: body.ingestKey },
      },
      create: {
        tenantId,
        ingestKey: body.ingestKey,
        clusterKey: body.clusterKey ?? null,
        eventType: body.eventType,
        title: body.title,
        shortSummary: body.shortSummary ?? null,
        longSummary: body.longSummary ?? null,
        eventTime,
        severity: body.severity,
        confidence: body.confidence,
        ...(reviewState ? { reviewState } : {}),
        sourceTrustScore: body.sourceTrustScore ?? null,
        sourceCount: body.sources.length,
        structuredPayload,
      },
      update: {
        clusterKey: body.clusterKey ?? null,
        eventType: body.eventType,
        title: body.title,
        shortSummary: body.shortSummary ?? null,
        longSummary: body.longSummary ?? null,
        eventTime,
        severity: body.severity,
        confidence: body.confidence,
        ...(reviewState ? { reviewState } : {}),
        sourceTrustScore: body.sourceTrustScore ?? null,
        sourceCount: body.sources.length,
        structuredPayload,
      },
    });

    await tx.scriEventSource.deleteMany({ where: { eventId: row.id } });
    await tx.scriEventGeography.deleteMany({ where: { eventId: row.id } });

    if (body.sources.length) {
      await tx.scriEventSource.createMany({
        data: body.sources.map((s) => ({
          eventId: row.id,
          sourceType: s.sourceType,
          publisher: s.publisher ?? null,
          url: s.url ?? null,
          headline: s.headline ?? null,
          publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
          extractedText: s.extractedText ?? null,
          extractionConfidence: s.extractionConfidence ?? null,
        })),
      });
    }

    const geos = body.geographies ?? [];
    if (geos.length) {
      await tx.scriEventGeography.createMany({
        data: geos.map((g) => ({
          eventId: row.id,
          countryCode: g.countryCode ?? null,
          region: g.region ?? null,
          portUnloc: g.portUnloc ?? null,
          label: g.label ?? null,
        })),
      });
    }

    return row.id;
  });
}
