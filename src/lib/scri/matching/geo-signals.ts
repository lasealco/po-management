import type { ScriEventGeography } from "@prisma/client";

export type GeoMatchSignals = {
  countries: Set<string>;
  unlocs: Set<string>;
  regionTerms: string[];
};

export function buildGeoSignalsFromGeographies(geos: ScriEventGeography[]): GeoMatchSignals {
  const countries = new Set<string>();
  const unlocs = new Set<string>();
  const regionTerms: string[] = [];

  for (const g of geos) {
    if (g.countryCode?.trim()) {
      countries.add(g.countryCode.trim().toUpperCase());
    }
    if (g.portUnloc?.trim()) {
      unlocs.add(g.portUnloc.trim().toUpperCase());
    }
    if (g.region?.trim()) {
      regionTerms.push(g.region.trim().toLowerCase());
    }
  }

  return { countries, unlocs, regionTerms };
}

export function normUnloc(code: string | null | undefined): string | null {
  if (code == null || !String(code).trim()) return null;
  return String(code).trim().toUpperCase();
}

export function normCountry(code: string | null | undefined): string | null {
  if (code == null || !String(code).trim()) return null;
  return String(code).trim().toUpperCase();
}

export function regionLooselyMatches(shipToRegion: string | null | undefined, regionTerms: string[]): boolean {
  if (!shipToRegion?.trim() || regionTerms.length === 0) return false;
  const r = shipToRegion.trim().toLowerCase();
  return regionTerms.some((t) => t.length > 0 && (r.includes(t) || t.includes(r)));
}
