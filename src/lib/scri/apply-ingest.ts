import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { resolveIngestAiFieldsAsync } from "@/lib/scri/build-deterministic-ai-summary";
import type { ScriIngestBody } from "@/lib/scri/schemas/ingest-body";
import { runScriEventMatching } from "@/lib/scri/matching/run-event-match";
import { maybeApplyScriAutoWatchAfterIngest } from "@/lib/scri/maybe-auto-watch-after-ingest";
import { normalizeIngestGeography } from "@/lib/scri/normalize-ingest-geography";
import { getScriTuningForTenant } from "@/lib/scri/tuning-repo";

export async function applyScriIngest(tenantId: string, body: ScriIngestBody) {
  const { dto: tuningDto } = await getScriTuningForTenant(tenantId);
  const countryAliases = tuningDto.geoAliases;

  const shouldRunMatch =
    Boolean(body.runMatch) ||
    ((body.geographies?.length ?? 0) > 0 && body.autoRematch !== false);
  const eventTime = body.eventTime ? new Date(body.eventTime) : null;
  const structuredPayload = (body.structuredPayload ?? {}) as Prisma.InputJsonValue;
  const reviewState = body.reviewState ?? undefined;
  const { aiSummary, aiSummarySource } = await resolveIngestAiFieldsAsync(body);

  const eventId = await prisma.$transaction(async (tx) => {
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
        aiSummary,
        aiSummarySource,
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
        aiSummary,
        aiSummarySource,
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
        data: geos.map((g) => {
          const n = normalizeIngestGeography(
            {
              countryCode: g.countryCode,
              region: g.region,
              portUnloc: g.portUnloc,
              label: g.label,
              raw: g.raw ?? undefined,
            },
            countryAliases,
          );
          return {
            eventId: row.id,
            countryCode: n.countryCode,
            region: n.region,
            portUnloc: n.portUnloc,
            label: n.label,
            ...(n.raw != null ? { raw: n.raw } : {}),
          };
        }),
      });
    }

    return row.id;
  });

  if (shouldRunMatch) {
    await runScriEventMatching(tenantId, eventId);
  }

  await maybeApplyScriAutoWatchAfterIngest(tenantId, eventId);

  return eventId;
}
