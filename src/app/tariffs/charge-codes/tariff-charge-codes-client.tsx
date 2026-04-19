"use client";

import { useState } from "react";

import type { TariffChargeFamily, TariffTransportMode } from "@prisma/client";

import { TARIFF_CHARGE_FAMILY_OPTIONS, TARIFF_TRANSPORT_MODE_OPTIONS } from "@/lib/tariff/normalized-charge-catalog-shared";

export type SerializedChargeCatalogRow = {
  id: string;
  code: string;
  displayName: string;
  chargeFamily: TariffChargeFamily;
  transportMode: TariffTransportMode | null;
  isLocalCharge: boolean;
  isSurcharge: boolean;
  active: boolean;
};

export function TariffChargeCodesClient(props: {
  initialRows: SerializedChargeCatalogRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState(props.initialRows);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [chargeFamily, setChargeFamily] = useState<TariffChargeFamily>("ADMIN_OTHER");
  const [transportMode, setTransportMode] = useState<string>("");
  const [isLocalCharge, setIsLocalCharge] = useState(false);
  const [isSurcharge, setIsSurcharge] = useState(false);

  async function patchRow(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tariffs/normalized-charge-codes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; chargeCode?: SerializedChargeCatalogRow };
      if (!res.ok) {
        setError(data.error ?? `Update failed (${res.status})`);
        return;
      }
      if (data.chargeCode) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.chargeCode } : r)));
      }
    } finally {
      setBusy(false);
    }
  }

  async function createRow(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tariffs/normalized-charge-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          displayName,
          chargeFamily,
          transportMode: transportMode.trim() ? transportMode.trim() : null,
          isLocalCharge,
          isSurcharge,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; chargeCode?: SerializedChargeCatalogRow };
      if (!res.ok) {
        setError(data.error ?? `Create failed (${res.status})`);
        return;
      }
      if (data.chargeCode) {
        setRows((prev) => [...prev, data.chargeCode!].sort((a, b) => a.code.localeCompare(b.code)));
        setCode("");
        setDisplayName("");
        setChargeFamily("ADMIN_OTHER");
        setTransportMode("");
        setIsLocalCharge(false);
        setIsSurcharge(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Catalog</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Normalized codes attach to tariff charge lines and snapshot JSON. Codes are shared across the tenant
          database (not per-tenant rows in this MVP).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Display</th>
                <th className="py-2 pr-3">Family</th>
                <th className="py-2 pr-3">Mode</th>
                <th className="py-2 pr-3">Local</th>
                <th className="py-2 pr-3">Surcharge</th>
                <th className="py-2 pr-3">Active</th>
                {props.canEdit ? <th className="py-2 pr-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-800">{r.code}</td>
                  <td className="py-2 pr-3 text-zinc-800">{r.displayName}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-600">{r.chargeFamily}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-600">{r.transportMode ?? "—"}</td>
                  <td className="py-2 pr-3">{r.isLocalCharge ? "Yes" : "—"}</td>
                  <td className="py-2 pr-3">{r.isSurcharge ? "Yes" : "—"}</td>
                  <td className="py-2 pr-3">{r.active ? "Yes" : "No"}</td>
                  {props.canEdit ? (
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void patchRow(r.id, { active: !r.active })}
                        className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline disabled:opacity-40"
                      >
                        {r.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {props.canEdit ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow · Step 1</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900">Add charge code</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Use short stable codes (e.g. <span className="font-mono">WH_HANDLING</span>). The code cannot be changed
            after creation.
          </p>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => void createRow(e)}>
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">Code</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm uppercase text-zinc-900 shadow-inner"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={32}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">Display name</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">Charge family</label>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner"
                value={chargeFamily}
                onChange={(e) => setChargeFamily(e.target.value as TariffChargeFamily)}
              >
                {TARIFF_CHARGE_FAMILY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Transport mode (optional)
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner"
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
              >
                <option value="">—</option>
                {TARIFF_TRANSPORT_MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={isLocalCharge} onChange={(e) => setIsLocalCharge(e.target.checked)} />
              Local charge
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={isSurcharge} onChange={(e) => setIsSurcharge(e.target.checked)} />
              Surcharge
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Create charge code"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
    </div>
  );
}
