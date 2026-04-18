"use client";

import type { SupplierContractRecordStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SupplierContractRecordRow = {
  id: string;
  title: string;
  externalReference: string | null;
  status: SupplierContractRecordStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  notes: string | null;
  referenceUrl: string | null;
  createdAt: string;
};

const STATUSES: { value: SupplierContractRecordStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
];

export function SupplierContractRecordsSection({
  supplierId,
  canEdit,
  initialRows,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierContractRecordRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [status, setStatus] = useState<SupplierContractRecordStatus>("draft");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [notes, setNotes] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");

  async function addContract(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      title: title.trim(),
      status,
      externalReference: externalReference.trim() || null,
      notes: notes.trim() || null,
    };
    if (effectiveFrom.trim()) body.effectiveFrom = new Date(effectiveFrom).toISOString();
    if (effectiveTo.trim()) body.effectiveTo = new Date(effectiveTo).toISOString();
    if (referenceUrl.trim()) body.referenceUrl = referenceUrl.trim();
    const res = await fetch(`/api/suppliers/${supplierId}/contract-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { error?: string; contract?: SupplierContractRecordRow };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add contract.");
      return;
    }
    if (payload.contract) setRows((prev) => [payload.contract!, ...prev]);
    setTitle("");
    setExternalReference("");
    setStatus("draft");
    setEffectiveFrom("");
    setEffectiveTo("");
    setNotes("");
    setReferenceUrl("");
    setBusy(false);
    router.refresh();
  }

  async function patchContract(id: string, patch: Record<string, unknown>) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/contract-records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await res.json()) as { error?: string; contract?: SupplierContractRecordRow };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Update failed.");
      return;
    }
    if (payload.contract) {
      setRows((prev) => prev.map((r) => (r.id === id ? payload.contract! : r)));
    }
    setBusyId(null);
    router.refresh();
  }

  async function removeContract(id: string) {
    if (!window.confirm("Delete this contract record?")) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/contract-records/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const payload = (await res.json()) as { error?: string };
      setBusyId(null);
      setError(payload.error ?? "Delete failed.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setBusyId(null);
    router.refresh();
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Contracts</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Register commercial agreements and links to signed artifacts. This is a summary index only —
        not tender awards, tariff tables, or sourcing events.
      </p>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">No contracts registered.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{r.title}</p>
                  {r.externalReference ? (
                    <p className="font-mono text-[11px] text-zinc-500">Ref: {r.externalReference}</p>
                  ) : null}
                  <p className="text-[11px] text-zinc-500">
                    Added {new Date(r.createdAt).toLocaleDateString()}
                    {r.effectiveFrom || r.effectiveTo
                      ? ` · ${r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString() : "…"} → ${r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : "…"}`
                      : ""}
                  </p>
                  {r.referenceUrl ? (
                    <a
                      href={r.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-[var(--arscmp-primary)] underline"
                    >
                      Open link
                    </a>
                  ) : null}
                  {r.notes ? <p className="mt-1 text-xs text-zinc-600">{r.notes}</p> : null}
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:w-44">
                    <select
                      value={r.status}
                      disabled={busyId === r.id}
                      onChange={(e) => {
                        void patchContract(r.id, { status: e.target.value as SupplierContractRecordStatus });
                      }}
                      className={f}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void removeContract(r.id)}
                      className="text-left text-xs text-red-700 underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-zinc-600">{r.status}</span>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
      {canEdit ? (
        <form onSubmit={addContract} className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4">
          <p className="text-sm font-medium text-zinc-800">Add contract</p>
          <label className="flex flex-col text-sm">
            <span>Title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span>External reference (optional)</span>
            <input
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
              className={f}
              placeholder="e.g. CTR-2026-0142"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SupplierContractRecordStatus)}
              className={f}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col text-sm">
              <span>Effective from</span>
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={f} />
            </label>
            <label className="flex flex-col text-sm">
              <span>Effective to</span>
              <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className={f} />
            </label>
          </div>
          <label className="flex flex-col text-sm">
            <span>Reference URL (https://…)</span>
            <input value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span>Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={f} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add contract"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
