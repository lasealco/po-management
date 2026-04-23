"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import {
  SRM_SUPPLIER_DOCUMENT_TYPE_LABEL,
  type SrmDocExpirySignal,
} from "@/lib/srm/srm-supplier-document-helpers";
import { useCallback, useEffect, useState } from "react";

type DocRow = {
  id: string;
  documentType: keyof typeof SRM_SUPPLIER_DOCUMENT_TYPE_LABEL;
  status: "active" | "archived" | "superseded";
  title: string | null;
  fileName: string;
  fileUrl: string;
  expiresAt: string | null;
  expirySignal: SrmDocExpirySignal;
  updatedAt: string;
  uploadedBy: { id: string; name: string; email: string };
  lastModifiedBy: { id: string; name: string; email: string } | null;
};

type AuditEntry = {
  id: string;
  at: string;
  action: string;
  details: unknown;
  actor: { id: string; name: string; email: string };
};

const EXPIRY_BADGE: Record<SrmDocExpirySignal, { label: string; className: string }> = {
  none: { label: "No expiry", className: "bg-zinc-100 text-zinc-600" },
  ok: { label: "Valid", className: "bg-emerald-50 text-emerald-800" },
  expiring_soon: { label: "Expiring soon", className: "bg-amber-50 text-amber-900" },
  expired: { label: "Expired", className: "bg-red-50 text-red-800" },
};

const DOC_TYPE_OPTIONS = Object.keys(SRM_SUPPLIER_DOCUMENT_TYPE_LABEL) as Array<
  keyof typeof SRM_SUPPLIER_DOCUMENT_TYPE_LABEL
>;

export function SupplierComplianceSection({
  supplierId,
  canEdit,
}: {
  supplierId: string;
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [expandedAudit, setExpandedAudit] = useState<Record<string, AuditEntry[] | "loading" | null>>({});
  const [busy, setBusy] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<(typeof DOC_TYPE_OPTIONS)[number]>("other");
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const q = includeArchived ? "?includeArchived=1" : "";
  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/srm-documents${q}`);
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Could not load documents."));
      return;
    }
    const list = (payload as { documents?: DocRow[] }).documents;
    setDocs(Array.isArray(list) ? list : []);
  }, [supplierId, q]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function loadAudit(docId: string) {
    setExpandedAudit((m) => ({ ...m, [docId]: "loading" }));
    const res = await fetch(`/api/suppliers/${supplierId}/srm-documents/${docId}/audit-logs`);
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setExpandedAudit((m) => ({ ...m, [docId]: null }));
      setError(apiClientErrorMessage(payload ?? {}, "Could not load audit log."));
      return;
    }
    const entries = (payload as { entries?: AuditEntry[] }).entries;
    setExpandedAudit((m) => ({ ...m, [docId]: Array.isArray(entries) ? entries : [] }));
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) {
      setError("Choose a file to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", uploadFile);
    form.set("documentType", docType);
    if (title.trim()) form.set("title", title.trim());
    if (expiresAt) form.set("expiresAt", new Date(`${expiresAt}T12:00:00.000Z`).toISOString());
    const res = await fetch(`/api/suppliers/${supplierId}/srm-documents`, {
      method: "POST",
      body: form,
    });
    const payload: unknown = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Upload failed."));
      return;
    }
    setUploadFile(null);
    setTitle("");
    setExpiresAt("");
    setDocType("other");
    await load();
  }

  async function archiveDoc(id: string) {
    if (!canEdit) return;
    if (!window.confirm("Archive this document? It can be shown again with “Include archived”.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/srm-documents/${id}`, { method: "DELETE" });
    const payload: unknown = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Could not archive."));
      return;
    }
    await load();
  }

  if (docs === null) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">Loading compliance documents…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Compliance &amp; documents</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Store certificates and agreements per supplier. Expiry is evaluated when you open this tab (no background job in
        MVP).
      </p>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {canEdit ? (
        <form onSubmit={onUpload} className="mt-6 space-y-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Upload</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col text-sm">
              <span>File *</span>
              <input
                type="file"
                className="text-sm"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,image/*"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span>Document type *</span>
              <select
                className="rounded-md border border-zinc-300 px-2 py-1.5"
                value={docType}
                onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPE_OPTIONS)[number])}
              >
                {DOC_TYPE_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {SRM_SUPPLIER_DOCUMENT_TYPE_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm sm:col-span-2">
              <span>Title (optional)</span>
              <input
                className="rounded-md border border-zinc-300 px-2 py-1.5"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2025 COI"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span>Expiry (optional)</span>
              <input
                type="date"
                className="rounded-md border border-zinc-300 px-2 py-1.5"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !uploadFile}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Upload document
          </button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-zinc-600">
          You can view and download files. Upload and archive require <strong>org.suppliers</strong> → <strong>edit</strong>
          .
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Library</p>
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include archived
        </label>
      </div>

      {docs.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">No documents yet{canEdit ? " — upload one above" : ""}.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {docs.map((d) => {
            const meta = (() => {
              if (d.expiresAt) return EXPIRY_BADGE[d.expirySignal];
              return EXPIRY_BADGE.none;
            })();
            return (
              <li key={d.id} className="py-4 first:pt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {d.title || d.fileName}
                      {d.title ? (
                        <span className="ml-2 text-xs font-normal text-zinc-500">({d.fileName})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {SRM_SUPPLIER_DOCUMENT_TYPE_LABEL[d.documentType]} ·{" "}
                      <span
                        className={
                          d.status === "archived" ? "text-zinc-500" : d.status === "superseded" ? "text-amber-800" : ""
                        }
                      >
                        {d.status}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Last change {new Date(d.updatedAt).toLocaleString()} ·{" "}
                      {(d.lastModifiedBy ?? d.uploadedBy).name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                      {d.expiresAt
                        ? `${meta.label} · ${d.expiresAt.slice(0, 10)}`
                        : meta.label}
                    </span>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
                    >
                      View / download
                    </a>
                    {canEdit && d.status !== "archived" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void archiveDoc(d.id)}
                        className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        Archive
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline"
                      onClick={() => {
                        if (expandedAudit[d.id] && expandedAudit[d.id] !== "loading") {
                          setExpandedAudit((m) => ({ ...m, [d.id]: null }));
                        } else {
                          void loadAudit(d.id);
                        }
                      }}
                    >
                      {expandedAudit[d.id] && expandedAudit[d.id] !== "loading" ? "Hide audit" : "Audit trail"}
                    </button>
                  </div>
                </div>
                {expandedAudit[d.id] === "loading" ? (
                  <p className="mt-2 text-xs text-zinc-500">Loading…</p>
                ) : Array.isArray(expandedAudit[d.id]) ? (
                  (expandedAudit[d.id] as AuditEntry[]).length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-500">No audit entries yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 border-l-2 border-zinc-200 pl-3 text-xs text-zinc-600">
                      {(expandedAudit[d.id] as AuditEntry[]).map((a) => (
                        <li key={a.id}>
                          {new Date(a.at).toLocaleString()} — <strong>{a.action}</strong> by {a.actor.name}
                          {a.details != null && typeof a.details === "object" ? (
                            <pre className="mt-1 max-w-full overflow-x-auto rounded bg-zinc-50 p-1 text-[10px] text-zinc-500">
                              {JSON.stringify(a.details, null, 2)}
                            </pre>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
