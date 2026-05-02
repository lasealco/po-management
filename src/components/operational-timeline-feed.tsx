"use client";

import { useCallback, useEffect, useState } from "react";

import type { OperationsTimelineEvent } from "@/lib/operations/tenant-operations-timeline";

function formatDetail(ev: OperationsTimelineEvent): string {
  const d = ev.detail;
  const parts: string[] = [];
  if (ev.kind === "ct_audit") {
    const et = d.entityType != null ? String(d.entityType) : "";
    const eid = d.entityId != null ? String(d.entityId) : "";
    if (et || eid) parts.push([et, eid].filter(Boolean).join(" "));
    const sid = d.shipmentId != null ? String(d.shipmentId) : "";
    if (sid) parts.push(`Shipment ${sid.slice(0, 8)}…`);
    const actor = d.actorEmail != null ? String(d.actorEmail) : "";
    if (actor) parts.push(actor);
  }
  if (ev.kind === "inventory_movement") {
    const wh = d.warehouseCode != null ? String(d.warehouseCode) : "";
    const pl = d.productLabel != null ? String(d.productLabel) : "";
    if (wh) parts.push(wh);
    if (pl) parts.push(pl);
    const rt = d.referenceType != null ? String(d.referenceType) : "";
    const rid = d.referenceId != null ? String(d.referenceId) : "";
    if (rt || rid) parts.push([rt, rid ? rid.slice(0, 8) : ""].filter(Boolean).join(" "));
  }
  if (ev.kind === "dock_milestone") {
    const wh = d.warehouseCode != null ? String(d.warehouseCode) : "";
    const dir = d.direction != null ? String(d.direction) : "";
    const ms = d.milestone != null ? String(d.milestone) : "";
    if (wh) parts.push(wh);
    if (dir) parts.push(dir);
    if (ms) parts.push(ms);
    const car = d.carrierName != null ? String(d.carrierName) : "";
    if (car) parts.push(car);
  }
  return parts.filter(Boolean).join(" · ");
}

export function OperationalTimelineFeed({
  title = "Operational timeline",
  subtitle = "Control Tower audits, inventory movements, and dock milestones (BF-49).",
}: {
  title?: string;
  subtitle?: string;
}) {
  const [events, setEvents] = useState<OperationsTimelineEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    const sp = new URLSearchParams();
    sp.set("limit", "25");
    if (cursor) sp.set("cursor", cursor);
    const res = await fetch(`/api/control-tower/timeline?${sp.toString()}`, { credentials: "include" });
    const body = (await res.json().catch(() => null)) as { events?: OperationsTimelineEvent[]; nextCursor?: string | null; error?: string } | null;
    if (!res.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    const next = body?.events ?? [];
    setNextCursor(body?.nextCursor ?? null);
    setEvents((prev) => (append ? [...prev, ...next] : next));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        await load(null, false);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load timeline.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      setError(null);
      await load(nextCursor, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">BF-49</p>
      <h2 className="mt-2 text-sm font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 max-w-3xl text-xs text-zinc-600">{subtitle}</p>

      {loading ? (
        <p className="mt-4 text-xs text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{error}</p>
      ) : events.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">No timeline rows yet for this tenant.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100">
          {events.map((ev) => {
            const sub = formatDetail(ev);
            return (
            <li key={`${ev.kind}:${ev.id}:${ev.occurredAt}`} className="py-3 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{ev.kind.replace(/_/g, " ")}</p>
                <time className="text-[11px] text-zinc-500" dateTime={ev.occurredAt}>
                  {new Date(ev.occurredAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-sm font-medium text-zinc-900">{ev.title}</p>
              {sub ? <p className="mt-1 text-xs text-zinc-600">{sub}</p> : null}
            </li>
            );
          })}
        </ul>
      )}

      {nextCursor && !loading ? (
        <div className="mt-4">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-40"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
