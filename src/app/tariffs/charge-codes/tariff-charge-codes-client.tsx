"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
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

export type ChargeCatalogAuditEntry = {
  id: string;
  action: string;
  objectId: string;
  at: string;
  actor: string;
};

function mergeUpdatedRow(c: SerializedChargeCatalogRow): SerializedChargeCatalogRow {
  return {
    id: c.id,
    code: c.code,
    displayName: c.displayName,
    chargeFamily: c.chargeFamily,
    transportMode: c.transportMode ?? null,
    isLocalCharge: Boolean(c.isLocalCharge),
    isSurcharge: Boolean(c.isSurcharge),
    active: Boolean(c.active),
  };
}

export function TariffChargeCodesClient(props: {
  initialRows: SerializedChargeCatalogRow[];
  auditTail: ChargeCatalogAuditEntry[];
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editChargeFamily, setEditChargeFamily] = useState<TariffChargeFamily>("ADMIN_OTHER");
  const [editTransportMode, setEditTransportMode] = useState("");
  const [editIsLocalCharge, setEditIsLocalCharge] = useState(false);
  const [editIsSurcharge, setEditIsSurcharge] = useState(false);

  function beginEdit(r: SerializedChargeCatalogRow) {
    setEditingId(r.id);
    setEditDisplayName(r.displayName);
    setEditChargeFamily(r.chargeFamily);
    setEditTransportMode(r.transportMode ?? "");
    setEditIsLocalCharge(r.isLocalCharge);
    setEditIsSurcharge(r.isSurcharge);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function patchRow(id: string, patch: Record<string, unknown>, opts?: { closeEdit?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tariffs/normalized-charge-codes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiClientErrorMessage(data, `Update failed (${res.status})`));
        return;
      }
      const body = data as { chargeCode?: SerializedChargeCatalogRow };
      if (body.chargeCode) {
        const next = mergeUpdatedRow(body.chargeCode);
        setRows((prev) => prev.map((r) => (r.id === id ? next : r)));
        if (opts?.closeEdit) setEditingId(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    await patchRow(
      id,
      {
        displayName: editDisplayName.trim(),
        chargeFamily: editChargeFamily,
        transportMode: editTransportMode.trim() ? editTransportMode.trim() : null,
        isLocalCharge: editIsLocalCharge,
        isSurcharge: editIsSurcharge,
      },
      { closeEdit: true },
    );
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
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiClientErrorMessage(data, `Create failed (${res.status})`));
        return;
      }
      const body = data as { chargeCode?: SerializedChargeCatalogRow };
      if (body.chargeCode) {
        const row = mergeUpdatedRow(body.chargeCode);
        setRows((prev) => [...prev, row].sort((a, b) => a.code.localeCompare(b.code)));
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
                  {editingId === r.id ? (
                    <>
                      <td className="py-2 pr-3">
                        <input
                          className="w-full min-w-[8rem] rounded border border-zinc-200 px-2 py-1 text-xs"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          className="w-full min-w-[8rem] rounded border border-zinc-200 px-2 py-1 text-xs"
                          value={editChargeFamily}
                          onChange={(e) => setEditChargeFamily(e.target.value as TariffChargeFamily)}
                        >
                          {TARIFF_CHARGE_FAMILY_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          className="w-full min-w-[6rem] rounded border border-zinc-200 px-2 py-1 text-xs"
                          value={editTransportMode}
                          onChange={(e) => setEditTransportMode(e.target.value)}
                        >
                          <option value="">—</option>
                          {TARIFF_TRANSPORT_MODE_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={editIsLocalCharge}
                          onChange={(e) => setEditIsLocalCharge(e.target.checked)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={editIsSurcharge}
                          onChange={(e) => setEditIsSurcharge(e.target.checked)}
                        />
                      </td>
                      <td className="py-2 pr-3">{r.active ? "Yes" : "No"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy || !editDisplayName.trim()}
                            onClick={() => void saveEdit(r.id)}
                            className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={cancelEdit}
                            className="text-xs font-semibold text-zinc-600 hover:underline disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-3 text-zinc-800">{r.displayName}</td>
                      <td className="py-2 pr-3 text-xs text-zinc-600">{r.chargeFamily}</td>
                      <td className="py-2 pr-3 text-xs text-zinc-600">{r.transportMode ?? "—"}</td>
                      <td className="py-2 pr-3">{r.isLocalCharge ? "Yes" : "—"}</td>
                      <td className="py-2 pr-3">{r.isSurcharge ? "Yes" : "—"}</td>
                      <td className="py-2 pr-3">{r.active ? "Yes" : "No"}</td>
                      {props.canEdit ? (
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => beginEdit(r)}
                              className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline disabled:opacity-40"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void patchRow(r.id, { active: !r.active })}
                              className="text-xs font-semibold text-zinc-600 hover:underline disabled:opacity-40"
                            >
                              {r.active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {props.auditTail.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Recent changes</h2>
          <p className="mt-2 text-xs text-zinc-500">Last writes to charge codes (create / update). Reload page to refresh.</p>
          <ul className="mt-4 divide-y divide-zinc-100 text-sm">
            {props.auditTail.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-3 py-2 text-zinc-700">
                <span className="font-mono text-xs text-zinc-500">{a.at.replace("T", " ").slice(0, 19)}</span>
                <span className="text-xs font-semibold uppercase text-zinc-500">{a.action}</span>
                <span className="text-xs">{a.actor}</span>
                <span className="font-mono text-xs text-zinc-500">{a.objectId.slice(0, 12)}…</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
