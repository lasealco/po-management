"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type OrderItemRow = {
  id: string;
  lineNo: number;
  description: string | null;
  quantity: string;
  quantityRemaining: string;
};

type OrderPickRow = {
  id: string;
  orderNumber: string;
  supplierName: string | null;
  items: OrderItemRow[];
};

type PackRow = { id: string; title: string; description: string; milestoneCount: number };

export function ControlTowerNewShipment() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<OrderPickRow[]>([]);
  const [pickLoading, setPickLoading] = useState(false);
  const [selected, setSelected] = useState<OrderPickRow | null>(null);
  const [qtyByItemId, setQtyByItemId] = useState<Record<string, string>>({});
  const [transportMode, setTransportMode] = useState<"OCEAN" | "AIR" | "ROAD" | "RAIL" | "">("");
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [packId, setPackId] = useState("");
  const [shipmentNo, setShipmentNo] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingNo, setBookingNo] = useState("");
  const [originCode, setOriginCode] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const query = q.trim();
      if (query.length < 2) {
        setOrders([]);
        return;
      }
      setPickLoading(true);
      void fetch(`/api/control-tower/order-picker?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((j: { orders?: OrderPickRow[] }) => {
          setOrders(Array.isArray(j.orders) ? j.orders : []);
        })
        .catch(() => setOrders([]))
        .finally(() => setPickLoading(false));
    }, 320);
    return () => clearTimeout(t);
  }, [q]);

  const loadPacks = useCallback((mode: string) => {
    if (!mode) {
      setPacks([]);
      setPackId("");
      return;
    }
    void fetch(`/api/control-tower/milestone-pack-catalog?mode=${encodeURIComponent(mode)}`)
      .then((r) => r.json())
      .then((j: { packs?: PackRow[] }) => {
        const list = Array.isArray(j.packs) ? j.packs : [];
        setPacks(list);
        setPackId((prev) => (list.some((p) => p.id === prev) ? prev : ""));
      })
      .catch(() => {
        setPacks([]);
        setPackId("");
      });
  }, []);

  useEffect(() => {
    loadPacks(transportMode);
  }, [transportMode, loadPacks]);

  function selectOrder(row: OrderPickRow) {
    setSelected(row);
    const next: Record<string, string> = {};
    for (const it of row.items) {
      next[it.id] = it.quantityRemaining !== "0" ? it.quantityRemaining : "";
    }
    setQtyByItemId(next);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!selected) {
      setError("Select a purchase order.");
      return;
    }
    if (!transportMode) {
      setError("Select a transport mode.");
      return;
    }
    const lines = Object.entries(qtyByItemId)
      .map(([orderItemId, quantityShipped]) => ({ orderItemId, quantityShipped: quantityShipped.trim() }))
      .filter((l) => l.quantityShipped !== "");
    if (lines.length === 0) {
      setError("Enter shipped quantity on at least one line.");
      return;
    }

    setBusy(true);
    try {
      const booking =
        bookingNo.trim() || originCode.trim() || destinationCode.trim() || etd.trim() || eta.trim()
          ? {
              bookingNo: bookingNo.trim() || null,
              originCode: originCode.trim().toUpperCase() || null,
              destinationCode: destinationCode.trim().toUpperCase() || null,
              etd: etd.trim() || null,
              eta: eta.trim() || null,
            }
          : undefined;

      const res = await fetch("/api/control-tower/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selected.id,
          transportMode,
          lines,
          shipmentNo: shipmentNo.trim() || null,
          carrier: carrier.trim() || null,
          trackingNo: trackingNo.trim() || null,
          notes: notes.trim() || null,
          booking,
          milestonePackId: packId.trim() || null,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        shipmentId?: string;
        milestonePackWarning?: string | null;
      };
      if (!res.ok) {
        setError(payload.error ?? "Create failed.");
        setBusy(false);
        return;
      }
      if (payload.shipmentId) {
        if (payload.milestonePackWarning) {
          window.alert(payload.milestonePackWarning);
        }
        router.push(`/control-tower/shipments/${payload.shipmentId}`);
        return;
      }
      setError("No shipment id returned.");
    } catch {
      setError("Network error.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-8 text-sm text-zinc-800">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">1. Link to purchase order</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Shipments stay tied to a PO for lines and parties. Search by PO number (or paste order id).
        </p>
        <input
          className="mt-3 w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {pickLoading ? <p className="mt-2 text-xs text-zinc-500">Searching…</p> : null}
        {orders.length > 0 ? (
          <ul className="mt-3 max-h-48 overflow-auto rounded border border-zinc-200 bg-zinc-50">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-white ${
                    selected?.id === o.id ? "bg-sky-50" : ""
                  }`}
                  onClick={() => selectOrder(o)}
                >
                  <span className="font-semibold text-zinc-900">{o.orderNumber}</span>
                  <span className="text-zinc-600">{o.supplierName ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {selected ? (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">2. Lines & mode</h2>
            <p className="mt-1 text-xs text-zinc-600">
              Order <span className="font-medium">{selected.orderNumber}</span> — set quantities to ship on this
              movement.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600">
                    <th className="py-2 pr-3">Line</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3">Open</th>
                    <th className="py-2">This shipment qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((it) => (
                    <tr key={it.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-3 font-mono">{it.lineNo}</td>
                      <td className="max-w-xs truncate py-2 pr-3">{it.description ?? "—"}</td>
                      <td className="py-2 pr-3">{it.quantityRemaining}</td>
                      <td className="py-2">
                        <input
                          className="w-24 rounded border border-zinc-300 px-2 py-1"
                          value={qtyByItemId[it.id] ?? ""}
                          onChange={(e) =>
                            setQtyByItemId((prev) => ({ ...prev, [it.id]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="mt-4 block text-xs font-medium text-zinc-700">
              Transport mode
              <select
                className="mt-1 block w-full max-w-xs rounded border border-zinc-300 px-2 py-2"
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value as typeof transportMode)}
              >
                <option value="">Select…</option>
                <option value="OCEAN">Ocean</option>
                <option value="AIR">Air</option>
                <option value="ROAD">Road</option>
                <option value="RAIL">Rail</option>
              </select>
            </label>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">3. References & booking draft</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs">
                Shipment ref (optional)
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
                  value={shipmentNo}
                  onChange={(e) => setShipmentNo(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Carrier (optional)
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Tracking / AWB (optional)
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Booking no. (optional)
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
                  value={bookingNo}
                  onChange={(e) => setBookingNo(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Origin UN/LOCODE
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 font-mono uppercase"
                  value={originCode}
                  onChange={(e) => setOriginCode(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Destination UN/LOCODE
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 font-mono uppercase"
                  value={destinationCode}
                  onChange={(e) => setDestinationCode(e.target.value)}
                />
              </label>
              <label className="text-xs">
                ETD (ISO date)
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
                  value={etd}
                  onChange={(e) => setEtd(e.target.value)}
                />
              </label>
              <label className="text-xs">
                ETA (ISO date)
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
              </label>
            </div>
            <label className="mt-3 block text-xs">
              Notes (optional)
              <textarea
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-2"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </section>

          <section className="rounded-xl border border-sky-200 bg-sky-50/40 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-sky-950">4. Initial milestone pack (optional)</h2>
            <p className="mt-1 text-xs text-sky-900">
              Only packs that match the selected mode are listed. Planned dates use booking ETD/ETA when present;
              otherwise some steps may be skipped until you set dates on Shipment 360.
            </p>
            {transportMode && packs.length > 0 ? (
              <select
                className="mt-3 w-full max-w-lg rounded border border-sky-200 bg-white px-2 py-2 text-xs"
                value={packId}
                onChange={(e) => setPackId(e.target.value)}
              >
                <option value="">No template — add milestones later</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.milestoneCount} steps)
                  </option>
                ))}
              </select>
            ) : transportMode ? (
              <p className="mt-2 text-xs text-zinc-600">No template packs for this mode.</p>
            ) : (
              <p className="mt-2 text-xs text-zinc-600">Select a transport mode to load packs.</p>
            )}
          </section>

          {error ? (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{error}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void submit()}
            >
              {busy ? "Creating…" : "Create shipment"}
            </button>
            <Link href="/control-tower/workbench" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm">
              Cancel
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
