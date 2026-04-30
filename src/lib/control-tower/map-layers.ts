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
