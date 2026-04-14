"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  shipmentNo: string | null;
  status: string;
  orderNumber: string;
  originCode: string | null;
  destinationCode: string | null;
  eta: string | null;
  latestEta: string | null;
  routeProgressPct: number | null;
  nextAction: string | null;
  updatedAt: string;
  customerCrmAccountName: string | null;
  dispatchOwner: { id: string; name: string } | null;
  openQueueCounts: { openAlerts: number; openExceptions: number };
};

const LANES = [
  "No route legs",
  "Plan leg",
  "Mark departure",
  "Record arrival",
  "Route complete",
  "Other",
] as const;

function laneKey(nextAction: string | null): (typeof LANES)[number] {
  if (!nextAction) return "No route legs";
  if (nextAction === "Route complete") return "Route complete";
  if (nextAction.startsWith("Plan leg")) return "Plan leg";
  if (nextAction.startsWith("Mark departure")) return "Mark departure";
  if (nextAction.startsWith("Record arrival")) return "Record arrival";
  return "Other";
}

export function ControlTowerCommandCenter() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      sp.set("take", "150");
      const res = await fetch(`/api/control-tower/shipments?${sp.toString()}`);
      const data = (await res.json()) as { shipments?: Row[]; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setRows(data.shipments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    m.set("", "All owners");
    m.set("__unassigned", "Unassigned queue");
    for (const r of rows) {
      if (r.dispatchOwner) {
        m.set(r.dispatchOwner.id, r.dispatchOwner.name);
      }
    }
    return Array.from(m.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (ownerFilter === "__unassigned") {
      list = list.filter((r) => !r.dispatchOwner);
    } else if (ownerFilter) {
      list = list.filter((r) => r.dispatchOwner?.id === ownerFilter);
    }
    return list;
  }, [rows, ownerFilter]);

  const byLane = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const lane of LANES) {
      map.set(lane, []);
    }
    for (const r of filtered) {
      const k = laneKey(r.nextAction);
      map.get(k)!.push(r);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Search</span>
          <input
            className="mt-1 block w-56 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="PO, tracking, carrier…"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Dispatch owner</span>
          <select
            className="mt-1 block w-52 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            {ownerOptions.map(([id, label]) => (
              <option key={id || "all"} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
        >
          Refresh
        </button>
        {busy ? <span className="text-xs text-zinc-500">Loading…</span> : null}
      </div>
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {LANES.map((lane) => {
          const cards = byLane.get(lane) ?? [];
          return (
            <div
              key={lane}
              className="flex w-72 shrink-0 flex-col rounded-lg border border-zinc-200 bg-zinc-50/80"
            >
              <div className="border-b border-zinc-200 bg-white px-3 py-2">
                <h2 className="text-sm font-semibold text-zinc-900">{lane}</h2>
                <p className="text-xs text-zinc-500">{cards.length} shipment{cards.length === 1 ? "" : "s"}</p>
              </div>
              <ul className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                {cards.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/control-tower/shipments/${r.id}`}
                      className="block rounded-md border border-zinc-200 bg-white p-2.5 text-sm shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40"
                    >
                      <div className="font-medium text-zinc-900">{r.shipmentNo || r.orderNumber}</div>
                      <div className="mt-0.5 text-xs text-zinc-600">
                        {r.originCode ?? "—"} → {r.destinationCode ?? "—"}
                      </div>
                      {r.routeProgressPct != null ? (
                        <div className="mt-1 text-xs text-zinc-500">Route {r.routeProgressPct}%</div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-zinc-600">
                        {r.dispatchOwner ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">
                            {r.dispatchOwner.name}
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">Unassigned</span>
                        )}
                        {r.openQueueCounts.openAlerts > 0 ? (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-900">
                            {r.openQueueCounts.openAlerts} alert{r.openQueueCounts.openAlerts === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {r.openQueueCounts.openExceptions > 0 ? (
                          <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-900">
                            {r.openQueueCounts.openExceptions} exc.
                          </span>
                        ) : null}
                      </div>
                      {r.customerCrmAccountName ? (
                        <div className="mt-1 truncate text-[11px] text-zinc-500">{r.customerCrmAccountName}</div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
