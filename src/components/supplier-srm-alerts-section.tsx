"use client";

import type { SupplierSrmAlertSeverity, SupplierSrmAlertStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SupplierSrmAlertRow = {
  id: string;
  title: string;
  message: string;
  severity: SupplierSrmAlertSeverity;
  status: SupplierSrmAlertStatus;
  resolvedAt: string | null;
  createdAt: string;
};

const SEVERITIES: { value: SupplierSrmAlertSeverity; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const STATUSES: { value: SupplierSrmAlertStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

export function SupplierSrmAlertsSection({
  supplierId,
  canEdit,
  initialRows,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierSrmAlertRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<SupplierSrmAlertSeverity>("warning");

  async function addAlert(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/suppliers/${supplierId}/srm-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        message: message.trim(),
        severity,
      }),
    });
    const payload = (await res.json()) as { error?: string; alert?: SupplierSrmAlertRow };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add alert.");
      return;
    }
    if (payload.alert) setRows((prev) => [payload.alert!, ...prev]);
    setTitle("");
    setMessage("");
    setBusy(false);
    router.refresh();
  }

  async function patchAlert(id: string, patch: Record<string, unknown>) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/srm-alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await res.json()) as { error?: string; alert?: SupplierSrmAlertRow };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Update failed.");
      return;
    }
    if (payload.alert) {
      setRows((prev) => prev.map((r) => (r.id === id ? payload.alert! : r)));
    }
    setBusyId(null);
    router.refresh();
  }

  async function removeAlert(id: string) {
    if (!window.confirm("Delete this alert?")) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/srm-alerts/${id}`, {
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
      <h2 className="text-sm font-semibold text-zinc-900">Alerts</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Buyer-logged follow-ups and escalations on this supplier (manual SRM workspace — not automated
        tender, tariff, or sourcing-event feeds).
      </p>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">No alerts logged.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[11px] text-zinc-500">
                    Logged {new Date(r.createdAt).toLocaleString()}
                    {r.resolvedAt ? ` · Resolved ${new Date(r.resolvedAt).toLocaleString()}` : ""}
                  </p>
                  {canEdit ? (
                    <input
                      type="text"
                      defaultValue={r.title}
                      disabled={busyId === r.id}
                      onBlur={(e) => {
                        void patchAlert(r.id, { title: e.target.value });
                      }}
                      className={f}
                    />
                  ) : (
                    <p className="text-sm font-medium text-zinc-900">{r.title}</p>
                  )}
                  {canEdit ? (
                    <textarea
                      defaultValue={r.message}
                      disabled={busyId === r.id}
                      rows={3}
                      onBlur={(e) => {
                        void patchAlert(r.id, { message: e.target.value });
                      }}
                      className={f}
                    />
                  ) : (
                    <p className="text-xs text-zinc-600 whitespace-pre-wrap">{r.message}</p>
                  )}
                </div>
                {canEdit ? (
                  <div className="flex flex-col gap-2 sm:w-44">
                    <select
                      value={r.severity}
                      disabled={busyId === r.id}
                      onChange={(e) => {
                        void patchAlert(r.id, { severity: e.target.value as SupplierSrmAlertSeverity });
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
                        void patchAlert(r.id, { status: e.target.value as SupplierSrmAlertStatus });
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
                      onClick={() => void removeAlert(r.id)}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
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
        <form onSubmit={addAlert} className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4">
          <p className="text-sm font-medium text-zinc-800">Log alert</p>
          <label className="flex flex-col text-sm">
            <span>Title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span>Message *</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span>Severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as SupplierSrmAlertSeverity)} className={f}>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add alert"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
