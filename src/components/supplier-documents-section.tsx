"use client";

import type { SupplierDocumentCategory } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SupplierDocumentRow = {
  id: string;
  title: string;
  category: SupplierDocumentCategory;
  referenceUrl: string | null;
  notes: string | null;
  documentDate: string | null;
  createdAt: string;
};

const CATEGORIES: { value: SupplierDocumentCategory; label: string }[] = [
  { value: "insurance", label: "Insurance" },
  { value: "license", label: "License" },
  { value: "certificate", label: "Certificate" },
  { value: "compliance_other", label: "Compliance (other)" },
  { value: "commercial_other", label: "Commercial (other)" },
];

export function SupplierDocumentsSection({
  supplierId,
  canEdit,
  initialRows,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierDocumentRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SupplierDocumentCategory>("compliance_other");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [documentDate, setDocumentDate] = useState("");

  async function addDoc(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      title: title.trim(),
      category,
      notes: notes.trim() || null,
    };
    if (referenceUrl.trim()) body.referenceUrl = referenceUrl.trim();
    if (documentDate.trim()) body.documentDate = new Date(documentDate).toISOString();
    const res = await fetch(`/api/suppliers/${supplierId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { error?: string; document?: SupplierDocumentRow };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add document.");
      return;
    }
    if (payload.document) setRows((prev) => [payload.document!, ...prev]);
    setTitle("");
    setReferenceUrl("");
    setNotes("");
    setDocumentDate("");
    setBusy(false);
    router.refresh();
  }

  async function patchDoc(id: string, patch: Record<string, unknown>) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await res.json()) as { error?: string; document?: SupplierDocumentRow };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Update failed.");
      return;
    }
    if (payload.document) {
      setRows((prev) => prev.map((r) => (r.id === id ? payload.document! : r)));
    }
    setBusyId(null);
    router.refresh();
  }

  async function removeDoc(id: string) {
    if (!window.confirm("Remove this document record?")) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/documents/${id}`, { method: "DELETE" });
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
      <h2 className="text-sm font-semibold text-zinc-900">Documents</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Register evidence and links (e.g. to your DMS or secure file share). This is a metadata index
        only — not tender, tariff, or sourcing-event tooling.
      </p>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">No documents registered.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{r.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    {CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                    {r.documentDate ? ` · Dated ${new Date(r.documentDate).toLocaleDateString()}` : ""}
                    {" · Added "}
                    {new Date(r.createdAt).toLocaleDateString()}
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
                <div className="flex shrink-0 flex-col gap-2 sm:w-48">
                  {canEdit ? (
                    <>
                      <select
                        value={r.category}
                        disabled={busyId === r.id}
                        onChange={(e) => {
                          void patchDoc(r.id, { category: e.target.value as SupplierDocumentCategory });
                        }}
                        className={f}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void removeDoc(r.id)}
                        className="text-left text-xs text-red-700 underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
      {canEdit ? (
        <form onSubmit={addDoc} className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4">
          <p className="text-sm font-medium text-zinc-800">Register document</p>
          <label className="flex flex-col text-sm">
            <span>Title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SupplierDocumentCategory)}
              className={f}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span>Reference URL (https://…)</span>
            <input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              className={f}
              placeholder="https://…"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span>Document date (optional)</span>
            <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} className={f} />
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
            {busy ? "Saving…" : "Add document"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
