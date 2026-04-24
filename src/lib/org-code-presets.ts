import type { OrgUnitKind } from "@prisma/client";

/** Standard region / macro codes (uppercase, hyphenated allowed in normalizer). */
export const ORG_CODE_PRESETS_REGION = [
  "EMEA",
  "APAC",
  "AMER",
  "AMERICAS",
  "LATAM",
  "MEA",
  "OCE",
  "AFRICA",
  "EU",
  "NA",
  "ANZ",
  "GCC",
  "DACH",
  "BENELUX",
  "NORDICS",
] as const;

/** Top-of-tree group / global nodes (keep distinct from `ORG_CODE_PRESETS_FACILITY` to avoid code clashes per tenant). */
export const ORG_CODE_PRESETS_GROUP = ["GLOBAL", "CORP", "HOLDING", "GROUP", "ENT"] as const;

/** Common site / facility codes (user may still use custom validated code). */
export const ORG_CODE_PRESETS_FACILITY = [
  "HQ",
  "DC1",
  "DC2",
  "WH1",
  "PLANT1",
  "PLANT2",
  "OFFICE1",
  "SITE1",
] as const;

const REGION_SET = new Set<string>(ORG_CODE_PRESETS_REGION);
const GROUP_SET = new Set<string>(ORG_CODE_PRESETS_GROUP);

export function isPresetRegionCode(code: string): boolean {
  return REGION_SET.has(code.trim().toUpperCase());
}

export function isPresetGroupCode(code: string): boolean {
  return GROUP_SET.has(code.trim().toUpperCase());
}

/**
 * Server-side: whether this kind must use a dropdown-only code path in the UI.
 * LEGAL_ENTITY / SITE / OFFICE may still use normalized custom codes.
 */
export function orgUnitKindUsesStrictPresetOnly(kind: OrgUnitKind): boolean {
  return kind === "REGION" || kind === "GROUP" || kind === "COUNTRY";
}
