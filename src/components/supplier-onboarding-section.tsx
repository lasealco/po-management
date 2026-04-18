"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  SupplierOnboardingTaskRow,
  SupplierOnboardingTaskStatusUi,
} from "@/lib/srm/supplier-onboarding-types";
import { computeOnboardingProgress } from "@/lib/srm/supplier-onboarding-workflow";

export function SupplierOnboardingSection({
  supplierId,
  canEdit,
  initialRows,
  workflowSummary,
  supplierApprovalStatus,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierOnboardingTaskRow[];
  workflowSummary?: {
    completedCount: number;
    totalCount: number;
    nextTaskLabel: string | null;
    nextTaskKey: string | null;
    openCount: number;
    readyForActivation: boolean;
  };
  supplierApprovalStatus?: "pending_approval" | "approved" | "rejected";
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SupplierOnboardingTaskRow[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const liveProgress = useMemo(
    () =>
      computeOnboardingProgress(
        rows.map((r) => ({
          taskKey: r.taskKey,
          status: r.status,
          label: r.label,
        })),
      ),
    [rows],
  );

  const pct =
    liveProgress.total > 0
      ? Math.round((liveProgress.doneOrWaived / liveProgress.total) * 100)
      : 0;

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

  const nextKey = liveProgress.firstPending?.taskKey ?? null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Onboarding checklist</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Default steps from the SRM lifecycle spec. Mark items <strong className="font-medium">done</strong> or{" "}
        <strong className="font-medium">waived</strong> as you progress. Procurement approval (
        <strong className="font-medium">Approve and activate</strong>) succeeds only when every row is complete.
      </p>
      <p className="mt-2 text-xs text-zinc-600">
        <strong className="font-medium text-zinc-800">Workflow:</strong> finish{" "}
        <span className="font-mono text-[11px]">approval_chain</span> (or waive it) before marking{" "}
        <span className="font-mono text-[11px]">activation_decision</span> as done.
      </p>

      {liveProgress.total > 0 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-700">
            <span>
              Progress: {liveProgress.doneOrWaived}/{liveProgress.total}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          {liveProgress.firstPending?.label ? (
            <p className="mt-2 text-xs text-zinc-600">
              Next up: <span className="font-medium text-zinc-900">{liveProgress.firstPending.label}</span>
            </p>
          ) : (
            <p className="mt-2 text-xs font-medium text-emerald-800">All checklist rows are done or waived.</p>
          )}
        </div>
      ) : null}

      {supplierApprovalStatus === "pending_approval" && workflowSummary ? (
        <div
          className={`mt-4 rounded-md border px-3 py-2 text-xs ${
            workflowSummary.readyForActivation
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {workflowSummary.readyForActivation ? (
            <p>
              <strong className="font-semibold">Approval path:</strong> checklist is complete — an approver can
              use <strong className="font-semibold">Approve and activate</strong> on the Overview banner.
            </p>
          ) : (
            <p>
              <strong className="font-semibold">Approval path:</strong> {workflowSummary.openCount} checklist row
              {workflowSummary.openCount === 1 ? " is" : "s are"} still open. Clear them before approval; the API
              returns <span className="font-mono">409</span> with a task list if anything remains pending.
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-100">
        {rows.map((row, index) => {
          const isNext = nextKey != null && row.taskKey === nextKey;
          return (
            <li
              key={row.id}
              className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between ${
                isNext ? "bg-amber-50/60 ring-1 ring-inset ring-amber-200/80" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Step {index + 1} of {rows.length}
                  {isNext ? (
                    <span className="ml-2 rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">
                      Next
                    </span>
                  ) : null}
                </p>
                <p className="text-sm font-medium text-zinc-900">{row.label}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase text-zinc-400">{row.taskKey}</p>
                {row.completedAt ? (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {row.status === "waived" ? "Waived" : "Completed"}{" "}
                    {new Date(row.completedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-52">
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
                    {row.notes ? <p className="text-xs text-zinc-600">{row.notes}</p> : null}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
