import type { Prisma } from "@prisma/client";

export type NormalizedGeoRow = {
  countryCode: string | null;
  region: string | null;
  portUnloc: string | null;
  label: string | null;
  raw?: Prisma.InputJsonValue;
};

/**
 * Normalize geography rows at ingest: ISO-2 uppercase, UN/LOC uppercase, trim text.
 * Invalid ISO-2 is cleared and noted under `raw.invalidCountryCode` when possible.
 */
export function normalizeIngestGeography(g: {
  countryCode?: string | null;
  region?: string | null;
  portUnloc?: string | null;
  label?: string | null;
  raw?: Record<string, unknown> | null;
}): NormalizedGeoRow {
  const rawBase =
    g.raw && typeof g.raw === "object" && !Array.isArray(g.raw)
      ? { ...g.raw }
      : ({} as Record<string, unknown>);

  const originalCountry = g.countryCode?.trim() || null;
  const upperCountry = originalCountry ? originalCountry.toUpperCase() : null;
  const validCountry = upperCountry && /^[A-Z]{2}$/.test(upperCountry) ? upperCountry : null;
  if (originalCountry && !validCountry) {
    rawBase.invalidCountryCode = originalCountry;
  }

  let port = g.portUnloc?.trim().toUpperCase().replace(/\s+/g, "") || null;
  if (port && port.length > 8) port = port.slice(0, 8);

  let region = g.region?.trim().replace(/\s+/g, " ") || null;
  if (region && region.length > 128) region = region.slice(0, 128);

  let label = g.label?.trim().replace(/\s+/g, " ") || null;
  if (label && label.length > 256) label = label.slice(0, 256);

  const rawKeys = Object.keys(rawBase);
  const rawJson: Prisma.InputJsonValue | undefined =
    rawKeys.length > 0 ? (rawBase as Prisma.InputJsonValue) : undefined;

  const out: NormalizedGeoRow = {
    countryCode: validCountry,
    region,
    portUnloc: port,
    label,
  };
  if (rawJson !== undefined) out.raw = rawJson;
  return out;
}
