/**
 * Indicative shipment CO₂e (planning / UI — not audited carbon accounting).
 *
 * - Distance: Haversine between known UN/LOCODE or IATA coordinates when both ends resolve;
 *   else duration × mode default speed when ETD/ATA windows exist.
 * - Mass: chargeable weight (if set) → estimated shipment weight → sum of line-level cargo gross kg.
 * - Emissions: kg CO₂e ≈ (tonne·km) × mode factor (well-to-wheels style ballpark; replace with your methodology).
 */

const EARTH_RADIUS_KM = 6371;

/** kg CO₂e per tonne·km — order-of-magnitude defaults for product planning (not regulatory claims). */
const KG_CO2E_PER_TONNE_KM: Record<string, number> = {
  OCEAN: 0.018,
  AIR: 0.82,
  ROAD: 0.09,
  RAIL: 0.03,
};

/** Used when coordinates are unknown but schedule window exists (very rough). */
const DEFAULT_SPEED_KMH: Record<string, number> = {
  OCEAN: 38,
  AIR: 720,
  ROAD: 55,
  RAIL: 45,
};

/** Approximate centroids (degrees). Extend as you onboard lanes. */
const LOCATION_COORDS: Record<string, { lat: number; lon: number }> = {
  // China
  CNSHA: { lat: 31.23, lon: 121.47 },
  CNSZX: { lat: 22.54, lon: 114.06 },
  CNNGB: { lat: 29.87, lon: 121.55 },
  CNQIN: { lat: 36.07, lon: 120.32 },
  CNTXG: { lat: 39.08, lon: 117.72 },
  CNXMN: { lat: 24.48, lon: 118.09 },
  // US
  USLAX: { lat: 33.94, lon: -118.41 },
  USLGB: { lat: 33.75, lon: -118.22 },
  USNYC: { lat: 40.68, lon: -74.0 },
  USCHI: { lat: 41.88, lon: -87.63 },
  USHOU: { lat: 29.73, lon: -95.27 },
  USSEA: { lat: 47.45, lon: -122.31 },
  USATL: { lat: 33.64, lon: -84.43 },
  // Europe
  NLRTM: { lat: 51.92, lon: 4.48 },
  BEANR: { lat: 51.22, lon: 4.4 },
  DEHAM: { lat: 53.55, lon: 9.99 },
  DEWVN: { lat: 53.59, lon: 8.12 },
  GBFXT: { lat: 51.95, lon: 1.31 },
  FRLEH: { lat: 49.49, lon: 0.11 },
  ESALG: { lat: 36.83, lon: -2.45 },
  ITGOA: { lat: 44.41, lon: 8.92 },
  // Asia / Oceania
  SGSIN: { lat: 1.26, lon: 103.82 },
  HKHKG: { lat: 22.29, lon: 114.16 },
  JPTYO: { lat: 35.45, lon: 139.78 },
  JPYOK: { lat: 35.44, lon: 139.64 },
  KRPUS: { lat: 35.1, lon: 129.04 },
  VNSGN: { lat: 10.72, lon: 106.72 },
  THBKK: { lat: 13.69, lon: 100.5 },
  MYPKG: { lat: 5.42, lon: 100.33 },
  AUMEL: { lat: -37.84, lon: 144.95 },
  AUSYD: { lat: -33.97, lon: 151.18 },
  // IATA (subset overlaps ocean — use for air legs)
  LAX: { lat: 33.94, lon: -118.41 },
  JFK: { lat: 40.64, lon: -73.78 },
  ORD: { lat: 41.98, lon: -87.9 },
  AMS: { lat: 52.31, lon: 4.76 },
  FRA: { lat: 50.04, lon: 8.57 },
  SZX: { lat: 22.54, lon: 114.06 },
  PVG: { lat: 31.14, lon: 121.8 },
  HKG: { lat: 22.31, lon: 113.92 },
  SIN: { lat: 1.36, lon: 103.99 },
};

export type ShipmentEmissionsLegRow = {
  legNo: number;
  originCode: string | null;
  destinationCode: string | null;
  mode: string | null;
  distanceKm: number | null;
  distanceSource: "coordinates" | "time_speed" | "none";
  kgCo2e: number | null;
};

export type ShipmentEmissionsSummary = {
  tonnageKg: number | null;
  tonnageSource: "chargeable" | "estimated_shipment" | "sum_line_cargo" | "none";
  legs: ShipmentEmissionsLegRow[];
  totalKgCo2e: number | null;
  totalDistanceKm: number | null;
  methodology: string;
};

function normalizeLocationCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  return t.length >= 2 ? t : null;
}

function coordsFor(code: string | null | undefined): { lat: number; lon: number } | null {
  const k = normalizeLocationCode(code);
  if (!k) return null;
  return LOCATION_COORDS[k] ?? null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_KM * c;
}

