"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type SupplierRelationshipNoteRow = {
  id: string;
  body: string;
  createdAt: string;
};

export function SupplierRelationshipNotesSection({
  supplierId,
  canEdit,
  initialRows,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierRelationshipNoteRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!draft.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/suppliers/${supplierId}/relationship-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft.trim() }),
    });
    const payload = (await res.json()) as { error?: string; note?: SupplierRelationshipNoteRow };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add note.");
      return;
    }
    if (payload.note) setRows((prev) => [payload.note!, ...prev]);
    setDraft("");
    setBusy(false);
    router.refresh();
  }

  async function patchNote(id: string, body: string, previous: string) {
    if (body.trim() === previous.trim()) return;
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/relationship-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    const payload = (await res.json()) as { error?: string; note?: SupplierRelationshipNoteRow };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Update failed.");
      return;
    }
    if (payload.note) {
      setRows((prev) => prev.map((r) => (r.id === id ? payload.note! : r)));
    }
    setBusyId(null);
    router.refresh();
  }

  async function removeNote(id: string) {
    if (!window.confirm("Delete this relationship note?")) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/relationship-notes/${id}`, {
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
      <h2 className="text-sm font-semibold text-zinc-900">Relationship notes</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Chronological log for account management: visits, reviews, escalations, and other touchpoints
        (SRM-only; not CRM opportunities or sourcing events).
      </p>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 space-y-4">
        {rows.length === 0 ? (
          <li className="rounded-md border border-zinc-100 px-4 py-6 text-center text-sm text-zinc-500">
            No notes yet.
          </li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="rounded-md border border-zinc-100 p-4">
              <p className="text-[11px] text-zinc-500">
                {new Date(r.createdAt).toLocaleString()}
              </p>
              {canEdit ? (
                <textarea
                  defaultValue={r.body}
                  disabled={busyId === r.id}
                  rows={3}
                  className={`${f} mt-2`}
                  onBlur={(e) => void patchNote(r.id, e.target.value, r.body)}
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{r.body}</p>
              )}
              {canEdit ? (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void removeNote(r.id)}
                  className="mt-2 text-xs text-red-700 underline disabled:opacity-50"
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {canEdit ? (
        <form onSubmit={addNote} className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4">
          <p className="text-sm font-medium text-zinc-800">Add note</p>
          <label className="flex flex-col text-sm">
            <span>Note</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className={f}
              placeholder="e.g. QBR completed — agreed to pilot lane on Midwest lanes."
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add note"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
