import {
  coordinatesFromCityCountry,
  inferCoordinatesFromLabel,
  jitterLatLng,
} from "@/lib/product-trace-geo";

/** BF-11 — WMS warehouse footprint pins on CT map (city/country/name heuristic; not rack geometry). */
export type WarehouseMapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  href: string;
};

export type WarehouseForMapPin = {
  id: string;
  code: string | null;
  name: string;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

export function buildWarehouseMapPins(rows: WarehouseForMapPin[]): WarehouseMapPin[] {
  const out: WarehouseMapPin[] = [];
  rows.forEach((w, i) => {
    const coord =
      coordinatesFromCityCountry(w.city, w.region, w.countryCode) ??
      inferCoordinatesFromLabel(w.name) ??
      (w.code ? inferCoordinatesFromLabel(w.code) : null);
    if (!coord) return;
    const j = jitterLatLng(coord.lat, coord.lng, i + 4000, w.id);
    const title = w.code ? `${w.code} · ${w.name}` : w.name;
    const parts = [w.city, w.region, w.countryCode].filter((x): x is string => Boolean(x && String(x).trim()));
    const subtitle =
      parts.length > 0 ? `${parts.join(", ")} · approx. site` : "Warehouse site (approx. from demo geo)";
    out.push({
      id: w.id,
      lat: j.lat,
      lng: j.lng,
      title,
      subtitle,
      href: "/wms/setup",
    });
  });
  return out;
}

/** BF-19 — CRM account pins when tenant ops explicitly sets WGS84 on `CrmAccount` (optional privacy default). */
export type CrmAccountMapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  href: string;
};

export type CrmAccountForMapPin = {
  id: string;
  name: string;
  legalName: string | null;
  mapLatitude: unknown;
  mapLongitude: unknown;
};

function coordComponent(v: unknown): number | null {
  if (v == null) return null;
  const n =
    typeof v === "object" &&
    v !== null &&
    "toNumber" in v &&
    typeof (v as { toNumber?: unknown }).toNumber === "function"
      ? (v as { toNumber: () => number }).toNumber()
      : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function buildCrmAccountMapPins(rows: CrmAccountForMapPin[]): CrmAccountMapPin[] {
  const out: CrmAccountMapPin[] = [];
  rows.forEach((a, i) => {
    const lat = coordComponent(a.mapLatitude);
    const lng = coordComponent(a.mapLongitude);
    if (lat == null || lng == null || !isValidLatLng(lat, lng)) return;
    const j = jitterLatLng(lat, lng, i + 7000, a.id);
    const title = a.legalName?.trim() ? `${a.name} (${a.legalName.trim()})` : a.name;
    out.push({
      id: a.id,
      lat: j.lat,
      lng: j.lng,
      title,
      subtitle: "CRM account HQ · approximate pin",
      href: `/crm/accounts/${a.id}`,
    });
  });
  return out;
}

/**
 * BF-27 — warehouse-bin pins clustered near BF-11 site coords (deterministic jitter; not surveyed CAD).
 * Exported for unit tests.
 */
export function warehouseBinScatterCoordinate(
  siteLat: number,
  siteLng: number,
  warehouseId: string,
  binId: string,
): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < binId.length; i += 1) h = (h * 31 + binId.charCodeAt(i)) >>> 0;
  const idx = 11_000 + (h % 6000);
  const raw = jitterLatLng(siteLat, siteLng, idx, `${warehouseId}\t${binId}`);
  const scale = 0.26;
  return {
    lat: siteLat + (raw.lat - siteLat) * scale,
    lng: siteLng + (raw.lng - siteLng) * scale,
  };
}

export type WarehouseBinMapPin = {
  id: string;
  warehouseId: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  href: string;
};

export type WarehouseBinForMapPin = {
  id: string;
  warehouseId: string;
  code: string;
  rackCode: string | null;
  aisle: string | null;
  bay: string | null;
  level: number | null;
  positionIndex: number | null;
};

export function buildWarehouseBinMapPins(
  bins: WarehouseBinForMapPin[],
  warehouseSiteCoordsByWarehouseId: Map<string, { lat: number; lng: number }>,
): WarehouseBinMapPin[] {
  const out: WarehouseBinMapPin[] = [];
  for (const b of bins) {
    const site = warehouseSiteCoordsByWarehouseId.get(b.warehouseId);
    if (!site) continue;
    const coord = warehouseBinScatterCoordinate(site.lat, site.lng, b.warehouseId, b.id);
    const addrParts = [
      b.rackCode ? `rack ${b.rackCode}` : null,
      b.aisle ? `aisle ${b.aisle}` : null,
      b.bay ? `bay ${b.bay}` : null,
      b.level != null ? `lvl ${b.level}` : null,
      b.positionIndex != null ? `#${b.positionIndex}` : null,
    ].filter((x): x is string => Boolean(x));
    const addressing = addrParts.length > 0 ? addrParts.join(" · ") : "address fields unset · scatter-only pin";
    out.push({
      id: b.id,
      warehouseId: b.warehouseId,
      lat: coord.lat,
      lng: coord.lng,
      title: `${b.code} · bin`,
      subtitle: `${addressing} · approximate offset from WMS site (BF-27 — not surveyed geometry)`,
      href: "/wms/setup",
    });
  }
  return out;
}
