import {
  coordinatesFromLaneCode,
  greatCircleInterpolate,
  jitterLatLng,
} from "@/lib/product-trace-geo";

import type { ControlTowerShipmentListRow } from "./list-shipments";

export type ControlTowerMapPin = {
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

/**
 * Derives WGS84 pins from workbench list rows: booking/leg `originCode` + `destinationCode`
 * resolved via `product-trace-geo` (LOCODE / IATA dictionary — same approach as product trace).
 * Pin position is interpolated along the great circle by **route progress** when both ends resolve.
 * Rows with no mappable codes are skipped (the API still reports `unmappedCount`).
 */
export function buildControlTowerMapPins(rows: ControlTowerShipmentListRow[]): {
  pins: ControlTowerMapPin[];
  unmappedCount: number;
} {
  const pins: ControlTowerMapPin[] = [];
  let unmapped = 0;
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    const o = coordinatesFromLaneCode(s.originCode);
    const d = coordinatesFromLaneCode(s.destinationCode);
    let lat: number;
    let lng: number;
    if (o && d) {
      const t = Math.max(0, Math.min(1, (s.routeProgressPct ?? 50) / 100));
      const p = greatCircleInterpolate(o.lat, o.lng, d.lat, d.lng, t);
      const j = jitterLatLng(p.lat, p.lng, i, s.id);
      lat = j.lat;
      lng = j.lng;
    } else if (d) {
      const j = jitterLatLng(d.lat, d.lng, i, s.id);
      lat = j.lat;
      lng = j.lng;
    } else if (o) {
      const j = jitterLatLng(o.lat, o.lng, i, s.id);
      lat = j.lat;
      lng = j.lng;
    } else {
      unmapped += 1;
      continue;
    }
    const title = s.shipmentNo || s.orderNumber || s.id.slice(0, 8);
    const parts = [s.originCode, s.destinationCode].filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    const subtitle = parts.length > 0 ? parts.join(" → ") : "Lane TBD";
    pins.push({
      id: s.id,
      lat,
      lng,
      title,
      subtitle,
      href: `/control-tower/shipments/${s.id}`,
      routeProgressPct: s.routeProgressPct,
      openAlerts: s.openQueueCounts.openAlerts,
      openExceptions: s.openQueueCounts.openExceptions,
    });
  }
  return { pins, unmappedCount: unmapped };
}
