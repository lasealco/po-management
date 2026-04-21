import { twinCatalogMetricsResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";

import type { TwinCatalogMetricsCounts } from "@/lib/supply-chain-twin/twin-catalog-metrics";

/**
 * Validates JSON from `GET /api/supply-chain-twin/metrics` (browser or server). No logging; no PII.
 */
export function parseTwinCatalogMetricsResponseJson(
  body: unknown,
): { ok: true; data: TwinCatalogMetricsCounts } | { ok: false } {
  const parsed = twinCatalogMetricsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false };
  }
  return { ok: true, data: parsed.data };
}
