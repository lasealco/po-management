/** Pure helpers for sales orders list URL query (?status=&q=). */

import type { Prisma } from "@prisma/client";
import { SalesOrderStatus } from "@prisma/client";

const ORDER_STATUSES: SalesOrderStatus[] = [SalesOrderStatus.DRAFT, SalesOrderStatus.OPEN, SalesOrderStatus.CLOSED];

export type SalesOrdersListQuery = {
  status: string;
  q: string;
};

export function parseSalesOrdersListQuery(searchParams: URLSearchParams): SalesOrdersListQuery {
  return {
    status: (searchParams.get("status") ?? "").trim(),
    q: (searchParams.get("q") ?? "").trim(),
  };
}

/** Next.js `searchParams` object → `URLSearchParams` (first value wins per key). */
export function nextSearchParamsToURLSearchParams(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "string") p.set(k, v);
    else if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === "string") p.append(k, x);
      }
    }
  }
  return p;
}

export function parseSalesOrdersListQueryFromNext(
  record: Record<string, string | string[] | undefined>,
): SalesOrdersListQuery {
  return parseSalesOrdersListQuery(nextSearchParamsToURLSearchParams(record));
}

export function normalizeSalesOrderStatusFilter(raw: string): SalesOrderStatus | null {
  const u = raw.trim().toUpperCase();
  if (!u) return null;
  return ORDER_STATUSES.includes(u as SalesOrderStatus) ? (u as SalesOrderStatus) : null;
}

export function salesOrdersListPrismaWhere(
  tenantId: string,
  query: SalesOrdersListQuery,
): Prisma.SalesOrderWhereInput {
  const where: Prisma.SalesOrderWhereInput = { tenantId };
  const status = normalizeSalesOrderStatusFilter(query.status);
  if (status) where.status = status;

  const q = query.q.trim();
  if (q) {
    where.OR = [
      { soNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { externalRef: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

/**
 * Merge filter patch into current search string. Omits empty filter keys; preserves unrelated keys.
 */
export function buildSalesOrdersListSearch(
  current: URLSearchParams,
  patch: Partial<{ status: string; q: string }>,
): string {
  const next = new URLSearchParams(current.toString());

  const apply = (key: "status" | "q", value: string | undefined) => {
    if (value === undefined) return;
    const t = value.trim();
    if (t) next.set(key, t);
    else next.delete(key);
  };

  if (patch.status !== undefined) apply("status", patch.status);
  if (patch.q !== undefined) apply("q", patch.q);

  return next.toString();
}

/** Serialize list filters for links (e.g. detail ?status=&q=). */
export function salesOrdersListQueryString(query: SalesOrdersListQuery): string {
  return buildSalesOrdersListSearch(new URLSearchParams(), {
    status: query.status,
    q: query.q,
  });
}
