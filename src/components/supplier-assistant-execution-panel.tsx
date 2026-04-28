"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useEffect, useState } from "react";

type Amp2Snapshot = {
  supplier: {
    id: string;
    name: string;
    assistantPerformanceBrief: string | null;
    assistantOnboardingGapPlan: string | null;
    assistantExecutionStatus: string;
    assistantExecutionNote: string | null;
    assistantLastReviewedAt: string | null;
  };
  generated: { performanceBrief: string; onboardingGapPlan: string; followUpMessage: string };
  metrics: {
    parentOrderCount: number | null;
    awaitingConfirmation: number | null;
    onTimeShipPct: number | null;
    openOnboardingTasks: number;
    followUpOrderCount: number;
  };
  followUpOrders: Array<{
    id: string;
    orderNumber: string;
    title: string | null;
    statusLabel: string | null;
    requestedDeliveryDate: string | null;
    totalAmount: string;
    currency: string;
    itemCount: number;
  }>;
  onboardingTasks: Array<{ id: string; title: string; done: boolean; dueAt: string | null }>;
};

export function SupplierAssistantExecutionPanel({
  supplierId,
  canEdit,
  canViewOrders,
}: {
  supplierId: string;
  canEdit: boolean;
  canViewOrders: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Amp2Snapshot | null>(null);
  const [brief, setBrief] = useState("");
  const [gapPlan, setGapPlan] = useState("");
  const [note, setNote] = useState("");
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError(null);
      const res = await fetch(`/api/suppliers/${supplierId}/assistant-execution`, { signal: controller.signal });
      const parsed: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiClientErrorMessage(parsed, "Could not load supplier execution assistant."));
        return;
      }
      const payload = parsed as Amp2Snapshot;
      setSnapshot(payload);
      setBrief(payload.supplier.assistantPerformanceBrief ?? payload.generated.performanceBrief);
      setGapPlan(payload.supplier.assistantOnboardingGapPlan ?? payload.generated.onboardingGapPlan);
      setNote(payload.supplier.assistantExecutionNote ?? "");
      setFollowUpMessage(payload.generated.followUpMessage);
      setTaskTitle(payload.onboardingTasks.find((task) => !task.done)?.title ?? "Confirm supplier follow-up owner and due date");
    }
    void load();
    return () => controller.abort();
  }, [supplierId]);

  async function save(status?: "REVIEWED" | "CLOSED") {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/suppliers/${supplierId}/assistant-execution`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantPerformanceBrief: brief,
        assistantOnboardingGapPlan: gapPlan,
        assistantExecutionNote: note,
        ...(status ? { assistantExecutionStatus: status } : {}),
      }),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not save supplier execution review."));
      return;
    }
    setNotice(status ? `Saved and marked ${status}.` : "Saved supplier execution plan.");
  }

  async function runAction(action: "create_onboarding_task" | "queue_supplier_followup") {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const firstOrder = snapshot?.followUpOrders[0] ?? null;
    const res = await fetch(`/api/suppliers/${supplierId}/assistant-execution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "create_onboarding_task"
          ? { action, title: taskTitle, notes: gapPlan }
          : { action, message: followUpMessage, purchaseOrderId: firstOrder?.id ?? null },
      ),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not complete assistant action."));
      return;
    }
    setNotice(action === "create_onboarding_task" ? "Onboarding task created." : "Supplier follow-up queued.");
  }

  const metric = (label: string, value: string | number | null) => (
    <div className="rounded-xl border border-sky-100 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-950">{value ?? "Hidden"}</p>
    </div>
  );

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">AMP2 Supplier Execution</p>
          <h2 className="mt-1 text-base font-semibold text-zinc-950">Assistant performance brief and follow-up plan</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Review PO follow-up risk, onboarding gaps, and supplier communication before logging approved actions.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-800">
          {snapshot?.supplier.assistantExecutionStatus ?? "Loading"}
        </span>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {metric("Parent POs", snapshot?.metrics.parentOrderCount ?? null)}
        {metric("Awaiting confirm", snapshot?.metrics.awaitingConfirmation ?? null)}
        {metric("On-time ship %", snapshot?.metrics.onTimeShipPct ?? null)}
        {metric("Open gaps", snapshot?.metrics.openOnboardingTasks ?? null)}
      </div>

      {!canViewOrders ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          PO follow-up signals are hidden for this role. Grant <strong>org.orders</strong> view to show order-level evidence.
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-700">
          Performance brief
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            disabled={!canEdit || !snapshot}
            className="mt-1 min-h-40 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Onboarding gap plan
          <textarea
            value={gapPlan}
            onChange={(event) => setGapPlan(event.target.value)}
            disabled={!canEdit || !snapshot}
            className="mt-1 min-h-40 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
          />
        </label>
      </div>

      {snapshot?.followUpOrders.length ? (
        <div className="mt-4 rounded-xl border border-sky-100 bg-white p-4">
          <p className="text-sm font-semibold text-zinc-950">PO lines needing follow-up evidence</p>
          <div className="mt-2 divide-y divide-zinc-100">
            {snapshot.followUpOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <Link href={`/orders/${order.id}`} className="font-semibold text-[var(--arscmp-primary)] hover:underline">
                    {order.orderNumber}
                  </Link>
                  <span className="text-zinc-500"> · {order.itemCount} line{order.itemCount === 1 ? "" : "s"} · {order.statusLabel}</span>
                </div>
                <span className="text-xs text-zinc-500">
                  {order.currency} {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-sky-100 bg-white p-4">
        <label className="block text-sm font-medium text-zinc-700">
          Supplier follow-up message
          <textarea
            value={followUpMessage}
            onChange={(event) => setFollowUpMessage(event.target.value)}
            disabled={!canEdit || !snapshot}
            className="mt-1 min-h-32 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !canEdit || !snapshot}
            onClick={() => void save()}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
          >
            Save plan
          </button>
          <button
            type="button"
            disabled={busy || !canEdit || !snapshot}
            onClick={() => void save("REVIEWED")}
            className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Mark reviewed
          </button>
          <button
            type="button"
            disabled={busy || !canEdit || !snapshot}
            onClick={() => void runAction("queue_supplier_followup")}
            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900 disabled:opacity-50"
          >
            Queue follow-up
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-sky-100 bg-white p-4">
        <label className="block text-sm font-medium text-zinc-700">
          New onboarding task from gap plan
          <input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            disabled={!canEdit || !snapshot}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-zinc-700">
          Review note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={!canEdit || !snapshot}
            className="mt-1 min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !canEdit || !snapshot}
            onClick={() => void runAction("create_onboarding_task")}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
          >
            Create onboarding task
          </button>
          <button
            type="button"
            disabled={busy || !canEdit || !snapshot}
            onClick={() => void save("CLOSED")}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50"
          >
            Close supplier gap
          </button>
        </div>
      </div>
    </section>
  );
}
