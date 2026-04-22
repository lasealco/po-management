"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useEffect, useMemo, useState } from "react";

export type CtExceptionCodeRow = {
  id: string;
  code: string;
  label: string;
  defaultSeverity: string;
  sortOrder: number;
  isActive: boolean;
};

type Props = {
  initialCodes: CtExceptionCodeRow[];
  canEdit: boolean;
};

const SEVERITIES = ["INFO", "WARN", "CRITICAL"] as const;

export function SettingsCtExceptionCodesClient({ initialCodes, canEdit }: Props) {
  const [rows, setRows] = useState<CtExceptionCodeRow[]>(initialCodes);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSeverity, setNewSeverity] = useState<"INFO" | "WARN" | "CRITICAL">("WARN");
  const [newSort, setNewSort] = useState("100");

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
    [rows],
  );

  async function postUpsert(body: Record<string, unknown>) {
    const res = await fetch("/api/control-tower", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_ct_exception_code", ...body }),
    });
    const j: unknown = await res.json();
    if (!res.ok) throw new Error(apiClientErrorMessage(j, res.statusText || "Request failed"));
    return (j as { row?: CtExceptionCodeRow & { defaultSeverity: string } }).row!;
  }

  async function saveRow(r: CtExceptionCodeRow, draft: Partial<CtExceptionCodeRow>) {
    setErr(null);
    setMsg(null);
    setBusyId(r.id);
    try {
      const row = await postUpsert({
        id: r.id,
        label: draft.label ?? r.label,
        defaultSeverity: draft.defaultSeverity ?? r.defaultSeverity,
        sortOrder: draft.sortOrder ?? r.sortOrder,
        isActive: draft.isActive ?? r.isActive,
      });
      setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)));
      setMsg("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function addCode() {
    setErr(null);
    setMsg(null);
    setCreating(true);
    try {
      const row = await postUpsert({
        code: newCode.trim().toUpperCase(),
        label: newLabel.trim(),
        defaultSeverity: newSeverity,
        sortOrder: parseInt(newSort, 10) || 100,
        isActive: true,
      });
      setRows((prev) => [...prev, row]);
      setNewCode("");
      setNewLabel("");
      setNewSeverity("WARN");
      setNewSort("100");
      setMsg("Type added.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add type.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <p className="text-sm text-zinc-600">
        Codes appear in <span className="font-medium">Shipment 360 → Exceptions</span> when creating an exception.
        Use uppercase codes without spaces (e.g. <code className="rounded bg-zinc-100 px-1">DELAY_CARRIER</code>).
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Sort</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <ExceptionCodeEditorRow
                key={r.id}
                row={r}
                disabled={!canEdit || busyId === r.id}
                onSave={(draft) => void saveRow(r, draft)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Add type</h3>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Code
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1.5 font-mono text-sm uppercase"
                placeholder="CUSTOM_CODE"
              />
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-700">
              Label
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                placeholder="Human-readable label"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Severity
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value as (typeof SEVERITIES)[number])}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Sort
              <input
                value={newSort}
                onChange={(e) => setNewSort(e.target.value)}
                className="w-20 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                inputMode="numeric"
              />
            </label>
            <button
              type="button"
              disabled={creating || !newCode.trim() || !newLabel.trim()}
              onClick={() => void addCode()}
              className="rounded-md bg-arscmp-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {creating ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExceptionCodeEditorRow({
  row,
  disabled,
  onSave,
}: {
  row: CtExceptionCodeRow;
  disabled: boolean;
  onSave: (draft: Partial<CtExceptionCodeRow>) => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [severity, setSeverity] = useState(row.defaultSeverity);
  const [sortOrder, setSortOrder] = useState(String(row.sortOrder));
  const [isActive, setIsActive] = useState(row.isActive);

  useEffect(() => {
    setLabel(row.label);
    setSeverity(row.defaultSeverity);
    setSortOrder(String(row.sortOrder));
    setIsActive(row.isActive);
  }, [row]);

  const dirty =
    label !== row.label ||
    severity !== row.defaultSeverity ||
    parseInt(sortOrder, 10) !== row.sortOrder ||
    isActive !== row.isActive;

  return (
    <tr className="border-b border-zinc-100 last:border-0">
      <td className="px-3 py-2 font-mono text-xs font-medium text-zinc-900">{row.code}</td>
      <td className="px-3 py-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={disabled}
          className="w-full min-w-[10rem] rounded border border-zinc-300 px-2 py-1 text-sm disabled:bg-zinc-50"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          disabled={disabled}
          className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:bg-zinc-50"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          disabled={disabled}
          className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm disabled:bg-zinc-50"
          inputMode="numeric"
        />
      </td>
      <td className="px-3 py-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={disabled} />
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={disabled || !dirty}
          onClick={() =>
            onSave({
              label,
              defaultSeverity: severity,
              sortOrder: parseInt(sortOrder, 10) || 0,
              isActive,
            })
          }
          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
