"use client";

import type { SupplierDocumentCategory } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  activeDocumentNeedsComplianceAttention,
  supplierHasMissingControlledDocumentSlots,
} from "@/lib/srm/supplier-compliance-document-signals";
import { supplierDocumentExpiryBadge } from "@/lib/srm/supplier-document-expiry";
import { supplierDocumentRowEditorKey } from "@/lib/srm/supplier-document-row-key";

export type SupplierDocumentRow = {
  id: string;
  title: string;
  category: SupplierDocumentCategory;
  referenceUrl: string | null;
  notes: string | null;
  documentDate: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

type DocumentFilter = "all" | "active" | "archived" | "issues";

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
  /** When set (e.g. from Compliance “Register …”), pre-select category once then clear via `onConsumedRegisterCategoryFocus`. */
  registerCategoryFocus = null,
  onConsumedRegisterCategoryFocus,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierDocumentRow[];
  registerCategoryFocus?: SupplierDocumentCategory | null;
  onConsumedRegisterCategoryFocus?: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SupplierDocumentCategory>("compliance_other");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [listFilter, setListFilter] = useState<DocumentFilter>("all");

  const visibleRows = useMemo(() => {
    if (listFilter === "all") return rows;
    if (listFilter === "active") return rows.filter((r) => !r.archivedAt);
    if (listFilter === "archived") return rows.filter((r) => Boolean(r.archivedAt));
    return rows.filter((r) => activeDocumentNeedsComplianceAttention(r));
  }, [rows, listFilter]);

  const issueCount = useMemo(
    () => rows.filter((r) => activeDocumentNeedsComplianceAttention(r)).length,
    [rows],
  );

  useEffect(() => {
    if (!registerCategoryFocus) return;
    setCategory(registerCategoryFocus);
    onConsumedRegisterCategoryFocus?.();
  }, [registerCategoryFocus, onConsumedRegisterCategoryFocus]);

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
    if (expiresAt.trim()) body.expiresAt = new Date(expiresAt).toISOString();
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
    setExpiresAt("");
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
    if (
      !window.confirm(
        "Remove this document from the register? This deletes the row (use Archive first if you only want to hide it from compliance counts).",
      )
    )
      return;
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

  async function copyReferenceUrl(url: string, documentId: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedDocId(documentId);
      window.setTimeout(() => setCopiedDocId((cur) => (cur === documentId ? null : cur)), 2000);
    } catch {
      setError("Could not copy link (browser blocked or unavailable).");
    }
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50";

  return (
    <section
      id="supplier-documents-section"
      className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Documents</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Register evidence and links (e.g. to your DMS or secure file share). Archive retires a row from
        active compliance readiness (Compliance tab) without deleting history. Optional expiry highlights
        overdue or soon-to-lapse rows.
      </p>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter document list">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["archived", "Archived"],
              ["issues", `Needs attention${issueCount ? ` (${issueCount})` : ""}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setListFilter(id as DocumentFilter)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                listFilter === id
                  ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary-50)] text-[var(--arscmp-primary)]"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {listFilter === "issues" &&
      visibleRows.length === 0 &&
      rows.length > 0 &&
      supplierHasMissingControlledDocumentSlots(rows) ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          No rows match row-level issues. At least one required category (insurance, license, or
          certificate) still has <strong className="font-semibold">no document on file</strong> — open the{" "}
          <strong className="font-semibold">Compliance</strong> tab for gaps and quick links to register
          here.
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">No documents registered.</li>
        ) : visibleRows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">
            No documents match this filter.
          </li>
        ) : (
          visibleRows.map((r) => {
            const isArchived = Boolean(r.archivedAt);
            const expiryBadge = isArchived ? null : supplierDocumentExpiryBadge(r.expiresAt);
            const rowEditorKey = supplierDocumentRowEditorKey(
              r.id,
              r.title,
              r.referenceUrl,
              r.documentDate,
              r.notes,
            );
            return (
            <li
              key={r.id}
              className={`px-4 py-3 ${isArchived ? "bg-zinc-50/80 text-zinc-500" : ""}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  {canEdit && !isArchived ? (
                    <label className="block text-xs text-zinc-600">
                      Title
                      <input
                        key={`${rowEditorKey}-title`}
                        defaultValue={r.title}
                        disabled={busyId === r.id}
                        className={f}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === r.title.trim()) return;
                          if (!v) {
                            e.target.value = r.title;
                            return;
                          }
                          void patchDoc(r.id, { title: v });
                        }}
                      />
                    </label>
                  ) : (
                    <p className={`text-sm font-medium ${isArchived ? "text-zinc-600" : "text-zinc-900"}`}>
                      {r.title}
                      {isArchived ? (
                        <span className="ml-2 rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-700">
                          Archived
                        </span>
                      ) : null}
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-500">
                    {CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                    {r.documentDate ? ` · Dated ${new Date(r.documentDate).toLocaleDateString()}` : ""}
                    {r.expiresAt ? (
                      <>
                        {" · Expires "}
                        {new Date(r.expiresAt).toLocaleDateString()}
                      </>
                    ) : null}
                    {" · Added "}
                    {new Date(r.createdAt).toLocaleDateString()}
                    {isArchived && r.archivedAt ? (
                      <>
                        {" · Archived "}
                        {new Date(r.archivedAt).toLocaleDateString()}
                      </>
                    ) : null}
                  </p>
                  {expiryBadge ? (
                    <p className="mt-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          expiryBadge === "expired"
                            ? "bg-rose-100 text-rose-800"
                            : expiryBadge === "expires_critical"
                              ? "bg-orange-100 text-orange-950"
                              : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {expiryBadge === "expired"
                          ? "Expired"
                          : expiryBadge === "expires_critical"
                            ? "Expires within 14 days (critical)"
                            : "Expires within 30 days"}
                      </span>
                    </p>
                  ) : null}
                  {canEdit && !isArchived ? (
                    <div className="mt-2 space-y-1">
                      <label className="block text-xs text-zinc-600">
                        Reference URL (https://…)
                        <input
                          key={`${rowEditorKey}-ref`}
                          defaultValue={r.referenceUrl ?? ""}
                          disabled={busyId === r.id}
                          placeholder="https://…"
                          className={f}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            const prev = (r.referenceUrl ?? "").trim();
                            if (v === prev) return;
                            void patchDoc(r.id, { referenceUrl: v || null });
                          }}
                        />
                      </label>
                      {r.referenceUrl ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void copyReferenceUrl(r.referenceUrl!, r.id)}
                          className="text-[11px] font-medium text-[var(--arscmp-primary)] underline disabled:opacity-50"
                        >
                          {copiedDocId === r.id ? "Copied" : "Copy saved link"}
                        </button>
                      ) : null}
                    </div>
                  ) : r.referenceUrl ? (
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <a
                        href={r.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--arscmp-primary)] underline"
                      >
                        Open link
                      </a>
                      <button
                        type="button"
                        onClick={() => void copyReferenceUrl(r.referenceUrl!, r.id)}
                        className="text-[11px] font-medium text-zinc-600 underline hover:text-zinc-900"
                      >
                        {copiedDocId === r.id ? "Copied" : "Copy link"}
                      </button>
                    </span>
                  ) : null}
                  {canEdit && !isArchived ? (
                    <label className="mt-2 block text-xs text-zinc-600">
                      Document date
                      <input
                        key={`${rowEditorKey}-docdate`}
                        type="date"
                        defaultValue={toDateInputValue(r.documentDate)}
                        disabled={busyId === r.id}
                        className={f}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const prev = toDateInputValue(r.documentDate);
                          if (v === prev) return;
                          void patchDoc(
                            r.id,
                            v ? { documentDate: new Date(v).toISOString() } : { documentDate: null },
                          );
                        }}
                      />
                    </label>
                  ) : null}
                  {canEdit && !isArchived ? (
                    <label className="mt-2 block text-xs text-zinc-600">
                      Notes
                      <textarea
                        key={`${rowEditorKey}-notes`}
                        defaultValue={r.notes ?? ""}
                        disabled={busyId === r.id}
                        rows={2}
                        className={f}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const prev = (r.notes ?? "").trim();
                          if (v === prev) return;
                          void patchDoc(r.id, { notes: v || null });
                        }}
                      />
                    </label>
                  ) : r.notes ? (
                    <p className="mt-1 text-xs text-zinc-600">{r.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:w-48">
                  {canEdit ? (
                    <>
                      {!isArchived ? (
                        <>
                          <label className="text-[11px] font-medium text-zinc-600">
                            Expiry (optional)
                            <input
                              type="date"
                              key={`exp-${r.id}-${r.expiresAt ?? "none"}`}
                              defaultValue={toDateInputValue(r.expiresAt)}
                              disabled={busyId === r.id}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                const prev = toDateInputValue(r.expiresAt);
                                if (v === prev) return;
                                void patchDoc(r.id, {
                                  expiresAt: v ? new Date(v).toISOString() : null,
                                });
                              }}
                              className={f}
                            />
                          </label>
                          <select
                            value={r.category}
                            disabled={busyId === r.id}
                            onChange={(e) => {
                              void patchDoc(r.id, {
                                category: e.target.value as SupplierDocumentCategory,
                              });
                            }}
                            className={f}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() =>
                          void patchDoc(r.id, { archived: !isArchived })
                        }
                        className="text-left text-xs font-medium text-zinc-700 underline disabled:opacity-50"
                      >
                        {isArchived ? "Restore to active" : "Archive"}
                      </button>
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
            );
          })
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
            <span>Expiry date (optional)</span>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={f} />
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
