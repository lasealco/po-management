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
  orderNumber: string;
  supplierName: string | null;
  customerCrmAccountId: string | null;
  originCode: string | null;
  destinationCode: string | null;
  etd: string | null;
  eta: string | null;
  latestEta: string | null;
  updatedAt: string;
  latestMilestone: { code: string; hasActual: boolean } | null;
};

export function ControlTowerWorkbench({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Array<{ id: string; name: string; filtersJson: unknown }>>([]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (mode) sp.set("mode", mode);
      if (q.trim()) sp.set("q", q.trim());
      sp.set("take", "120");
      const res = await fetch(`/api/control-tower/shipments?${sp.toString()}`);
      const data = (await res.json()) as { shipments?: Row[]; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setRows(data.shipments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [status, mode, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/control-tower/saved-filters");
      if (!res.ok) return;
      const data = (await res.json()) as {
        filters?: Array<{ id: string; name: string; filtersJson: unknown }>;
      };
      setSaved(data.filters ?? []);
    })();
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
      "updatedAt",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
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
    const o = json as { status?: string; mode?: string; q?: string };
    setStatus(typeof o.status === "string" ? o.status : "");
    setMode(typeof o.mode === "string" ? o.mode : "");
    setQ(typeof o.q === "string" ? o.q : "");
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
        filtersJson: { status, mode, q },
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      window.alert(err.error || "Save failed");
      return;
    }
    const list = await fetch("/api/control-tower/saved-filters");
    if (list.ok) {
      const data = (await list.json()) as {
        filters?: Array<{ id: string; name: string; filtersJson: unknown }>;
      };
      setSaved(data.filters ?? []);
    }
  };

  const statusOptions = useMemo(
    () => ["", "SHIPPED", "VALIDATED", "BOOKED", "IN_TRANSIT", "DELIVERED", "RECEIVED"],
    [],
  );
  const modeOptions = useMemo(() => ["", "OCEAN", "AIR", "ROAD", "RAIL"], []);

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
          disabled={rows.length === 0}
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
          <label className="text-xs text-zinc-600">
            Saved views
            <select
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value;
                e.target.value = "";
                const f = saved.find((x) => x.id === id);
                if (f) applySaved(f.filtersJson);
              }}
              className="mt-1 block max-w-[10rem] rounded border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="">Apply…</option>
              {saved.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
            <tr>
              <th className="px-2 py-2">Order</th>
              <th className="px-2 py-2">Shipment</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Mode</th>
              <th className="px-2 py-2">CRM</th>
              <th className="px-2 py-2">Lane</th>
              <th className="px-2 py-2">ETA</th>
              <th className="px-2 py-2">Milestone</th>
              <th className="px-2 py-2">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-2 py-6 text-center text-zinc-500">
                  {busy ? "Loading…" : "No rows match."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="text-zinc-800">
                  <td className="px-2 py-2 font-medium">
                    <Link href={`/control-tower/shipments/${r.id}`} className="text-sky-800 hover:underline">
                      {r.orderNumber}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-zinc-600">{r.shipmentNo || r.id.slice(0, 8)}</td>
                  <td className="px-2 py-2">{r.status}</td>
                  <td className="px-2 py-2">{r.transportMode || "—"}</td>
                  <td className="px-2 py-2 font-mono text-xs text-zinc-500">
                    {r.customerCrmAccountId ? r.customerCrmAccountId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-2 py-2 text-xs text-zinc-600">
                    {(r.originCode || "—") + " → " + (r.destinationCode || "—")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs">
                    {r.eta || r.latestEta
                      ? new Date((r.latestEta || r.eta) as string).toLocaleDateString()
                      : "—"}
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
    </div>
  );
}
