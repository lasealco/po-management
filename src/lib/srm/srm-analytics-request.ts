import type { SrmKindParam } from "@/lib/srm/srm-analytics-aggregates";

function parseKindParam(raw: string | null): SrmKindParam {
  return raw === "logistics" ? "logistics" : "product";
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function parseYmdToUtcStart(raw: string | null, fallback: Date): Date {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return startOfUtcDay(fallback);
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? startOfUtcDay(fallback) : d;
}

function parseYmdToUtcEnd(raw: string | null, fallback: Date): Date {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return endOfUtcDay(fallback);
  }
  const d = new Date(`${raw}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? endOfUtcDay(fallback) : d;
}

export type SrmAnalyticsRangeResult =
  | { ok: true; from: Date; to: Date; kind: SrmKindParam }
  | { ok: false; error: string };

/**
 * Shared query contract for `GET /api/srm/analytics` and integration snapshot (Phase J).
 */
export function parseSrmAnalyticsQuery(url: URL, now: Date = new Date()): SrmAnalyticsRangeResult {
  const toDefault = new Date(now);
  const fromDefault = new Date(now);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 90);
  const to = parseYmdToUtcEnd(url.searchParams.get("to"), toDefault);
  const from = parseYmdToUtcStart(url.searchParams.get("from"), fromDefault);
  if (from.getTime() > to.getTime()) {
    return { ok: false, error: "from must be before to." };
  }
  return { ok: true, from, to, kind: parseKindParam(url.searchParams.get("kind")) };
}
