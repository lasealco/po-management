/**
 * Demo / fallback geography for product trace maps.
 * Prefer DB lat/lng when added later; today we resolve UN/LOCODE-ish codes and city/country text.
 * Brand primary: keep in sync with `globals.css` --arscmp-primary.
 */
export const ARSCMP_PRIMARY_HEX = "#165b67";

/** Common booking / lane codes from seed and typical flows (lat, lng). */
const LOCODE_OR_IATA: Record<string, { lat: number; lng: number }> = {
  CNSZX: { lat: 22.5431, lng: 114.0579 },
  CNNGB: { lat: 29.8683, lng: 121.544 },
  CNSHA: { lat: 31.2304, lng: 121.4737 },
  CNYTN: { lat: 22.2465, lng: 114.1733 },
  CNQIN: { lat: 36.0671, lng: 120.3826 },
  USLAX: { lat: 33.7542, lng: -118.2165 },
  USLGB: { lat: 33.7542, lng: -118.2165 },
  USNYC: { lat: 40.684, lng: -74.0064 },
  USCHI: { lat: 41.8781, lng: -87.6298 },
  USMKE: { lat: 43.0389, lng: -87.9065 },
  NLRTM: { lat: 51.9244, lng: 4.4777 },
  NLAMS: { lat: 52.3676, lng: 4.9041 },
  DEHAM: { lat: 53.5511, lng: 9.9937 },
  SZX: { lat: 22.5431, lng: 114.0579 },
  LAX: { lat: 33.7542, lng: -118.2165 },
  ORD: { lat: 41.9742, lng: -87.9073 },
  NGB: { lat: 29.8683, lng: 121.544 },
};

const CITY_COUNTRY_KEY: Record<string, { lat: number; lng: number }> = {
  "chicago|us": { lat: 41.8781, lng: -87.6298 },
  "los angeles|us": { lat: 34.0522, lng: -118.2437 },
  "shenzhen|cn": { lat: 22.5431, lng: 114.0579 },
  "rotterdam|nl": { lat: 51.9244, lng: 4.4777 },
  "milwaukee|us": { lat: 43.0389, lng: -87.9065 },
};

const NAME_HINTS: Array<{ test: RegExp; lat: number; lng: number }> = [
  { test: /shenzhen/i, lat: 22.5431, lng: 114.0579 },
  { test: /shanghai/i, lat: 31.2304, lng: 121.4737 },
  { test: /ningbo/i, lat: 29.8683, lng: 121.544 },
  { test: /rotterdam/i, lat: 51.9244, lng: 4.4777 },
  { test: /los angeles|(^|\s)la(\s|$)/i, lat: 34.0522, lng: -118.2437 },
  { test: /chicago/i, lat: 41.8781, lng: -87.6298 },
  { test: /milwaukee/i, lat: 43.0389, lng: -87.9065 },
];

function normKey(city: string | null | undefined, country: string | null | undefined) {
  return `${(city ?? "").trim().toLowerCase()}|${(country ?? "").trim().toLowerCase()}`;
}

export function normalizeLaneCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const u = code.trim().toUpperCase();
  return u.length > 0 ? u : null;
}

export function coordinatesFromLaneCode(code: string | null | undefined): { lat: number; lng: number } | null {
  const u = normalizeLaneCode(code);
  if (!u) return null;
  if (LOCODE_OR_IATA[u]) return LOCODE_OR_IATA[u];
  if (u.length >= 5 && LOCODE_OR_IATA[u.slice(0, 5)]) return LOCODE_OR_IATA[u.slice(0, 5)];
  return null;
}

export function coordinatesFromCityCountry(
  city: string | null | undefined,
  region: string | null | undefined,
  country: string | null | undefined,
): { lat: number; lng: number } | null {
  const k = normKey(city, country);
  if (CITY_COUNTRY_KEY[k]) return CITY_COUNTRY_KEY[k];
  void region;
  const cc = (country ?? "").trim().toUpperCase();
  if (cc === "US") return { lat: 39.8283, lng: -98.5795 };
  if (cc === "CN") return { lat: 35.0, lng: 105.0 };
  if (cc === "NL") return { lat: 52.1326, lng: 5.2913 };
  return null;
}

export function inferCoordinatesFromLabel(label: string | null | undefined): { lat: number; lng: number } | null {
  if (!label) return null;
  for (const h of NAME_HINTS) {
    if (h.test.test(label)) return { lat: h.lat, lng: h.lng };
  }
  return null;
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

/** Spherical linear interpolation between two WGS84 points (fraction 0..1). */
export function greatCircleInterpolate(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  fraction: number,
): { lat: number; lng: number } {
  const f = Math.max(0, Math.min(1, fraction));
  if (f <= 0) return { lat: lat1, lng: lng1 };
  if (f >= 1) return { lat: lat2, lng: lng2 };
  const φ1 = toRad(lat1);
  const λ1 = toRad(lng1);
  const φ2 = toRad(lat2);
  const λ2 = toRad(lng2);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    );
  if (d < 1e-10) return { lat: lat1, lng: lng1 };
  const a = Math.sin((1 - f) * d) / Math.sin(d);
  const b = Math.sin(f * d) / Math.sin(d);
  const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
  const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
  const z = a * Math.sin(φ1) + b * Math.sin(φ2);
  return {
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lng: toDeg(Math.atan2(y, x)),
  };
}

export function routeProgress(nowMs: number, startMs: number | null, endMs: number | null): number {
  if (endMs !== null && startMs !== null && endMs > startMs) {
    const t = (nowMs - startMs) / (endMs - startMs);
    return Math.max(0, Math.min(1, t));
  }
  if (endMs !== null && startMs === null && endMs > nowMs) return 0.35;
  if (endMs !== null && startMs === null && endMs <= nowMs) return 1;
  return 0.45;
}

export function jitterLatLng(lat: number, lng: number, index: number, salt: string) {
  let h = 0;
  for (let i = 0; i < salt.length; i += 1) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
  const angle = ((index + (h % 360)) / 360) * 2 * Math.PI;
  const r = 0.35 + (index % 5) * 0.12;
  return {
    lat: lat + Math.cos(angle) * r * 0.08,
    lng: lng + Math.sin(angle) * r * 0.08,
  };
}
