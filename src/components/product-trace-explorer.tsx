"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ProductTracePayload } from "@/lib/product-trace";
import { ARSCMP_PRIMARY_HEX } from "@/lib/product-trace-geo";

type Props = {
  data: ProductTracePayload;
  canSeeCt: boolean;
};

function ProductTraceLeafletMap({
  pins,
  onSelectPin,
}: {
  pins: ProductTracePayload["mapPins"];
  onSelectPin: (id: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const liveMapRef = useRef<import("leaflet").Map | null>(null);

  const pinsKey = useMemo(() => JSON.stringify(pins.map((p) => [p.id, p.lat, p.lng])), [pins]);

  useEffect(() => {
    if (!hostRef.current || pins.length === 0) return;

    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !hostRef.current) return;

      const m = L.map(hostRef.current, { scrollWheelZoom: false }).setView([20, 10], 2);
      if (cancelled) {
        m.remove();
        return;
      }

      liveMapRef.current?.remove();
      liveMapRef.current = m;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);

      for (const pin of pins) {
        if (cancelled) break;
        const html = `<span class="po-trace-dot" style="display:block;width:18px;height:18px;border-radius:9999px;background:${ARSCMP_PRIMARY_HEX};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`;
        const icon = L.divIcon({
          className: "po-trace-marker-wrap !bg-transparent !border-0",
          html,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(m);
        const popupHtml = `
          <div class="po-trace-popup text-zinc-900" style="min-width:200px;font:14px/1.4 system-ui,sans-serif">
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(pin.title)}</div>
            <div style="font-size:12px;color:#52525b;margin-bottom:8px">${escapeHtml(pin.subtitle)}</div>
            <div style="font-size:13px"><strong>Qty</strong> ${escapeHtml(pin.quantityLabel)}</div>
            <div style="font-size:13px;margin-top:4px"><strong>Est. availability</strong> ${escapeHtml(pin.estimatedAvailabilityLabel)}</div>
            ${pin.footnote ? `<p style="font-size:11px;color:#71717a;margin:8px 0 0">${escapeHtml(pin.footnote)}</p>` : ""}
          </div>`;
        marker.bindPopup(popupHtml);
        marker.on("click", () => {
          onSelectPin(pin.id);
        });
      }

      if (cancelled) {
        m.remove();
        if (liveMapRef.current === m) liveMapRef.current = null;
        return;
      }

      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
      if (pins.length === 1) {
        m.setView([pins[0].lat, pins[0].lng], 5);
      } else {
        m.fitBounds(bounds, { padding: [48, 48], maxZoom: 5 });
      }
    })();

    return () => {
      cancelled = true;
      liveMapRef.current?.remove();
      liveMapRef.current = null;
    };
  }, [pins, pinsKey, onSelectPin]);

  if (pins.length === 0) {
    return (
      <div className="flex h-[min(420px,55vh)] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-600">
        No mappable locations yet (add booking lane codes, supplier address, or warehouse city/country).
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="z-0 h-[min(420px,55vh)] w-full overflow-hidden rounded-lg border border-zinc-200 shadow-sm"
      aria-label="Product locations map"
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function ProductTraceExplorer({ data, canSeeCt }: Props) {
  const [view, setView] = useState<"list" | "tiles">("list");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  const onSelectPin = useCallback((id: string | null) => {
    setSelectedPinId(id);
  }, []);

  const selectedPin = data.mapPins.find((p) => p.id === selectedPinId) ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Product</h2>
        <p className="mt-1 text-lg font-semibold text-zinc-900">{data.product.name}</p>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-700">
          <div>
            <dt className="inline text-zinc-500">SKU </dt>
            <dd className="inline font-mono">{data.product.sku ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-zinc-500">Code </dt>
            <dd className="inline font-mono">{data.product.productCode ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-zinc-500">Unit </dt>
            <dd className="inline">{data.product.unit ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Supply map</h2>
          <p className="max-w-xl text-xs text-zinc-500">
            Dots use your brand color. At-sea positions are estimated from booking dates along the origin→destination
            lane (AIS / carrier feeds can replace this later).
          </p>
        </div>
        <ProductTraceLeafletMap pins={data.mapPins} onSelectPin={onSelectPin} />
        {selectedPin ? (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            <p className="font-semibold text-zinc-900">{selectedPin.title}</p>
            <p className="mt-0.5 text-zinc-600">{selectedPin.subtitle}</p>
            <p className="mt-2">
              <span className="text-zinc-500">Quantity </span>
              {selectedPin.quantityLabel}
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">Est. availability </span>
              {selectedPin.estimatedAvailabilityLabel}
            </p>
            {selectedPin.footnote ? <p className="mt-2 text-xs text-zinc-500">{selectedPin.footnote}</p> : null}
          </div>
        ) : null}
      </section>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Details</span>
        <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              view === "list" ? "bg-[var(--arscmp-primary)] text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("tiles")}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              view === "tiles" ? "bg-[var(--arscmp-primary)] text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Tiles
          </button>
        </div>
      </div>

      {view === "list" ? (
        <ProductTraceListView data={data} canSeeCt={canSeeCt} selectedPinId={selectedPinId} />
      ) : (
        <ProductTraceTilesView data={data} canSeeCt={canSeeCt} selectedPinId={selectedPinId} />
      )}
    </div>
  );
}

function pinRefClass(pin: ProductTracePayload["mapPins"][number] | undefined, selectedId: string | null) {
  if (!pin || !selectedId || pin.id !== selectedId) return "";
  return "ring-2 ring-[var(--arscmp-primary)] ring-offset-2";
}

function ProductTraceListView({
  data,
  canSeeCt,
  selectedPinId,
}: {
  data: ProductTracePayload;
  canSeeCt: boolean;
  selectedPinId: string | null;
}) {
  const pinForSupplier = (id: string | null) => data.mapPins.find((p) => p.kind === "supplier" && p.supplierId === id);
  const pinForWh = (id: string) => data.mapPins.find((p) => p.kind === "warehouse" && p.warehouseId === id);
  const pinForShip = (id: string) => data.mapPins.find((p) => p.kind === "in_transit" && p.shipmentId === id);

  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Ordered (PO lines)</h2>
        {data.purchaseOrderLines.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No matching purchase lines for your visibility.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {data.purchaseOrderLines.map((line) => (
              <li
                key={`${line.orderId}-${line.lineNo}`}
                className={`py-3 first:pt-0 ${pinRefClass(line.supplierId ? pinForSupplier(line.supplierId) : undefined, selectedPinId)}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/orders/${line.orderId}`}
                    className="font-medium text-[var(--arscmp-primary)] hover:underline"
                  >
                    {line.orderNumber}
                  </Link>
                  <span className="text-sm text-zinc-600">
                    Line {line.lineNo}: {line.quantityOrdered} {line.uom ?? ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {line.supplierName ?? "Supplier TBD"}
                  {line.supplierAddressSummary ? ` · ${line.supplierAddressSummary}` : ""} · {line.statusLabel}
                  {line.requestedDeliveryDate
                    ? ` · Req. delivery ${new Date(line.requestedDeliveryDate).toLocaleDateString()}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">In transit</h2>
        {data.shipments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No shipments carrying this SKU in your scope.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {data.shipments.map((s) => (
              <li
                key={s.shipmentId}
                className={`py-4 first:pt-0 ${pinRefClass(pinForShip(s.shipmentId), selectedPinId)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {canSeeCt ? (
                      <Link
                        href={`/control-tower/shipments/${s.shipmentId}`}
                        className="font-medium text-[var(--arscmp-primary)] hover:underline"
                      >
                        {s.shipmentNo ?? s.shipmentId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-medium text-zinc-900">{s.shipmentNo ?? s.shipmentId.slice(0, 8)}</span>
                    )}
                    <span className="ml-2 text-sm text-zinc-500">PO {s.orderNumber}</span>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800">
                    {s.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  Shipped {s.quantityShipped}
                  {Number(s.quantityReceived) > 0 ? ` · Received ${s.quantityReceived}` : ""}
                  {s.booking?.eta
                    ? ` · ETA ${new Date(s.booking.eta).toLocaleDateString()}`
                    : s.expectedReceiveAt
                      ? ` · Expected receive ${new Date(s.expectedReceiveAt).toLocaleDateString()}`
                      : ""}
                  {s.booking?.originCode && s.booking?.destinationCode
                    ? ` · ${s.booking.originCode} → ${s.booking.destinationCode}`
                    : ""}
                </p>
                {s.containers.length > 0 ? (
                  <p className="mt-1 font-mono text-xs text-zinc-700">
                    {s.containers.map((c) => c.containerNumber).join(" · ")}
                    {s.containers[0]?.status ? ` (${s.containers[0].status})` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Warehouse stock</h2>
        {data.inventoryOmittedReason === "no_wms_grant" ? (
          <p className="mt-3 text-sm text-zinc-600">
            Inventory totals are hidden because this session does not have{" "}
            <span className="font-mono">org.wms → view</span>.
          </p>
        ) : data.inventory && data.inventory.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No on-hand balances for this product.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {data.inventory?.map((row) => (
              <li
                key={row.warehouseId}
                className={`flex flex-wrap justify-between gap-2 py-3 first:pt-0 ${pinRefClass(pinForWh(row.warehouseId), selectedPinId)}`}
              >
                <span className="font-medium text-zinc-900">
                  {row.warehouseName}
                  {row.warehouseCode ? (
                    <span className="ml-2 font-mono text-sm font-normal text-zinc-500">{row.warehouseCode}</span>
                  ) : null}
                </span>
                <span className="text-sm text-zinc-700">
                  On hand <span className="font-mono">{row.onHandQty}</span>
                  {Number(row.allocatedQty) > 0 ? (
                    <>
                      {" "}
                      · Allocated <span className="font-mono">{row.allocatedQty}</span>
                    </>
                  ) : null}
                </span>
                <p className="w-full text-xs text-zinc-500">
                  {[row.addressLine1, [row.city, row.region].filter(Boolean).join(", "), row.countryCode]
                    .filter(Boolean)
                    .join(" · ") || null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProductTraceTilesView({
  data,
  canSeeCt,
  selectedPinId,
}: {
  data: ProductTracePayload;
  canSeeCt: boolean;
  selectedPinId: string | null;
}) {
  const pinForSupplier = (id: string | null) => data.mapPins.find((p) => p.kind === "supplier" && p.supplierId === id);
  const pinForWh = (id: string) => data.mapPins.find((p) => p.kind === "warehouse" && p.warehouseId === id);
  const pinForShip = (id: string) => data.mapPins.find((p) => p.kind === "in_transit" && p.shipmentId === id);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Ordered</h3>
        {data.purchaseOrderLines.length === 0 ? (
          <p className="text-sm text-zinc-600">No PO lines in your scope.</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {data.purchaseOrderLines.map((line) => (
            <div
              key={`${line.orderId}-${line.lineNo}`}
              className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${pinRefClass(line.supplierId ? pinForSupplier(line.supplierId) : undefined, selectedPinId)}`}
            >
              <Link href={`/orders/${line.orderId}`} className="font-semibold text-[var(--arscmp-primary)] hover:underline">
                {line.orderNumber}
              </Link>
              <p className="mt-1 text-sm text-zinc-600">
                Line {line.lineNo} · {line.quantityOrdered} {line.uom ?? ""}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {line.supplierName}
                {line.supplierAddressSummary ? ` · ${line.supplierAddressSummary}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">In transit</h3>
        {data.shipments.length === 0 ? (
          <p className="text-sm text-zinc-600">No shipments in your scope.</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {data.shipments.map((s) => (
            <div
              key={s.shipmentId}
              className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${pinRefClass(pinForShip(s.shipmentId), selectedPinId)}`}
            >
              {canSeeCt ? (
                <Link
                  href={`/control-tower/shipments/${s.shipmentId}`}
                  className="font-semibold text-[var(--arscmp-primary)] hover:underline"
                >
                  {s.shipmentNo ?? s.shipmentId.slice(0, 8)}
                </Link>
              ) : (
                <span className="font-semibold text-zinc-900">{s.shipmentNo ?? s.shipmentId.slice(0, 8)}</span>
              )}
              <p className="mt-1 text-sm text-zinc-600">PO {s.orderNumber}</p>
              <p className="mt-2 text-xs text-zinc-500">{s.status.replaceAll("_", " ")}</p>
            </div>
          ))}
        </div>
      </div>
      {data.inventory && data.inventory.length > 0 ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Warehouse</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.inventory.map((row) => (
              <div
                key={row.warehouseId}
                className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${pinRefClass(pinForWh(row.warehouseId), selectedPinId)}`}
              >
                <p className="font-semibold text-zinc-900">{row.warehouseName}</p>
                <p className="mt-1 font-mono text-sm text-zinc-700">
                  {row.onHandQty} on hand
                  {Number(row.allocatedQty) > 0 ? ` · ${row.allocatedQty} allocated` : ""}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {[row.addressLine1, [row.city, row.region].filter(Boolean).join(", "), row.countryCode]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
