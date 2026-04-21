"use client";

import { Suspense, use, useMemo } from "react";

const EVENT_LIMIT = 10;
const TYPE_DISPLAY_MAX = 48;
const PAYLOAD_PREVIEW_MAX = 96;

type EventRow = { id: string; type: string; createdAt: string; payload: unknown };

type EventsResult = { ok: true; events: EventRow[] } | { ok: false; message: string };

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function previewPayload(payload: unknown): string {
  try {
    const raw = JSON.stringify(payload ?? null);
    const singleLine = raw.replace(/\s+/g, " ").trim();
    return truncateText(singleLine, PAYLOAD_PREVIEW_MAX);
  } catch {
    return "(not serializable)";
  }
}

async function fetchRecentIngestEvents(): Promise<EventsResult> {
  try {
    const params = new URLSearchParams();
    params.set("limit", String(EVENT_LIMIT));
    const res = await fetch(`/api/supply-chain-twin/events?${params.toString()}`, { cache: "no-store" });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        typeof body === "object" && body != null && "error" in body && typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : "Ingest events could not be loaded.";
      return { ok: false, message };
    }
    if (typeof body !== "object" || body == null || !("events" in body) || !Array.isArray((body as { events: unknown }).events)) {
      return { ok: false, message: "Unexpected response from ingest events." };
    }
    const rawEvents = (body as { events: unknown[] }).events;
    const events: EventRow[] = [];
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
        typeof (row as { createdAt: unknown }).createdAt === "string" &&
        "payload" in row
      ) {
        events.push({
          id: (row as { id: string }).id,
          type: (row as { type: string }).type,
          createdAt: (row as { createdAt: string }).createdAt,
          payload: (row as { payload: unknown }).payload,
        });
      }
    }
    if (events.length !== rawEvents.length) {
      return { ok: false, message: "Unexpected response from ingest events." };
    }
    return { ok: true, events };
  } catch {
    return { ok: false, message: "Network error while loading ingest events." };
  }
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return truncateText(iso, 24);
  }
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TwinExplorerRecentEventsStripInner() {
  const data = use(useMemo(() => fetchRecentIngestEvents(), []));

  if (data.ok === false) {
    return (
      <div className="px-5 py-6">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{data.message}</p>
      </div>
    );
  }

  if (data.events.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">No ingest events yet</p>
        <p className="mt-1 text-xs text-zinc-500">
          Append events via <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">POST /api/supply-chain-twin/events</code>{" "}
          when your session has twin access.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200">
      {data.events.map((row) => {
        const typeShown = truncateText(row.type, TYPE_DISPLAY_MAX);
        const payloadShown = previewPayload(row.payload);
        return (
          <li key={row.id} className="px-5 py-3 hover:bg-zinc-50/80">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-medium text-zinc-900">{typeShown}</p>
                <p className="mt-1 break-all font-mono text-[11px] leading-snug text-zinc-600" title={payloadShown}>
                  {payloadShown}
                </p>
              </div>
              <p className="shrink-0 font-mono text-[11px] text-zinc-500">{formatCreatedAt(row.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Thin strip of recent twin ingest events for the explorer (Slice 41). */
export function TwinExplorerRecentEventsStrip() {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Recent ingest events</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Last {EVENT_LIMIT} rows · <code className="text-[11px]">GET /api/supply-chain-twin/events</code>
        </p>
      </div>
      <Suspense fallback={<div className="px-5 py-8 text-center text-sm text-zinc-500">Loading ingest events…</div>}>
        <TwinExplorerRecentEventsStripInner />
      </Suspense>
    </section>
  );
}
