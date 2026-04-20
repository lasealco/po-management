"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buildSalesOrderPatchStatusErrorMessage } from "@/lib/sales-orders/patch-status-client";

export function SalesOrderStatusActions({
  salesOrderId,
  status,
  canTransition,
}: {
  salesOrderId: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  canTransition: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canTransition) return null;

  const options: Array<"DRAFT" | "OPEN" | "CLOSED"> =
    status === "DRAFT" ? ["OPEN", "CLOSED"] : status === "OPEN" ? ["DRAFT", "CLOSED"] : ["OPEN"];

  async function changeStatus(next: "DRAFT" | "OPEN" | "CLOSED") {
    if (busy || next === status) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sales-orders/${salesOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const payload = (await res.json()) as {
      code?: "INVALID_TRANSITION" | "ACTIVE_SHIPMENTS";
      error?: string;
      activeShipments?: Array<{ shipmentNo: string | null; status: string }>;
    };
    setBusy(false);
    if (!res.ok) {
      setError(buildSalesOrderPatchStatusErrorMessage(payload));
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Transition status</span>
        {options.map((next) => (
          <button
            key={next}
            type="button"
            disabled={busy}
            onClick={() => void changeStatus(next)}
            className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {busy ? "Saving..." : `Move to ${next}`}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
