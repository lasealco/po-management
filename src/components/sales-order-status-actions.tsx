"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

  if (!canTransition) return null;

  const options: Array<"DRAFT" | "OPEN" | "CLOSED"> =
    status === "DRAFT" ? ["OPEN", "CLOSED"] : status === "OPEN" ? ["DRAFT", "CLOSED"] : ["OPEN"];

  async function changeStatus(next: "DRAFT" | "OPEN" | "CLOSED") {
    if (busy || next === status) return;
    setBusy(true);
    const res = await fetch(`/api/sales-orders/${salesOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const payload = (await res.json()) as { error?: string; activeShipments?: Array<{ shipmentNo: string | null; status: string }> };
    setBusy(false);
    if (!res.ok) {
      const suffix =
        payload.activeShipments && payload.activeShipments.length
          ? ` Active: ${payload.activeShipments
              .map((s) => `${s.shipmentNo || "shipment"} (${s.status})`)
              .join(", ")}`
          : "";
      window.alert((payload.error || "Could not change status.") + suffix);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500">Change status:</span>
      {options.map((next) => (
        <button
          key={next}
          type="button"
          disabled={busy}
          onClick={() => void changeStatus(next)}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
        >
          {busy ? "Saving..." : next}
        </button>
      ))}
    </div>
  );
}
