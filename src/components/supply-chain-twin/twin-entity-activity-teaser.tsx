"use client";

import { Suspense, use, useMemo } from "react";

/** Slice 65: small teaser list; matches capped `GET /api/supply-chain-twin/events` page size. */
const ACTIVITY_TEASER_LIMIT = 8;
const TYPE_DISPLAY_MAX = 56;

type TeaserRow = { id: string; type: string; createdAt: string };

type TeaserResult = { ok: true; rows: TeaserRow[] } | { ok: false; message: string };

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

async function fetchWorkspaceIngestActivity(): Promise<TeaserResult> {
  try {
    const params = new URLSearchParams();
    params.set("limit", String(ACTIVITY_TEASER_LIMIT));
    const res = await fetch(`/api/supply-chain-twin/events?${params.toString()}`, { cache: "no-store" });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: "Twin activity could not be loaded for this session." };
    }
    if (typeof body !== "object" || body == null || !("events" in body) || !Array.isArray((body as { events: unknown }).events)) {
      return { ok: false, message: "Unexpected response from ingest events." };
    }
    const rawEvents = (body as { events: unknown[] }).events;
    const rows: TeaserRow[] = [];
    for (const row of rawEvents) {
      if (
        typeof row === "object" &&
        row != null &&
        "id" in row &&
        typeof (row as { id: unknown }).id === "string" &&
        (row as { id: string }).id.length > 0 &&
        "type" in row &&
        typeof (row as { type: unknown }).type === "string" &&
        "createdAt" in row &&
        typeof (row as { createdAt: unknown }).createdAt === "string"
      ) {
        rows.push({
          id: (row as { id: string }).id,
          type: (row as { type: string }).type,
          createdAt: (row as { createdAt: string }).createdAt,
        });
      }
    }
    if (rows.length !== rawEvents.length) {
      return { ok: false, message: "Unexpected response from ingest events." };
    }
    return { ok: true, rows };
  } catch {
    return { ok: false, message: "Network error while loading twin activity." };
  }
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return truncateText(iso, 24);
  }
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TwinEntityActivityTeaserSkeleton() {
  return (
    <div className="px-5 py-6" role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">Loading twin activity…</p>
      <ul className="divide-y divide-zinc-200" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="py-3">
            <div className="flex justify-between gap-4">
              <span className="h-3 w-40 max-w-[70%] animate-pulse rounded bg-zinc-200" />
              <span className="h-3 w-24 shrink-0 animate-pulse rounded bg-zinc-200" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TwinEntityActivityTeaserInner() {
  const data = use(useMemo(() => fetchWorkspaceIngestActivity(), []));

  if (data.ok === false) {
    return (
      <div className="px-5 py-6">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{data.message}</p>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">No twin ingest activity yet</p>
        <p className="mt-1 text-xs text-zinc-500">
          Events appear after successful <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">POST</code> calls to
          ingest. This teaser is tenant-wide and not filtered to this snapshot yet.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200">
      {data.rows.map((row) => (
        <li key={row.id} className="px-5 py-3 hover:bg-zinc-50/80">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <p className="min-w-0 font-mono text-xs font-medium text-zinc-900">{truncateText(row.type, TYPE_DISPLAY_MAX)}</p>
            <p className="shrink-0 font-mono text-[11px] text-zinc-500">{formatCreatedAt(row.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tenant-wide ingest teaser for entity detail (Slice 65): types and times only — no payload text. */
export function TwinEntityActivityTeaser() {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Twin activity</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Latest {ACTIVITY_TEASER_LIMIT} rows from{" "}
          <code className="text-[11px]">GET /api/supply-chain-twin/events</code> (workspace scope). Event{" "}
          <span className="font-medium text-zinc-700">type</span> and <span className="font-medium text-zinc-700">time</span>{" "}
          only — payload previews are omitted here to avoid accidental PII. Optional <code className="text-[11px]">type</code>{" "}
          query filtering is available on the API for future entity-linked views.
        </p>
      </div>
      <Suspense fallback={<TwinEntityActivityTeaserSkeleton />}>
        <TwinEntityActivityTeaserInner />
      </Suspense>
    </section>
  );
}
