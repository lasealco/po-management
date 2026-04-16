"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SalesOrderCreateForm({
  soNumberHint,
  shipmentHint,
}: {
  soNumberHint: string;
  shipmentHint: {
    id: string;
    shipmentNo: string | null;
    order: { shipToName: string | null; requestedDeliveryDate: Date | null };
  } | null;
}) {
  const router = useRouter();
  const [soNumber, setSoNumber] = useState(soNumberHint);
  const [customerName, setCustomerName] = useState(shipmentHint?.order.shipToName || "");
  const [externalRef, setExternalRef] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(
    shipmentHint?.order.requestedDeliveryDate
      ? new Date(shipmentHint.order.requestedDeliveryDate).toISOString().slice(0, 10)
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!customerName.trim()) {
      setError("Customer name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/sales-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soNumber: soNumber.trim() || null,
        customerName: customerName.trim(),
        externalRef: externalRef.trim() || null,
        requestedDeliveryDate: requestedDeliveryDate || null,
        shipmentId: shipmentHint?.id || null,
      }),
    });
    const payload = (await res.json()) as { id?: string; error?: string };
    setBusy(false);
    if (!res.ok || !payload.id) {
      setError(payload.error || "Could not create sales order.");
      return;
    }
    router.push(`/sales-orders/${payload.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Create Sales Order</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Sales order process v1 for export/ad-hoc shipments. You can link this order to one shipment at creation.
      </p>
      {shipmentHint ? (
        <p className="mt-2 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Linking shipment {(shipmentHint.shipmentNo || shipmentHint.id).toString()}.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
      ) : null}

      <section className="mt-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="text-sm">
          SO number
          <input
            value={soNumber}
            onChange={(e) => setSoNumber(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Customer name
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          External reference (ERP/SO)
          <input
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Requested delivery date
          <input
            type="date"
            value={requestedDeliveryDate}
            onChange={(e) => setRequestedDeliveryDate(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>
      </section>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create Sales Order"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/sales-orders")}
          className="rounded border border-zinc-300 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}
