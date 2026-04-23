import { TwinRiskSeverity, ScriEventReviewState } from "@prisma/client";
import { z } from "zod";

const twinSeveritySchema = z.nativeEnum(TwinRiskSeverity);
const reviewStateSchema = z.nativeEnum(ScriEventReviewState);

export const scriIngestSourceSchema = z.object({
  sourceType: z.string().min(1).max(64),
  publisher: z.string().max(256).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  headline: z.string().max(512).optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  extractedText: z.string().max(12000).optional().nullable(),
  extractionConfidence: z.number().int().min(0).max(100).optional().nullable(),
});

export const scriIngestGeographySchema = z.object({
  countryCode: z.string().length(2).optional().nullable(),
  region: z.string().max(128).optional().nullable(),
  portUnloc: z.string().max(8).optional().nullable(),
  label: z.string().max(256).optional().nullable(),
  raw: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const scriIngestBodySchema = z.object({
  ingestKey: z.string().min(1).max(256),
  clusterKey: z.string().max(256).optional().nullable(),
  eventType: z.string().min(1).max(64),
  title: z.string().min(1).max(512),
  shortSummary: z.string().max(8000).optional().nullable(),
  longSummary: z.string().max(20000).optional().nullable(),
  eventTime: z.string().datetime().optional().nullable(),
  severity: twinSeveritySchema,
  confidence: z.number().int().min(0).max(100).optional().default(50),
  reviewState: reviewStateSchema.optional(),
  sourceTrustScore: z.number().int().min(0).max(100).optional().nullable(),
  structuredPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  sources: z.array(scriIngestSourceSchema).min(1).max(50),
  geographies: z.array(scriIngestGeographySchema).max(30).optional(),
  /** When true, run deterministic network matching after ingest (org.scri edit). */
  runMatch: z.boolean().optional().default(false),
});

export type ScriIngestBody = z.infer<typeof scriIngestBodySchema>;
