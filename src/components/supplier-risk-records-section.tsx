"use client";

import type { SupplierRiskSeverity, SupplierRiskStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SupplierRiskRecordRow = {
  id: string;
  title: string;
  category: string;
  severity: SupplierRiskSeverity;
  status: SupplierRiskStatus;
  details: string | null;
  identifiedAt: string;
  closedAt: string | null;
};

const SEVERITIES: { value: SupplierRiskSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUSES: { value: SupplierRiskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "mitigating", label: "Mitigating" },
  { value: "closed", label: "Closed" },
];

export function SupplierRiskRecordsSection({
  supplierId,
  canEdit,
  initialRows,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierRiskRecordRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Operational");
  const [severity, setSeverity] = useState<SupplierRiskSeverity>("medium");
  const [details, setDetails] = useState("");

  async function addRisk(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/suppliers/${supplierId}/risk-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        category: category.trim() || "General",
        severity,
        details: details.trim() || null,
      }),
    });
    const payload = (await res.json()) as { error?: string; risk?: SupplierRiskRecordRow };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add risk.");
      return;
    }
    if (payload.risk) setRows((prev) => [payload.risk!, ...prev]);
    setTitle("");
    setDetails("");
    setBusy(false);
    router.refresh();
  }

  async function patchRisk(id: string, patch: Record<string, unknown>) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/risk-records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await res.json()) as { error?: string; risk?: SupplierRiskRecordRow };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Update failed.");
      return;
    }
    if (payload.risk) {
      setRows((prev) => prev.map((r) => (r.id === id ? payload.risk! : r)));
    }
    setBusyId(null);
    router.refresh();
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Risk records</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Log and track supplier risks (concentration, delivery, financial, compliance). Closing a record
        stamps closed date automatically.
      </p>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">No risks logged.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{r.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    {r.category} · Identified {new Date(r.identifiedAt).toLocaleDateString()}
                    {r.closedAt ? ` · Closed ${new Date(r.closedAt).toLocaleDateString()}` : ""}
                  </p>
                  {canEdit ? (
                    <label className="mt-2 block text-xs text-zinc-600">
                      Details
                      <textarea
                        key={`${r.id}-details-${r.details ?? ""}`}
                        defaultValue={r.details ?? ""}
                        disabled={busyId === r.id}
                        rows={2}
                        className={f}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const prev = (r.details ?? "").trim();
                          if (v === prev) return;
                          void patchRisk(r.id, { details: v || null });
                        }}
                      />
                    </label>
                  ) : r.details ? (
                    <p className="mt-1 text-xs text-zinc-600">{r.details}</p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="flex flex-col gap-2 sm:w-44">
                    <select
                      value={r.severity}
                      disabled={busyId === r.id}
                      onChange={(e) => {
                        void patchRisk(r.id, { severity: e.target.value as SupplierRiskSeverity });
                      }}
                      className={f}
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={r.status}
                      disabled={busyId === r.id}
                      onChange={(e) => {
                        void patchRisk(r.id, { status: e.target.value as SupplierRiskStatus });
                      }}
                      className={f}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">
                    {r.severity} · {r.status}
                  </p>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
      {canEdit ? (
        <form onSubmit={addRisk} className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4">
          <p className="text-sm font-medium text-zinc-800">Log risk</p>
          <label className="flex flex-col text-sm">
            <span>Title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span>Category</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span>Severity</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SupplierRiskSeverity)}
              className={f}
            >
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span>Details</span>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className={f} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add risk"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
