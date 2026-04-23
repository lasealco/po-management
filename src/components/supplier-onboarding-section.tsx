"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useCallback, useEffect, useState } from "react";

export type OnboardingTaskRow = {
  id: string;
  taskKey: string;
  title: string;
  sortOrder: number;
  done: boolean;
  assigneeUserId: string | null;
  assignee: { id: string; name: string; email: string } | null;
  dueAt: string | null;
  notes: string | null;
};

const ONBOARDING_STAGES = [
  { value: "intake" as const, label: "Intake" },
  { value: "diligence" as const, label: "Diligence" },
  { value: "review" as const, label: "Review" },
  { value: "cleared" as const, label: "Cleared" },
];

export function SupplierOnboardingSection({
  supplierId,
  assigneeOptions,
  viewerUserId,
  srmOnboardingStage,
  canEdit,
  onStageUpdated,
}: {
  supplierId: string;
  assigneeOptions: { id: string; name: string; email: string }[];
  viewerUserId: string;
  srmOnboardingStage: (typeof ONBOARDING_STAGES)[number]["value"];
  canEdit: boolean;
  onStageUpdated: (next: (typeof ONBOARDING_STAGES)[number]["value"]) => void;
}) {
  const [tasks, setTasks] = useState<OnboardingTaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stageBusy, setStageBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/onboarding-tasks`);
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Could not load onboarding tasks."));
      return;
    }
    const list = (payload as { tasks?: OnboardingTaskRow[] }).tasks;
    setTasks(Array.isArray(list) ? list : []);
  }, [supplierId]);

  useEffect(() => {
    // Schedule outside the effect tick so the rule does not treat load() as sync setState in the effect.
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function patchStage(next: (typeof ONBOARDING_STAGES)[number]["value"]) {
    if (!canEdit) return;
    setStageBusy(true);
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ srmOnboardingStage: next }),
    });
    const payload: unknown = await res.json().catch(() => null);
    setStageBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Could not update onboarding stage."));
      return;
    }
    onStageUpdated(next);
  }

  async function patchTask(taskId: string, body: Record<string, unknown>) {
    setBusyId(taskId);
    setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/onboarding-tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Update failed."));
      return;
    }
    const p = payload as {
      supplierOnboarding?: { srmOnboardingStage: string; stageAutoCleared?: boolean };
    };
    const st = p.supplierOnboarding?.srmOnboardingStage;
    if (st && ONBOARDING_STAGES.some((x) => x.value === st)) {
      onStageUpdated(st as (typeof ONBOARDING_STAGES)[number]["value"]);
    }
    await load();
  }

  if (tasks === null) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">Loading onboarding checklist…</p>
      </section>
    );
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((100 * doneCount) / tasks.length) : 0;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Onboarding checklist</h2>
      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Operator pipeline (Phase G)</p>
        <p className="mt-1 text-xs text-zinc-600">
          Track where this partner sits in diligence — alongside the task checklist below. Does not replace approval
          status. <span className="text-zinc-500">(G-v1) When every checklist item is complete, the pipeline automatically moves to Cleared; you can still change the stage before that.</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ONBOARDING_STAGES.map((s) => {
            const active = srmOnboardingStage === s.value;
            return (
              <button
                key={s.value}
                type="button"
                disabled={!canEdit || stageBusy}
                onClick={() => void patchStage(s.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-[var(--arscmp-primary)] bg-white text-zinc-900 shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                } disabled:opacity-50`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-xs font-medium text-zinc-700">
        {tasks.length === 0
          ? "No checklist rows yet"
          : `${doneCount} / ${tasks.length} complete (${pct}%)`}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {tasks.length === 0
          ? "Default tasks are created when this tab loads. Try refreshing, or re-open the supplier if the list stays empty."
          : "Default tasks are created for each supplier. Assign owners and due dates; mark items done as you complete diligence."}
      </p>
      <p className="mt-2 text-xs text-zinc-600">
        Tip: on the SRM list, turn on <strong className="text-zinc-800">Assigned onboarding</strong> to see suppliers
        where you have open tasks.
      </p>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {tasks.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No task rows to display. Check connectivity or try again in a moment.</p>
      ) : null}

      <ul className="mt-4 divide-y divide-zinc-100">
        {tasks.map((t) => (
          <li key={t.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:flex-wrap sm:items-start">
            <label className="flex min-w-[200px] flex-1 cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 rounded border-zinc-300"
                checked={t.done}
                disabled={busyId === t.id}
                onChange={(e) => void patchTask(t.id, { done: e.target.checked })}
              />
              <span className={t.done ? "text-zinc-500 line-through" : "text-zinc-900"}>{t.title}</span>
            </label>
            <div className="flex min-w-[180px] flex-col gap-2 sm:w-48">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Assignee</span>
              <select
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                value={t.assigneeUserId ?? ""}
                disabled={busyId === t.id}
                onChange={(e) => {
                  const v = e.target.value;
                  void patchTask(t.id, { assigneeUserId: v === "" ? null : v });
                }}
              >
                <option value="">— Unassigned —</option>
                {assigneeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              {assigneeOptions.some((u) => u.id === viewerUserId) && t.assigneeUserId !== viewerUserId ? (
                <button
                  type="button"
                  disabled={busyId === t.id}
                  className="text-left text-xs font-medium text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                  onClick={() => void patchTask(t.id, { assigneeUserId: viewerUserId })}
                >
                  Assign to me
                </button>
              ) : null}
            </div>
            <div className="flex min-w-[160px] flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Due</span>
              <input
                type="date"
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                disabled={busyId === t.id}
                value={t.dueAt ? t.dueAt.slice(0, 10) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  void patchTask(t.id, {
                    dueAt: v === "" ? null : `${v}T12:00:00.000Z`,
                  });
                }}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</span>
              <textarea
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                rows={2}
                disabled={busyId === t.id}
                defaultValue={t.notes ?? ""}
                key={`${t.id}-${t.notes ?? ""}`}
                onBlur={(e) => {
                  const next = e.target.value.trim() || null;
                  if (next !== (t.notes?.trim() || null)) {
                    void patchTask(t.id, { notes: next });
                  }
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
