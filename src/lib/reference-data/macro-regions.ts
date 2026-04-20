/** Optional macro-region tags for `ReferenceCountry.regionCode` (tariff lanes, reporting). */
export const REFERENCE_MACRO_REGIONS = [
  "",
  "NA",
  "LATAM",
  "EU",
  "MEA",
  "APAC",
  "OCE",
  "OTHER",
] as const;

export type ReferenceMacroRegion = (typeof REFERENCE_MACRO_REGIONS)[number];

export function isMacroRegion(value: string): value is ReferenceMacroRegion {
  return (REFERENCE_MACRO_REGIONS as readonly string[]).includes(value);
}
