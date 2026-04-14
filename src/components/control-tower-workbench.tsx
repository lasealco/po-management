"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  shipmentNo: string | null;
  status: string;
  transportMode: string | null;
  trackingNo: string | null;
  carrier: string | null;
  orderId: string;
  orderNumber: string;
  supplierName: string | null;
  customerCrmAccountId: string | null;
  customerCrmAccountName: string | null;
  originCode: string | null;
  destinationCode: string | null;
  etd: string | null;
  eta: string | null;
  latestEta: string | null;
  receivedAt: string | null;
  routeProgressPct: number | null;
  nextAction: string | null;
  shipperName: string | null;
  consigneeName: string | null;
  quantityRef: string | null;
  weightKgRef: string | null;
  cbmRef: string | null;
  updatedAt: string;
  latestMilestone: { code: string; hasActual: boolean } | null;
  dispatchOwner: { id: string; name: string } | null;
  openQueueCounts: { openAlerts: number; openExceptions: number };
};

export function ControlTowerWorkbench({ canEdit }: { canEdit: boolean }) {
  const defaultViewKey = "ct-workbench-default-view-id";
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [routeAction, setRouteAction] = useState("");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [onlyOverdueEta, setOnlyOverdueEta] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [shipperFilter, setShipperFilter] = useState("");
  const [consigneeFilter, setConsigneeFilter] = useState("");
  const [laneFilter, setLaneFilter] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [saved, setSaved] = useState<Array<{ id: string; name: string; filtersJson: unknown }>>([]);
  const [ownerFilter, setOwnerFilter] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (mode) sp.set("mode", mode);
      if (q.trim()) sp.set("q", q.trim());
      if (shipperFilter.trim()) sp.set("shipperName", shipperFilter.trim());
      if (consigneeFilter.trim()) sp.set("consigneeName", consigneeFilter.trim());
      if (laneFilter.trim()) sp.set("lane", laneFilter.trim());
      if (ownerFilter) sp.set("dispatchOwnerUserId", ownerFilter);
      if (onlyOverdueEta) sp.set("onlyOverdueEta", "1");
      sp.set("take", "120");
      const res = await fetch(`/api/control-tower/shipments?${sp.toString()}`);
      const data = (await res.json()) as { shipments?: Row[]; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setRows(data.shipments ?? []);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [status, mode, q, shipperFilter, consigneeFilter, laneFilter, ownerFilter, onlyOverdueEta]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [autoRefresh, load]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/control-tower/saved-filters");
      if (!res.ok) return;
      const data = (await res.json()) as {
        filters?: Array<{ id: string; name: string; filtersJson: unknown }>;
      };
      setSaved(data.filters ?? []);
      const defaultId = typeof window !== "undefined" ? window.localStorage.getItem(defaultViewKey) : null;
      if (defaultId) {
        const match = (data.filters ?? []).find((f) => f.id === defaultId);
        if (match) applySaved(match.filtersJson);
      }
    })();
  }, []);

  const refreshSaved = useCallback(async () => {
    const list = await fetch("/api/control-tower/saved-filters");
    if (!list.ok) return;
    const data = (await list.json()) as {
      filters?: Array<{ id: string; name: string; filtersJson: unknown }>;
    };
    setSaved(data.filters ?? []);
  }, []);

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [
      "shipmentId",
      "orderNumber",
      "shipmentNo",
      "status",
      "mode",
      "customerCrmAccountId",
      "origin",
      "destination",
      "eta",
      "ata",
      "etaVsAtaDays",
      "shipper",
      "consignee",
      "quantityRef",
      "weightKgRef",
      "cbmRef",
      "updatedAt",
    ];
    const lines = [header.join(",")];
    for (const r of filteredRows) {
      lines.push(
        [
          esc(r.id),
          esc(r.orderNumber),
          esc(r.shipmentNo || ""),
          esc(r.status),
          esc(r.transportMode || ""),
          esc(r.customerCrmAccountId || ""),
          esc(r.originCode || ""),
          esc(r.destinationCode || ""),
          esc(r.eta || r.latestEta || ""),
          esc(r.receivedAt || ""),
          esc(
            (() => {
              const etaIso = r.latestEta || r.eta;
              if (!etaIso || !r.receivedAt) return "";
              const deltaMs = new Date(r.receivedAt).getTime() - new Date(etaIso).getTime();
              return (deltaMs / 86_400_000).toFixed(1);
            })(),
          ),
          esc(r.shipperName || ""),
          esc(r.consigneeName || ""),
          esc(r.quantityRef || ""),
          esc(r.weightKgRef || ""),
          esc(r.cbmRef || ""),
          esc(r.updatedAt),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-tower-shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applySaved = (json: unknown) => {
    if (!json || typeof json !== "object") return;
    const o = json as {
      status?: string;
      mode?: string;
      q?: string;
      shipperFilter?: string;
      consigneeFilter?: string;
      laneFilter?: string;
      ownerFilter?: string;
      routeAction?: string;
      sortBy?: string;
      onlyOverdueEta?: boolean;
    };
    setStatus(typeof o.status === "string" ? o.status : "");
    setMode(typeof o.mode === "string" ? o.mode : "");
    setQ(typeof o.q === "string" ? o.q : "");
    setShipperFilter(typeof o.shipperFilter === "string" ? o.shipperFilter : "");
    setConsigneeFilter(typeof o.consigneeFilter === "string" ? o.consigneeFilter : "");
    setLaneFilter(typeof o.laneFilter === "string" ? o.laneFilter : "");
    setOwnerFilter(typeof o.ownerFilter === "string" ? o.ownerFilter : "");
    setRouteAction(typeof o.routeAction === "string" ? o.routeAction : "");
    setSortBy(typeof o.sortBy === "string" ? o.sortBy : "updated_desc");
    setOnlyOverdueEta(Boolean(o.onlyOverdueEta));
    setPage(1);
  };

  const saveCurrentFilter = async () => {
    const name = typeof window !== "undefined" ? window.prompt("Filter name:") : null;
    if (!name?.trim()) return;
    const res = await fetch("/api/control-tower", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_ct_filter",
        name: name.trim(),
        filtersJson: {
          status,
          mode,
          q,
          shipperFilter,
          consigneeFilter,
          laneFilter,
          ownerFilter,
          routeAction,
          sortBy,
          onlyOverdueEta,
        },
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      window.alert(err.error || "Save failed");
      return;
    }
    await refreshSaved();
  };

  const statusOptions = useMemo(
    () => ["", "SHIPPED", "VALIDATED", "BOOKED", "IN_TRANSIT", "DELIVERED", "RECEIVED"],
    [],
  );
  const modeOptions = useMemo(() => ["", "OCEAN", "AIR", "ROAD", "RAIL"], []);
  const routeActionOptions = useMemo(
    () => ["", "Plan leg", "Mark departure", "Record arrival", "Route complete"],
    [],
  );
  const routeActionCounts = useMemo(() => {
    const out: Record<string, number> = {
      "Plan leg": 0,
      "Mark departure": 0,
      "Record arrival": 0,
      "Route complete": 0,
    };
    for (const r of rows) {
      const action = r.nextAction || "";
      for (const key of Object.keys(out)) {
        if (action.startsWith(key)) out[key] += 1;
      }
    }
    return out;
  }, [rows]);
  const ownerChoices = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.dispatchOwner?.id) m.set(r.dispatchOwner.id, r.dispatchOwner.name);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);
  const filteredRows = useMemo(() => {
    const nowMs = Date.now();
    const routed = !routeAction
      ? rows
      : rows.filter((r) => (r.nextAction || "").startsWith(routeAction));
    const etaScoped = !onlyOverdueEta
      ? routed
      : routed.filter((r) => {
          const eta = r.latestEta || r.eta;
          return eta ? new Date(eta).getTime() < nowMs : false;
        });
    const sorted = [...etaScoped];
    sorted.sort((a, b) => {
      if (sortBy === "eta_asc") {
        const ae = a.latestEta || a.eta;
        const be = b.latestEta || b.eta;
        const av = ae ? new Date(ae).getTime() : Number.MAX_SAFE_INTEGER;
        const bv = be ? new Date(be).getTime() : Number.MAX_SAFE_INTEGER;
        return av - bv;
      }
      if (sortBy === "route_progress_asc") {
        return (a.routeProgressPct ?? 999) - (b.routeProgressPct ?? 999);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return sorted;
  }, [rows, routeAction, onlyOverdueEta, sortBy]);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page],
  );
  const triageStats = useMemo(
    () => ({
      overdue: filteredRows.filter((r) => {
        const eta = r.latestEta || r.eta;
        return eta ? new Date(eta).getTime() < Date.now() : false;
      }).length,
      needsDeparture: filteredRows.filter((r) => (r.nextAction || "").startsWith("Mark departure")).length,
      needsArrival: filteredRows.filter((r) => (r.nextAction || "").startsWith("Record arrival")).length,
    }),
    [filteredRows],
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="text-xs text-zinc-600">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {statusOptions.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {modeOptions.map((m) => (
              <option key={m || "any"} value={m}>
                {m || "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-zinc-600">
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="PO #, tracking, B/L ref…"
            className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Shipper
          <input
            value={shipperFilter}
            onChange={(e) => setShipperFilter(e.target.value)}
            placeholder="Shipper contains"
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Consignee
          <input
            value={consigneeFilter}
            onChange={(e) => setConsigneeFilter(e.target.value)}
            placeholder="Consignee contains"
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Lane
          <input
            value={laneFilter}
            onChange={(e) => setLaneFilter(e.target.value)}
            placeholder="e.g. CNSHA or USLAX"
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Dispatch owner
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {ownerChoices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Route action
          <select
            value={routeAction}
            onChange={(e) => setRouteAction(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {routeActionOptions.map((opt) => (
              <option key={opt || "all-actions"} value={opt}>
                {opt || "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Sort
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="updated_desc">Updated (newest)</option>
            <option value="eta_asc">ETA (earliest)</option>
            <option value="route_progress_asc">Route progress (lowest)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={onlyOverdueEta}
            onChange={(e) => {
              setOnlyOverdueEta(e.target.checked);
              setPage(1);
            }}
          />
          Overdue ETA only
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setAutoRefresh((v) => !v)}
          className={`rounded border px-3 py-2 text-sm font-medium ${
            autoRefresh
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-zinc-300 text-zinc-700"
          }`}
        >
          Auto-refresh: {autoRefresh ? "On" : "Off"}
        </button>
        <button
          type="button"
          disabled={filteredRows.length === 0}
          onClick={exportCsv}
          className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
        >
          Export CSV
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={() => void saveCurrentFilter()}
            className="rounded border border-sky-600 px-3 py-2 text-sm font-medium text-sky-900"
          >
            Save view
          </button>
        ) : null}
        {saved.length > 0 ? (
          <div className="flex flex-col gap-1 text-xs text-zinc-600">
            <span>Saved views</span>
            <div className="max-h-24 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-1">
              {saved.map((f) => (
                <div key={f.id} className="mb-1 flex items-center gap-1 last:mb-0">
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-left text-xs hover:bg-zinc-100"
                    onClick={() => applySaved(f.filtersJson)}
                    title="Apply saved view"
                  >
                    {f.name}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2 py-1 text-[11px]"
                    title="Set default"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(defaultViewKey, f.id);
                      }
                    }}
                  >
                    Default
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-800"
                    title="Delete saved view"
                    onClick={async () => {
                      if (!window.confirm(`Delete saved view "${f.name}"?`)) return;
                      const res = await fetch("/api/control-tower", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "delete_ct_filter", filterId: f.id }),
                      });
                      if (!res.ok) {
                        const err = (await res.json()) as { error?: string };
                        window.alert(err.error || "Delete failed");
                        return;
                      }
                      if (
                        typeof window !== "undefined" &&
                        window.localStorage.getItem(defaultViewKey) === f.id
                      ) {
                        window.localStorage.removeItem(defaultViewKey);
                      }
                      await refreshSaved();
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="self-start rounded border border-zinc-300 px-2 py-1 text-[11px]"
              onClick={() => {
                if (typeof window !== "undefined") window.localStorage.removeItem(defaultViewKey);
              }}
            >
              Clear default
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRouteAction("")}
          className={`rounded-full border px-3 py-1 text-xs ${
            routeAction === "" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-zinc-300 text-zinc-700"
          }`}
        >
          Any ({rows.length})
        </button>
        {routeActionOptions
          .filter((o) => o)
          .map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRouteAction(opt)}
              className={`rounded-full border px-3 py-1 text-xs ${
                routeAction === opt
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-zinc-300 text-zinc-700"
              }`}
            >
              {opt} ({routeActionCounts[opt] ?? 0})
            </button>
          ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-700">
          Visible: <strong>{filteredRows.length}</strong>
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
          Overdue ETA: <strong>{triageStats.overdue}</strong>
        </span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-900">
          Needs departure: <strong>{triageStats.needsDeparture}</strong>
        </span>
        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-orange-900">
          Needs arrival: <strong>{triageStats.needsArrival}</strong>
        </span>
      </div>
      <p className="text-xs text-zinc-500">
        Last refreshed: {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : "—"}
      </p>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
            <tr>
              <th className="px-2 py-2">Shipment</th>
              <th className="px-2 py-2">Order</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Mode</th>
              <th className="px-2 py-2">Customer</th>
              <th className="px-2 py-2">Lane</th>
              <th className="px-2 py-2">ETA</th>
              <th className="px-2 py-2">ATA / Delay</th>
              <th className="px-2 py-2">Parties</th>
              <th className="px-2 py-2">Qty / Wt / Cbm</th>
              <th className="px-2 py-2">Owner / Queue</th>
              <th className="px-2 py-2">Route</th>
              <th className="px-2 py-2">Next action</th>
              <th className="px-2 py-2">Milestone</th>
              <th className="px-2 py-2">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-2 py-6 text-center text-zinc-500">
                  {busy ? "Loading…" : "No rows match."}
                </td>
              </tr>
            ) : (
              pagedRows.map((r) => (
                <tr
                  key={r.id}
                  className={`text-zinc-800 ${
                    (r.nextAction || "").startsWith("Record arrival")
                      ? "bg-amber-50/40"
                      : (r.nextAction || "").startsWith("Mark departure")
                        ? "bg-sky-50/40"
                        : ""
                  }`}
                >
                  <td className="px-2 py-2 font-medium">
                    <Link href={`/control-tower/shipments/${r.id}`} className="text-sky-800 hover:underline">
                      {r.shipmentNo || r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-zinc-600">
                    <Link href={`/orders/${r.orderId}`} className="hover:underline">
                      {r.orderNumber}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{r.status}</td>
                  <td className="px-2 py-2">{r.transportMode || "—"}</td>
                  <td className="px-2 py-2 text-xs text-zinc-600">
                    {r.customerCrmAccountName || (r.customerCrmAccountId ? r.customerCrmAccountId.slice(0, 8) + "…" : "—")}
                  </td>
                  <td className="px-2 py-2 text-xs text-zinc-600">
                    {(r.originCode || "—") + " → " + (r.destinationCode || "—")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs">
                    {r.eta || r.latestEta
                      ? new Date((r.latestEta || r.eta) as string).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">
                    {r.receivedAt ? new Date(r.receivedAt).toLocaleDateString() : "—"}
                    {(() => {
                      const etaIso = r.latestEta || r.eta;
                      if (!etaIso || !r.receivedAt) return null;
                      const deltaMs = new Date(r.receivedAt).getTime() - new Date(etaIso).getTime();
                      const days = Math.round((deltaMs / 86_400_000) * 10) / 10;
                      return (
                        <span
                          className={`ml-2 rounded-full border px-2 py-0.5 ${
                            days <= 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                          }`}
                        >
                          {days <= 0 ? `${Math.abs(days)}d early` : `${days}d late`}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="max-w-[14rem] px-2 py-2 text-xs text-zinc-600">
                    <div className="truncate" title={r.shipperName || ""}>
                      S: {r.shipperName || "—"}
                    </div>
                    <div className="truncate" title={r.consigneeName || ""}>
                      C: {r.consigneeName || "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">
                    {r.quantityRef || "—"} / {r.weightKgRef || "—"}kg / {r.cbmRef || "—"}cbm
                  </td>
                  <td className="px-2 py-2 text-xs text-zinc-600">
                    <div>{r.dispatchOwner?.name || "Unassigned"}</div>
                    <div className="text-zinc-500">
                      A:{r.openQueueCounts?.openAlerts ?? 0} / E:{r.openQueueCounts?.openExceptions ?? 0}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-700">
                    {r.routeProgressPct == null ? "—" : `${r.routeProgressPct}%`}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">
                    {r.nextAction || "—"}
                  </td>
                  <td className="px-2 py-2 text-xs text-zinc-600">
                    {r.latestMilestone ? `${r.latestMilestone.code}${r.latestMilestone.hasActual ? " ✓" : ""}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-500">
                    {new Date(r.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
        <span className="text-zinc-600">
          Page {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
