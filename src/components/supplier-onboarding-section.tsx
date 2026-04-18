"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  SupplierOnboardingTaskRow,
  SupplierOnboardingTaskStatusUi,
} from "@/lib/srm/supplier-onboarding-types";

export function SupplierOnboardingSection({
  supplierId,
  canEdit,
  initialRows,
  workflowSummary,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierOnboardingTaskRow[];
  workflowSummary?: {
    completedCount: number;
    totalCount: number;
    nextTaskLabel: string | null;
    nextTaskKey: string | null;
  };
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SupplierOnboardingTaskRow[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patchTask(
    id: string,
    patch: { status?: SupplierOnboardingTaskStatusUi; notes?: string | null },
  ) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/onboarding-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await res.json()) as { error?: string; task?: SupplierOnboardingTaskRow };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Update failed.");
      return;
    }
    if (payload.task) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...payload.task! } : r)));
    }
    setBusyId(null);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Onboarding checklist</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Default steps from the SRM lifecycle spec. Mark items done or waived as you progress; activation
        still follows supplier approval rules.
      </p>
      {workflowSummary && workflowSummary.totalCount > 0 ? (
        <p className="mt-2 text-xs font-medium text-zinc-700">
          {workflowSummary.completedCount}/{workflowSummary.totalCount} complete
          {workflowSummary.nextTaskLabel
            ? ` · Next: ${workflowSummary.nextTaskLabel}`
            : " · Checklist complete"}
        </p>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900">{row.label}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase text-zinc-400">{row.taskKey}</p>
              {row.completedAt ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Completed {new Date(row.completedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:w-52">
              {canEdit ? (
                <>
                  <select
                    value={row.status}
                    disabled={busyId === row.id}
                    onChange={(e) => {
                      const status = e.target.value as SupplierOnboardingTaskStatusUi;
                      void patchTask(row.id, { status });
                    }}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50"
                  >
                    <option value="pending">Pending</option>
                    <option value="done">Done</option>
                    <option value="waived">Waived</option>
                  </select>
                  <textarea
                    defaultValue={row.notes ?? ""}
                    disabled={busyId === row.id}
                    rows={2}
                    placeholder="Notes"
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 disabled:opacity-50"
                    onBlur={(e) => {
                      const next = e.target.value.trim() || null;
                      if (next === (row.notes ?? "")) return;
                      void patchTask(row.id, { notes: next });
                    }}
                  />
                </>
              ) : (
                <div className="space-y-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.status === "done"
                        ? "bg-emerald-100 text-emerald-800"
                        : row.status === "waived"
                          ? "bg-zinc-200 text-zinc-700"
                          : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {row.status}
                  </span>
                  {row.notes ? (
                    <p className="text-xs text-zinc-600">{row.notes}</p>
                  ) : null}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
