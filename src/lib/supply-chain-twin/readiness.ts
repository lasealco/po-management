import { prisma } from "@/lib/prisma";

/**
 * Environment / dependency readiness for the Supply Chain Twin module.
 * Keep the JSON shape stable for clients (`ok`, `reasons` only — operator-safe strings, no PII).
 */
export type SupplyChainTwinReadiness = {
  ok: boolean;
  reasons: string[];
};

const REQUIRED_PUBLIC_TABLES = [
  "SupplyChainTwinEntitySnapshot",
  "SupplyChainTwinEntityEdge",
  "SupplyChainTwinIngestEvent",
] as const;

let cache: { checkedAtMs: number; value: SupplyChainTwinReadiness } | null = null;
const CACHE_TTL_MS = 45_000;

export type GetSupplyChainTwinReadinessOptions = {
  /** Skip in-memory cache (e.g. `GET .../readiness?refresh=1` after `migrate deploy`). */
  bypassCache?: boolean;
};

async function computeSupplyChainTwinReadiness(): Promise<SupplyChainTwinReadiness> {
  try {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name::text AS table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'SupplyChainTwinEntitySnapshot',
          'SupplyChainTwinEntityEdge',
          'SupplyChainTwinIngestEvent'
        )
    `;
    const found = new Set(rows.map((r) => r.table_name));
    const missing = REQUIRED_PUBLIC_TABLES.filter((t) => !found.has(t));
    if (missing.length > 0) {
      return {
        ok: false,
        reasons: missing.map(
          (name) =>
            `Supply Chain Twin requires Postgres table "${name}". Run \`npm run db:migrate\` (or \`npx prisma migrate deploy\`) on this database.`,
        ),
      };
    }
    return { ok: true, reasons: [] };
  } catch {
    return {
      ok: false,
      reasons: [
        "Could not verify Supply Chain Twin database tables. Confirm Postgres connectivity and that migrations have been applied.",
      ],
    };
  }
}

/**
 * Live readiness snapshot (short in-memory cache). DB checks only — no tenant or user strings in `reasons`.
 */
export async function getSupplyChainTwinReadinessSnapshot(
  options?: GetSupplyChainTwinReadinessOptions,
): Promise<SupplyChainTwinReadiness> {
  const now = Date.now();
  if (options?.bypassCache) {
    cache = null;
  } else if (cache && now - cache.checkedAtMs < CACHE_TTL_MS) {
    return cache.value;
  }
  const value = await computeSupplyChainTwinReadiness();
  cache = { checkedAtMs: now, value };
  return value;
}

/** @internal Vitest */
export function clearSupplyChainTwinReadinessCacheForTests() {
  cache = null;
}