function modeKey(mode: string | null | undefined, fallback: string | null | undefined): string {
  const m = (mode || fallback || "OCEAN").toUpperCase();
  return KG_CO2E_PER_TONNE_KM[m] != null ? m : "OCEAN";
}

function parseDecimalKg(v: { toString(): string } | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function resolveTonnageKg(input: {
  cargoChargeableWeightKg: { toString(): string } | null | undefined;
  estimatedWeightKg: { toString(): string } | null | undefined;
  lineCargoGrossKg: Array<{ toString(): string } | null | undefined>;
}): { kg: number | null; source: ShipmentEmissionsSummary["tonnageSource"] } {
  const ch = parseDecimalKg(input.cargoChargeableWeightKg ?? null);
  if (ch != null) return { kg: ch, source: "chargeable" };
  const est = parseDecimalKg(input.estimatedWeightKg ?? null);
  if (est != null) return { kg: est, source: "estimated_shipment" };
  let sum = 0;
  let any = false;
  for (const w of input.lineCargoGrossKg) {
    const x = parseDecimalKg(w ?? null);
    if (x != null) {
      sum += x;
      any = true;
    }
  }
  if (any && sum > 0) return { kg: sum, source: "sum_line_cargo" };
  return { kg: null, source: "none" };
}

function legWindowHours(leg: {
  plannedEtd: Date | null;
  plannedEta: Date | null;
  actualAtd: Date | null;
  actualAta: Date | null;
}): number | null {
  const start = leg.actualAtd ?? leg.plannedEtd;
  const end = leg.actualAta ?? leg.plannedEta;
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms / 3_600_000;
}

type LegInput = {
  legNo: number;
  originCode: string | null;
  destinationCode: string | null;
  transportMode: string | null;
  plannedEtd: Date | null;
  plannedEta: Date | null;
  actualAtd: Date | null;
  actualAta: Date | null;
};

function distanceKmForLeg(leg: LegInput, shipmentMode: string | null): { km: number | null; source: ShipmentEmissionsLegRow["distanceSource"] } {
  const o = coordsFor(leg.originCode);
  const d = coordsFor(leg.destinationCode);
  if (o && d) {
    return { km: Math.round(haversineKm(o.lat, o.lon, d.lat, d.lon) * 10) / 10, source: "coordinates" };
  }
  const hours = legWindowHours(leg);
  const mode = modeKey(leg.transportMode, shipmentMode);
  const spd = DEFAULT_SPEED_KMH[mode];
  if (hours != null && spd) {
    return { km: Math.round(hours * spd * 10) / 10, source: "time_speed" };
  }
  return { km: null, source: "none" };
}

export function computeShipmentEmissionsSummary(input: {
  legs: LegInput[];
  shipmentTransportMode: string | null;
  cargoChargeableWeightKg: { toString(): string } | null | undefined;
  estimatedWeightKg: { toString(): string } | null | undefined;
  lineCargoGrossKg: Array<{ toString(): string } | null | undefined>;
}): ShipmentEmissionsSummary {
  const { kg: tonnageKg, source: tonnageSource } = resolveTonnageKg({
    cargoChargeableWeightKg: input.cargoChargeableWeightKg,
    estimatedWeightKg: input.estimatedWeightKg,
    lineCargoGrossKg: input.lineCargoGrossKg,
  });

  const legsOut: ShipmentEmissionsLegRow[] = [];
  let totalKm = 0;
  let totalKg: number | null = null;

  for (const leg of input.legs) {
    const { km, source } = distanceKmForLeg(leg, input.shipmentTransportMode);
    const mode = modeKey(leg.transportMode, input.shipmentTransportMode);
    const factor = KG_CO2E_PER_TONNE_KM[mode] ?? KG_CO2E_PER_TONNE_KM.OCEAN;
    const tonnes = tonnageKg != null ? tonnageKg / 1000 : null;
    let kgCo2e: number | null = null;
    if (km != null) {
      totalKm += km;
      if (tonnes != null && tonnes > 0) {
        kgCo2e = Math.round(km * tonnes * factor * 1000) / 1000;
      }
    }
    legsOut.push({
      legNo: leg.legNo,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      mode,
      distanceKm: km,
      distanceSource: source,
      kgCo2e,
    });
  }

  const sumCo2 = legsOut.reduce((a, r) => a + (r.kgCo2e ?? 0), 0);
  totalKg = sumCo2 > 0 ? Math.round(sumCo2 * 1000) / 1000 : null;

  const methodology =
    "Indicative CO₂e: tonne·km × mode factor (planning defaults). Distance = great-circle when origin/destination " +
    "codes match an internal coordinate table, else schedule duration × default speed. Not audited carbon accounting — " +
    "replace factors with your methodology before customer-facing compliance.";

  return {
    tonnageKg,
    tonnageSource: tonnageSource,
    legs: legsOut,
    totalKgCo2e: totalKg,
    totalDistanceKm: legsOut.some((l) => l.distanceKm != null) ? Math.round(totalKm * 10) / 10 : null,
    methodology,
  };
}
