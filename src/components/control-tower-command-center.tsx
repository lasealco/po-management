"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchableSelectField } from "@/components/searchable-select-field";

import {
  controlTowerListPrimaryTitle,
  controlTowerListSecondaryRef,
} from "@/lib/control-tower/shipment-list-label";
import { controlTowerWorkbenchPath } from "@/lib/control-tower/workbench-url-sync";

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

type HealthState = "good" | "at_risk" | "delayed" | "missing_data";

function classifyShipmentHealth(r: Row, nowMs: number): HealthState {
  const etaIso = r.latestEta || r.eta;
  const etaMs = etaIso ? new Date(etaIso).getTime() : Number.NaN;
  const hasRoutePlan = Boolean(r.nextAction);
  if ((r.nextAction || "").startsWith("Escalate booking")) return "at_risk";
  if (!hasRoutePlan) return "missing_data";
  if (r.routeProgressPct != null && r.routeProgressPct < 40 && Number.isFinite(etaMs) && etaMs < nowMs) return "delayed";
  if (Number.isFinite(etaMs) && etaMs < nowMs) return "delayed";
  if ((r.openQueueCounts?.openAlerts ?? 0) > 0 || (r.openQueueCounts?.openExceptions ?? 0) > 0) return "at_risk";
  return "good";
}

const LANES = [
  "Booking: send",
  "Booking: awaiting confirm",
  "Booking: SLA overdue",
  "No route legs",
  "Plan leg",
  "Mark departure",
  "Record arrival",
  "Route complete",
  "Other",
] as const;

const STATUS_OPTIONS = [
  "",
  "BOOKING_DRAFT",
  "BOOKING_SUBMITTED",
  "SHIPPED",
  "VALIDATED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "RECEIVED",
] as const;

const ROUTE_ACTION_FILTER = [
  "",
  "Send booking",
  "Await booking",
  "Escalate booking",
  "Plan leg",
  "Mark departure",
  "Record arrival",
  "Route complete",
] as const;

function laneKey(nextAction: string | null): (typeof LANES)[number] {
  if (!nextAction) return "No route legs";
  if (nextAction.startsWith("Send booking")) return "Booking: send";
  if (nextAction.startsWith("Await booking")) return "Booking: awaiting confirm";
  if (nextAction.startsWith("Escalate booking")) return "Booking: SLA overdue";
  if (nextAction === "Route complete") return "Route complete";
  if (nextAction.startsWith("Plan leg")) return "Plan leg";
  if (nextAction.startsWith("Mark departure")) return "Mark departure";
  if (nextAction.startsWith("Record arrival")) return "Record arrival";
  return "Other";
}

