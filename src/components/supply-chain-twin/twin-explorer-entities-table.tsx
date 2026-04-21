"use client";

import Link from "next/link";
import { Suspense, use, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

/** Matches `limit` on `fetchEntitiesCatalog` — exports never include rows beyond this page. */
const CATALOG_TABLE_PAGE_LIMIT = 50;

/**
 * Slice 60: show a courtesy “many rows” hint above this count (N = 25).
 * The on-screen catalog is still capped at {@link CATALOG_TABLE_PAGE_LIMIT} rows per request.
 */
const EXPORT_SIZE_HINT_ABOVE_ROW_COUNT = 25;

type CatalogRow = { id: string; ref: { kind: string; id: string } };

type CatalogResult =
  | { ok: true; items: CatalogRow[] }
  | { ok: false; message: string };

async function fetchEntitiesCatalog(searchQ: string): Promise<CatalogResult> {
  const params = new URLSearchParams();
  params.set("q", searchQ);
  params.set("limit", String(CATALOG_TABLE_PAGE_LIMIT));
  try {
    const res = await fetch(`/api/supply-chain-twin/entities?${params.toString()}`, { cache: "no-store" });
    const body = (await res.json()) as unknown;
    if (!res.ok) {
      if (res.status === 403) {
        return { ok: false, message: "This workspace session cannot access Twin entities right now." };
      }
      if (res.status === 400) {
        return { ok: false, message: "Explorer filters are invalid. Reset filters and retry." };
      }
      if (res.status >= 500) {
        return { ok: false, message: "Twin entities are temporarily unavailable. Retry in a moment." };
      }
      if (typeof body === "object" && body != null && "error" in body && typeof (body as { error: unknown }).error === "string") {
        return { ok: false, message: "The entity catalog could not be loaded." };
      }
      return { ok: false, message: "The entity catalog could not be loaded." };
    }
    if (
      typeof body !== "object" ||
      body == null ||
      !("items" in body) ||
      !Array.isArray((body as { items: unknown }).items)
    ) {
      return { ok: false, message: "Unexpected response from entity catalog." };
    }
    const items = (body as { items: unknown[] }).items;
    const normalized: CatalogRow[] = [];
    for (const row of items) {
      if (
        typeof row === "object" &&
        row != null &&
        "id" in row &&
        typeof (row as { id: unknown }).id === "string" &&
        (row as { id: string }).id.length > 0 &&
        "ref" in row &&
        typeof (row as { ref: unknown }).ref === "object" &&
        (row as { ref: unknown }).ref != null &&
        "kind" in (row as { ref: { kind?: unknown } }).ref &&
        "id" in (row as { ref: { id?: unknown } }).ref &&
        typeof (row as { ref: { kind: unknown } }).ref.kind === "string" &&
        typeof (row as { ref: { id: unknown } }).ref.id === "string"
      ) {
        normalized.push({
          id: (row as { id: string }).id,
          ref: {
            kind: (row as { ref: { kind: string } }).ref.kind,
            id: (row as { ref: { id: string } }).ref.id,
          },
        });
      }
    }
    if (normalized.length !== items.length) {
      return { ok: false, message: "Unexpected response from entity catalog." };
    }
    return { ok: true, items: normalized };
  } catch {
    return { ok: false, message: "Network error while loading the catalog." };
  }
}

const SKELETON_ROW_COUNT = 8;

function TwinExplorerEntitiesTableSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">Loading entity catalog…</p>
      <p className="mt-0.5 px-5 pt-3 text-xs text-zinc-500" aria-hidden>
        <span className="inline-block h-3.5 w-36 max-w-[60%] animate-pulse rounded bg-zinc-200" />
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm" aria-hidden>
          <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3">Kind</th>
              <th className="px-5 py-3">Entity key</th>
              <th className="px-5 py-3">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
              <tr key={i}>
                <td className="px-5 py-3">
                  <span className="block h-4 w-28 max-w-[90%] animate-pulse rounded bg-zinc-200" />
                </td>
                <td className="px-5 py-3">
                  <span className="block h-4 w-44 max-w-[95%] animate-pulse rounded bg-zinc-200" />
                </td>
                <td className="px-5 py-3">
                  <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-zinc-200" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function downloadVisibleEntitiesJson(searchQ: string, items: CatalogRow[]) {
  const body = {
    exportedAt: new Date().toISOString(),
    source: "supply-chain-twin/explorer",
    searchQuery: searchQ,
    /** Same as `items.length`; capped by {@link CATALOG_TABLE_PAGE_LIMIT} on fetch. */
    rowCount: items.length,
    items,
  };
  const json = JSON.stringify(body, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replaceAll(":", "").slice(0, 15);
  a.download = `twin-explorer-entities-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function TwinExplorerEntitiesTableInner({
  searchQ,
  highlightSnapshotId,
}: {
  searchQ: string;
  highlightSnapshotId?: string | null;
}) {
  const router = useRouter();
  const data = use(useMemo(() => fetchEntitiesCatalog(searchQ), [searchQ]));
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useLayoutEffect(() => {
    const id = highlightSnapshotId?.trim();
    if (!id || data.ok !== true) {
      return;
    }
    const el = rowRefs.current.get(id);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightSnapshotId, data]);

  const onExportJson = useCallback(() => {
    if (data.ok !== true || data.items.length === 0) {
      return;
    }
    downloadVisibleEntitiesJson(searchQ, data.items);
  }, [data, searchQ]);

  if (data.ok === false) {
    return (
      <div className="px-5 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900">
          <p className="font-semibold">Unable to load Twin explorer entities</p>
          <p className="mt-1">{data.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white"
            >
              Retry
            </button>
            <Link
              href="/api/supply-chain-twin/readiness"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700"
            >
              Check readiness
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const count = data.items.length;

  const showExportSizeHint = count > EXPORT_SIZE_HINT_ABOVE_ROW_COUNT;

  return (
    <>
      <div className="mt-0.5 flex flex-col gap-2 px-5 pt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p className="text-xs text-zinc-500">
          {count} row{count === 1 ? "" : "s"} · <code className="text-[11px]">GET /api/supply-chain-twin/entities</code>
        </p>
        {count > 0 ? (
          <div className="flex min-w-[200px] flex-col items-stretch gap-2 sm:items-end">
            {showExportSizeHint ? (
              <p className="max-w-md text-right text-xs text-amber-900">
                Large export: JSON includes all {count} rows currently shown (catalog requests are capped at{" "}
                {CATALOG_TABLE_PAGE_LIMIT} per page).
              </p>
            ) : null}
            <button
              type="button"
              onClick={onExportJson}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Download JSON
            </button>
          </div>
        ) : null}
      </div>
      {count === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">No entities match this view yet.</p>
          <p className="mt-1">
            Try adjusting search filters, re-seeding Twin demo data, or checking readiness before retrying.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white"
            >
              Retry
            </button>
            <Link
              href="/api/supply-chain-twin/readiness"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700"
            >
              Check readiness
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Kind</th>
                <th className="px-5 py-3">Entity key</th>
                <th className="px-5 py-3">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {data.items.map((row) => {
                const href = `/supply-chain-twin/explorer/${encodeURIComponent(row.id)}`;
                const label = `Open twin snapshot for ${row.ref.kind} ${row.ref.id}`;
                const focused = highlightSnapshotId != null && highlightSnapshotId !== "" && row.id === highlightSnapshotId;
                return (
                  <tr
                    key={row.id}
                    ref={(el) => {
                      if (el) {
                        rowRefs.current.set(row.id, el);
                      } else {
                        rowRefs.current.delete(row.id);
                      }
                    }}
                    className={`hover:bg-zinc-50/80 ${focused ? "bg-emerald-50/90 ring-1 ring-emerald-200/90" : ""}`}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-zinc-600">{row.ref.kind}</td>
                    <td className="px-5 py-3 font-mono text-xs">{row.ref.id}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={href}
                        className="inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-[var(--arscmp-primary)] underline-offset-2 outline-none ring-zinc-300 hover:underline focus-visible:ring-2"
                        aria-label={label}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function TwinExplorerEntitiesTable({
  searchQ,
  highlightSnapshotId = null,
}: {
  searchQ: string;
  /** When set and the row is on the current catalog page, the row is highlighted and scrolled into view (Slice 76). */
  highlightSnapshotId?: string | null;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Entities</h2>
      </div>
      <Suspense fallback={<TwinExplorerEntitiesTableSkeleton />}>
        <TwinExplorerEntitiesTableInner searchQ={searchQ} highlightSnapshotId={highlightSnapshotId} />
      </Suspense>
    </section>
  );
}
