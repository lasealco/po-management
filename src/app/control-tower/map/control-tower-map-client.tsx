"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ARSCMP_PRIMARY_HEX } from "@/lib/product-trace-geo";

type ShipmentPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  href: string;
  routeProgressPct: number | null;
  openAlerts: number;
  openExceptions: number;
};

type WarehousePin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  href: string;
};

type CrmAccountPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  href: string;
};

/** BF-27 — approximate scatter near BF-11 warehouse site (not surveyed CAD). */
type WarehouseBinPin = {
  id: string;
  warehouseId: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  href: string;
};

type MapPinsPayload = {
  pins: ShipmentPin[];
  unmappedCount: number;
  warehousePins: WarehousePin[];
  warehouseSiteUnmapped: number;
  warehouseBinPins: WarehouseBinPin[];
  warehouseBinPinsTruncated: boolean;
  crmAccountPins: CrmAccountPin[];
  crmAccountsMissingGeo: number;
  listLimit: number;
  itemCount: number;
  truncated: boolean;
};

const WAREHOUSE_MARKER_HEX = "#475569";
const WMS_BIN_MARKER_HEX = "#0d9488";
const CRM_MARKER_HEX = "#7c3aed";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ControlTowerMapLeaflet({
  shipmentPins,
  warehousePins,
  warehouseBinPins,
  crmPins,
}: {
  shipmentPins: ShipmentPin[];
  warehousePins: WarehousePin[];
  warehouseBinPins: WarehouseBinPin[];
  crmPins: CrmAccountPin[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const pinsKey = useMemo(
    () =>
      JSON.stringify({
        s: shipmentPins.map((p) => [p.id, p.lat, p.lng]),
        w: warehousePins.map((p) => [p.id, p.lat, p.lng]),
        b: warehouseBinPins.map((p) => [p.id, p.lat, p.lng]),
        c: crmPins.map((p) => [p.id, p.lat, p.lng]),
      }),
    [shipmentPins, warehousePins, warehouseBinPins, crmPins],
  );

  useEffect(() => {
    const total =
      shipmentPins.length + warehousePins.length + warehouseBinPins.length + crmPins.length;
    if (!hostRef.current || total === 0) return;

    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !hostRef.current) return;

      const m = L.map(hostRef.current, { scrollWheelZoom: true }).setView([20, 0], 2);
      mapRef.current?.remove();
      mapRef.current = m;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);

      for (const pin of shipmentPins) {
        const hasQueue = pin.openAlerts > 0 || pin.openExceptions > 0;
        const color = hasQueue ? "#b45309" : ARSCMP_PRIMARY_HEX;
        const html = `<span class="po-ctmap-dot" style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`;
        const icon = L.divIcon({
          className: "po-ctmap-marker !bg-transparent !border-0",
          html,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(m);
        const qNote =
          hasQueue
            ? `<div style="font-size:12px;color:#b45309;margin-top:6px">Open queue: ${pin.openAlerts} alert(s), ${pin.openExceptions} exception(s)</div>`
            : "";
        const progress =
          pin.routeProgressPct != null
            ? `<div style="font-size:12px;margin-top:4px">Route ~${Math.round(pin.routeProgressPct)}%</div>`
            : "";
        const popupHtml = `
          <div class="text-zinc-900" style="min-width:200px;font:14px/1.4 system-ui,sans-serif">
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(pin.title)}</div>
            <div style="font-size:12px;color:#52525b;margin-bottom:8px">${escapeHtml(pin.subtitle)}</div>
            ${progress}
            ${qNote}
            <a href="${escapeHtml(pin.href)}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:${ARSCMP_PRIMARY_HEX}">Open shipment 360</a>
          </div>`;
        marker.bindPopup(popupHtml);
      }

      for (const pin of warehousePins) {
        const html = `<span class="po-ctmap-wh" style="display:block;width:16px;height:16px;border-radius:4px;background:${WAREHOUSE_MARKER_HEX};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`;
        const icon = L.divIcon({
          className: "po-ctmap-marker !bg-transparent !border-0",
          html,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(m);
        const popupHtml = `
          <div class="text-zinc-900" style="min-width:200px;font:14px/1.4 system-ui,sans-serif">
            <div style="font-size:11px;font-weight:600;letter-spacing:.06em;color:#64748b;text-transform:uppercase;margin-bottom:4px">WMS warehouse</div>
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(pin.title)}</div>
            <div style="font-size:12px;color:#52525b;margin-bottom:8px">${escapeHtml(pin.subtitle)}</div>
            <a href="${escapeHtml(pin.href)}" style="display:inline-block;font-size:13px;font-weight:600;color:${ARSCMP_PRIMARY_HEX}">Open WMS setup</a>
          </div>`;
        marker.bindPopup(popupHtml);
      }

      for (const pin of warehouseBinPins) {
        const html = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,2 14,14 2,14" fill="${WMS_BIN_MARKER_HEX}" stroke="#fff" stroke-width="2"/></svg>`;
        const icon = L.divIcon({
          className: "po-ctmap-marker !bg-transparent !border-0",
          html,
          iconSize: [18, 18],
          iconAnchor: [9, 14],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(m);
        const popupHtml = `
          <div class="text-zinc-900" style="min-width:200px;font:14px/1.4 system-ui,sans-serif">
            <div style="font-size:11px;font-weight:600;letter-spacing:.06em;color:#64748b;text-transform:uppercase;margin-bottom:4px">WMS bin (approx.)</div>
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(pin.title)}</div>
            <div style="font-size:12px;color:#52525b;margin-bottom:8px">${escapeHtml(pin.subtitle)}</div>
            <a href="${escapeHtml(pin.href)}" style="display:inline-block;font-size:13px;font-weight:600;color:${ARSCMP_PRIMARY_HEX}">Open WMS setup</a>
          </div>`;
        marker.bindPopup(popupHtml);
      }

      for (const pin of crmPins) {
        const html = `<span class="po-ctmap-crm" style="display:block;width:12px;height:12px;background:${CRM_MARKER_HEX};transform:rotate(45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`;
        const icon = L.divIcon({
          className: "po-ctmap-marker !bg-transparent !border-0",
          html,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(m);
        const popupHtml = `
          <div class="text-zinc-900" style="min-width:200px;font:14px/1.4 system-ui,sans-serif">
            <div style="font-size:11px;font-weight:600;letter-spacing:.06em;color:#64748b;text-transform:uppercase;margin-bottom:4px">CRM account</div>
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(pin.title)}</div>
            <div style="font-size:12px;color:#52525b;margin-bottom:8px">${escapeHtml(pin.subtitle)}</div>
            <a href="${escapeHtml(pin.href)}" style="display:inline-block;font-size:13px;font-weight:600;color:${ARSCMP_PRIMARY_HEX}">Open account</a>
          </div>`;
        marker.bindPopup(popupHtml);
      }

      if (cancelled) {
        m.remove();
        if (mapRef.current === m) mapRef.current = null;
        return;
      }

      const allPts: [number, number][] = [
        ...shipmentPins.map((p) => [p.lat, p.lng] as [number, number]),
        ...warehousePins.map((p) => [p.lat, p.lng] as [number, number]),
        ...warehouseBinPins.map((p) => [p.lat, p.lng] as [number, number]),
        ...crmPins.map((p) => [p.lat, p.lng] as [number, number]),
      ];
      if (allPts.length === 1) {
        m.setView(allPts[0], 4);
      } else {
        const bounds = L.latLngBounds(allPts);
        m.fitBounds(bounds, { padding: [48, 48], maxZoom: 6 });
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [shipmentPins, warehousePins, warehouseBinPins, crmPins, pinsKey]);

  if (
    shipmentPins.length === 0 &&
    warehousePins.length === 0 &&
    warehouseBinPins.length === 0 &&
    crmPins.length === 0
  ) {
    return null;
  }

  return <div ref={hostRef} className="h-[min(480px,60vh)] w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100" />;
}

export function ControlTowerMapClient() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [data, setData] = useState<MapPinsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShipments, setShowShipments] = useState(true);
  const [showWarehouses, setShowWarehouses] = useState(true);
  const [showWarehouseBins, setShowWarehouseBins] = useState(true);
  const [showCrmAccounts, setShowCrmAccounts] = useState(true);

  const workbenchHref = qs ? `/control-tower/workbench?${qs}` : "/control-tower/workbench";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const url = qs ? `/api/control-tower/map-pins?${qs}` : "/api/control-tower/map-pins";
      try {
        const res = await fetch(url, { cache: "no-store" });
        const j = (await res.json()) as MapPinsPayload & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setErr(typeof j.error === "string" ? j.error : "Could not load map data.");
          setData(null);
          return;
        }
        setData({
          pins: j.pins ?? [],
          unmappedCount: j.unmappedCount ?? 0,
          warehousePins: j.warehousePins ?? [],
          warehouseSiteUnmapped: j.warehouseSiteUnmapped ?? 0,
          warehouseBinPins: j.warehouseBinPins ?? [],
          warehouseBinPinsTruncated: j.warehouseBinPinsTruncated ?? false,
          crmAccountPins: j.crmAccountPins ?? [],
          crmAccountsMissingGeo: j.crmAccountsMissingGeo ?? 0,
          listLimit: j.listLimit ?? 80,
          itemCount: j.itemCount ?? 0,
          truncated: j.truncated ?? false,
        });
        setErr(null);
      } catch {
        if (!cancelled) {
          setErr("Could not load map data.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  const visibleShipments = data && showShipments ? data.pins : [];
  const visibleWarehouses = data && showWarehouses ? data.warehousePins : [];
  const visibleWarehouseBins = data && showWarehouseBins ? data.warehouseBinPins : [];
  const visibleCrm = data && showCrmAccounts ? data.crmAccountPins : [];
  const hasLayerOptions =
    Boolean(data) &&
    ((data?.pins.length ?? 0) > 0 ||
      (data?.warehousePins.length ?? 0) > 0 ||
      (data?.warehouseBinPins.length ?? 0) > 0 ||
      (data?.crmAccountPins.length ?? 0) > 0);
  const anyVisible =
    visibleShipments.length > 0 ||
    visibleWarehouses.length > 0 ||
    visibleWarehouseBins.length > 0 ||
    visibleCrm.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={workbenchHref}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          Open workbench (same filters)
        </Link>
        {data?.truncated ? (
          <span className="text-xs text-amber-800">
            List cap {data.listLimit}: more rows may exist — narrow filters on the workbench.
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading map…</p>
      ) : null}
      {err ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p> : null}

      {data && !err ? (
        <>
          <p className="text-sm text-zinc-600">
            <strong className="text-zinc-800">{data.pins.length}</strong> shipment pin
            {data.pins.length === 1 ? "" : "s"}
            {data.itemCount > 0 ? (
              <>
                {" "}
                ({data.unmappedCount} of {data.itemCount} workbench row{data.itemCount === 1 ? "" : "s"} had no
                mappable origin/destination code in the demo geography dictionary)
              </>
            ) : null}
            {data.warehousePins.length > 0 ? (
              <>
                {" · "}
                <strong className="text-zinc-800">{data.warehousePins.length}</strong> WMS warehouse site
                {data.warehousePins.length === 1 ? "" : "s"} (approximate){data.warehouseSiteUnmapped > 0 ? (
                  <>
                    {" "}
                    — {data.warehouseSiteUnmapped} active warehouse
                    {data.warehouseSiteUnmapped === 1 ? "" : "s"} omitted (no demo geo match)
                  </>
                ) : null}
              </>
            ) : null}
            {data.warehouseBinPins.length > 0 ? (
              <>
                {" · "}
                <strong className="text-zinc-800">{data.warehouseBinPins.length}</strong> WMS bin pin
                {data.warehouseBinPins.length === 1 ? "" : "s"} (approximate scatter near site — BF-27)
                {data.warehouseBinPinsTruncated ? (
                  <>
                    {" "}
                    — list capped (more bins exist); use WMS Setup for full addressing lists.
                  </>
                ) : null}
              </>
            ) : null}
            {data.crmAccountPins.length > 0 ? (
              <>
                {" · "}
                <strong className="text-zinc-800">{data.crmAccountPins.length}</strong> CRM account
                {data.crmAccountPins.length === 1 ? "" : "s"} with map coordinates
                {data.crmAccountsMissingGeo > 0 ? (
                  <>
                    {" "}
                    ({data.crmAccountsMissingGeo} account{data.crmAccountsMissingGeo === 1 ? "" : "s"} in CRM scope
                    without coordinates)
                  </>
                ) : null}
              </>
            ) : data.crmAccountsMissingGeo > 0 ? (
              <>
                {" · "}
                <strong className="text-zinc-800">0</strong> CRM pins (
                {data.crmAccountsMissingGeo} account{data.crmAccountsMissingGeo === 1 ? "" : "s"} in scope without
                coordinates)
              </>
            ) : null}
            . Shipment pins follow workbench filters; warehouse pins require{" "}
            <strong className="text-zinc-800">org.wms → view</strong> (BF-11). Bin scatter pins reuse site coords only
            (BF-27 — not surveyed rack CAD). CRM pins require{" "}
            <strong className="text-zinc-800">org.crm → view</strong> and explicit lat/lng on the account (BF-19).
          </p>

          {hasLayerOptions ? (
            <fieldset className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Map layers</legend>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-800">
                {data.pins.length > 0 ? (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showShipments}
                      onChange={(e) => setShowShipments(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span>
                      Shipments <span className="text-zinc-500">(● lane pins)</span>
                    </span>
                  </label>
                ) : null}
                {data.warehousePins.length > 0 ? (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showWarehouses}
                      onChange={(e) => setShowWarehouses(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span>
                      WMS warehouses <span className="text-zinc-500">(■ site approx.)</span>
                    </span>
                  </label>
                ) : null}
                {data.warehouseBinPins.length > 0 ? (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showWarehouseBins}
                      onChange={(e) => setShowWarehouseBins(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span>
                      WMS bins <span className="text-zinc-500">(▲ scatter near site)</span>
                    </span>
                  </label>
                ) : null}
                {data.crmAccountPins.length > 0 ? (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showCrmAccounts}
                      onChange={(e) => setShowCrmAccounts(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span>
                      CRM accounts <span className="text-zinc-500">(◆ HQ coords)</span>
                    </span>
                  </label>
                ) : null}
              </div>
            </fieldset>
          ) : null}

          {anyVisible ? (
            <ControlTowerMapLeaflet
              shipmentPins={visibleShipments}
              warehousePins={visibleWarehouses}
              warehouseBinPins={visibleWarehouseBins}
              crmPins={visibleCrm}
            />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
              {hasLayerOptions ? (
                <>All layers are hidden — enable at least one layer above.</>
              ) : (
                <>
                  No pins to show. Try fewer filters on shipments, add CRM lat/lng on account profiles (BF-19), or
                  ensure warehouses have city/country (or a name matching demo geo hints) so WMS sites — and optional
                  BF-27 bin scatter pins — can be placed.
                </>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