export function ControlTowerCommandCenter({
  restrictedView = false,
}: {
  restrictedView?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [listTruncated, setListTruncated] = useState(false);
  const [listLimit, setListLimit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [qInput, setQInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [routeAction, setRouteAction] = useState("");
  const [onlyOverdueEta, setOnlyOverdueEta] = useState(false);
  const [ownerDirectory, setOwnerDirectory] = useState(() => new Map<string, string>());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(qInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    if (restrictedView) setOwnerFilter("");
  }, [restrictedView]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    setListTruncated(false);
    setListLimit(null);
    try {
      const sp = new URLSearchParams();
      if (debouncedQ) sp.set("q", debouncedQ);
      if (status) sp.set("status", status);
      if (onlyOverdueEta) sp.set("onlyOverdueEta", "1");
      if (routeAction) sp.set("routeAction", routeAction);
      if (!restrictedView && ownerFilter && ownerFilter !== "__unassigned") {
        sp.set("dispatchOwnerUserId", ownerFilter);
      }
      sp.set("take", "150");
      const res = await fetch(`/api/control-tower/shipments?${sp.toString()}`);
      const data = (await res.json()) as {
        shipments?: Row[];
        error?: string;
        truncated?: boolean;
        listLimit?: number;
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      const list = data.shipments ?? [];
      setRows(list);
      setListTruncated(Boolean(data.truncated));
      setListLimit(typeof data.listLimit === "number" ? data.listLimit : null);
      setOwnerDirectory((prev) => {
        const next = new Map(prev);
        for (const r of list) {
          if (r.dispatchOwner) next.set(r.dispatchOwner.id, r.dispatchOwner.name);
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setListTruncated(false);
      setListLimit(null);
    } finally {
      setBusy(false);
    }
  }, [debouncedQ, status, onlyOverdueEta, routeAction, ownerFilter, restrictedView]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>(ownerDirectory);
    m.set("", "All owners");
    m.set("__unassigned", "Unassigned queue");
    return Array.from(m.entries());
  }, [ownerDirectory]);
  const ownerSearchOptions = useMemo(
    () => ownerOptions.map(([id, label]) => ({ value: id, label })),
    [ownerOptions],
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (ownerFilter === "__unassigned") {
      list = list.filter((r) => !r.dispatchOwner);
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
  const healthStats = useMemo(() => {
    const now = Date.now();
    const stats = { good: 0, at_risk: 0, delayed: 0, missing_data: 0 };
    for (const r of filtered) {
      stats[classifyShipmentHealth(r, now)] += 1;
    }
    return stats;
  }, [filtered]);

  const workbenchDrillQuery = useMemo(() => {
    const q: Record<string, string> = {};
    if (status) q.status = status;
    if (routeAction) q.routeAction = routeAction;
    if (onlyOverdueEta) q.onlyOverdueEta = "1";
    if (debouncedQ.trim()) q.q = debouncedQ.trim();
    if (!restrictedView && ownerFilter && ownerFilter !== "__unassigned") {
      q.dispatchOwnerUserId = ownerFilter;
    }
    return q;
  }, [status, routeAction, onlyOverdueEta, debouncedQ, restrictedView, ownerFilter]);
  const workbenchDrillHref = controlTowerWorkbenchPath(workbenchDrillQuery);
  const hasWorkbenchDrillFilters = Object.keys(workbenchDrillQuery).length > 0;

  return (
    <div className="space-y-4">
      {restrictedView ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Portal view: dispatch-owner filter is hidden; cards still reflect your scoped shipments.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Search</span>
          <input
            className="mt-1 block w-56 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="PO, tracking, carrier…"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Status</span>
          <select
            className="mt-1 block w-44 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s.replaceAll("_", " ") : "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Route lane filter</span>
          <select
            className="mt-1 block w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            value={routeAction}
            onChange={(e) => setRouteAction(e.target.value)}
          >
            {ROUTE_ACTION_FILTER.map((a) => (
              <option key={a || "all"} value={a}>
                {a ? `${a}…` : "All lanes (below)"}
              </option>
            ))}
          </select>
        </label>
        {!restrictedView ? (
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Dispatch owner</span>
            <SearchableSelectField
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={ownerSearchOptions}
              placeholder="Type to filter owner..."
              emptyLabel="All owners"
              inputClassName="mt-1 block w-52 rounded border border-zinc-300 px-2 py-1.5 text-sm"
              listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={onlyOverdueEta}
            onChange={(e) => setOnlyOverdueEta(e.target.checked)}
            className="rounded border-zinc-300"
          />
          Overdue ETA only
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
      <p className="text-xs text-zinc-500">
        Search applies after you pause typing (~400ms). Status, overdue ETA, and route lane are applied on the server.
        {!restrictedView
          ? ' Dispatch owner (except "Unassigned queue") is applied on the server; unassigned queue is filtered in the browser.'
          : null}{" "}
        <Link href={workbenchDrillHref} className="font-medium text-sky-800 hover:underline">
          {hasWorkbenchDrillFilters ? "Open these filters in workbench" : "Open workbench"}
        </Link>
        .
      </p>
      {listTruncated && listLimit != null ? (
        <p className="text-xs text-amber-900">
          Showing up to <strong>{listLimit}</strong> shipments; more may match. Open the workbench to scroll the full
          list or narrow filters.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900">
          On-time: <strong>{healthStats.good}</strong>
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
          At risk: <strong>{healthStats.at_risk}</strong>
        </span>
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-900">
          Delayed: <strong>{healthStats.delayed}</strong>
        </span>
        <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-zinc-700">
          Missing legs/route: <strong>{healthStats.missing_data}</strong>
        </span>
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
                      <div className="font-medium text-zinc-900">
                        {controlTowerListPrimaryTitle({
                          orderNumber: r.orderNumber,
                          shipmentNo: r.shipmentNo,
                          id: r.id,
                        })}
                      </div>
                      {(() => {
                        const sub = controlTowerListSecondaryRef({
                          orderNumber: r.orderNumber,
                          shipmentNo: r.shipmentNo,
                          id: r.id,
                        });
                        return sub ? (
                          <div className="mt-0.5 text-[11px] font-normal text-zinc-700">{sub}</div>
                        ) : null;
                      })()}
                      <div className="mt-0.5 text-xs text-zinc-700">
                        {r.originCode ?? "—"} → {r.destinationCode ?? "—"}
                      </div>
                      {(() => {
                        const health = classifyShipmentHealth(r, Date.now());
                        return (
                          <div className="mt-1">
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[11px] ${
                                health === "good"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                  : health === "at_risk"
                                    ? "border-amber-200 bg-amber-50 text-amber-900"
                                    : health === "delayed"
                                      ? "border-rose-200 bg-rose-50 text-rose-900"
                                      : "border-zinc-300 bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {health === "good"
                                ? "On-time"
                                : health === "at_risk"
                                  ? "At risk"
                                  : health === "delayed"
                                    ? "Delayed"
                                    : "Missing route plan"}
                            </span>
                          </div>
                        );
                      })()}
                      {r.routeProgressPct != null ? (
                        <div className="mt-1 text-xs text-zinc-500">Route {r.routeProgressPct}%</div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-zinc-600">
                        {r.dispatchOwner ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">
                            {r.dispatchOwner.name}
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-zinc-900">Unassigned</span>
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
