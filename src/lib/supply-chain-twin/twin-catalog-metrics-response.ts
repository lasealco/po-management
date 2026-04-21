import {
  type TwinCatalogMetricsResponse,
  twinCatalogMetricsResponseSchema,
} from "@/lib/supply-chain-twin/schemas/twin-api-responses";

/**
 * Validates JSON from `GET /api/supply-chain-twin/metrics` (browser or server). No logging; no PII.
 */
export function parseTwinCatalogMetricsResponseJson(
  body: unknown,
): { ok: true; data: TwinCatalogMetricsResponse } | { ok: false } {
  const parsed = twinCatalogMetricsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false };
  }
  return { ok: true, data: parsed.data };
}
