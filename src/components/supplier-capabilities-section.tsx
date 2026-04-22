"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SupplierCapabilityRow } from "@/lib/srm/supplier-capability-types";

const MODE_OPTIONS = ["", "OCEAN", "AIR", "ROAD", "RAIL"] as const;

export function SupplierCapabilitiesSection({
  supplierId,
  canEdit,
  initialRows,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierCapabilityRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SupplierCapabilityRow[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<SupplierCapabilityRow>>({});

  const [nMode, setNMode] = useState("");
  const [nSubMode, setNSubMode] = useState("");
  const [nServiceType, setNServiceType] = useState("");
  const [nGeography, setNGeography] = useState("");
  const [nNotes, setNNotes] = useState("");

  async function addCapability(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nServiceType.trim()) {
      setError("Service type is required.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/suppliers/${supplierId}/capabilities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: nMode || null,
        subMode: nSubMode.trim() || null,
        serviceType: nServiceType.trim(),
        geography: nGeography.trim() || null,
        notes: nNotes.trim() || null,
      }),
    });
    const payload: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Save failed."));
      return;
    }
    const body = payload as { capability?: SupplierCapabilityRow };
    if (body.capability) {
      setRows((r) => [...r, body.capability!]);
    }
    setNMode("");
    setNSubMode("");
    setNServiceType("");
    setNGeography("");
    setNNotes("");
    setBusy(false);
    router.refresh();
  }

  async function saveEdit(id: string) {
    setError(null);
    if (!(draft.serviceType ?? "").trim()) {
      setError("Service type is required.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/suppliers/${supplierId}/capabilities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: draft.mode === "" ? null : draft.mode,
        subMode: draft.subMode,
        serviceType: draft.serviceType,
        geography: draft.geography,
        notes: draft.notes,
      }),
    });
    const payload: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Update failed."));
      return;
    }
    const body = payload as { capability?: SupplierCapabilityRow };
    if (body.capability) {
      setRows((prev) => prev.map((x) => (x.id === id ? body.capability! : x)));
    }
    setEditingId(null);
    setDraft({});
    setBusy(false);
    router.refresh();
  }

  async function removeRow(id: string) {
    if (!window.confirm("Remove this capability row?")) return;
    setBusy(true);
    const res = await fetch(`/api/suppliers/${supplierId}/capabilities/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const payload: unknown = await res.json();
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Delete failed."));
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== id));
    setBusy(false);
    router.refresh();
  }

  function startEdit(row: SupplierCapabilityRow) {
    setEditingId(row.id);
    setDraft({
      mode: row.mode,
      subMode: row.subMode,
      serviceType: row.serviceType,
      geography: row.geography,
      notes: row.notes,
    });
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Service capabilities</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Declared modes, services, and geography (SRM data model — qualification workflows can build on this
        later).
      </p>

      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Sub-mode</th>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">Geography</th>
              <th className="px-3 py-2">Notes</th>
              {canEdit ? <th className="px-3 py-2 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="px-3 py-6 text-center text-zinc-500"
                >
                  No capability rows yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {editingId === row.id && canEdit ? (
                    <>
                      <td className="px-2 py-2 align-top">
                        <select
                          value={draft.mode ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, mode: e.target.value ? e.target.value : null }))
                          }
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          {MODE_OPTIONS.map((m) => (
                            <option key={m || "any"} value={m}>
                              {m === "" ? "—" : m}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          value={draft.subMode ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, subMode: e.target.value || null }))}
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          value={draft.serviceType ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, serviceType: e.target.value }))
                          }
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          value={draft.geography ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, geography: e.target.value || null }))
                          }
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <textarea
                          value={draft.notes ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, notes: e.target.value || null }))
                          }
                          rows={2}
                          className="w-full min-w-[140px] rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveEdit(row.id)}
                          className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(null);
                            setDraft({});
                          }}
                          className="ml-2 text-xs text-zinc-600 hover:underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-zinc-800">{row.mode ?? "—"}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.subMode ?? "—"}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{row.serviceType}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.geography ?? "—"}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-zinc-600" title={row.notes ?? ""}>
                        {row.notes ?? "—"}
                      </td>
                      {canEdit ? (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(row)}
                            className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeRow(row.id)}
                            className="ml-2 text-xs text-rose-700 hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <form
          onSubmit={(e) => void addCapability(e)}
          className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4"
        >
          <p className="text-sm font-medium text-zinc-800">Add capability</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col text-sm">
              <span className="font-medium text-zinc-700">Mode</span>
              <select
                value={nMode}
                onChange={(e) => setNMode(e.target.value)}
                className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m || "any"} value={m}>
                    {m === "" ? "Any / not specified" : m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="font-medium text-zinc-700">Sub-mode</span>
              <input
                value={nSubMode}
                onChange={(e) => setNSubMode(e.target.value)}
                className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="e.g. FCL, LCL"
              />
            </label>
            <label className="flex flex-col text-sm sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-zinc-700">Service type *</span>
              <input
                value={nServiceType}
                onChange={(e) => setNServiceType(e.target.value)}
                className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="e.g. Ocean freight, Customs brokerage"
                required
              />
            </label>
            <label className="flex flex-col text-sm sm:col-span-2">
              <span className="font-medium text-zinc-700">Geography</span>
              <input
                value={nGeography}
                onChange={(e) => setNGeography(e.target.value)}
                className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Regions, lanes, or countries served"
              />
            </label>
            <label className="flex flex-col text-sm sm:col-span-2">
              <span className="font-medium text-zinc-700">Notes</span>
              <textarea
                value={nNotes}
                onChange={(e) => setNNotes(e.target.value)}
                rows={2}
                className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add capability
          </button>
        </form>
      ) : null}
    </section>
  );
}
